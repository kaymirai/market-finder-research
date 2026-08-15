# Market Finder Multi-Angle Exploration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A/B候補が不足したとき、販売時期を守りながら複数の探索角度へ自動で切り替え、重複検索せずに週次目標または探索枯渇まで完走させる。

**Architecture:** 既存のEtsy・EverBee検証パイプラインは変更せず、その前段に「販売時期ゲート」「候補生成アダプター」「探索台帳付きオーケストレーター」を追加する。画面側は既存の`pendingEvidenceAutomation`へ次バッチを渡し、結果を今回イベント、エバーグリーン、今作るべき季節参考の3レーンに分ける。

**Tech Stack:** Browser ES modules, Node.js built-in test runner, static HTML/CSS, localStorage, existing local JSON archive API

## Global Constraints

- 標準準備期間は需要ピークの2か月前とする。
- 実際の「今作るべき」範囲は需要ピークまで45～75日とする。
- 調査開始時に選んだイベントは、調査完了まで固定する。
- 別イベントへ自動で切り替えない。
- 別イベント候補は今回のA/B目標件数に算入しない。
- イベント名を含まない大市場とエバーグリーン市場を調査対象にできる。
- 候補生成元だけを理由にA/B判定へ昇格させない。
- Marketplace InsightsとEverBeeの既存検証工程を共通の最終判定として維持する。
- モバイル対応は行わない。
- 既存の保存結果と調査アーカイブを破壊しない。

---

## File Structure

### Create

- `shared/market-keyword-engine/market-timing.js`
  固定日、移動祝日、月間イベントの需要ピーク日を解決し、45～75日の制作期間を判定する。
- `market-finder/src/multi-angle-candidates.js`
  既存データを需要周辺、属性、新着販売、別商品、市場空白、エバーグリーンの候補へ変換する。
- `market-finder/src/multi-angle-exploration.js`
  探索角度の順序、調査済み台帳、次バッチ、完了・枯渇判定を管理する。
- `market-finder/scripts/test-market-timing.mjs`
  需要ピーク日と45～75日判定を検証する。
- `market-finder/scripts/test-multi-angle-candidates.mjs`
  各候補生成元と3つの結果レーンを検証する。
- `market-finder/scripts/test-multi-angle-exploration.mjs`
  角度切替、重複排除、再開、目標到達、探索枯渇を検証する。
- `market-finder/scripts/test-multi-angle-ui.mjs`
  デスクトップ画面の状態表示と操作要素を検証する。

### Modify

- `shared/market-keyword-engine/index.js`
  新しい時期判定を再公開し、既存の`getMarketTiming()`を互換ラッパーにする。
- `market-finder/src/winning-niche-automation.js`
  既存状態を新オーケストレーターへ移行するための読み取り互換を追加する。
- `market-finder/src/app.js`
  候補プール構築、時期ゲート、次バッチ投入、保存、3レーン表示を接続する。
- `market-finder/index.html`
  時期判定、探索角度、3レーンの表示領域を追加し、モジュール版番号を更新する。
- `market-finder/styles.css`
  デスクトップ用の探索状況レールと結果レーンを追加する。
- `market-finder/scripts/test-opportunity-model.mjs`
  新しい時期判定の互換性を確認する。
- `market-finder/scripts/test-winning-niche-automation.mjs`
  旧保存状態から新状態への移行を確認する。
- `market-finder/scripts/test-evidence-archive.mjs`
  探索台帳と候補出所がアーカイブへ保存されることを確認する。
- `market-finder/scripts/test-research-rounds.mjs`
  探索角度ごとのラウンド表示を確認する。
- `market-finder/README.md`
  多角的探索、時期判定、終了条件を追記する。
- `market-finder/SCREEN_GUIDE.md`
  画面上の時期警告、探索角度、3レーンの読み方を追記する。

---

### Task 1: 販売時期ゲート

**Files:**
- Create: `shared/market-keyword-engine/market-timing.js`
- Create: `market-finder/scripts/test-market-timing.mjs`
- Modify: `shared/market-keyword-engine/index.js`
- Modify: `market-finder/scripts/test-opportunity-model.mjs`

**Interfaces:**
- Consumes: `event.id`, `event.month`, `event.searchTerm`, `Date`
- Produces:
  - `resolveEventPeakDate(event: object, year: number): Date | null`
  - `nextEventPeakDate(event: object, now?: Date): Date | null`
  - `classifyProductionWindow(event: object, now?: Date): { status, daysUntil, peakDate, canAutoResearch }`
  - `buildTimelySeasonalSuggestions(events: object[], options: object): object[]`
  - 互換用`getMarketTiming(event, now)`

- [ ] **Step 1: 需要ピーク日と制作期間の失敗テストを書く**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTimelySeasonalSuggestions,
  classifyProductionWindow,
  resolveEventPeakDate,
} from '../../shared/market-keyword-engine/market-timing.js'

