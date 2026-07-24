# EtsyMirai Research Helper

Market Finderの候補キーワードをeRank Keyword ToolとEverBee Product Analyticsで順番に検索するためのChrome拡張です。
既存のEtsy商品画像取得機能も残しています。

## 読み込み

1. Chromeで `chrome://extensions/` を開く
2. Developer modeをオンにする
3. Load unpackedを押す
4. このフォルダを選ぶ

```text
C:\work\AntiGravity\Etsy_product\etsy-chrome-extension
```

更新後は、拡張カードのReloadを押してください。バージョン `1.26` ならOKです。Reload時に実Chromeで開いているMarket Finderページも自動で再読み込みされます。

## Market Finderから使う

1. `http://127.0.0.1:4173/market-finder/` を開く
2. イベントと商品カテゴリを選び、キーワードを生成する
3. `eRankで広く見る` を押す
4. 拡張がeRankを開き、広めの検索語で検索数・クリック・競合を順番に確認する
5. `EverBeeで売上確認` を押す
6. 拡張がEverBee Product Analyticsを開き、売上指標を順番に確認する
7. 取得できた結果がMarket Finderへ戻り、スコアリングされる

Broad Market Scanの `EverBeeで広め調査` から起動した場合は、EverBee画面の共通商品IDを使って商品名・月間販売数・累計販売数・売上・公開後月数を一対一で取得します。Market Finderでは月間販売数順に表示し、公開12か月以内に複数商品で売れている語句を種ワード抽出で優先します。

Halloweenのような大型イベントでは、無料モードは15語、Etsy Plusモードは入口20語から始めて有望語を5語ずつ最大40語まで追加する段階式プランを作ります。`Etsy公式確認を自動実行` を押すと、候補を1語ずつ検索し、結果表示を待って直近30日の検索数・検索変化率・掲載数・関連語を取り込み、次の語句へ自動で進みます。日本語・英語表示の両方に対応し、「似たような検索ワード / Similar search terms」と「探索のアイデア / Exploration ideas」を自動で切り替え、各行の検索数・検索結果数・コンバージョン表示を統合します。失敗時だけ停止し、手動取り込みで復旧できます。

Market Finderページに「接続済み v1.35」と出ない場合は、そのページがCodex内蔵ブラウザではなく実Chromeで開かれているか確認し、Chrome拡張をReloadしてください。バージョン `1.35` ではバックグラウンド応答まで確認して接続状態を表示し、Market Finderページも自動で再読み込みされます。

## ポップアップから使う

Market Finderページから直接起動できない場合は、拡張アイコンを押してポップアップを開きます。

1. Market Finderの「拡張用JSONをコピー」を押す
2. 拡張ポップアップの `調査キーワード / JSON` に貼り付ける
3. `調査開始` を押す
4. 結果CSVをMarket FinderのCSV欄に貼り付ける

## 注意

eRank、EverBee、Etsy Marketplace Insightsの画面構造が変わると、検索欄や数値を見つけられないことがあります。
その場合はCSVのNotesに理由が残るので、手動確認してください。
