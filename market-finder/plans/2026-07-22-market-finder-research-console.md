# Market Finder Research Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Market Finderの既存5段階リサーチを、途中工程は高密度に確認でき、最終結果はコピーと未来デザイナー用CSV出力に集中できるデスクトップResearch Consoleへ変更する。

**Architecture:** 検索・採点・Chrome拡張連携の正本は既存`state`と既存関数に残し、新しい`research-console-ui.js`は工程状態と表示選択だけを扱う。既存DOM IDを維持したままHTMLを工程タブ、Queue、Workspace、Inspectorへ再配置し、`app.js`は現在工程だけ詳細描画する。

**Tech Stack:** Vanilla HTML/CSS/JavaScript ES modules、Node.js built-in test runner、既存の静的HTTPサーバー、Chrome拡張連携。

## Global Constraints

- 採用案はC「Research Console」とする。
- モバイル対応は行わず、幅1280px以上のデスクトップを対象とする。
- 検索候補生成、eRank、Etsy Marketplace Insights、EverBee、クロスニッチ、スコアリング、CSV列の判定ロジックを変更しない。
- 工程順は「条件」「候補」「eRank」「Etsy公式」「最終結果」の5段階を維持する。
- Chrome拡張、イベント登録、CSV出力が参照する既存DOM IDを変更・複製しない。
- 最終結果CSVは既存形式を維持し、画面上の名称だけを「未来デザイナー用CSV」に変更する。
- 新しいUIフレームワークまたは依存パッケージを追加しない。
- 角丸は最大8px、文字サイズは画面幅に連動させない。

---

### Task 1: Research Console表示状態モデル

**Files:**
- Create: `market-finder/src/research-console-ui.js`
- Create: `market-finder/scripts/test-research-console-ui.mjs`

**Interfaces:**
- Consumes: `candidateCount`、`readyCandidateCount`、`erankResultCount`、`erankFailureCount`、`erankPendingCount`、`etsyEligibleCount`、`etsyCompletedCount`、`etsyPendingCount`、`everbeeResultCount`、`activeService`。
- Produces: `RESEARCH_STAGE_IDS`、`createResearchConsoleUi()`、`selectResearchStage()`、`selectResearchQueueFilter()`、`deriveResearchStageStates()`。

- [ ] **Step 1: 工程状態とUI復元の失敗テストを書く**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createResearchConsoleUi,
  deriveResearchStageStates,
  selectResearchQueueFilter,
  selectResearchStage,
} from '../src/research-console-ui.js'

test('restores only known stage and queue values', () => {
  assert.deepEqual(createResearchConsoleUi({ activeStage: 'etsy', queueFilter: 'failed' }), {
    activeStage: 'etsy',
    queueFilter: 'failed',
    selectedKeyword: '',
  })
  assert.equal(createResearchConsoleUi({ activeStage: 'unknown' }).activeStage, 'conditions')
})

test('selects stage and queue filter without mutating input', () => {
  const initial = createResearchConsoleUi()
  const selected = selectResearchQueueFilter(selectResearchStage(initial, 'erank'), 'completed')
  assert.equal(initial.activeStage, 'conditions')
  assert.deepEqual(selected, { activeStage: 'erank', queueFilter: 'completed', selectedKeyword: '' })
})