test('resolves fixed and movable 2026 event dates', () => {
  assert.equal(
    resolveEventPeakDate({ id: 'halloween', month: 10 }, 2026).toISOString().slice(0, 10),
    '2026-10-31',
  )
  assert.equal(
    resolveEventPeakDate({ id: 'thanksgiving', month: 11 }, 2026).toISOString().slice(0, 10),
    '2026-11-26',
  )
  assert.equal(
    resolveEventPeakDate({ id: 'mothers-day', month: 5 }, 2026).toISOString().slice(0, 10),
    '2026-05-10',
  )
})

test('treats 45 through 75 days as the production window', () => {
  const event = { id: 'halloween', month: 10 }
  assert.equal(classifyProductionWindow(event, new Date('2026-08-17T00:00:00Z')).status, 'timely')
  assert.equal(classifyProductionWindow(event, new Date('2026-09-20T00:00:00Z')).status, 'late')
  assert.equal(classifyProductionWindow(event, new Date('2026-07-01T00:00:00Z')).status, 'early')
})

test('never includes the active event in seasonal reference suggestions', () => {
  const suggestions = buildTimelySeasonalSuggestions([
    { id: 'halloween', month: 10 },
    { id: 'thanksgiving', month: 11 },
    { id: 'valentines-day', month: 2 },
  ], {
    selectedEventId: 'halloween',
    now: new Date('2026-09-20T00:00:00Z'),
  })
  assert.deepEqual(suggestions.map((item) => item.event.id), ['thanksgiving'])
})
```

- [ ] **Step 2: テストを実行し、未実装で失敗することを確認する**

Run:

```powershell
node --test market-finder/scripts/test-market-timing.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` for `market-timing.js`.

- [ ] **Step 3: 固定日・移動祝日・月間イベントの解決を実装する**

`market-timing.js`に次の規則を実装する。

```js
export const PRODUCTION_WINDOW_MIN_DAYS = 45
export const PRODUCTION_WINDOW_MAX_DAYS = 75

const FIXED_DATES = Object.freeze({
  'new-years-day': [1, 1],
  'valentines-day': [2, 14],
  'galentines-day': [2, 13],
  'st-patricks-day': [3, 17],
  'earth-day': [4, 22],
  'national-pet-day': [4, 11],
  'cinco-de-mayo': [5, 5],
  juneteenth: [6, 19],
  'canada-day': [7, 1],
  'independence-day': [7, 4],
  halloween: [10, 31],
  'veterans-day': [11, 11],
  christmas: [12, 25],
  'new-years-eve': [12, 31],
})

const NTH_WEEKDAY_RULES = Object.freeze({
  'mlk-day': { month: 1, weekday: 1, occurrence: 3 },
  'mothers-day': { month: 5, weekday: 0, occurrence: 2 },
  'fathers-day': { month: 6, weekday: 0, occurrence: 3 },
  'labor-day': { month: 9, weekday: 1, occurrence: 1 },
  'canadian-thanksgiving': { month: 10, weekday: 1, occurrence: 2 },
  thanksgiving: { month: 11, weekday: 4, occurrence: 4 },
})
```

`memorial-day`は5月最終月曜日、`black-friday`はThanksgiving翌日として解決する。月間イベントはその月の1日、`auto-discovery`と`month: 0`は`null`にする。翌年を選ぶのは、今年の対象日が現在日より前の場合だけにする。

- [ ] **Step 4: 既存`getMarketTiming()`を互換ラッパーへ変更する**

`index.js`から新関数を再公開し、既存UIが期待する`label`、`weeksUntil`、`priority`を保持する。

```js
export {
  buildTimelySeasonalSuggestions,
  classifyProductionWindow,
  nextEventPeakDate,
  resolveEventPeakDate,
} from './market-timing.js'

