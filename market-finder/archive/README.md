# 調査エビデンスの保管庫

Market Finderが取得した実測データを、1回の調査につき1ファイルのJSONで貯めます。

## なぜここに置くか

調査結果はこれまでブラウザのlocalStorageにしかありませんでした。サイトデータを消す、別のPCで開く、その2つで、それまでに消費したeRankの検索枠とEtsy公式の取得結果が全部消えます。取得にコストがかかったデータとしては割に合いません。

ファイルにすると次が同時に手に入ります。

- **消えない**: ブラウザの状態と無関係になります。
- **差分が見える**: gitで「先月のこの語の検索数」と比較できます。
- **貯まるほど賢くなる**: 2「候補」の「購入者語彙の学習」は、人・理由・場面・修飾を分けて数えます。次回は同じ人、同じイベント、同じ商品カテゴリの順に近い実測を優先します。

## 形式

```json
{
  "version": 3,
  "runId": "round-20260726-001",
  "capturedAt": "2026-07-26T00:00:00.000Z",
  "locale": "en-US",
  "categoryId": "shirt",
  "eventId": "halloween",
  "identitySeeds": ["nicu nurse"],
  "context": {
    "categoryId": "shirt",
    "eventId": "halloween",
    "eventTerm": "halloween",
    "buyerIdentities": ["nicu nurse"]
  },
  "demandKeywords": [{ "keyword": "...", "etsySearches30d": 1300, "etsyListings": 20100 }],
  "supplyListings": [{ "title": "...", "monthlySales": 5 }],
  "drilldownNodes": [{
    "keyword": "special education teacher shirt",
    "rootKeyword": "teacher shirt",
    "parentKeyword": "teacher shirt",
    "depth": 1,
    "specificityAxis": "specialty",
    "source": ["everbee-title"],
    "metrics": {},
    "comparison": { "competitionReduction": 0.9 },
    "verdict": "promising",
    "stopReason": ""
  }]
}
```

`demandKeywords` はEtsy公式（Marketplace Insights）の検索語と関連語、`supplyListings` はEverBeeで売れている商品タイトルです。需要と供給を混ぜずに持ちます。両方を使っている語は既に取られている市場、需要だけある語が空いている入口だからです。

保存時には抽出済みの単語ランキングではなく、元の検索語と商品タイトルを残します。分類方法を後から改善しても、過去データを人・理由・場面・修飾へ再分類できるためです。

`drilldownNodes` は親語、子語、深さ、具体化軸、実測値、親子比較、継続・停止理由を保存します。`runId` が同じ途中保存は同じファイルを更新し、観測を二重計上しません。別の `runId` や別日に同じ語句を再確認した場合は、人気の再現性として新しいファイルに残します。以前の `version: 1`、`version: 2` ファイルにも互換性があります。

## 次回候補への反映

学習結果は次の優先順で候補生成へ戻します。

1. 同じ人・相手で確認した語
2. 同じイベント・場面で確認した語
3. 同じ商品カテゴリで確認した語
4. それ以外の市場で確認した語

検索数が大きいだけの別市場語が、現在の市場を乗っ取らないようにしています。90日を超えた語は履歴として表示できますが、自動候補には使いません。商標・IPリスク語も候補へ昇格させません。

ファイル名はサーバ側で `<日時>-<カテゴリ>-<イベント>.json` として生成します。ブラウザから受け取ったパスは使いません。

## 保存されるタイミング

Etsy公式、eRank、EverBee、または探索枝の結果が更新されると自動保存されます。同じ調査ランの途中では1ファイルを更新し、別の調査ランだけ新しいファイルを作ります。「調査結果を保管する」ボタンも手動確認用として残しています。

保存にはローカルの静的サーバが必要です。

```bash
node market-finder/scripts/static-server.mjs . 4174
```

`file://` で直接開いた場合や、別のサーバで配信している場合は保存ボタンが無効になり、理由が表示されます。

## Supabaseなどに移すとき

現時点ではファイルで十分です。1台のPCで1人が使う限り、失われる原因はブラウザのデータ消去であって、それはファイルで解決します。

次のどちらかが必要になった時点で、外部データベースを検討します。

- 複数のPCやブラウザから同じ蓄積を見たい
- 未来デザイナー本体（`etsy-product-ai`、Supabaseを使用済み）から、この実測データを直接読みたい

その場合もこのJSON形式をそのまま1行1レコードとして入れられるので、移行は取り込みスクリプトだけで済みます。
