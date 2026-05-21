# Market Keyword Engine

Market Finderと将来のEtsyMiraiProducer本体で共有するための、キーワード生成・EverBee結果解析・スコアリングの小さなエンジンです。

## 役割

- イベント、ターゲット、商品カテゴリ、年号、追加語句からロングテール候補を生成
- 広めの市場で売れている商品名・タグから種ワードを抽出
- 商標・著作権リスクがありそうな語句を要確認としてマーク
- EverBeeから取った `Listings / Sales / Revenue / Price / Listing Age` をスコア化
- 有望キーワードを商品テーマ、ターゲット、デザイン方向性、素材案、EtsyMiraiProducer用プロンプト、SEOタイトル、タグ案へ変換
- 売れている結果から次ラウンドの派生キーワードを生成

## 主な入口

- `generateKeywordCandidates`
- `generateBroadMarketQueries`
- `generateFollowUpKeywords`
- `parseBroadMarketListings`
- `extractNicheHintsFromListings`
- `parseEverbeeRows`
- `rankResearchRows`
- `scoreEverbeeResult`
- `buildProductIdea`

## 組み込み方針

今は静的な別アプリから直接読み込んでいます。
EtsyMiraiProducerへ組み込む段階では、このディレクトリを本体側の `src/utils` などへ移すか、workspace package化して同じ関数を使います。