export function getMarketTiming(event = {}, now = new Date()) {
  const timing = classifyProductionWindow(event, now)
  const label = {
    evergreen: 'evergreen',
    timely: 'launch',
    early: 'prepare',
    late: 'late',
  }[timing.status]
  return {
    ...timing,
    label,
    weeksUntil: timing.daysUntil === null ? null : Math.round(timing.daysUntil / 7),
    priority: timing.status === 'timely' ? 5 : timing.status === 'early' ? 2 : 1,
  }
}
```

- [ ] **Step 5: 新旧の時期テストを通す**

Run:

```powershell
node --test market-finder/scripts/test-market-timing.mjs market-finder/scripts/test-opportunity-model.mjs
```

Expected: all tests pass.

- [ ] **Step 6: Task 1をコミットする**

```powershell
git add shared/market-keyword-engine/market-timing.js shared/market-keyword-engine/index.js market-finder/scripts/test-market-timing.mjs market-finder/scripts/test-opportunity-model.mjs
git commit -m "feat: gate market research by production timing"
```

---

### Task 2: 多角的な候補生成アダプター

**Files:**
- Create: `market-finder/src/multi-angle-candidates.js`
- Create: `market-finder/scripts/test-multi-angle-candidates.mjs`
- Modify: `shared/market-keyword-engine/index.js`

**Interfaces:**
- Consumes:
  - `event`, `category`
  - Marketplace Insightsの関連語
  - `buildCrossNicheDrilldown()`の候補
  - `buildNextWinningNicheBatch()`の属性候補
  - 保存済みEverBee商品タイトル
  - 他の商品種で観測されたタイトル
- Produces:
  - `normalizeExplorationCandidate(candidate): ExplorationCandidate | null`
  - `buildMultiAngleCandidatePools(input): Record<angleId, ExplorationCandidate[]>`
  - `candidateEvidenceKey(candidate): string`
  - `candidateProvenanceKey(candidate): string`

`ExplorationCandidate`の必須フィールド:

```js
{
  keyword: 'spooky nurse shirt',
  categoryId: 'shirt',
  eventId: 'halloween',
  angleId: 'recent-sales',
  source: 'everbee-title',
  sourceKeywords: ['halloween nurse shirt'],
  resultLane: 'event',
  priorityScore: 82,
  timingStatus: 'timely',
}
```

- [ ] **Step 1: 各探索角度と重複排除の失敗テストを書く**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMultiAngleCandidatePools,
  candidateEvidenceKey,
  candidateProvenanceKey,
} from '../src/multi-angle-candidates.js'

const base = {
  event: { id: 'halloween', searchTerm: 'halloween' },
  category: { id: 'shirt', searchTerm: 'shirt', tags: ['tee'] },
  timingStatus: 'timely',
}

test('creates separate pools from demand, taxonomy, recent sales and adjacent products', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    relatedTerms: ['spooky nurse shirt'],
    taxonomyCandidates: [{ keyword: 'halloween gardener shirt', source: 'curated-taxonomy' }],
    drilldownCandidates: [{ keyword: 'ghost book lover shirt', source: 'everbee-title', priorityScore: 81 }],
    adjacentProductListings: [{
      title: 'Witchy Gardener Mug',
      categoryId: 'mug',
      sales: 9,
      listingAgeMonths: 5,
    }],
  })

  assert.equal(pools['demand-neighborhood'][0].keyword, 'spooky nurse shirt')
  assert.equal(pools['attribute-combination'][0].keyword, 'halloween gardener shirt')
  assert.equal(pools['recent-sales'][0].keyword, 'ghost book lover shirt')
  assert.equal(pools['adjacent-product'][0].keyword, 'witchy gardener shirt')
})

test('keeps provenance separate while deduping external evidence lookups', () => {
  const demand = {
    keyword: 'spooky nurse shirt',
    categoryId: 'shirt',
    eventId: 'halloween',
    angleId: 'demand-neighborhood',
  }
  const sales = { ...demand, angleId: 'recent-sales' }
  assert.equal(candidateEvidenceKey(demand), candidateEvidenceKey(sales))
  assert.notEqual(candidateProvenanceKey(demand), candidateProvenanceKey(sales))
})

test('places evergreen and timely other events outside the active-event lane', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    evergreenCandidates: [{ keyword: 'funny nurse shirt' }],
    seasonalReferenceCandidates: [{
      keyword: 'thanksgiving nurse shirt',
      eventId: 'thanksgiving',
      timingStatus: 'timely',
    }],
  })
  assert.equal(pools.evergreen[0].resultLane, 'evergreen')
  assert.equal(pools['seasonal-reference'][0].resultLane, 'seasonal-reference')
})
```

- [ ] **Step 2: テストを実行し、未実装で失敗することを確認する**

Run:

```powershell
node --test market-finder/scripts/test-multi-angle-candidates.mjs
```

Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 候補の正規化と2種類のキーを実装する**

外部検索の重複防止には探索角度を含めない。

```js
export function candidateEvidenceKey(candidate = {}) {
  return [
    normalizePhrase(candidate.keyword),
    String(candidate.categoryId ?? ''),
    String(candidate.eventId ?? ''),
  ].join('|')
}

export function candidateProvenanceKey(candidate = {}) {
  return `${candidateEvidenceKey(candidate)}|${String(candidate.angleId ?? '')}`
}
```

同じ語が複数角度から生成された場合、候補は1件にまとめ、`sources`と`angleIds`へ全出所を残す。

- [ ] **Step 4: 6つの候補プールを実装する**

角度IDと生成ルールを固定する。

```js
export const EXPLORATION_ANGLE_ORDER = Object.freeze([
  'demand-neighborhood',
  'attribute-combination',
  'recent-sales',
  'adjacent-product',
  'market-gap',
  'evergreen',
])
```

- `demand-neighborhood`: Marketplace Insights関連語のうち、現在の商品種と一致する語。
- `attribute-combination`: 既存`buildNextWinningNicheBatch()`の未調査候補。
- `recent-sales`: `buildCrossNicheDrilldown()`の`everbee-title`候補。
- `adjacent-product`: 他商品種タイトルから商品種語を除き、現在の商品種語へ差し替えた候補。販売数1以上かつ出品12か月以内を優先する。
- `market-gap`: 検索需要があり、親市場より競合が30%以上減少し、販売中商品2件以上の測定済み子市場。
- `evergreen`: イベント語を外しても、関連語または販売タイトルに完全フレーズが存在する候補。辞書だけからイベント語を外した候補は生成しない。
- `seasonal-reference`: 別イベントのうち`timingStatus === 'timely'`の候補。探索バッチには入れない。

