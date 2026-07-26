# 自分専用Market Finder Webアプリ化 設計

## 目的

Market FinderをCodexの起動状態やトークン残量に依存せず、Chromeから専用URLを開くだけで使える自分専用Webアプリにする。

同時に、現在の調査順と表示文言を整理する。ただし、売れる可能性の判定根拠は減らさない。Etsy公式Marketplace InsightsとEverBeeの実測が揃っている候補は、eRankがなくても現在と同じOpportunity・Confidence判定を維持する。

## 成功条件

- Codexを起動しなくてもWebアプリへアクセスできる。
- 指定した自分のアカウント以外は調査データを閲覧・更新できない。
- Chrome拡張からEtsy Marketplace InsightsとEverBeeを自動取得できる。
- 調査履歴、探索経路、評価結果がSupabaseへ保存され、PCやブラウザを再起動しても復元できる。
- Etsy公式とEverBeeのデータが同一なら、Web化前後でOpportunity、Confidence、総合点が変わらない。
- eRank未取得だけを理由に、Etsy公式とEverBeeが揃った候補の点数や判定を下げない。
- 現在のJSONアーカイブとCSVは移行・再利用できる。

## 対象外

- 複数ユーザー向けSaaS化、課金、管理者画面。
- Etsy、EverBee、eRankへのサーバー側ログインやサーバー側スクレイピング。
- Chrome拡張の廃止。
- 売上の保証。
- eRank関連コードや過去データの削除。

## 推奨アーキテクチャ

### Webフロントエンド

現在の静的Market FinderをCloudflare Pagesへ配置する。公開URLはSupabase Authのログイン後だけ調査画面を表示する。

ローカル版も開発・緊急時の予備として残す。公開版とローカル版は同じフロントエンドコードと判定エンジンを使う。

### データ保存

ローカルサーバーの `/market-finder/archive` を、Supabase保存アダプターへ置き換える。

初期実装では既存のVersion 3アーカイブをそのままJSONBで保存する。データを細かいテーブルへ分割せず、既存形式を壊さない。

`market_finder_research_runs`

- `id`: UUID
- `user_id`: Supabase AuthのユーザーID
- `run_id`: Market Finderの調査ID
- `payload`: Version 3アーカイブ全体のJSONB
- `created_at`
- `updated_at`

`user_id + run_id`を一意にし、同じ調査の再保存は上書きする。RLSで`auth.uid() = user_id`の行だけを読み書きできるようにする。新規ユーザー登録は無効化し、自分の1アカウントだけを用意する。

Supabase障害や一時的なオフライン時は、保存待ちデータをブラウザ内に残し、次回接続時に再送する。

### Chrome拡張

拡張機能は次の役割だけを担当する。

- ログイン済みEtsy画面からMarketplace Insightsを取得
- ログイン済みEverBee画面から競合・販売実績を取得
- 任意実行時だけeRankを取得
- 取得結果を開いているMarket Finderへ返す

本番URLを`manifest.json`の`host_permissions`とMarket Finder Bridgeの`matches`へ追加する。`localhost`と`127.0.0.1`は開発用として残す。

EtsyやEverBeeのログイン情報はSupabaseへ送らない。拡張機能は表示ページから必要な調査結果だけを返す。

進行中ジョブは`chrome.storage.local`へ保存し、Manifest V3 Service Workerの停止やChrome再起動後に状態を復元できるようにする。

## 調査フロー

通常画面は次の5ステップとする。

1. 条件
2. 候補
3. Etsy公式
4. EverBee
5. 最終結果

eRankは通常ステップから外し、最終結果または上級者向けパネルの「eRankで追加確認」に移す。

eRank追加確認の対象は次に限定する。

- Etsy公式の検索数または出品数がUnknown
- 季節推移を確認したい
- A/BまたはB/Cの判定境界
- 関連語を追加探索したい
- Etsy公式とEverBeeの信号が矛盾する

## 添付画面の文言修正

現在のeRank結果画面では、`salesCheckKeywords()`が返す20件はEtsy公式確認候補ではなく、次のEverBee売上確認候補である。

表示を次のように変更する。

- `Etsy確認へ`を`EverBee優先候補`へ変更
- `Etsy公式確認候補を20件に絞りました`を`Etsy公式確認済みの20件をEverBeeへ送ります`へ変更
- eRank結果件数、追加探索候補、保留候補は参考情報として折りたたむ
- 主操作は`EverBeeで売上を確認する`だけを強調する

## 売れる可能性の判定を守る条件

主要判定は次の根拠を維持する。

### 需要・供給

- Etsy直近30日の検索数
- Etsy出品数
- Etsy関連検索語

### 販売実績

- EverBee競合数
- 販売中の商品数
- 最近売れている商品数
- 月間販売中央値
- 売上の単一商品集中率
- 商品年齢

### 安全性・鮮度

- 商標、人物、キャラクターなどのリスク語
- EtsyとEverBeeの取得日
- データ欠損

Etsy公式の検索数・出品数とEverBee集計が新しい状態で揃えば、eRankなしでもHigh ConfidenceとA/B判定を許可する。これは現在の共有キーワードエンジンの判定方針を変えない。

eRankは次の場合だけ需要・供給の代替ソースとして使用する。

- Etsy公式コアデータが取得できない
- 過去12か月程度の季節傾向を補いたい
- 別ソースとの整合性を確認したい

## データ移行

- 現在の`market-finder/archive/*.json`をSupabaseへ読み込む管理用スクリプトを用意する。
- 同じ`run_id`は重複登録せず上書きする。
- 読み込み後もローカルJSONは削除しない。
- CSVの列と未来デザイナー連携は維持する。

## エラー表示

- 拡張機能未接続: Webアプリは開けるが外部取得ボタンだけ無効化する。
- Etsy/EverBee未ログイン: 対象サイトへのログイン案内を出し、候補と過去結果は保持する。
- Supabase未接続: ローカル保存待ちとして保持し、調査を止めない。
- データUnknown: 失敗と断定せず、Unknownまたは追加確認対象として扱う。
- eRank未契約・上限到達: 通常フローには影響させない。

## 検証

### スコア回帰

- Etsy公式＋EverBeeが同一なら、Web化前後で総合点・Opportunity・Confidenceが一致する。
- eRank列を空にしても、Etsy公式＋EverBeeが揃ったA/B候補の判定が下がらない。
- Etsy公式が欠損した場合は、eRank＋EverBeeで現在の代替判定が動く。
- Etsy公式もeRankもない候補はA/Bへ昇格しない。

### 保存

- 同じ`run_id`の再保存が上書きになる。
- 別の調査は別レコードになる。
- RLSで他ユーザーIDのデータを取得できない。
- オフライン保存待ちが再接続後に送信される。

### 実画面

- 公開URLでログイン、調査復元、拡張接続を確認する。
- Etsy公式からEverBee、最終結果まで進める。
- eRankなしで最終結果と未来デザイナーCSVを出力できる。
- ローカル版も継続して起動できる。

## 実装順

1. eRank画面の誤った説明を修正し、5ステップをEtsy公式→EverBeeへ整理
2. スコア回帰テストにeRankなしケースを追加
3. Supabase Authとアーカイブ保存アダプターを追加
4. 既存JSONの移行スクリプトを追加
5. Chrome拡張へ本番URLとジョブ復元を追加
6. Cloudflare Pagesへ公開し、本番URLで一連の調査を確認

