# Market Finder Opportunity Model Design

作成日: 2026-07-19
状態: ユーザー承認済み方針を設計へ反映

## 1. 目的

Market Finderを、米国Etsy向けの英語キーワードを調査し、シャツ・スウェット中心のPOD商品で「調査する価値が高いニッチ」を絞るツールへ改善する。

売上保証や擬似的な成功確率は出さない。代わりに、需要、供給、複数商品の販売実績、鮮度、安全性を分けて示し、根拠が揃った候補だけを上位へ出す。

## 2. 初期対象と非対象

### 初期対象

- 米国Etsy向けの英語キーワード
- プリントオンデマンド
- Shirt / T-shirt / Tee
- Sweatshirt / Crewneck / Hoodie
- eRankによる需要・競合確認
- EverBeeによる商品販売実績確認
- Etsy向けタイトルと13タグの下書き

### 今回の非対象

- Etsy Marketplace Insightsの自動画面操作
- Marketplace Insightsを必須とする判定
- 売上確率の表示
- マグ、ウォールアート、トートバッグの詳細スコア最適化
- ステッカー対応
- USPTOなど外部商標データベースの自動検索

Marketplace Insightsは無料枠の消費を避けるため、今回は任意の手入力データ源として拡張可能な項目だけ用意する。公式の無料枠は週15検索で、Etsy Plusは無制限。

## 3. 現状の問題

### 3.1 指標の役割が混ざっている

現在はEverBeeの `Listings Analyzed` を競合数として扱い、代表商品の月間販売数を割って販売密度を計算している。しかしEverBee Product Analyticsの販売数・収益・掲載期間は商品単位の推定値であり、キーワード競合はTag Analytics側の別指標である。

このため、以下の値は廃止する。

- `Top Monthly Sales / Listings Analyzed`
- `Top Revenue / Listings Analyzed`
- `Listings Analyzed`だけを根拠にした低競合判定

### 3.2 一商品だけの成功を市場需要と誤認しやすい

現在は画面上の代表商品一件が売れていれば、EverBee側を肯定的に扱える。一つのヒット商品、強いショップ、古いベストセラーだけを市場全体の証拠として扱わないようにする。

### 3.3 古い入口データが新しく見える

検索種データは2026-05-23取得だが、自動探索時に実行日時が付け直される。元の取得日時を保持し、古いデータを新規取得のように表示しない。

### 3.4 候補生成が定型的で不自然

`recipient + gift + product` の組み合わせが多く、`cat dad gift wall art` のような購買検索として不自然な候補を作る。`gift` は自動付与せず、実データで確認された場合だけ候補へ残す。

### 3.5 SEOタイトルが現在のEtsy方針とずれる

現在は複数キーワードを140文字近くまで並べる。タイトルは15語未満を目安にし、商品名を一度だけ明示し、確認できた客観的特徴を前半へ置く。贈り物表現、受取人、イベントは商品に不可欠な場合だけタイトルへ入れ、それ以外はタグへ回す。

## 4. データソースの役割

| ソース | 役割 | 判定への使用 | 鮮度 |
|---|---|---|---|
| eRank Keyword Tool | 検索需要、クリック、CTR、競合、KD、長期季節性 | 使用する | 取得日時を保存 |
| EverBee Product Analytics | 複数商品の推定販売実績、収益、掲載期間 | 使用する | 取得日時を保存 |
| Etsy Marketplace Insights | 直近30日の公式検索数、商品数、関連語 | 将来の任意入力 | 30日データ |
| 保存済み検索種CSV | 広い入口の発想 | 発想のみ | 元の取得日時を保持 |
| Pinterest / Google Trends | モチーフや話題の発想 | 発想のみ | eRank確認前は昇格不可 |
| eRank Trend Buzz | Etsy内トレンドの入口 | 発想のみ | Keyword Tool確認前は昇格不可 |

全データに以下の共通情報を持たせる。

- `sourceType`
- `sourceLabel`
- `capturedAt`
- `freshnessDays`
- `sourceConfidence`
- `sourceKeyword`

鮮度の初期ルール:

- 30日以内: 新しい
- 31〜45日: 使用可能
- 46〜90日: 発想用のみ
- 91日超: 自動候補へ入れず、手動選択時だけ使用

## 5. 候補生成

### 5.1 商品語を分離する

初期の商品設定を次の二系統に分ける。

- Shirt family: `shirt`, `t shirt`, `tshirt`, `tee`
- Sweatshirt family: `sweatshirt`, `crewneck`, `hoodie`

異なる商品系統を同一候補へ混在させない。将来のマグ、ウォールアート、トートバッグも、商品別設定を追加して対応する。