- [ ] **Step 5: 候補生成テストを通す**

Run:

```powershell
node --test market-finder/scripts/test-multi-angle-candidates.mjs market-finder/scripts/test-niche-drilldown-graph.mjs
```

Expected: all tests pass.

- [ ] **Step 6: Task 2をコミットする**

```powershell
git add market-finder/src/multi-angle-candidates.js market-finder/scripts/test-multi-angle-candidates.mjs shared/market-keyword-engine/index.js
git commit -m "feat: generate candidates from multiple market angles"
```

---

### Task 3: 探索台帳とオーケストレーター

**Files:**
- Create: `market-finder/src/multi-angle-exploration.js`
- Create: `market-finder/scripts/test-multi-angle-exploration.mjs`
- Modify: `market-finder/src/winning-niche-automation.js`
- Modify: `market-finder/scripts/test-winning-niche-automation.mjs`

**Interfaces:**
- Consumes:
  - Task 2の`EXPLORATION_ANGLE_ORDER`
  - `candidateEvidenceKey()`
  - `Record<angleId, ExplorationCandidate[]>`
  - 既存のA/B結果行
- Produces:
  - `createMultiAngleExplorationState(saved): MultiAngleExplorationState`
  - `migrateWinningNicheState(saved): MultiAngleExplorationState`
  - `startMultiAngleExploration(state, context, now): MultiAngleExplorationState`
  - `nextMultiAngleBatch(options): { state, candidates, reason }`
  - `recordMultiAngleBatch(state, rows, now): MultiAngleExplorationState`
  - `recordMultiAngleFailure(state, candidate, failure, now): MultiAngleExplorationState`
  - `pauseMultiAngleExploration()`, `resumeMultiAngleExploration()`, `stopMultiAngleExploration()`

状態の必須フィールド:

```js
{
  status: 'idle',
  activeEventId: '',
  categoryId: '',
  currentAngleId: '',
  angleIndex: 0,
  evidenceKeys: [],
  provenance: {},
  queuedEvidenceKeys: [],
  retryQueue: [],
  failedEvidenceKeys: [],
  winnerKeywords: [],
  targetWinnerCount: 1,
  resultLanes: {
    event: [],
    evergreen: [],
    seasonalReference: [],
  },
  exhaustedAngles: [],
  startedAt: '',
  updatedAt: '',
  completedAt: '',
  pauseReason: '',
}
```

- [ ] **Step 1: 角度切替と完了条件の失敗テストを書く**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMultiAngleExplorationState,
  nextMultiAngleBatch,
  recordMultiAngleBatch,
  recordMultiAngleFailure,
  startMultiAngleExploration,
} from '../src/multi-angle-exploration.js'

const context = {
  activeEventId: 'halloween',
  categoryId: 'shirt',
  targetWinnerCount: 2,
}

test('moves to the next angle without repeating the same evidence lookup', () => {
  const started = startMultiAngleExploration({}, context, '2026-07-30T00:00:00Z')
  const pools = {
    'demand-neighborhood': [{ keyword: 'spooky nurse shirt', categoryId: 'shirt', eventId: 'halloween' }],
    'attribute-combination': [{ keyword: 'spooky nurse shirt', categoryId: 'shirt', eventId: 'halloween' }],
    'recent-sales': [{ keyword: 'ghost gardener shirt', categoryId: 'shirt', eventId: 'halloween' }],
  }
  const first = nextMultiAngleBatch({
    state: started,
    pools,
    limit: 8,
  })
  const researched = recordMultiAngleBatch(first.state, [{
    keyword: 'spooky nurse shirt',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'C',
  }], '2026-07-30T00:05:00Z')
  const second = nextMultiAngleBatch({ state: researched, pools, limit: 8 })
  assert.deepEqual(second.candidates.map((item) => item.keyword), ['ghost gardener shirt'])
})

test('finishes when the A/B target is reached', () => {
  const started = startMultiAngleExploration({}, context)
  const completed = recordMultiAngleBatch(started, [
    { keyword: 'one', evidenceState: { status: 'verified' }, opportunityLabel: 'A' },
    { keyword: 'two', evidenceState: { status: 'verified' }, opportunityLabel: 'B' },
  ])
  assert.equal(completed.status, 'winner-found')
  assert.equal(completed.winnerKeywords.length, 2)
})

test('finishes as exhausted after every angle has no unseen candidates', () => {
  const started = startMultiAngleExploration({}, context)
  const result = nextMultiAngleBatch({ state: started, pools: {}, limit: 8 })
  assert.equal(result.state.status, 'exhausted')
  assert.equal(result.reason, 'all-angles-exhausted')
})

