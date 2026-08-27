# Market Finder 誰向け・何向け候補の根拠判定 設計

## 目的

Market Finder の「購入者候補」を、商品カテゴリに依存した固定人物候補から、現在の市場調査で確認できた「誰向け・何向け」を役割別に扱う仕組みへ変更する。

現在の実装は、購入者、受取人、利用者、贈り手、商品に描かれる対象を `buyerIdentitySeeds` へまとめている。そのため、Shirt の過去実績にある `teacher` や `mom` が Ornament の `memorial ornament` 調査へ混ざり、`mom` が購入者なのか追悼対象なのかも区別できない。

新しい仕組みでは、現在のカテゴリと入口テーマに一致する Etsy 関連検索語および EverBee 販売商品タイトルを根拠に役割を判定する。根拠がない人物を固定辞書から自動補充しない。

## 成功条件

- Shirt、Sweatshirt、Mug、Ornament、Wall Art、Tote Bag、Sticker の全カテゴリで同じ証拠ルールを使用する。
- 候補を「受取人・利用者」「贈り手」「商品で表す対象」の3役に分離する。
- 別カテゴリまたは別テーマの履歴を現在の自動選択へ混ぜない。
- 根拠がない場合は候補を空欄にし、未確定であることを表示する。
- 静的な需要入口ワードだけでは人物を自動確定しない。
- 現在の調査から得た Etsy と EverBee の根拠を候補ごとに表示する。
- 旧保存データと旧アーカイブを失わず、安全に新形式へ移行する。
- Opportunity、Confidence、商品化・利益スコア、Etsy/EverBee取得順序を変更しない。

## 採用方式

### 採用: 実測優先型

現在の入口テーマを商品カテゴリだけで探索し、Etsy 関連検索語と EverBee 販売商品タイトルから役割候補を抽出する。根拠が一定条件を満たした候補だけを自動選択し、次の候補生成または深掘りに使用する。

カテゴリは「どの役割を扱えるか」と「どの語順を許可するか」だけを定義し、`teacher`、`mom`、`pet owner` などの人物そのものを自動で発明しない。

### 不採用: カテゴリ固定辞書型

カテゴリごとに人物候補を固定すると実装は簡単だが、`memorial ornament` に `daughter` を自動設定するような、根拠のない推測が再発するため採用しない。

### 不採用: AI単独判定型

商品タイトルを外部AIへ渡して毎回分類する方式は、コスト、再現性、説明可能性、オフライン利用の点で現在の Market Finder に適さない。初期実装では決定的なルールと取得済み証拠だけを使用する。

## 用語と役割モデル

画面上の見出しは「購入者候補」から「誰向け・何向けの商品ですか」へ変更する。

内部では次の3役を区別する。

| 役割 | ID | 意味 | 例 |
|---|---|---|---|
| 受取人・利用者 | `recipient` | 商品を使う、着る、受け取る人 | `teacher mug` の teacher |
| 贈り手 | `giver` | 商品を贈る人または集団 | `teacher ornament from students` の students |
| 商品で表す対象 | `subject` | 記念、追悼、描画、部屋、趣味など商品の主題 | `pet memorial ornament` の pet、`nursery wall art` の nursery |

`subject` は人物に限定しない。`person`、`pet`、`place`、`room`、`interest`、`occasion` のサブタイプを持てるようにする。

## 商品カテゴリの役割プロファイル

カテゴリプロファイルは候補語を供給せず、許可する役割と文法だけを定義する。

| カテゴリ | 主役割 | 補助役割 | 人物なしを許可 |
|---|---|---|---|
| Shirt | recipient | giver、subject | 可 |
| Sweatshirt | recipient | giver、subject | 可 |
| Mug | recipient | giver、subject | 可 |
| Ornament | subject | recipient、giver | 可 |
| Wall Art | subject | recipient、giver | 可 |
| Tote Bag | recipient | giver、subject | 可 |
| Sticker | recipient または subject | giver | 可 |

