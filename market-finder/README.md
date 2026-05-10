# Market Finder

EtsyMiraiProducerへ組み込む前に、イベント別の低競合キーワード探索を試すための別アプリです。

## できること

- 父の日、母の日、ハロウィン、クリスマスなどのイベントからロングテール候補を生成
- 広めの市場で売れた商品のタイトル・タグから種ワードを抽出
- `event + target + product + year` を軸に候補を増やす
- Chrome拡張へ直接依頼して、eRank Keyword ToolとEverBee Product Analyticsを順番に検索
- eRankで検索需要を見て、良さそうな候補だけEverBeeで売上確認
- 低競合、需要、収益性、新しさ、商標リスクを点数化
- 「両方OK」「EverBeeのみ」「eRankのみ」「要判断」で根拠の強さを表示
- 良い候補を商品テーマ、ターゲット、デザイン方向性、SEOタイトル、タグ案へ変換
- 売れている候補から次ラウンドの派生キーワードを作成

## 起動

リポジトリルートで静的サーバーを立てます。

```powershell
python -m http.server 3021
```

開くURL:

```text
http://127.0.0.1:3021/market-finder/
```

## Chrome拡張連携

1. `etsy-chrome-extension` をChromeでLoad unpackedする
2. 拡張のバージョンが `1.5` になっていることを確認
3. Market Finderページをリロードする
4. 画面上部のかんたんモードで `候補を作る` を押す
5. `eRankで広く見る` を押す
6. `EverBeeで売上確認` を押す

調査開始後は進捗モーダルが開き、現在のキーワード、完了件数、残り件数、完了/停止/エラー状態を確認できます。
モーダル内の `停止` から途中停止もできます。

接続されない場合は、拡張をReloadしてMarket Finderページも再読み込みしてください。

## Broad Market Scan

最初に `fathers day shirt` のような広めの検索で売れ筋商品を見て、商品名・タグ・Salesを貼り付けます。
`種ワード抽出` を押すと、`dog dad`、`bonus dad`、`from daughter` のような語句を拾い、`追加語句へ入れる` で候補生成に使えます。

`広め検索語を作る` を押すと、イベントと商品から `fathers day shirt` などの広め検索語を作ります。
Chrome拡張が接続済みなら、`EverBeeで広め調査` でその検索語を順番に調査し、EverBee画面から拾えた商品名を自動で種ワード抽出へ流します。

## eRank連携

かんたんモードでは、Chrome拡張がeRank Keyword Toolを開き、まず広めの検索語を順番に検索します。
画面から取得できた Average Searches、Average Clicks、CTR、Etsy Competition、KD、Trend をMarket Finderへ戻します。
下に表示される Keyword Ideas / Near Matches も読めた範囲で取り込みます。
その結果を使って、EverBeeでは細かい候補だけを売上確認します。
画面構造が変わった場合の保険として、CSV貼り付け・手入力も残しています。

対応している列:

```csv
Keyword,Listings Analyzed,Top Monthly Sales,Top Revenue,Average Price,Listing Age,eRank Search Volume,eRank Clicks,eRank CTR,eRank Competition,eRank Trend,Notes
```

EverBeeは売れている証拠、eRankは検索されてクリックされる証拠として扱います。
詳しい判断基準は `market-finder/DUAL_TOOL_STRATEGY.md` に置いています。

## SEOタイトル / タグ設計

Step 5で、調査済みキーワードを3つのバケットに整理できます。

- `Visibility` は低競合で入口にしたい語句
- `Reach` は中競合で検索範囲を広げる語句
- `Best seller` は競合は強いが市場の中心になる語句

`結果からバケット作成` を押すと、EverBee/eRankの数値から自動で振り分けます。`SEO案を作る` で、Etsyタイトル140文字以内とタグ13個以内に整えます。タグはEtsyの20文字制限に合わせて短い語句へ分割します。

## 共通ロジック

キーワード生成、CSV解析、スコアリング、商品案変換は `shared/market-keyword-engine` に置いています。
将来EtsyMiraiProducer本体へ入れる時も、この共通ロジックを使う想定です。