test('moves one timed-out keyword to retry wait and continues other candidates', () => {
  const started = startMultiAngleExploration({}, context)
  const candidate = {
    keyword: 'spooky nurse shirt',
    categoryId: 'shirt',
    eventId: 'halloween',
  }
  const failed = recordMultiAngleFailure(started, candidate, {
    code: 'page-timeout',
    retryAfterMs: 60_000,
  }, '2026-07-30T00:00:00Z')
  assert.equal(failed.retryQueue[0].attempts, 1)
  assert.equal(failed.retryQueue[0].retryAt, '2026-07-30T00:01:00.000Z')
  assert.equal(failed.status, 'running')
})

test('stops retrying one keyword after two timeouts', () => {
  const candidate = {
    keyword: 'spooky nurse shirt',
    categoryId: 'shirt',
    eventId: 'halloween',
  }
  const started = startMultiAngleExploration({}, context)
  const once = recordMultiAngleFailure(started, candidate, {
    code: 'page-timeout',
    retryAfterMs: 1,
  }, '2026-07-30T00:00:00Z')
  const twice = recordMultiAngleFailure(once, candidate, {
    code: 'page-timeout',
    retryAfterMs: 1,
  }, '2026-07-30T00:01:00Z')
  assert.equal(twice.retryQueue.length, 0)
  assert.equal(twice.failedEvidenceKeys.length, 1)
})
```

- [ ] **Step 2: テストを実行し、未実装で失敗することを確認する**

Run:

```powershell
node --test market-finder/scripts/test-multi-angle-exploration.mjs
```

Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 状態の復元、開始、重複排除を実装する**

復元時は未知の状態値を`idle`へ戻す。`evidenceKeys`は「語、商品種、イベント」で重複排除し、`provenance`には同じ語を発見した全探索角度を保持する。`seasonal-reference`は`resultLanes.seasonalReference`へ保存するだけで、`queuedEvidenceKeys`へ入れない。

- [ ] **Step 4: 次バッチと終了判定を実装する**

```js
export function nextMultiAngleBatch({
  state,
  pools = {},
  angleOrder = EXPLORATION_ANGLE_ORDER,
  limit = 8,
} = {}) {
  let current = createMultiAngleExplorationState(state)
  if (['winner-found', 'paused', 'stopped', 'exhausted'].includes(current.status)) {
    return { state: current, candidates: [], reason: `status-${current.status}` }
  }

  const used = new Set([...current.evidenceKeys, ...current.queuedEvidenceKeys])
  const exhausted = new Set(current.exhaustedAngles)
  for (let index = current.angleIndex; index < angleOrder.length; index += 1) {
    const angleId = angleOrder[index]
    const unseen = (pools[angleId] ?? [])
      .filter((candidate) => !used.has(candidateEvidenceKey(candidate)))
      .slice(0, Math.max(1, Math.min(30, Number(limit) || 8)))
    if (unseen.length === 0) {
      exhausted.add(angleId)
      continue
    }

    const queuedEvidenceKeys = unseen.map(candidateEvidenceKey)
    return {
      state: {
        ...current,
        status: 'running',
        currentAngleId: angleId,
        angleIndex: index,
        queuedEvidenceKeys,
        exhaustedAngles: [...exhausted],
      },
      candidates: unseen,
      reason: 'batch-ready',
    }
  }

  current = {
    ...current,
    status: 'exhausted',
    queuedEvidenceKeys: [],
    exhaustedAngles: [...new Set([...exhausted, ...angleOrder])],
    completedAt: current.completedAt || new Date().toISOString(),
  }
  return { state: current, candidates: [], reason: 'all-angles-exhausted' }
}
```

`recordMultiAngleBatch()`は、検証済みA/Bのみ`winnerKeywords`へ追加する。C/D、欠損、未検証は勝ち候補へ含めない。

`recordMultiAngleFailure()`は、個別キーワードの`page-timeout`を`retryQueue`へ移して他候補を続行する。同じ証拠キーは最大2回までとし、2回目の失敗後は`failedEvidenceKeys`へ移す。`service-unavailable`、`login-required`、`rate-limited`は個別候補の問題ではないため、状態全体を`paused`にして現在バッチを保持する。

- [ ] **Step 5: 旧`winningNicheAutomation`状態の移行を実装する**

既存ユーザーの保存状態を失わないように、次の対応で移す。

```js
export function migrateWinningNicheState(saved = {}) {
  const context = {
    categoryId: String(saved.categoryId ?? ''),
    eventId: String(saved.eventId ?? ''),
  }
  return createMultiAngleExplorationState({
    status: saved.status === 'winner-found' ? 'winner-found'
      : saved.status === 'paused' ? 'paused'
        : saved.status === 'stopped' ? 'stopped'
          : saved.status === 'exhausted' ? 'running'
            : saved.status,
    activeEventId: saved.eventId,
    categoryId: saved.categoryId,
    currentAngleId: saved.currentAxis ? 'attribute-combination' : '',
    evidenceKeys: (saved.researchedKeywords ?? []).map((keyword) => (
      candidateEvidenceKey({ ...context, keyword })
    )),
    queuedEvidenceKeys: (saved.queuedKeywords ?? []).map((keyword) => (
      candidateEvidenceKey({ ...context, keyword })
    )),
    retryQueue: [],
    failedEvidenceKeys: [],
    winnerKeywords: saved.winnerKeywords,
    targetWinnerCount: saved.targetWinnerCount,
    startedAt: saved.startedAt,
    updatedAt: saved.updatedAt,
    completedAt: saved.completedAt,
    pauseReason: saved.pauseReason,
  })
}
```

`resultLane: 'seasonal-reference'`は状態内の`resultLanes.seasonalReference`へ、`resultLane: 'evergreen'`は`resultLanes.evergreen`へ、それ以外は`resultLanes.event`へ保存する。

- [ ] **Step 6: オーケストレーターと移行テストを通す**

Run:

```powershell
node --test market-finder/scripts/test-multi-angle-exploration.mjs market-finder/scripts/test-winning-niche-automation.mjs
```

Expected: all tests pass.

- [ ] **Step 7: Task 3をコミットする**

```powershell
git add market-finder/src/multi-angle-exploration.js market-finder/scripts/test-multi-angle-exploration.mjs market-finder/src/winning-niche-automation.js market-finder/scripts/test-winning-niche-automation.mjs
git commit -m "feat: orchestrate multi-angle niche exploration"
```

---

### Task 4: 既存の自動リサーチと保存処理へ接続

**Files:**
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-evidence-archive.mjs`
- Modify: `market-finder/scripts/test-research-rounds.mjs`
- Modify: `market-finder/src/research-rounds.js`

