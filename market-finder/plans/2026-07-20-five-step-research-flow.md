# Market Finder Five-Step Research Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Market Finderの自動探索を、条件入力、候補、eRank、Etsy公式、EverBee最終結果の順で迷わず進める5ステップへ変更する。

**Architecture:** 既存の静的HTML、CSS、vanilla JavaScriptと拡張機能通信を維持する。画面順はDOM契約テストで固定し、eRankからEtsy、EtsyからEverBeeへの候補選択は新しい純粋関数モジュールへ分離して単体テストする。スコアリング、保存形式、外部サイト取得プロトコルは変更しない。

**Tech Stack:** HTML、CSS、vanilla JavaScript、Node.js `node:test`

## Global Constraints

- 自動探索は5ステップとし、番号は実作業セクションだけに表示する。
- 各ステップは結果を先、次工程の主ボタンを末尾に置く。
- 年を含む候補生成条件は「候補を自動で探す」より上に置く。
- eRank確認済み候補からEtsy公式確認プランを作る。
- Etsy公式取得済み候補をEverBeeキューで優先する。
- Etsy公式が利用できない場合は、明示的な確認を経てeRank候補で続行できる。
- CSV判定、SEO予備機能、A-D判定式、IP・商標リスク判定は変更しない。
- モバイル向けの再設計は行わず、デスクトップ表示を検証する。
- 新しい依存パッケージは追加しない。
- 共有の未コミット作業ツリーを使うため、コミットとステージングはユーザーから依頼されるまで行わない。

---

### Task 1: 5ステップのDOM順を固定する

**Files:**
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs`
- Modify: `market-finder/index.html`
- Modify: `market-finder/styles.css`
- Modify: `market-finder/src/app.js`

**Interfaces:**
- Consumes: 既存要素ID `trendAutoBtn`, `candidateList`, `candidateErankBtn`, `erankResultsList`, `marketplaceInsightPanel`, `erankToEverbeeBtn`, `resultsList`
- Produces: 5つの番号付きセクションと、各結果の後ろに1つだけ置かれた次工程ボタン

- [ ] **Step 1: 表示順の失敗テストを書く**

`test-guided-entry-ui.mjs`へ、次の構造契約を追加する。

```js
function position(id) {
  const index = html.indexOf(`id="${id}"`)
  assert.notEqual(index, -1, `${id} must exist`)
  return index
}

test('renders one five-step research flow in action order', () => {
  for (let step = 1; step <= 5; step += 1) {
    assert.match(html, new RegExp(`class="section-kicker">${step} \\/ 5<`))
  }
  assert.ok(position('yearInput') < position('trendAutoBtn'))
  assert.ok(position('candidateList') < position('candidateErankBtn'))
  assert.ok(position('erankResultsList') < position('marketplaceStartBtn'))
  assert.ok(position('marketplaceResultsList') < position('erankToEverbeeBtn'))
  assert.ok(position('erankToEverbeeBtn') < position('resultsList'))
})

test('does not render duplicate automatic research buttons above the steps', () => {
  assert.doesNotMatch(html, /id="simpleImportErankBtn"/)
  assert.doesNotMatch(html, /id="simpleStartBtn"/)
})
```

- [ ] **Step 2: テストが仕様未実装の理由で失敗することを確認する**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs`

Expected: `1 / 5`、`marketplaceStartBtn`、または新しいDOM順のアサーションでFAILする。

- [ ] **Step 3: HTMLを5ステップへ並べ替える**

`index.html`で以下を行う。

```html
<!-- Step 1: yearInputを含む通常条件の後ろに置く -->
<div class="step-primary-action" id="candidateDiscoveryAction">
  <button id="trendAutoBtn" type="button" class="primary-btn full-width">候補を自動で探す</button>
  <!-- connection and trend status -->
</div>

<!-- Step 2: candidateListの後ろに置く -->
<div class="step-primary-action">
  <button id="candidateErankBtn" type="button" class="primary-btn full-width">eRankで検索数を見る</button>
</div>

<!-- Step 3: erankResultsListの後ろに新設 -->
<div class="step-primary-action" id="marketplaceStartAction">
  <button id="marketplaceStartBtn" type="button" class="primary-btn">次をEtsyで確認</button>
  <div id="marketplaceStartStatus" class="inline-status">eRank結果が入ると利用できます。</div>
</div>

<!-- Step 4: Marketplace Insights本体と公式結果の後ろに置く -->
<div id="marketplaceResultsList" class="marketplace-results-list"></div>
<div class="step-primary-action">
  <button id="erankToEverbeeBtn" type="button" class="primary-btn">EverBeeで売上を確認する</button>
</div>

<!-- Step 5 -->
<p class="section-kicker">5 / 5</p>
<h2>おすすめキーワード</h2>
```

自動モード用の`simpleImportErankBtn`と`simpleStartBtn`は削除する。CSV用の`simple-runner`と`simpleStatus`は維持し、自動モードではCSSで非表示にする。

- [ ] **Step 4: 不要になったDOM参照とイベント登録を除く**

