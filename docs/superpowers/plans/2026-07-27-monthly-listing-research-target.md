# Monthly Listing Research Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 月間出品目標から週次の必要出品数とA/B必要件数を逆算し、設定値を画面で変更・保存でき、必要件数へ達するまで連続探索を止めないようにする。

**Architecture:** 逆算と入力検証は新しい純粋関数モジュールへ分離する。連続探索状態は算出済みの目標件数と週次サイクルを持ち、検証済みA/Bの一意件数だけで停止を判断する。`app.js`は入力・永続化・表示・外部探索開始の調整だけを担う。

**Tech Stack:** Vanilla JavaScript ES modules、Node.js `node:test`、静的HTML/CSS、localStorage、既存Chrome拡張連携。

## Global Constraints

- 初期設定は月間出品目標100、月間リサーチ回数4、A/B候補1件から5商品。
- 100・4・5では、1回25商品、A/B目標5件とする。
- 月間出品目標1〜1,000、月間リサーチ回数1〜31、1候補の商品数1〜50。
- 無効な入力では保存済み設定を上書きせず、外部調査を開始しない。
- 検証済みA/Bの一意キーワードだけを達成件数へ加算する。
- 現在の `halloween reading shirt` を1件目として保持する。
- 既存の市場機会スコア、A/B判定、取得済み結果を変更しない。
- モバイル対応は対象外。

---

### Task 1: 出品目標の逆算と入力検証

**Files:**
- Create: `market-finder/src/listing-research-target.js`
- Create: `market-finder/scripts/test-listing-research-target.mjs`

**Interfaces:**
- Produces: `normalizeListingResearchTarget(saved) -> settings`
- Produces: `validateListingResearchTargetDraft(draft, fallback) -> { valid, settings, errors }`
- Produces: `calculateListingResearchTarget(settings) -> { monthlyListingTarget, researchRunsPerMonth, listingsPerWinner, listingsPerRun, targetWinnerCount }`

- [ ] **Step 1: Write failing calculation and validation tests**

```js
test('turns one hundred monthly listings into five winners per weekly research run', () => {
  assert.deepEqual(calculateListingResearchTarget({
    monthlyListingTarget: 100,
    researchRunsPerMonth: 4,
    listingsPerWinner: 5,
  }), {
    monthlyListingTarget: 100,
    researchRunsPerMonth: 4,
    listingsPerWinner: 5,
    listingsPerRun: 25,
    targetWinnerCount: 5,
  })
})

test('keeps the last saved settings when a draft contains an invalid value', () => {
  const result = validateListingResearchTargetDraft({
    monthlyListingTarget: '',
    researchRunsPerMonth: 4,
    listingsPerWinner: 5,
  }, {
    monthlyListingTarget: 100,
    researchRunsPerMonth: 4,
    listingsPerWinner: 5,
  })
  assert.equal(result.valid, false)
  assert.deepEqual(result.settings, {
    monthlyListingTarget: 100,
    researchRunsPerMonth: 4,
    listingsPerWinner: 5,
  })
  assert.equal(result.errors.monthlyListingTarget, '1〜1,000の数値を入力してください。')
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test market-finder/scripts/test-listing-research-target.mjs`

Expected: FAIL because `listing-research-target.js` does not exist.

- [ ] **Step 3: Implement the pure target module**

Implement integer ceiling, range validation, safe restoration defaults, and the literal Japanese error messages used by the UI.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test market-finder/scripts/test-listing-research-target.mjs`

Expected: all target calculation and validation tests pass.

### Task 2: A/B目標件数まで続く連続探索

**Files:**
- Modify: `market-finder/src/winning-niche-automation.js`
- Modify: `market-finder/scripts/test-winning-niche-automation.mjs`

**Interfaces:**
- Consumes: `targetWinnerCount` from Task 1.
- Produces: `resetWinningNicheCycle(state, now) -> automation`
- Extends: `createWinningNicheAutomation(saved)` with `cycleId`, `targetWinnerCount`, `completedAt`.
- Extends: `startWinningNicheAutomation(state, context, now)` to adopt a changed target and resume a legacy one-winner state.

- [ ] **Step 1: Write failing continuation, threshold, dedupe, and reset tests**

```js
test('keeps searching after one verified B when the weekly target is five', () => {
  const started = startWinningNicheAutomation(createWinningNicheAutomation(), {
    ...HALLOWEEN_CONTEXT,
    targetWinnerCount: 5,
  })
  const evaluated = evaluateWinningNicheRows(started, [
    { keyword: 'halloween reading shirt', opportunityLabel: 'B', evidenceState: { status: 'verified' } },
  ])
  assert.equal(evaluated.status, 'running')
  assert.equal(evaluated.winnerKeywords.length, 1)
})