**Interfaces:**
- Consumes:
  - `buildMultiAngleCandidatePools()`
  - `nextMultiAngleBatch()`
  - 既存`pendingEvidenceAutomation`
  - 既存`finalEvidenceRows()`
  - 既存`persistMarketFinderState()`
- Produces:
  - 保存状態`state.multiAngleExploration`
  - `currentMultiAnglePools()`
  - `queueNextMultiAngleBatch()`
  - `completeMultiAngleBatch()`
  - アーカイブ内`multiAngleExploration`と`explorationProvenance`

- [ ] **Step 1: 保存・再開・ラウンドの失敗テストを書く**

`test-evidence-archive.mjs`へ、次の期待を追加する。

```js
assert.deepEqual(record.multiAngleExploration.exhaustedAngles, [
  'demand-neighborhood',
  'attribute-combination',
])
assert.deepEqual(
  record.explorationProvenance['spooky nurse shirt|shirt|halloween'],
  ['demand-neighborhood', 'recent-sales'],
)
```

`test-research-rounds.mjs`へ、探索角度を保持するケースを追加する。

```js
const state = startResearchRound(createResearchRoundsState(), {
  type: 'multi-angle',
  angleId: 'recent-sales',
  depth: 1,
  status: 'pending-everbee',
  candidateKeywords: ['ghost gardener shirt'],
})
assert.equal(state.rounds[0].angleId, 'recent-sales')
```

- [ ] **Step 2: 対象テストを実行し、保存項目不足で失敗することを確認する**

Run:

```powershell
node --test market-finder/scripts/test-evidence-archive.mjs market-finder/scripts/test-research-rounds.mjs
```

Expected: missing `multiAngleExploration` / `angleId` assertions fail.

- [ ] **Step 3: アプリ状態の初期化と旧状態移行を接続する**

`state`へ追加する。

```js
multiAngleExploration: createMultiAngleExplorationState(),
```

復元は新状態を優先し、なければ旧状態から移行する。

```js
state.multiAngleExploration = savedState.multiAngleExploration
  ? createMultiAngleExplorationState(savedState.multiAngleExploration)
  : migrateWinningNicheState(savedState.winningNicheAutomation)
```

旧`winningNicheAutomation`は1リリース分だけ保存互換として残すが、新しい検索制御には使用しない。

- [ ] **Step 4: 既存データから角度別プールを組み立てる**

`currentMultiAnglePools()`で次を渡す。

```js
return buildMultiAngleCandidatePools({
  event: selectedEvent(),
  category: selectedCategory(),
  timingStatus: classifyProductionWindow(selectedEvent()).status,
  relatedTerms: marketplaceRelatedTerms(),
  taxonomyCandidates: nextTaxonomyCandidates(),
  drilldownCandidates: currentCrossNicheDrilldown().candidates,
  adjacentProductListings: evidenceLearningRecords()
    .flatMap((record) => record.supplyListings)
    .filter((listing) => listing.categoryId !== selectedCategory().id),
  measuredRows: finalEvidenceRows(),
  evergreenCandidates: measuredEventlessCandidates(),
  seasonalReferenceCandidates: currentSeasonalReferenceCandidates(),
})
```

存在しない補助関数は、既存の`state.marketplaceInsightPlan`、`state.evidenceArchives`、`finalEvidenceRows()`から配列を返す純粋な小関数として`app.js`内に置く。