人物なしを全カテゴリで許可する。`custom tote bag`、`landscape wall art`、`bumper sticker` のように、取得済みの語句から相手を判断できない場合は空欄が正しい状態である。

## 判定文法

同じ関係語でも市場文脈によって役割が変わるため、正規化後のフレーズ全体から判定する。

- `<identity> <product>`: 通常は recipient。例 `teacher mug`。
- `gift for <identity> <product>`: recipient。例 `gift for mom mug`。
- `<recipient> <product> from <identity>`: `from` の後ろは giver。
- `memorial`、`remembrance`、`in memory of`、`loss of`、`sympathy` と結び付く人物・動物: subject。
- 部屋、場所、題材、趣味が Wall Art や Sticker の中心語になっている場合: subject。
- `custom`、`personalized`、`vintage` など相手を表さない語: audience 候補にしない。
- 役割が一意に決まらない語: modifier として残し、audience 候補には昇格させない。

例:

| 検索語・商品タイトル | 判定 |
|---|---|
| `teacher mug` | recipient: teacher |
| `gift for mom mug` | recipient: mom |
| `teacher ornament from students` | recipient: teacher、giver: students |
| `pet memorial ornament` | subject: pet |
| `memorial ornament for mom` | subject: mom |
| `nursery wall art` | subject: nursery |
| `custom tote bag` | audience なし |

## 証拠レベル

候補ごとに次の判定状態を持つ。

### `confirmed`

次のいずれかを満たす。

- 現在コンテキストに一致する Etsy 関連検索語で1回以上、かつ EverBee の販売あり商品タイトルで1件以上確認した。
- 現在コンテキストに一致する異なる EverBee 販売あり商品タイトルで2件以上確認した。

`confirmed` だけを自動選択できる。

### `verify`

Etsy 関連検索語または EverBee 販売あり商品タイトルの一方だけで確認した。画面へ確認候補として表示するが、自動選択しない。

### `reference`

同カテゴリでも別の入口テーマ、別イベント、または過去の参考履歴だけで確認した。参考枠には表示できるが、現在の候補生成へ渡さない。

### `manual`

ユーザーが入力または選択した仮説。現在の探索には使用できるが、実測確認済みとは表示しない。Etsy/EverBee確認後に `verify` または `confirmed` へ昇格できる。

### `legacy`

旧 `buyerIdentitySeeds` から移行した候補。受取人候補として仮置きし、「旧形式・要確認」と表示する。自動選択済みだった値も無条件には再採用しない。

静的ファイルの「需要の入口ワード」は探索開始点であり、`confirmed` または `verify` の証拠数へ含めない。

## 調査コンテキスト

Audience 履歴の再利用単位は次とする。

```text
商品カテゴリ × イベント × 入口テーマ
```

内部キーは次の概念を持つ。

```js
{
  categoryId,
  eventId,
  rootKeyword,
}
```

`rootKeyword` は現在の候補または入口語から商品語、年、一般的な様式語を除いた既存のニッチ・クラスタ基準で正規化する。既存のクラスタキーや research context の生成規則を再利用し、UI側で別の正規化を作らない。

完全一致するコンテキストだけを `confirmed` / `verify` の計算に使用する。同カテゴリの別テーマは `reference`、別カテゴリは通常の候補画面へ出さない。

## 二段階の探索フロー

誰向けかを調査前に推測しないため、既存の5工程を保ったまま候補生成を二段階にする。

### 第1段階: テーマ探索

条件画面では商品カテゴリ、イベント、入口ワードから人物なしでも候補を生成できる。Audience が未確定でも候補生成を止めない。

手動 audience は任意の仮説として追加できるが、実測とは表示しない。

### 第2段階: Audience 深掘り

Etsy 関連検索語と EverBee 商品タイトルを取得した後、役割候補を抽出・集計する。`confirmed` 候補は現在テーマの次ラウンド候補または深掘り候補へ使用する。