### 5.2 検索語の構造

候補は次の要素から作る。

- Identity: mom, dad, teacher, nurseなど
- Hobby / Work: pickleball, gardening, librarianなど
- Situation / Occasion: retirement, first day of school, family reunionなど
- Motif / Style: ghost, floral, retro, westernなど
- Product: shirtまたはsweatshirt系の商品語

一候補に入れる具体要素は原則1〜2個とし、最低一つはeRank、EverBee商品タイトル、または鮮度内の検索種データで確認された語句にする。

固定テンプレートは入口生成にだけ使い、次の状態へ直接昇格させない。

1. `idea`: 発想のみ
2. `demand-checked`: eRank需要確認済み
3. `sales-checked`: EverBee販売確認済み
4. `opportunity`: 必要な根拠が揃った候補
5. `reject`: リスク、商品違い、データ不備などで除外

### 5.3 ニッチ単位の重複整理

同じ具体語を共有する候補を一つのクラスターへまとめる。例えば以下は `pickleball mom` クラスターとして扱う。

- pickleball mom shirt
- funny pickleball mom tee
- retro pickleball mom shirt

一覧ではクラスターごとの代表候補を優先し、似た語句だけで上位枠を埋めない。代表候補は、データ鮮度、需要、競合、販売実績、自然な語順の順で決める。

## 6. EverBee販売証拠

代表商品一件ではなく、画面から読めた商品群を集計する。

追加する集計値:

- `visibleListingCount`
- `sellingListingCount`
- `recentSellingListingCount`
- `medianMonthlySales`
- `medianMonthlyRevenue`
- `totalVisibleMonthlySales`
- `topMonthlySales`
- `topSalesShare`
- `medianListingAgeMonths`

`recentSellingListingCount` は、掲載2〜18か月かつ月間販売が1以上の商品数とする。閾値は実データ検証後に調整可能にする。

`topSalesShare` は、見えている商品の推定月間販売合計に対する最大商品の比率とする。70%以上なら一商品集中として注意扱いにし、最優先候補へは昇格させない。

EverBeeの値は推定値であることを画面とCSVに残す。

## 7. 判定モデル

一つの合計点だけで判断せず、`Opportunity` と `Confidence` を分ける。

### Opportunity

- Demand: 検索数、クリック、CTR
- Supply: eRank CompetitionまたはKD
- Sales breadth: 売れている商品数、最近売れている商品数、中央値
- Momentum: 最近の商品が複数売れているか
- Timing: イベント出品時期に合うか
- Safety: リスク語句、商品違い、固有名詞の疑い

### Confidence

- High: 需要、供給、複数商品の販売実績、鮮度が揃う
- Medium: 一部が未取得だが、需要または販売実績に複数の根拠がある
- Low: 発想用ソースだけ、古いデータだけ、単一商品だけ

### 初期ラベル

- A: 直接テスト候補
- B: 小さく試す候補
- C: 派生探索
- D: 見送り

Aの必須条件:

- リスク語句と商品不一致がない
- eRankの `Average Searches >= 100` または `Average Clicks >= 30`
- `KD <= 45` または `Competition < 20,000`
- `recentSellingListingCount >= 2`、または `sellingListingCount >= 3` かつ月間販売中央値が1以上
- 見えている月間販売合計がある場合、`topSalesShare < 0.70`
- eRankとEverBeeの取得日が45日以内
- ConfidenceがHigh

Bは、需要または販売実績が強いが、もう一方が弱い、欠ける、またはConfidenceがMediumの場合とする。

不足データを0として扱わない。未取得は未取得としてConfidenceを下げる。

## 8. 季節と出品タイミング

イベント月を使い、次の目安を表示する。

- 準備: イベントの10〜16週前
- 出品推奨: 4〜10週前
- 遅め: 4週未満
- 次回向け: イベント通過後

これは需要証拠の代替にはせず、同程度の候補を並べる時の優先順位と注意表示に使う。年号は `class of`, `est`, `first`, `new mom`, `new dad` など年が購買意図になる場合だけ残す。

## 9. SEO出力

### タイトル

- 15語未満を目安にする
- 商品名は一回だけ
- 最も重要な具体語を前半へ置く
- 同じ単語を繰り返さない
- 商品データにない素材、サイズ、製法を作らない
- `gift for`, `perfect gift`, `birthday present` などは原則タイトルへ入れない
- イベントや受取人は商品に不可欠な場合だけ含める

### タグ

- 13個を使う
- 20文字以内
- 複数語の自然なフレーズを優先する
- タイトル、カテゴリ、属性で完全に重複する語だけに偏らない
- Identity、Hobby / Work、Situation、Motif / Style、Productを分散させる
- 単独の年号タグは作らない