test('stops only after five unique verified A or B keywords', () => {
  const started = startWinningNicheAutomation(createWinningNicheAutomation(), {
    ...HALLOWEEN_CONTEXT,
    targetWinnerCount: 5,
  })
  const evaluated = evaluateWinningNicheRows(started, [
    { keyword: 'one', opportunityLabel: 'A', evidenceState: { status: 'verified' } },
    { keyword: 'two', opportunityLabel: 'B', evidenceState: { status: 'verified' } },
    { keyword: 'three', opportunityLabel: 'B', evidenceState: { status: 'verified' } },
    { keyword: 'four', opportunityLabel: 'A', evidenceState: { status: 'verified' } },
    { keyword: 'five', opportunityLabel: 'B', evidenceState: { status: 'verified' } },
  ])
  assert.equal(evaluated.status, 'winner-found')
  assert.equal(evaluated.winnerKeywords.length, 5)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test market-finder/scripts/test-winning-niche-automation.mjs`

Expected: the one-winner case stops too early and reset export is missing.

- [ ] **Step 3: Implement target-aware state and weekly reset**

Accumulate unique winners across batches, compare against `targetWinnerCount`, set `completedAt` only at the threshold, and preserve researched keywords when resetting a weekly cycle.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test market-finder/scripts/test-winning-niche-automation.mjs`

Expected: all winning automation tests pass.

### Task 3: 設定入力欄、保存、進捗表示

**Files:**
- Modify: `market-finder/index.html`
- Modify: `market-finder/styles.css`
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs`

**Interfaces:**
- Consumes: Task 1 calculator and validator.
- Consumes: Task 2 target-aware automation.
- Adds DOM ids: `monthlyListingTargetInput`, `researchRunsPerMonthInput`, `listingsPerWinnerInput`, `listingResearchTargetSaveBtn`, `listingResearchTargetErrors`, `listingResearchTargetSummary`, `listingResearchTargetProgress`.

- [ ] **Step 1: Write failing behavior-facing UI tests**

Add DOM tests that instantiate the real static page structure and assert that the three labeled number inputs, save button, summary, and progress region exist. Add module tests around a small exported UI view-model if rendering conditions cannot be exercised directly without a browser.

- [ ] **Step 2: Run the focused UI test and verify RED**

Run: `node --test market-finder/scripts/test-guided-entry-ui.mjs`

Expected: FAIL because the new controls and application bindings are absent.

- [ ] **Step 3: Add markup and desktop layout**

Place the three number inputs and save button inside the existing continuous exploration panel. Use a three-column desktop grid and existing form/button tokens; do not add mobile-specific work.

- [ ] **Step 4: Bind state, validation, persistence, and rendering**

Persist `listingResearchTargetSettings` beside the current form state. On save, validate the draft, update target math, migrate the current Halloween winner to `1 / 5`, and never start external research automatically. Render the button as `目標まで探索を再開` while under target and `今週の探索を完了` at target.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

`node --test market-finder/scripts/test-listing-research-target.mjs market-finder/scripts/test-winning-niche-automation.mjs market-finder/scripts/test-guided-entry-ui.mjs`

Expected: all focused tests pass.

### Task 4: 回帰検証と実画面で月100を適用

**Files:**
- Verify only: `market-finder/src/app.js`
- Verify only: `market-finder/src/winning-niche-automation.js`
- Verify only: `market-finder/src/listing-research-target.js`

**Interfaces:**
- Consumes all previous tasks.
- Produces a running local app with persisted 100・4・5 settings and current progress `1 / 5`.

- [ ] **Step 1: Run syntax and relevant regression tests**

Run:

`node --check market-finder/src/app.js`

`node --test market-finder/scripts/test-listing-research-target.mjs market-finder/scripts/test-winning-niche-automation.mjs market-finder/scripts/test-niche-drilldown-graph.mjs market-finder/scripts/test-final-evidence-matrix.mjs market-finder/scripts/test-guided-entry-ui.mjs`

Expected: zero failures.

- [ ] **Step 2: Reload the running Market Finder in Chrome**

Verify the three editable fields show 100, 4, and 5, then press `設定を保存して再計算`.

- [ ] **Step 3: Verify current results are migrated**

Confirm `halloween reading shirt` remains recommended and the progress reads `A/B候補 1 / 5件・残り4件`.

- [ ] **Step 4: Resume the real exploration**

Press `目標まで探索を再開`. Allow Etsy official and EverBee automation to continue across unresearched categories until five verified A/B keywords are found or the safe candidate pool is exhausted.

- [ ] **Step 5: Verify the terminal UI state**

Confirm the application stops only at `5 / 5`, or reports the exact shortfall if exhausted. Leave Chrome on the recommended final-results view.