test('derives progress, review, complete, and available states', () => {
  const stages = deriveResearchStageStates({
    candidateCount: 20,
    readyCandidateCount: 14,
    erankResultCount: 16,
    erankFailureCount: 3,
    erankPendingCount: 0,
    etsyEligibleCount: 14,
    etsyCompletedCount: 0,
    etsyPendingCount: 14,
    everbeeResultCount: 0,
    activeService: 'etsy',
  })
  assert.equal(stages.find((item) => item.id === 'conditions').status, 'complete')
  assert.equal(stages.find((item) => item.id === 'erank').status, 'review')
  assert.equal(stages.find((item) => item.id === 'etsy').status, 'progress')
  assert.equal(stages.find((item) => item.id === 'results').status, 'locked')
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `node --test market-finder/scripts/test-research-console-ui.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `research-console-ui.js`.

- [ ] **Step 3: 純粋なUI状態モジュールを実装する**

```js
export const RESEARCH_STAGE_IDS = Object.freeze([
  'conditions',
  'candidates',
  'erank',
  'etsy',
  'results',
])

const QUEUE_FILTERS = new Set(['all', 'pending', 'active', 'completed', 'failed', 'hold'])

export function createResearchConsoleUi(saved = {}) {
  return {
    activeStage: RESEARCH_STAGE_IDS.includes(saved.activeStage) ? saved.activeStage : 'conditions',
    queueFilter: QUEUE_FILTERS.has(saved.queueFilter) ? saved.queueFilter : 'all',
    selectedKeyword: String(saved.selectedKeyword ?? ''),
  }
}

export function selectResearchStage(ui, activeStage) {
  if (!RESEARCH_STAGE_IDS.includes(activeStage)) return { ...ui }
  return { ...ui, activeStage, queueFilter: 'all' }
}

export function selectResearchQueueFilter(ui, queueFilter) {
  if (!QUEUE_FILTERS.has(queueFilter)) return { ...ui }
  return { ...ui, queueFilter }
}

function stage(id, label, status, count, message) {
  return { id, label, status, count: Number(count) || 0, message }
}

export function deriveResearchStageStates(metrics = {}) {
  const candidateCount = Number(metrics.candidateCount) || 0
  const readyCandidateCount = Number(metrics.readyCandidateCount) || 0
  const erankResultCount = Number(metrics.erankResultCount) || 0
  const erankFailureCount = Number(metrics.erankFailureCount) || 0
  const erankPendingCount = Number(metrics.erankPendingCount) || 0
  const etsyEligibleCount = Number(metrics.etsyEligibleCount) || 0
  const etsyCompletedCount = Number(metrics.etsyCompletedCount) || 0
  const etsyPendingCount = Number(metrics.etsyPendingCount) || 0
  const everbeeResultCount = Number(metrics.everbeeResultCount) || 0
  const activeService = String(metrics.activeService ?? '')

  return [
    stage('conditions', '条件', candidateCount > 0 ? 'complete' : 'available', candidateCount, candidateCount > 0 ? '候補作成済み' : '条件を入力'),
    stage('candidates', '候補', readyCandidateCount > 0 ? 'complete' : candidateCount > 0 ? 'review' : 'locked', readyCandidateCount, readyCandidateCount > 0 ? 'eRankへ送信可能' : '候補を確認'),
    stage('erank', 'eRank', activeService === 'erank' ? 'progress' : erankFailureCount > 0 || erankPendingCount > 0 ? 'review' : erankResultCount > 0 ? 'complete' : readyCandidateCount > 0 ? 'available' : 'locked', erankResultCount, erankFailureCount > 0 ? `${erankFailureCount}件の数値を要確認` : erankPendingCount > 0 ? `${erankPendingCount}件が未検索` : '需要を確認'),
    stage('etsy', 'Etsy公式', activeService === 'etsy' ? 'progress' : etsyCompletedCount > 0 && etsyPendingCount === 0 ? 'complete' : etsyCompletedCount > 0 ? 'review' : etsyEligibleCount > 0 ? 'available' : 'locked', etsyCompletedCount, etsyPendingCount > 0 ? `${etsyPendingCount}件が未完了` : etsyEligibleCount > 0 ? `${etsyEligibleCount}件を確認可能` : 'eRank候補待ち'),
    stage('results', '最終結果', activeService === 'everbee' ? 'progress' : everbeeResultCount > 0 ? 'complete' : ['erank', 'etsy'].includes(activeService) ? 'locked' : etsyCompletedCount > 0 || erankResultCount > 0 ? 'available' : 'locked', everbeeResultCount, everbeeResultCount > 0 ? '商品化候補を確認' : '売上確認待ち'),
  ]
}
```

- [ ] **Step 4: テストを通す**

Run: `node --test market-finder/scripts/test-research-console-ui.mjs`

Expected: PASS, 3 tests.

- [ ] **Step 5: コミットする**

```bash
git add market-finder/src/research-console-ui.js market-finder/scripts/test-research-console-ui.mjs
git commit -m "feat: add research console UI state model"
```

### Task 2: 5工程ConsoleのHTML骨格

**Files:**
- Modify: `market-finder/index.html`
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs`

**Interfaces:**
- Consumes: 既存の各工程セクションと全DOM ID。
- Produces: `#researchStageTabs`、5個の`[data-research-stage]`、`#researchQueue`、`#researchWorkspace`、`#researchInspector`、5個の`[data-research-panel]`。

- [ ] **Step 1: 新しい骨格とID一意性の失敗テストを書く**

```js
test('renders the five-stage research console', () => {
  assert.match(html, /id="researchStageTabs"/)
  for (const stage of ['conditions', 'candidates', 'erank', 'etsy', 'results']) {
    assert.match(html, new RegExp(`data-research-stage="${stage}"`))
    assert.match(html, new RegExp(`data-research-panel="${stage}"`))
  }
  assert.match(html, /id="researchQueue"/)
  assert.match(html, /id="researchWorkspace"/)
  assert.match(html, /id="researchInspector"/)
})

test('keeps extension and action DOM contracts unique', () => {
  for (const id of [
    'trendAutoBtn', 'candidateErankBtn', 'marketplaceStartBtn',
    'erankToEverbeeBtn', 'resultsList', 'downloadStep4CsvBtn',
  ]) {
    assert.equal(html.match(new RegExp(`id="${id}"`, 'g'))?.length, 1)
  }
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs`

Expected: FAIL because `researchStageTabs` and console panes do not exist.

- [ ] **Step 3: 既存セクションをConsoleへ再配置する**

`index.html`の自動調査ルートを次の構造へ変更する。既存セクションの内部要素とIDはそのまま移動する。

```html
<nav id="researchStageTabs" class="research-stage-tabs" aria-label="調査工程">
  <button type="button" data-research-stage="conditions" aria-selected="true"><span>1</span><strong>条件</strong><small id="researchStageConditionsStatus">未開始</small></button>
  <button type="button" data-research-stage="candidates" aria-selected="false"><span>2</span><strong>候補</strong><small id="researchStageCandidatesStatus">未開始</small></button>
  <button type="button" data-research-stage="erank" aria-selected="false"><span>3</span><strong>eRank</strong><small id="researchStageErankStatus">未開始</small></button>
  <button type="button" data-research-stage="etsy" aria-selected="false"><span>4</span><strong>Etsy公式</strong><small id="researchStageEtsyStatus">未開始</small></button>
  <button type="button" data-research-stage="results" aria-selected="false"><span>5</span><strong>最終結果</strong><small id="researchStageResultsStatus">未開始</small></button>
</nav>

<section id="researchConsole" class="research-console flow-auto-only">
  <aside id="researchQueue" class="research-console-queue" aria-label="処理キュー">
    <div id="researchQueueFilters" class="research-queue-filters"></div>
    <div id="researchQueueList" class="research-queue-list"></div>
  </aside>
  <div id="researchWorkspace" class="research-console-workspace"></div>
  <aside id="researchInspector" class="research-console-inspector" aria-label="選択キーワードの詳細">
    <div id="researchInspectorContent" class="research-inspector-content"></div>
  </aside>
</section>
```

`.quick-start`は自動調査とCSV判定を切り替える共通入口としてConsoleの上に残す。`.simple-runner`もCSV/SEOルート用としてConsole外に残す。`#researchWorkspace`内では残りの既存要素を次の単位で移動し、各親へ`data-research-panel`を付ける。

- `conditions`: 現在の`.controls-panel`
- `candidates`: 現在の`.candidates-panel`
- `erank`: 現在の`.erank-section`
- `etsy`: 現在の`#marketplaceInsightPanel`
- `results`: 現在の`.results-section`と`.seo-section`

現在の`.research-panel`は削除せず、`#researchInspector`内の`<details class="advanced-research-input advanced-only">`へ移す。これにより手入力、CSV貼り付け、拡張機能用入力の既存IDとイベントを維持する。非active panelには`hidden`属性を設定し、active panelだけ外す。

- [ ] **Step 4: HTML回帰テストを通す**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs`

Expected: PASS for existing workflow ordering and new Console structure tests.

- [ ] **Step 5: コミットする**

```bash
git add market-finder/index.html market-finder/scripts/test-guided-entry-ui.mjs
git commit -m "feat: restructure Market Finder as research console"
```

### Task 3: 工程タブ、復元、状態サマリーの連携

**Files:**
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs`

**Interfaces:**
- Consumes: Task 1の`createResearchConsoleUi()`と`deriveResearchStageStates()`、既存`state`、既存件数関数。
- Produces: `setActiveResearchStage()`、`researchConsoleMetrics()`、`renderResearchStageTabs()`、保存済み`marketState.consoleUi`。

- [ ] **Step 1: import、保存、タブ操作の失敗テストを書く**

```js
test('persists and restores research console UI state', () => {
  assert.match(app, /createResearchConsoleUi/)
  assert.match(app, /consoleUi: state\.consoleUi/)
  assert.match(app, /state\.consoleUi = createResearchConsoleUi\(savedState\.consoleUi\)/)
})

test('switches stages without clearing research data', () => {
  assert.match(app, /function setActiveResearchStage\(/)
  assert.match(app, /data-research-stage/)
  assert.doesNotMatch(app, /function setActiveResearchStage[\s\S]{0,500}state\.researchRows = \[\]/)
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs`

Expected: FAIL because Console state is not imported or persisted.

- [ ] **Step 3: Console状態を`app.js`へ接続する**

```js
import {
  createResearchConsoleUi,
  deriveResearchStageStates,
  selectResearchQueueFilter,
  selectResearchStage,
} from './research-console-ui.js?v=20260722-1'

// state
consoleUi: createResearchConsoleUi(),

function researchConsoleMetrics() {
  const captureStates = erankCaptureStateRows()
  const marketplaceItems = state.marketplaceInsightPlan?.items ?? []
  const activeService = state.marketplaceInsightAutoRunning
    ? 'etsy'
    : state.extensionState?.active
      ? String(state.extensionState.mode ?? '').toLowerCase().includes('erank') ? 'erank' : 'everbee'
      : ''
  return {
    candidateCount: state.candidates.length,
    readyCandidateCount: readyKeywords().length,
    erankResultCount: erankResultRows().length,
    erankFailureCount: captureStates.filter((row) => row.status === 'failed').length,
    erankPendingCount: captureStates.filter((row) => row.status === 'unsearched').length,
    etsyEligibleCount: buildEtsyCandidatesFromErank(erankResultRows(), state.candidates).length,
    etsyCompletedCount: marketplaceItems.filter((item) => item.status === 'completed').length,
    etsyPendingCount: marketplaceItems.filter((item) => !['completed', 'skipped'].includes(item.status)).length,
    everbeeResultCount: everbeeResultRows().length,
    activeService,
  }
}

function setActiveResearchStage(stageId, { persist = true } = {}) {
  state.consoleUi = selectResearchStage(state.consoleUi, stageId)
  renderResearchStageTabs()
  renderActiveResearchStage()
  if (persist) persistMarketFinderState()
}

function renderResearchStageTabs() {
  const stages = deriveResearchStageStates(researchConsoleMetrics())
  elements.researchConsole.dataset.activeStage = state.consoleUi.activeStage
  elements.researchStageTabs.querySelectorAll('[data-research-stage]').forEach((button) => {
    const stage = stages.find((item) => item.id === button.dataset.researchStage)
    const active = stage?.id === state.consoleUi.activeStage
    button.setAttribute('aria-selected', String(active))
    button.dataset.status = stage?.status ?? 'locked'
    button.querySelector('small').textContent = stage?.count ? `${stage.count}件` : stage?.message ?? '未開始'
  })
  document.querySelectorAll('[data-research-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.researchPanel !== state.consoleUi.activeStage
  })
}
```

`persistMarketFinderState()`の`marketState`へ`consoleUi: state.consoleUi`を追加し、`restorePersistedState()`で`state.consoleUi = createResearchConsoleUi(savedState.consoleUi)`を実行する。

- [ ] **Step 4: タブ状態と保存テストを通す**

Run: `node --test market-finder/scripts/test-research-console-ui.mjs market-finder/scripts/test-guided-entry-ui.mjs`

Expected: PASS.

- [ ] **Step 5: コミットする**

```bash
git add market-finder/src/app.js market-finder/scripts/test-guided-entry-ui.mjs
git commit -m "feat: connect research console navigation"
```

### Task 4: QueueとInspector

**Files:**
- Modify: `market-finder/src/research-console-ui.js`
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-research-console-ui.mjs`
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs`

**Interfaces:**
- Consumes: eRank query plan、Marketplace plan、候補、最終結果の既存行。
- Produces: `filterResearchQueueRows()`、`researchQueueRows()`、`renderResearchQueue()`、`renderResearchInspector()`。

- [ ] **Step 1: Queueフィルターの失敗テストを書く**

```js
import { filterResearchQueueRows } from '../src/research-console-ui.js'

test('filters queue rows by normalized status', () => {
  const rows = [
    { keyword: 'a', status: 'pending' },
    { keyword: 'b', status: 'completed' },
    { keyword: 'c', status: 'failed' },
  ]
  assert.deepEqual(filterResearchQueueRows(rows, 'failed').map((row) => row.keyword), ['c'])
  assert.equal(filterResearchQueueRows(rows, 'all').length, 3)
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `node --test market-finder/scripts/test-research-console-ui.mjs`

Expected: FAIL because `filterResearchQueueRows` is not exported.

- [ ] **Step 3: Queueの純粋フィルターと画面アダプターを実装する**

```js
export function filterResearchQueueRows(rows = [], filter = 'all') {
  if (filter === 'all') return [...rows]
  return rows.filter((row) => row.status === filter)
}
```

`app.js`では工程ごとに既存状態を共通形へ変換する。

```js
function researchQueueRows(stageId = state.consoleUi.activeStage) {
  if (stageId === 'conditions') {
    return state.researchedMarketHistory.slice(0, 40).map((row) => ({ keyword: row.keyword, status: 'completed', detail: `${row.eventLabel || row.eventId} / ${formatDateTime(row.checkedAt) || '日時不明'}` }))
  }
  if (stageId === 'candidates') {
    const ready = new Set(readyKeywords().map(normalizePhrase))
    return state.candidates.map((row) => ({ keyword: row.keyword, status: ready.has(normalizePhrase(row.keyword)) ? 'completed' : 'hold', detail: row.sourceLabel ?? '' }))
  }
  if (stageId === 'erank') {
    return [
      ...erankResultRows().map((row) => ({ keyword: row.keyword, status: 'completed', detail: row.queryKind ?? '' })),
      ...erankCaptureStateRows().map((row) => ({ keyword: row.query, status: row.status === 'failed' ? 'failed' : 'pending', detail: row.error ?? row.queryKind ?? '' })),
    ]
  }
  if (stageId === 'etsy') {
    return (state.marketplaceInsightPlan?.items ?? []).map((row) => ({ keyword: row.query, status: row.status === 'error' ? 'failed' : row.status === 'opened' ? 'active' : row.status === 'completed' ? 'completed' : row.status === 'skipped' ? 'hold' : 'pending', detail: row.error ?? row.stage ?? '' }))
  }
  return everbeeResultRows().map((row) => ({ keyword: row.score.normalized.keyword, status: row.score.opportunityLabel === 'D' ? 'hold' : 'completed', detail: `${row.score.score}/100` }))
}
```

Queue行は`data-console-keyword`を持つbuttonで描画する。クリック時は`state.consoleUi.selectedKeyword`だけを更新し、外部検索は開始しない。Inspectorは選択語句に対応する既存行を探し、取得済み数値、由来、失敗列、判定理由を表示する。該当行がない場合は`キーワードを選択すると詳細を表示します`を表示する。

- [ ] **Step 4: Queue、選択、Inspectorのテストを通す**

Run: `node --test market-finder/scripts/test-research-console-ui.mjs market-finder/scripts/test-guided-entry-ui.mjs`

Expected: PASS, including assertions for `data-console-keyword`, `renderResearchQueue`, and `renderResearchInspector`.

- [ ] **Step 5: コミットする**

```bash
git add market-finder/src/research-console-ui.js market-finder/src/app.js market-finder/scripts/test-research-console-ui.mjs market-finder/scripts/test-guided-entry-ui.mjs
git commit -m "feat: add research queue and keyword inspector"
```

### Task 5: 最終結果専用Workspaceと出力操作

**Files:**
- Modify: `market-finder/index.html`
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs`

**Interfaces:**
- Consumes: 既存`renderResultsTable()`、`copyKeywords()`、`exportStep4Csv()`、`exportErankCsv()`、調査ラウンド状態。
- Produces: `#finalResultToolbar`、`#copyFinalKeywordsBtn`、既存`#downloadStep4CsvBtn`の新表示名、`#downloadErankCsvBtn`の第5工程配置。

- [ ] **Step 1: 最終結果の操作契約テストを書く**

```js
test('gives final results a dedicated export toolbar', () => {
  assert.match(html, /id="finalResultToolbar"/)
  assert.match(html, /id="copyFinalKeywordsBtn"[^>]*>キーワードをコピー<\/button>/)
  assert.match(html, /id="downloadStep4CsvBtn"[^>]*>未来デザイナー用CSV<\/button>/)
  assert.match(html, /id="downloadErankCsvBtn"[^>]*>参考用eRank CSV<\/button>/)
  assert.match(app, /researchConsole\.dataset\.activeStage = state\.consoleUi\.activeStage/)
})

test('keeps final result groups and round history', () => {
  assert.match(app, /title: '商品化テスト候補'/)
  assert.match(app, /title: '追加探索候補'/)
  assert.match(app, /title: '除外候補'/)
  assert.match(html, /id="researchRoundTabs"/)
  assert.match(html, /id="researchRoundSummary"/)
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs`

Expected: FAIL because `finalResultToolbar` and `copyFinalKeywordsBtn` do not exist.

- [ ] **Step 3: 第5工程の専用Toolbarを実装する**

```html
<div id="finalResultToolbar" class="final-result-toolbar">
  <div class="final-result-context">
    <strong>調査結果と商品化候補</strong>
    <span id="finalResultFreshness">取得状況を確認中</span>
  </div>
  <div class="final-result-actions">
    <button id="copyFinalKeywordsBtn" type="button" class="ghost-btn">キーワードをコピー</button>
    <button id="downloadErankCsvBtn" type="button" class="ghost-btn">参考用eRank CSV</button>
    <button id="downloadStep4CsvBtn" type="button" class="primary-btn">未来デザイナー用CSV</button>
  </div>
</div>
```

`copyFinalKeywordsBtn`は`everbeeResultRows()`のA/B候補だけを順位順に改行区切りでコピーする`copyFinalKeywords()`へ接続する。既存`copyKeywordsBtn`は候補生成段階の全候補コピーとして残す。

`renderResearchStageTabs()`で`elements.researchConsole.dataset.activeStage = state.consoleUi.activeStage`を設定する。`results`の時は左右の共通QueueとInspectorを隠し、既存`results-comparison-layout`の一覧と詳細をConsole全幅で使用する。

```js
async function copyFinalKeywords() {
  const text = everbeeResultRows()
    .filter((row) => ['A', 'B'].includes(row.score.opportunityLabel))
    .map((row) => row.score.normalized.keyword)
    .join('\n')
  if (!text) return
  await navigator.clipboard.writeText(text)
  elements.copyFinalKeywordsBtn.textContent = 'コピーしました'
  window.setTimeout(() => {
    elements.copyFinalKeywordsBtn.textContent = 'キーワードをコピー'
  }, 1400)
}
```

- [ ] **Step 4: 最終結果テストを通す**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs market-finder/scripts/test-research-rounds.mjs market-finder/scripts/test-opportunity-model.mjs`

Expected: PASS.

- [ ] **Step 5: コミットする**

```bash
git add market-finder/index.html market-finder/src/app.js market-finder/scripts/test-guided-entry-ui.mjs
git commit -m "feat: add dedicated final results workspace"
```

### Task 6: 現在工程だけの詳細描画

**Files:**
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs`

**Interfaces:**
- Consumes: 既存の各`render*`関数と`state.consoleUi.activeStage`。
- Produces: `renderActiveResearchStage()`と軽量化した`renderAll()`。

- [ ] **Step 1: 非表示工程を全面描画しない失敗テストを書く**

```js
test('renders only the active research stage details', () => {
  assert.match(app, /function renderActiveResearchStage\(\)/)
  assert.match(app, /switch \(state\.consoleUi\.activeStage\)/)
  assert.doesNotMatch(app, /function renderAll\(\) \{\s*renderTrendScoutStatus\(\)[\s\S]*renderSeoPlan\(\)/)
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs`

Expected: FAIL because `renderAll()` still renders every long result list.

- [ ] **Step 3: 詳細描画を工程ごとに分岐する**

```js
function renderActiveResearchStage() {
  switch (state.consoleUi.activeStage) {
    case 'conditions':
      renderTrendScoutStatus()
      renderBroadHints()
      renderSearchSeedRows()
      break
    case 'candidates':
      renderCandidates()
      break
    case 'erank':
      renderErankResults()
      break
    case 'etsy':
      renderMarketplaceInsightPlan()
      break
    case 'results':
      renderResultsTable()
      renderCrossNicheDrilldown()
      renderSeoPlan()
      break
  }
  renderResearchQueue()
  renderResearchInspector()
}

function renderAll() {
  renderResearchStageTabs()
  renderActiveResearchStage()
  persistMarketFinderState()
}
```

外部取得イベント内で対象工程の詳細が必要な箇所は、既存のstate更新後に`renderResearchStageTabs()`を必ず呼ぶ。現在工程と取得サービスが一致する場合だけ`renderActiveResearchStage()`を追加で呼ぶ。

- [ ] **Step 4: 描画回帰テストを通す**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs market-finder/scripts/test-research-performance.mjs market-finder/scripts/test-research-flow.mjs`

Expected: PASS.

- [ ] **Step 5: コミットする**

```bash
git add market-finder/src/app.js market-finder/scripts/test-guided-entry-ui.mjs
git commit -m "perf: render only active research console stage"
```

### Task 7: Desktop Consoleスタイルと総合検証

**Files:**
- Modify: `market-finder/index.html`
- Modify: `market-finder/styles.css`
- Modify: `market-finder/SCREEN_GUIDE.md`
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs`

**Interfaces:**
- Consumes: Tasks 2から6のConsoleクラスと状態属性。
- Produces: 幅1280px以上の固定3列レイアウト、工程タブ、最終結果専用レイアウト、更新済み画面ガイド。

- [ ] **Step 1: デスクトップ設計制約の失敗テストを書く**

```js
test('styles a desktop research console without mobile stacking', () => {
  assert.match(styles, /\.research-console\s*\{[^}]*grid-template-columns:\s*220px\s+minmax\(720px,\s*1fr\)\s+320px/s)
  assert.match(styles, /\.research-stage-tabs/)
  assert.match(styles, /\.final-result-toolbar/)
  assert.doesNotMatch(styles, /@media[^{}]*max-width[^{}]*\{[\s\S]{0,800}\.research-console[^}]*grid-template-columns:\s*1fr/)
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs`

Expected: FAIL because Console CSS does not exist.

- [ ] **Step 3: Research Consoleスタイルを実装する**

```css
body {
  min-width: 1280px;
  overflow-x: auto;
}

h1 {
  font-size: 24px;
  line-height: 1.2;
}

.app-shell {
  width: min(1760px, calc(100% - 24px));
  padding: 12px 0 24px;
}

.research-stage-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  min-height: 58px;
  border: 1px solid var(--line);
  border-radius: 8px 8px 0 0;
  background: var(--panel);
}

.research-console {
  display: grid;
  grid-template-columns: 220px minmax(720px, 1fr) 320px;
  min-width: 1260px;
  height: calc(100vh - 176px);
  min-height: 640px;
  border: 1px solid var(--line);
  border-top: 0;
  background: var(--panel);
}

.research-console-queue,
.research-console-inspector {
  min-width: 0;
  overflow: auto;
  background: #f8fafc;
}

.research-console-queue { border-right: 1px solid var(--line); }
.research-console-inspector { border-left: 1px solid var(--line); }
.research-console-workspace { min-width: 0; overflow: auto; }

.research-console[data-active-stage="results"] {
  grid-template-columns: minmax(0, 1fr);
}

.research-console[data-active-stage="results"] > .research-console-queue,
.research-console[data-active-stage="results"] > .research-console-inspector {
  display: none;
}

.final-result-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  justify-content: space-between;
  min-height: 58px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.98);
  padding: 10px 14px;
}
```

工程statusごとに`data-status="progress|complete|review|available|locked"`を使い、ティール、ブルー、アンバー、グレーを限定的に割り当てる。角丸は8px以下を維持する。

`index.html`のキャッシュバスターを`styles.css?v=20260722-3`と`src/app.js?v=20260722-3`へ更新し、ConsoleのCSSとJavaScriptが再読み込みで確実に反映されるようにする。

- [ ] **Step 4: 画面ガイドを現在構成へ更新する**

`SCREEN_GUIDE.md`へ、5工程タブ、Queue、Workspace、Inspector、最終結果の出力ボタン、無効ボタン理由の確認場所を記載する。旧来の縦長スクロール手順は削除する。

- [ ] **Step 5: 全自動テストを実行する**

Run:

```powershell
Get-ChildItem market-finder\scripts\test-*.mjs | ForEach-Object { node --test $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
node market-finder\scripts\validate-scoring.mjs
node market-finder\scripts\validate-halloween-research.mjs
npm --prefix etsy-chrome-extension test
```

Expected: all Node tests PASS; both validation scripts exit 0.

- [ ] **Step 6: デスクトップ画面を確認する**

Run: `node market-finder/scripts/static-server.mjs`

Verify at 1440x900 and 1920x1080:

- 5工程タブ、Queue、Workspace、Inspectorが重ならない。
- Queue、Workspace、Inspectorが各領域内でスクロールする。
- eRank取得中に工程を切り替えても進捗と結果が消えない。
- 無効な主ボタンの直下に理由が表示される。
- 第5工程のキーワードコピー、未来デザイナー用CSV、参考用eRank CSVが動く。
- 500件の保存済みeRank結果でも工程切り替えと行選択が目立って遅延しない。

- [ ] **Step 7: 差分を確認してコミットする**

```bash
git diff --check
git status --short
git add market-finder/index.html market-finder/styles.css market-finder/SCREEN_GUIDE.md market-finder/scripts/test-guided-entry-ui.mjs
git commit -m "style: finish desktop Market Finder research console"
```

## Final Verification

- [ ] `git diff --check`が空で終了する。
- [ ] `git status --short`でユーザーの既存未追跡ファイルを変更していないことを確認する。
- [ ] `npm --prefix etsy-chrome-extension test`を実行し、Chrome拡張のビルドと既存テストが通ることを確認する。
- [ ] Market Finderを起動し、実Chromeで候補生成から第5工程までの主操作を1回通す。
- [ ] 実装コミットを`codex/market-finder-research-improvements`へpushする。