`app.js`から`simpleImportErankBtn`、`simpleStartBtn`の要素取得、`disabled`更新、イベント登録を削除する。`simpleStartErankResearch()`と`simpleStartResearch()`自体は各ステップの主ボタンから利用するため維持する。

- [ ] **Step 5: デスクトップ向けの節間と操作領域を整える**

`styles.css`に`.step-primary-action`と`.marketplace-results-list`を追加する。既存の8px角丸、白・ティール・グレー、全幅セクションを維持し、主ボタンは結果一覧の下で右寄せまたは全幅とする。カード内カードは追加しない。

- [ ] **Step 6: 構造テストを通す**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs`

Expected: 全テストPASS。

---

### Task 2: eRankからEtsy、EtsyからEverBeeへの候補選択を分離する

**Files:**
- Create: `market-finder/src/research-flow.js`
- Create: `market-finder/scripts/test-research-flow.mjs`
- Modify: `market-finder/src/app.js`

**Interfaces:**
- Produces: `buildEtsyCandidatesFromErank(erankRows, candidates): Candidate[]`
- Produces: `marketplaceCompletedKeywords(plan): string[]`
- Consumes: `row.erankOpportunity.action`, `row.score.riskTerms`, `row.score.exclusionReasons`, `plan.items[].result`

- [ ] **Step 1: eRank適格候補とEtsy取得済み候補の失敗テストを書く**

```js
import {
  buildEtsyCandidatesFromErank,
  marketplaceCompletedKeywords,
} from '../src/research-flow.js'

test('builds Etsy candidates only from usable eRank results', () => {
  const rows = [
    { keyword: 'retro ghost shirt', erankOpportunity: { action: 'everbee', score: 82 }, score: { riskTerms: [], exclusionReasons: [] } },
    { keyword: 'weak ghost shirt', erankOpportunity: { action: 'reject', score: 12 }, score: { riskTerms: [], exclusionReasons: [] } },
    { keyword: 'brand ghost shirt', erankOpportunity: { action: 'everbee', score: 90 }, score: { riskTerms: ['brand'], exclusionReasons: [] } },
  ]
  const candidates = [{ keyword: 'retro ghost shirt', discoveryLane: 'aesthetic', queryStrategy: 'direct' }]

  assert.deepEqual(buildEtsyCandidatesFromErank(rows, candidates), [{
    keyword: 'retro ghost shirt',
    query: 'retro ghost shirt',
    discoveryLane: 'aesthetic',
    queryStrategy: 'direct',
    opportunityIndex: 82,
  }])
})

test('prioritizes completed Etsy queries and related metrics for EverBee', () => {
  const plan = { items: [{
    query: 'retro ghost shirt',
    status: 'completed',
    result: {
      etsySearches30d: 80,
      etsyListings: 1200,
      etsyRelatedKeywordMetrics: [
        { keyword: 'cute retro ghost shirt', etsySearches30d: 35, etsyListings: 420 },
      ],
    },
  }] }

  assert.deepEqual(marketplaceCompletedKeywords(plan), [
    'retro ghost shirt',
    'cute retro ghost shirt',
  ])
})
```

- [ ] **Step 2: 新規モジュールがない理由で失敗することを確認する**

Run: `node --test market-finder/scripts/test-research-flow.mjs`

Expected: `ERR_MODULE_NOT_FOUND`でFAILする。

- [ ] **Step 3: 最小の純粋関数を実装する**

`research-flow.js`は、空白と大文字小文字を正規化して重複を除く。eRank側は`everbee`または`expand`だけを許可し、リスク・除外理由がある行は除く。Etsy側は`completed`だけを対象とし、直接語句の後に数値付き関連語を検索数降順で追加する。

- [ ] **Step 4: 単体テストを通す**

Run: `node --test market-finder/scripts/test-research-flow.mjs`

Expected: 2件以上PASS。

- [ ] **Step 5: app.jsへ候補選択を接続する**

```js
import {
  buildEtsyCandidatesFromErank,
  marketplaceCompletedKeywords,
} from './research-flow.js?v=20260720-1'

function etsyValidationCandidates() {
  return buildEtsyCandidatesFromErank(erankResultRows(), state.candidates)
}

