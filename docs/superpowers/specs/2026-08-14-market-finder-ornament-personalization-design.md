# Market Finder: オーナメント調査と名入れ方針表示 設計

## 目的

Market Finder で `Ornament` を通常の商品カテゴリとして調査できるようにする。さらに、名入れ・カスタム版が有効かを、候補語の推測ではなく、その行で取得した Etsy 関連語と EverBee の販売商品から判断して、結果画面とCSVに明示する。

## 非対象

- 名入れ版を自動で別候補として追加・再調査すること
- 名入れ用の制作テンプレート、価格、製造フローを自動決定すること
- 既存の Opportunity / Confidence / IP リスクの判定式を変更すること
- Chrome 拡張や既存の未コミット変更を整理・戻すこと

## 現状と課題

- `PRODUCT_CATEGORIES` は shirt / sweatshirt / mug / wall art / tote / sticker の6種で、ornament は商品として選べない。
- 生成候補には `名入れ可` の補助タグが出る場合があるが、これは候補語の形に基づく表示であり、実測の需要・販売根拠ではない。
- 最終結果には商品ルートがあるため、名入れ方針も同じ結果行に表示・出力できる。

## 設計

### 1. Ornament を商品カテゴリとして追加する

共有キーワードエンジンに次を追加する。

- カテゴリ: `id: 'ornament'`, `label: 'Ornament'`, `searchTerm: 'ornament'`
- 一般的なタグ: `ornament`, `christmas ornament`, `holiday decor`
- 商品ファミリー語: `ornament`, `ornaments`, `christmas ornament`, `christmas ornaments`
- カテゴリと商品ファミリーの対応、および商品ルートのシグナルと理由

これにより、カテゴリ選択、候補生成、Etsy関連語の取り込み、EverBee結果の製品一致チェック、クロスニッチ候補、商品ルートが同じ `ornament` 文脈で動く。UI側の種語一致にも単数・複数形を追加する。

オーナメントに `personalized` を初期検索語として固定しない。通常版と名入れ版のどちらが適切かは、下記の実測判定に委ねる。

### 2. 実測ベースの名入れ方針を独立した純粋関数で算出する

共有キーワードエンジンに、結果行と既に算出済みのスコアを受け取る `recommendPersonalization` 相当の関数を追加する。結果は、表示に必要な `decision`, `label`, `summary`, `etsyEvidenceCount`, `everbeeEvidenceCount` を返す。

対象とする語は `personalized`, `personalised`, `custom`, `custom name`, `with name`, `monogram`, `monogrammed`, `name` とする。ただし、候補キーワードそのものにこれらが含まれていることは根拠に数えない。

判定は以下の通りとする。

| 判定 | 条件 | 結果表示 |
| --- | --- | --- |
| `recommend` | 新鮮な Etsy 関連語に対象語が1件以上あり、かつ EverBee の商品タイトルで対象語を含み月間販売が正のものが2件以上ある。IPリスクなし。 | `名入れ方針: 推奨` |
| `verify` | Etsy または EverBee のどちらか一方だけに根拠がある、または EverBee販売根拠が1件だけ。 | `名入れ方針: 要確認` |
| `not-recommended` | 実測根拠がない。 | `名入れ方針: 根拠なし` |
| `blocked` | IP/安全性で商品化不可。 | `名入れ方針: 判定対象外` |

古いデータは `recommend` の根拠に使わない。Etsy または EverBee の取得日が現行スコアの鮮度基準を満たさない場合、そのソースは未確認として扱う。

### 3. 結果・CSVへの表示

`rankResearchRows` で各結果に `personalizationRecommendation` を付与する。既存の `productRoute` とは別責務にし、商品ルート表示内に次の1ブロックを追加する。

- `名入れ方針: 推奨 / 要確認 / 根拠なし / 判定対象外`
- 根拠要約: `Etsy関連語 n件 / EverBee販売商品 n件`
- 状態に応じた短い行動メモ
  - 推奨: 通常版より名入れ版を優先してテスト
  - 要確認: 名入れ語で追加確認後にテスト
  - 根拠なし: 通常版を先にテスト
  - 判定対象外: 商品化しない

この同一レンダラーを使用する通常結果と詳細結果の両方で表示する。CSVには `Personalization Decision` と `Personalization Evidence` を追加し、後から結果を見返しても判断根拠を失わないようにする。

### 4. テスト

テスト先行で以下を追加する。

1. `ornament` を選んだ時、単数・複数のオーナメント語をカテゴリ一致と判定できる。
2. オーナメント語を含む安全な結果の製品ルートで Ornament が選ばれる。
3. 新鮮な Etsy 関連語と、販売中の EverBee 商品タイトル2件が揃う時だけ `recommend` になる。
4. 片側のみ、または販売商品が1件だけなら `verify`、実測根拠なしなら `not-recommended` になる。
5. 候補キーワードに `personalized` があるだけでは `recommend` にならない。
6. IPリスクがある行は `blocked` となる。
7. 結果レンダラーとCSVに名入れ方針・根拠が含まれる。

既存の `market-finder/scripts/test-opportunity-model.mjs` と `market-finder/scripts/test-guided-entry-ui.mjs` を主な回帰テストとし、必要なら新規の小さなテストファイルに切り出す。

## 受け入れ条件

- 商品選択で Ornament を選び、`christmas ornament` と `ornaments` を含むデータで一貫して調査できる。
- 最終結果で、名入れを勧める場合に Etsy と EverBee の件数根拠が見える。
- 片側だけの観測、古い観測、候補語だけの推測では `推奨` と表示されない。
- 既存のカテゴリ、Opportunity、Confidence、IPブロック、結果表示・CSVの動作を壊さない。

## 変更予定箇所

- `shared/market-keyword-engine/index.js`
- `market-finder/src/app.js`
- `market-finder/scripts/test-opportunity-model.mjs`
- `market-finder/scripts/test-guided-entry-ui.mjs`
- 必要時のみ `market-finder/scripts/test-*.mjs`