これにより、最初から teacher や mom を当てはめるのではなく、実際の市場語彙が見えた後に `teacher mug`、`pet memorial ornament` などの長尾候補へ進む。

## データ形状

共有ドメインロジックが返す候補は次の形を基本とする。

```js
{
  phrase: 'teacher',
  role: 'recipient',
  subjectType: '',
  status: 'confirmed',
  autoSelectable: true,
  context: {
    categoryId: 'mug',
    eventId: '',
    rootKeyword: 'teacher mug',
  },
  evidence: {
    etsyRelatedTermCount: 1,
    etsySearches: 1200,
    everbeeListingCount: 2,
    everbeeSellingListingCount: 2,
    everbeeMonthlySales: 18,
    observationRuns: 1,
    latestCapturedAt: '2026-08-27T00:00:00.000Z',
  },
  sources: ['etsy-related', 'everbee-title'],
}
```

`app.js` はこの判定を再計算せず、表示、選択、保存、イベント配線だけを担当する。

## 候補生成への適用

- recipient: `<identity> <product>`、`gift for <identity> <product>` など既存の受取人文法へ渡す。
- giver: `from <giver>` のように、recipient または subject と文法上組み合わせられる場合だけ使用する。
- subject: 商品テーマとして組み込み、`gift for <subject>` を機械的に生成しない。
- `verify` / `reference`: 自動生成へ渡さない。
- `manual`: 仮説候補として生成できるが、candidate provenance に `manual` を残す。
- audience が空: 通常のテーマ候補だけを生成する。

既存の Opportunity、Confidence、検証段階、IP判定は、Audience の状態によって上書きしない。

## 画面設計

現在の人物候補パネルを次の構成へ置き換える。

### 見出し

```text
誰向け・何向けの商品ですか
```

### 状態表示

- 調査前: `まだ実績がないため未選択`
- 確認候補あり: `EtsyまたはEverBeeで確認・自動選択なし`
- 確定候補あり: `現在の調査実績から自動選択`
- 手動入力あり: `手動仮説を使用中`
- 旧データあり: `旧形式・要確認`

### 候補グループ

- 受取人・利用者
- 贈り手
- 商品で表す対象
- 別テーマの参考候補。必要な場合だけ折りたたみ表示

各チップに役割、状態、Etsy件数、EverBee販売商品件数を表示する。`confirmed` 以外は押すまで入力へ追加しない。

現在のランダムな「別の候補を見る」は廃止し、「実績候補を更新」に変更する。固定辞書を巡回する操作にはしない。

## 条件変更と状態分離

Audience 選択は `categoryId + eventId + rootKeyword` ごとに保持する。

- カテゴリ変更時、別カテゴリの自動・手動選択を持ち越さない。
- イベントまたは入口テーマ変更時、別コンテキストの自動選択を持ち越さない。
- 元のコンテキストへ戻った時は、そのコンテキストで保存した手動選択を復元する。
- 「最初からやり直す」は現在の選択を消すが、証拠アーカイブと学習履歴は残す。
- 保存済み証拠は同一コンテキストでのみ再評価する。

## 保存形式と移行

### ブラウザ状態

新形式では、コンテキストごとの選択を `audienceSelectionsByContext` に保存する。

```js
{
  '<context-key>': {
    selections: [
      { phrase, role, subjectType, status, source },
    ],
    updatedAt,
  },
}
```

旧 `buyerIdentitySeeds` は読み込み互換のため残す。初回移行時に各行を `recipient / legacy` として現在コンテキストへ仮置きする。旧 `buyerIdentitySelectionMode: auto` の値は自動確定せず、選択解除した状態で表示する。

### 証拠アーカイブ

既存の `identitySeeds` を読み続ける。新しいアーカイブには `audienceSignals` を追加する。旧アーカイブは再解析できる Etsy 関連語と EverBee 商品タイトルがある場合だけ新しい役割判定へ使用し、旧 `identitySeeds` 自体を confirmed 証拠にしない。

