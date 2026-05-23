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

更新後は、拡張カードのReloadを押してください。バージョン `1.18` になっていればYouTube OCR取り込み版です。

## Market Finderから使う

1. `http://127.0.0.1:3021/market-finder/` を開く
2. イベントと商品カテゴリを選び、キーワードを生成する
3. `eRankで広く見る` を押す
4. 拡張がeRankを開き、広めの検索語で検索数・クリック・競合を順番に確認する
5. `EverBeeで売上確認` を押す
6. 拡張がEverBee Product Analyticsを開き、売上指標を順番に確認する
7. 取得できた結果がMarket Finderへ戻り、スコアリングされる

Broad Market Scanの `EverBeeで広め調査` から起動した場合は、EverBee画面で拾えた商品名もMarket Finderへ戻し、種ワード抽出に使います。

Market Finderページに「接続済み」と出ない場合は、Chrome拡張をReloadしてMarket Finderページもリロードしてください。

## YouTube OCR取り込み

動画内に出てくるキーワード一覧を、Market Finderの流行語候補として拾うための一回用機能です。

1. YouTube動画を開き、キーワード表が見える場面まで進める
2. できれば全画面または大きめの表示にする
3. Market FinderのStep 1にある `1 読み取り開始` を押す
4. 読み取れた語句を確認し、`2 Step 2候補へ追加` を押す
5. 必要なら `CSV保存` でOCR結果を保存する
6. Step 2で候補化し、eRankとEverBeeで確認する

OCRはまずChromeのネイティブ `TextDetector` を試します。使えない環境では、Market Finder側でTesseract.jsの無料OCRへ切り替えます。Tesseract.jsは初回読み込みにネット接続が必要です。YouTube画面キャプチャのため、個人用拡張として `<all_urls>` 権限を使います。

## ポップアップから使う

Market Finderページから直接起動できない場合は、拡張アイコンを押してポップアップを開きます。

1. Market Finderの「拡張用JSONをコピー」を押す
2. 拡張ポップアップの `調査キーワード / JSON` に貼り付ける
3. `調査開始` を押す
4. 結果CSVをMarket FinderのCSV欄に貼り付ける

## 注意

eRankやEverBeeの画面構造が変わると、検索欄や数値を見つけられないことがあります。
その場合はCSVのNotesに理由が残るので、手動確認してください。