- [ ] **Step 5: バッチ投入を既存検証パイプラインへ接続する**

`queueNextWinningNicheBatch()`を`queueNextMultiAngleBatch()`へ置き換える。候補が返った場合は、既存どおり次を設定する。

```js
state.candidates = candidates.map(multiAngleCandidateForResearch)
state.pendingEvidenceAutomation = {
  active: true,
  scheduled: false,
  initialCount: candidates.length,
  completedBatches: 0,
  currentStage: '',
  targetKeywords: candidates.map((candidate) => candidate.keyword),
}
schedulePendingEvidenceAutomation(0)
```

候補ゼロの場合は同じ角度を再実行せず、次の角度を呼ぶ。`all-angles-exhausted`のときだけ正常完了画面へ進める。

- [ ] **Step 6: バッチ結果を台帳へ記録し、次角度へ進める**

`completeMultiAngleBatch()`は`finalEvidenceRows()`から現在バッチだけを取り出し、`recordMultiAngleBatch()`へ渡す。

- A/B目標達成: `winner-found`
- 未達かつ未探索角度あり: `queueNextMultiAngleBatch()`
- 未達かつ全角度枯渇: `exhausted`
- 単一キーワードのページ無応答: `recordMultiAngleFailure()`へ渡し、他候補を続行
- サービス全体の停止・ログイン切れ・抑制: 現在候補を残して`paused`

各バッチの通常候補を処理した後、`retryQueue`の`retryAt`を過ぎた候補だけを再投入する。再試行待ちのために画面全体を待機させず、未調査の通常候補を先に進める。

- [ ] **Step 7: 保存・再開・ラウンドテストを通す**

Run:

```powershell
node --test market-finder/scripts/test-evidence-archive.mjs market-finder/scripts/test-research-rounds.mjs market-finder/scripts/test-research-flow.mjs
```

Expected: all tests pass.

- [ ] **Step 8: Task 4をコミットする**

```powershell
git add market-finder/src/app.js market-finder/src/research-rounds.js market-finder/scripts/test-evidence-archive.mjs market-finder/scripts/test-research-rounds.mjs
git commit -m "feat: connect multi-angle search to evidence automation"
```

---

### Task 5: 時期警告、探索角度、3レーンのデスクトップ画面

**Files:**
- Modify: `market-finder/index.html`
- Modify: `market-finder/styles.css`
- Modify: `market-finder/src/app.js`
- Create: `market-finder/scripts/test-multi-angle-ui.mjs`
- Modify: `market-finder/scripts/test-final-evidence-ui.mjs`

**Interfaces:**
- Consumes:
  - `state.multiAngleExploration`
  - `classifyProductionWindow(selectedEvent())`
  - `buildTimelySeasonalSuggestions()`
- Produces:
  - `renderMarketTimingGate()`
  - `renderExplorationAngleRail()`
  - `renderExplorationResultLanes()`
  - 時期外イベントの明示的続行ボタン

- [ ] **Step 1: 必須画面要素の失敗テストを書く**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8')

test('shows production timing and requires explicit override outside 45-75 days', () => {
  assert.match(html, /id="marketTimingGate"/)
  assert.match(html, /id="marketTimingOverrideBtn"/)
  assert.match(app, /renderMarketTimingGate/)
  assert.match(app, /timingOverrideConfirmed/)
})