function salesCheckKeywords() {
  const official = marketplaceCompletedKeywords(state.marketplaceInsightPlan)
  if (official.length > 0) return cleanKeywordList(official).slice(0, 50)
  const narrowed = narrowEverbeeKeywordsFromErank()
  return narrowed.length > 0 ? narrowed : readyKeywords()
}
```

`rebuildMarketplaceInsightPlan()`は`state.candidates`ではなく`etsyValidationCandidates()`を`buildMarketplaceInsightPlan()`へ渡す。候補生成直後には新規プランを作らず、過去プランを保持する明示ケース以外はリセットする。

- [ ] **Step 6: 研究フローと既存モデルテストを通す**

Run: `node --test market-finder/scripts/test-research-flow.mjs market-finder/scripts/test-opportunity-model.mjs`

Expected: 全テストPASS。

---

### Task 3: Etsy公式確認をStep 3から開始し、Step 4で継続する

**Files:**
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/index.html`
- Modify: `market-finder/styles.css`
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs`

**Interfaces:**
- Consumes: `marketplaceStartBtn`, `marketplaceStartStatus`, `marketplaceResultsList`
- Produces: `startMarketplaceInsight(): Promise<void>`, `renderMarketplaceInsightResults(): void`
- Preserves: `runNextMarketplaceInsight()`, `captureMarketplaceInsight()`, `requestExtension()`

- [ ] **Step 1: 状態切替のソース契約テストを書く**

```js
test('starts Etsy after eRank and renders official results before EverBee', () => {
  assert.match(app, /async function startMarketplaceInsight\(\)/)
  assert.match(app, /function renderMarketplaceInsightResults\(\)/)
  assert.match(app, /marketplaceCompletedKeywords\(state\.marketplaceInsightPlan\)/)
  assert.match(app, /Etsy公式データを取得していません/)
})
```

- [ ] **Step 2: 未実装の関数名でテストが失敗することを確認する**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs`

Expected: `startMarketplaceInsight`または`renderMarketplaceInsightResults`が見つからずFAILする。

- [ ] **Step 3: 初回Etsy操作を実装する**

`startMarketplaceInsight()`はeRank適格候補がなければStep 3内に説明を表示する。候補があればプランを作成し、`runNextMarketplaceInsight()`で最初の語句を開く。開始済みの場合、Step 3の初回ボタンは非表示または無効にし、Step 4の既存操作へ誘導する。

- [ ] **Step 4: Etsy公式結果一覧を実装する**

`renderMarketplaceInsightResults()`は完了項目を取得順に表示し、各行へ次を出す。

```text
キーワード | 30日検索数 | 掲載数 | 検索変化 | 関連語数 | 取得済み
```

完了項目がない場合は「Step 3の『次をEtsyで確認』から始めます」という空状態を表示する。既存のキュー、プラン統計、取り込み、スキップ、次の5語追加は維持する。

- [ ] **Step 5: EverBee開始時の明示的フォールバックを実装する**

`simpleStartResearch()`でEtsy取得済み語句が0件、eRank結果が1件以上の場合だけ`window.confirm()`を出す。

```js
const officialKeywords = marketplaceCompletedKeywords(state.marketplaceInsightPlan)
if (officialKeywords.length === 0 && erankResultRows().length > 0) {
  const proceed = window.confirm('Etsy公式データを取得していません。eRank結果だけでEverBeeへ進みますか？')
  if (!proceed) return
}
```

- [ ] **Step 6: Step 4の状態別ボタンを整える**

Etsyページを開いている時は「表示中の結果を取り込む」を主操作にし、取り込み後は「次をEtsyで確認」を有効にする。`erankToEverbeeBtn`はEtsy取得済み件数またはeRank結果がある時に有効とし、直下へ`Etsy公式 N件を優先`または`Etsy未取得・確認後に続行可能`を表示する。

- [ ] **Step 7: UIと研究フローのテストを通す**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs market-finder/scripts/test-research-flow.mjs`

Expected: 全テストPASS。

---

### Task 4: 回帰検証と実ブラウザ確認

**Files:**
- Modify: `market-finder/index.html` cache query only when needed

**Interfaces:**
- Consumes: 完成した5ステップUIと既存ローカルサーバー
- Produces: 再読み込み後の検証済みデスクトップ画面

- [ ] **Step 1: JavaScript構文を確認する**

Run: `node --check market-finder/src/app.js`

Expected: exit code 0。

- [ ] **Step 2: Market Finderの対象テストをまとめて実行する**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs market-finder/scripts/test-research-flow.mjs market-finder/scripts/test-research-performance.mjs market-finder/scripts/test-opportunity-model.mjs`

Expected: 全テストPASS、fail 0。

- [ ] **Step 3: 既存スコア回帰を確認する**

Run: `node market-finder/scripts/validate-scoring.mjs`

Expected: `PASS`。

- [ ] **Step 4: 差分の空白エラーを確認する**

Run: `git diff --check -- market-finder/index.html market-finder/styles.css market-finder/src/app.js market-finder/src/research-flow.js market-finder/scripts/test-guided-entry-ui.mjs market-finder/scripts/test-research-flow.mjs`

Expected: 出力なし、exit code 0。

- [ ] **Step 5: ブラウザを再読み込みしてデスクトップ導線を確認する**

`http://127.0.0.1:4173/market-finder/`を再読み込みし、次を確認する。

```text
1. 年が候補生成ボタンより上
2. 候補一覧の後にeRankボタン
3. eRank結果の後に初回Etsyボタン
4. Etsy結果の後にEverBeeボタン
5. 最後におすすめキーワード
6. 上部に重複したeRank/EverBeeボタンがない
7. 既存保存データを復元しても画面が崩れない
8. ブラウザコンソールエラーがない
```

- [ ] **Step 6: 最終差分を仕様書と照合する**

`market-finder/specs/2026-07-20-five-step-research-flow-design.md`のAcceptance Criteriaを一項目ずつ確認し、未達項目があれば完了報告前に修正する。