## 10. 実績フィードバック

本当の売れやすさは出品後データでしか確認できないため、調査時点の証拠と30日後の結果を結び付けられるCSVを用意する。

初期項目:

- `researchedAt`
- `keyword`
- `clusterKey`
- `opportunityLabel`
- `confidenceLabel`
- `sourceSnapshot`
- `launchedAt`
- `listingId`
- `impressions30d`
- `visits30d`
- `favorites30d`
- `orders30d`
- `revenue30d`
- `notes`

第一段階ではテンプレート出力だけ用意し、自動でEtsy Statsへ接続しない。20〜50件の実績がたまったら、A/B閾値を再調整する。

## 11. 将来カテゴリの拡張

商品カテゴリは設定オブジェクトへまとめる。

- 商品名と別名
- 禁止する他商品語
- 関連する用途・モチーフ
- 価格帯の参考値
- タイトルで必要な客観的特徴
- 季節性
- 利益計算用の任意設定

シャツ・スウェットで共通処理を検証してから、マグ、ウォールアート、トートバッグを一カテゴリずつ追加する。ステッカーは今回の将来対象にも含めない。

## 12. エラー処理

- eRankまたはEverBeeの取得失敗を0として保存しない
- 画面解析で同じ数値が複数列へ漏れた場合は未取得扱いにする
- KDまたはCompetitionが不明ならAへ昇格させない
- 古いデータには取得日と鮮度ラベルを表示する
- 拡張機能停止後の遅延結果を取り込まない
- CSVには取得失敗理由と使用したソースを残す

## 13. 検証

### 自動検証

- `Listings Analyzed`が競合点や販売密度へ使われない
- 一商品だけ売れている市場がAにならない
- 複数の新しい販売商品がある市場は販売証拠として評価される
- 46日超の検索種データが自動で有望候補にならない
- 元の `capturedAt` が保持される
- Pinterest / Google由来語がeRank未確認でA/Bにならない
- ShirtとSweatshirtの商品語が不自然に混在しない
- 同一ニッチの近似候補がクラスター化される
- タイトルが15語未満を目安に作られ、商品名と単語を重複しない
- タグが13個以内、各20文字以内、単独年号なしになる
- リスク語句はすべての段階で最優先候補へ昇格しない

### 実データ検証

- 最新のeRank / EverBee結果を20〜50件集める
- 旧判定と新判定を並べ、順位が変わった理由を確認する
- 単一ヒット市場の降格と、複数商品が売れる市場の昇格を重点確認する
- 出品した候補は30日後のEtsy Statsを記録する
- 20〜50件の出品実績がたまるまで「確率」とは表現しない

## 14. 実装範囲

### 第一段階A: 判定の正しさ

- データソースと鮮度の正規化
- EverBee複数商品集計
- Opportunity / Confidence分離
- 不足データと取得失敗の扱い修正
- 判定ロジックの回帰テスト

### 第一段階B: 候補と出力の品質

- Shirt / Sweatshirt向け候補生成の修正
- ニッチクラスター整理
- 季節タイミング表示
- Etsy現行方針に沿ったタイトル・タグ生成
- 候補生成とSEO出力の回帰テスト
- 実績CSVテンプレート

### 将来段階

- Marketplace Insights手入力またはCSV入力
- Marketplace Insightsの無料枠を消費しない補助導線
- マグ、ウォールアート、トートバッグのカテゴリ設定
- Etsy Stats実績の取り込みと閾値再調整

## 15. 完了条件

- 現在のeRank / EverBee操作を維持できる
- 古い種データや一般トレンドだけで上位候補を作らない
- 競合と販売証拠を別の指標で説明できる
- 一商品だけの成功を市場成功として扱わない
- 上位候補が同じニッチの言い換えだけにならない
- 出品時期を判断できる
- タイトルとタグがEtsyの現行方針に沿う
- 将来カテゴリ追加で共有判定を壊さない

## 16. 公式参考情報

- Etsy Marketplace Insights: https://help.etsy.com/hc/en-us/articles/35122361353239-How-Do-I-Use-Etsy-s-Marketplace-Insights-Tool
- Etsy listing title guidance: https://www.etsy.com/seller-handbook/article/1399426136697
- Etsy search behavior: https://www.etsy.com/seller-handbook/article/375461474487
- EverBee Product Analytics metrics: https://help.everbee.io/en/article/3-product-analytics
- eRank and Marketplace Insights metric differences: https://help.erank.com/blog/etsy-marketplace-insights-tool/