test('shows six exploration angles and three result lanes', () => {
  assert.match(html, /id="multiAngleRail"/)
  assert.match(html, /id="activeEventResultLane"/)
  assert.match(html, /id="evergreenResultLane"/)
  assert.match(html, /id="seasonalReferenceLane"/)
  assert.match(app, /data-exploration-angle/)
})
```

- [ ] **Step 2: UIテストを実行し、要素不足で失敗することを確認する**

Run:

```powershell
node --test market-finder/scripts/test-multi-angle-ui.mjs
```

Expected: required element assertions fail.

- [ ] **Step 3: 時期ゲートを実装する**

調査開始前に次の状態を表示する。

- `timely`: 「今作る時期です。需要ピークまでN日」
- `early`: 「まだ早い時期です。別イベントへは移動しません」
- `late`: 「制作開始が遅い時期です。別イベントへは移動しません」
- `evergreen`: 「通年市場として調査できます」

`early`と`late`では自動検索を開始せず、「このイベントを続けて調査する」を押した場合だけ`timingOverrideConfirmed = true`にする。イベント選択変更時は必ず`false`へ戻す。

- [ ] **Step 4: 探索角度レールを実装する**

次の順で、状態を`未開始 / 調査中 / 完了 / 候補なし`として表示する。

```js
[
  ['demand-neighborhood', '需要周辺'],
  ['attribute-combination', '属性組み合わせ'],
  ['recent-sales', '新着販売'],
  ['adjacent-product', '別商品種'],
  ['market-gap', '市場の空白'],
  ['evergreen', '大市場・通年'],
]
```

現在の角度と、次の角度へ移った理由を常に表示する。

- [ ] **Step 5: 最終結果を3レーンに分ける**

- `activeEventResultLane`: 今回イベントの検証済みA/B/C/D
- `evergreenResultLane`: エバーグリーン候補
- `seasonalReferenceLane`: 今作るべき別季節の参考候補

参考候補の見出しに「今回のA/B目標には含みません」を表示する。参考候補から自動検索を開始するボタンは作らず、「次回候補に保存」だけを設ける。

- [ ] **Step 6: デスクトップレイアウトを整える**

`styles.css`は既存のカード幅と配色を再利用する。探索角度レールは横並び、3レーンは縦積みとし、狭幅用メディアクエリは追加しない。テキストが1文字ずつ折り返されないように、状態説明を含む列へ`min-width`を設定する。

- [ ] **Step 7: UI関連テストを通す**

Run:

```powershell
node --test market-finder/scripts/test-multi-angle-ui.mjs market-finder/scripts/test-final-evidence-ui.mjs market-finder/scripts/test-research-console-ui.mjs
```

Expected: all tests pass.

- [ ] **Step 8: Task 5をコミットする**

```powershell
git add market-finder/index.html market-finder/styles.css market-finder/src/app.js market-finder/scripts/test-multi-angle-ui.mjs market-finder/scripts/test-final-evidence-ui.mjs
git commit -m "feat: show timing and multi-angle research results"
```

---

### Task 6: 統合回帰、実画面確認、利用ガイド

**Files:**
- Modify: `market-finder/README.md`
- Modify: `market-finder/SCREEN_GUIDE.md`
- Modify: `market-finder/index.html`
- Test: `market-finder/scripts/test-*.mjs`

**Interfaces:**
- Consumes: Tasks 1～5の完成状態
- Produces: 起動後に時期ゲートから探索完了まで操作できる完成版

- [ ] **Step 1: 関連テストを一括実行する**

Run:

```powershell
node --test `
  market-finder/scripts/test-market-timing.mjs `
  market-finder/scripts/test-multi-angle-candidates.mjs `
  market-finder/scripts/test-multi-angle-exploration.mjs `
  market-finder/scripts/test-multi-angle-ui.mjs `
  market-finder/scripts/test-winning-niche-automation.mjs `
  market-finder/scripts/test-cross-niche-workflow.mjs `
  market-finder/scripts/test-evidence-archive.mjs `
  market-finder/scripts/test-research-flow.mjs `
  market-finder/scripts/test-research-rounds.mjs `
  market-finder/scripts/test-final-evidence-ui.mjs
```

Expected: all tests pass with no unhandled rejection.

- [ ] **Step 2: 全Market Finderテストを実行する**

Run:

```powershell
Get-ChildItem market-finder/scripts/test-*.mjs | ForEach-Object {
  node --test $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "Test failed: $($_.Name)" }
}
```

Expected: every test file exits 0. Existing unrelated failureがある場合は、今回変更による失敗と分けて記録する。

- [ ] **Step 3: 利用ガイドを更新する**

`README.md`へ次を追記する。

- 需要ピーク45～75日前だけを「今作るべき」とする。
- 選択イベントを固定し、別イベントへ自動移動しない。
- 候補不足時は6つの探索角度へ自動で切り替える。
- 週次A/B目標または全角度枯渇で正常完了する。

`SCREEN_GUIDE.md`へ次の操作順を追記する。

1. イベントと商品種を選ぶ。
2. 時期判定を確認する。
3. 時期外なら、続行する場合だけ明示ボタンを押す。
4. 「勝ち候補を探す」を押す。
5. 探索角度レールで進行を確認する。
6. 3つの結果レーンを確認する。

- [ ] **Step 4: ブラウザキャッシュ用の版番号を更新する**

`index.html`の`app.js`と`styles.css`のクエリ文字列を同じ日付連番へ更新する。

```html
<link rel="stylesheet" href="./styles.css?v=20260730-1">
<script type="module" src="./src/app.js?v=20260730-1"></script>
```

- [ ] **Step 5: ローカルアプリを起動して実画面を確認する**

Run:

```powershell
.\start-market-finder.cmd
```

Verify:

- `http://127.0.0.1:4174/market-finder/`がHTTP 200を返す。
- ハロウィン選択時に需要ピーク日と残り日数が表示される。
- 時期外イベントで自動検索が開始しない。
- 明示続行後は選択イベントのまま検索する。
- 一つの探索角度が空なら次の角度へ移る。
- 同じキーワードを別角度で再検索しない。
- 参考季節候補が今回のA/B件数へ加算されない。
- 目標達成または全角度枯渇で「完了」になる。

- [ ] **Step 6: 最終差分を確認する**

Run:

```powershell
git diff --check
git status --short
```

Expected: whitespace errorsなし。ユーザーの既存変更を今回のコミットへ混ぜない。

- [ ] **Step 7: Task 6をコミットする**

```powershell
git add market-finder/README.md market-finder/SCREEN_GUIDE.md market-finder/index.html
git commit -m "docs: explain multi-angle market research"
```