### CSV

既存の `Wearer Intent`、`Recipient Role`、`Giver Role` は維持する。末尾に次を追加する。

- `Audience Subject`
- `Audience Subject Type`
- `Audience Status`
- `Audience Sources JSON`
- `Audience Evidence JSON`
- `Audience Context Key`

旧CSVの読み込み互換を維持し、新列がない場合は空値として扱う。

## エラーと空状態

- Etsy/EverBee未取得: `まだ実績がないため未選択`。固定候補は出さない。
- 取得失敗: 候補なしと断定せず、`取得失敗のため未判定` と表示する。
- Etsyだけで確認: `verify` として表示し、自動選択しない。
- EverBee販売あり商品1件だけ: `verify` として表示し、自動選択しない。
- 役割が競合: 自動選択せず `役割要確認` と表示する。
- 同じ語が複数役割: フレーズ全体の文法で分け、解決できない場合は双方とも自動選択しない。
- 人物を必要としない商品: 空欄を正常状態として候補生成を継続する。
- 古い証拠: 既存の鮮度判定に従い `reference` へ降格する。

## 実装境界

共有エンジンに、次の責務を持つ小さな純粋関数または専用モジュールを追加する。

- 商品カテゴリの役割プロファイルを返す。
- 検索語・商品タイトルから役割シグナルを抽出する。
- コンテキスト一致と鮮度を判定する。
- Etsy/EverBee証拠を集計して候補状態を決める。
- 選択済み役割から文法的に妥当な候補語を生成する。
- 旧保存形式を新形式へ正規化する。

`market-finder/src/app.js` は DOM、状態遷移、保存・復元、表示を配線する。役割判定や証拠しきい値を `app.js` に複製しない。

先行して追加された Ornament 固定候補 `pet owner / daughter / son` と、カテゴリに応じた固定補充処理は削除し、本設計の証拠判定へ置き換える。

## 検証計画

### 役割分類

- `teacher shirt`、`teacher sweatshirt` を recipient と判定する。
- `gift for grandma mug` を recipient と判定する。
- `teacher ornament from students` を recipient と giver に分ける。
- `pet memorial ornament` を subject と判定する。
- `memorial ornament for mom` の mom を recipient ではなく subject と判定する。
- `nursery wall art` を subject と判定する。
- `custom tote bag` と `bumper sticker` から人物を作らない。

### 証拠判定

- Etsy関連語とEverBee販売商品が揃った候補を confirmed にする。
- 異なるEverBee販売商品2件で確認した候補を confirmed にする。
- 一方の情報源だけなら verify にする。
- 別テーマの実績を reference にする。
- 別カテゴリの実績を現在候補へ出さない。
- 静的入口ワードだけでは confirmed にしない。
- 古い証拠を自動選択しない。

### 候補生成

- recipient、giver、subject を正しい文法へ渡す。
- subject から不自然な `gift for` 語句を作らない。
- audience が空でもテーマ候補を生成できる。
- manual 候補の provenance を保持する。

### UIと永続化

- 3役を別グループで表示する。
- 根拠件数と状態を表示する。
- confirmed だけを自動選択する。
- カテゴリ・イベント・入口テーマ間で選択を混ぜない。
- 元のコンテキストへ戻ると手動選択を復元する。
- 旧ブラウザ状態と旧アーカイブを安全に移行する。
- CSVの既存列を維持して新しいAudience列を追加する。

### 回帰確認

- 全 Market Finder テストを実行する。
- 変更した JavaScript を `node --check` で確認する。
- `git diff --check` を実行する。
- Opportunity、Confidence、商品化・利益スコアの既存期待値が変わっていないことを確認する。

## 対象外

- 外部AI APIによる役割分類
- Etsy、EverBee、eRankの取得方法変更
- Opportunity、Confidence、商品化・利益スコアの再設計
- 売上予測または売上保証
- Audience候補を増やすためだけの追加外部検索

