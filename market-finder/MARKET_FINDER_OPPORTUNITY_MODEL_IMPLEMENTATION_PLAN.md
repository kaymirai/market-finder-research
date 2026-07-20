# Market Finder Opportunity Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Market Finder rank US Etsy shirt and sweatshirt keywords from fresh eRank demand/supply data and broad EverBee sales evidence, while preventing stale, incomplete, or single-listing evidence from receiving the top recommendation.

**Architecture:** Keep the browser extension as the collector and `shared/market-keyword-engine/index.js` as the source of truth for normalization, evidence quality, scoring, clustering, timing, and SEO output. The extension will aggregate all visible EverBee rows into market-level evidence; the app will preserve source dates and show separate opportunity and confidence labels. Existing single-listing fields remain readable for compatibility, but they cannot independently unlock an A recommendation.

**Tech Stack:** Browser ES modules, TypeScript Chrome extension, Node.js built-in `node:test`, HTML/CSS, CSV exports.

## Global Constraints

- Initial products are US Etsy English-language shirts, T-shirts, tees, sweatshirts, crewnecks, and hoodies.
- Marketplace Insights is optional and user-triggered one query at a time. It must not be required or consume free searches automatically or in a batch.
- `Listings Analyzed` is a graduated secondary competition signal; it never replaces eRank/Etsy competition and is never a sales-density denominator. At least 30,000 analyzed listings blocks A/B.
- Missing values stay `null`/unavailable and never become zero evidence.
- A requires fresh eRank and EverBee checks, High confidence, demand, supply, sales breadth, and safety gates.
- Saved seed and general trend sources are inspiration-only after 45 days and never independently qualify for A or B.
- Preserve existing extension and app workflows and avoid unrelated restructuring.
- Do not invent garment material, fit, printing, or personalization attributes in SEO output.

---

### Task 1: Evidence freshness, timing, and niche clustering

**Files:**
- Create: `market-finder/scripts/test-opportunity-model.mjs`
- Modify: `shared/market-keyword-engine/index.js`

**Interfaces:**
- Produces: `getSourceFreshness(capturedAt, now?)`, `getMarketTiming(event, now?)`, `buildKeywordClusterKey(keyword, options?)`, and `clusterKeywordCandidates(candidates, options?)`.
- `getSourceFreshness` returns `{ capturedAt, freshnessDays, freshnessLabel, eligibleForRanking }`.
- `getMarketTiming` returns `{ label, weeksUntil, priority }` using `prepare`, `launch`, `late`, `next-cycle`, or `evergreen`.

- [ ] **Step 1: Write freshness, timing, and clustering tests**

```js
test('keeps the original capture date and makes 46-day-old data inspiration-only', () => {
  const result = getSourceFreshness('2026-05-01T00:00:00Z', '2026-06-16T00:00:00Z')
  assert.equal(result.freshnessDays, 46)
  assert.equal(result.eligibleForRanking, false)
})

test('clusters product and style variants under one niche', () => {
  const rows = clusterKeywordCandidates([
    { keyword: 'retro pickleball mom shirt', score: 80 },
    { keyword: 'pickleball mom tee', score: 70 },
  ], { categoryId: 'shirt' })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].clusterKey, 'pickleball mom')
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement minimal deterministic helpers**

Use UTC date differences, preserve invalid/missing timestamps as unavailable, remove only known product/style/generic-gift tokens from cluster keys, and derive event timing from the existing event month/day metadata.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Expected: all Task 1 tests PASS.

---

### Task 2: Aggregate visible EverBee listings

**Files:**
- Modify: `etsy-chrome-extension/src/everbeeContent.ts`
- Modify: `etsy-chrome-extension/src/background.ts`
- Test: `market-finder/scripts/test-opportunity-model.mjs`
- Modify: `shared/market-keyword-engine/index.js`

**Interfaces:**
- Produces: `aggregateEverbeeListings(listings)` returning `visibleListingCount`, `sellingListingCount`, `recentSellingListingCount`, `medianMonthlySales`, `medianMonthlyRevenue`, `totalVisibleMonthlySales`, `topMonthlySales`, `topSalesShare`, and `medianListingAgeMonths`.
- Extension `MarketResult` includes these nullable aggregate fields plus `everbeeCheckedAt`.

- [ ] **Step 1: Add aggregate behavior tests**

```js
test('aggregates sales breadth without using Listings Analyzed', () => {
  const result = aggregateEverbeeListings([
    { monthlySales: 12, monthlyRevenue: 300, listingAgeMonths: 4 },
    { monthlySales: 8, monthlyRevenue: 200, listingAgeMonths: 6 },
    { monthlySales: 0, monthlyRevenue: 0, listingAgeMonths: 20 },
  ])
  assert.equal(result.visibleListingCount, 3)
  assert.equal(result.sellingListingCount, 2)
  assert.equal(result.recentSellingListingCount, 2)
  assert.equal(result.totalVisibleMonthlySales, 20)
  assert.equal(result.topSalesShare, 0.6)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Expected: FAIL because `aggregateEverbeeListings` is missing.

- [ ] **Step 3: Implement the shared aggregate helper**

Treat a listing as selling when monthly sales is greater than zero, and as recent-selling when sales are greater than zero and age is at most 18 months. Compute medians from available values only; return `null` when no values exist.

- [ ] **Step 4: Update the EverBee collector and background result contract**

Parse all visible product rows, call the same aggregate rules, retain the representative listing fields for backward compatibility, and stamp a real ISO capture time. Do not substitute the visible-row count for eRank competition.

- [ ] **Step 5: Verify tests and TypeScript build**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Run: `npm.cmd run build` from `etsy-chrome-extension`

Expected: tests PASS and TypeScript exits 0.

---

### Task 3: Separate opportunity from confidence

**Files:**
- Modify: `shared/market-keyword-engine/index.js`
- Modify: `market-finder/validation/scoring-regression-cases.csv`
- Modify: `market-finder/scripts/validate-scoring.mjs`
- Test: `market-finder/scripts/test-opportunity-model.mjs`

**Interfaces:**
- `scoreEverbeeResult(row, options)` returns `opportunityLabel`, `confidenceLabel`, `candidateStage`, `gateReasons`, aggregate normalized fields, and the existing numeric score/label fields.
- A gates: demand (`searches >= 100` or `clicks >= 30`), supply (`KD <= 45` or competition `< 20000`), sales breadth (`recent >= 2` or `selling >= 3` with median sales `>= 1`), concentration (`topSalesShare < 0.70` when total sales exists), both checks within 45 days, safety clear, and High confidence.

- [ ] **Step 1: Add failing gate tests**

```js
test('does not award A to a single hit', () => {
  const result = scoreEverbeeResult(freshRow({
    visibleListingCount: 12,
    sellingListingCount: 1,
    recentSellingListingCount: 1,
    medianMonthlySales: 0,
    totalVisibleMonthlySales: 100,
    topMonthlySales: 100,
    topSalesShare: 1,
  }))
  assert.notEqual(result.opportunityLabel, 'A')
})

test('awards A only to fresh broad sales evidence', () => {
  const result = scoreEverbeeResult(freshRow())
  assert.equal(result.opportunityLabel, 'A')
  assert.equal(result.confidenceLabel, 'High')
})

test('legacy rows without aggregate evidence cannot receive A', () => {
  const result = scoreEverbeeResult({ keyword: 'pickleball mom shirt', topMonthlySales: 100 })
  assert.notEqual(result.opportunityLabel, 'A')
  assert.notEqual(result.confidenceLabel, 'High')
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Expected: at least the A/High assertions FAIL with the old single-score model.

- [ ] **Step 3: Replace density-based scoring with evidence gates**

Keep the 0-100 score for ordering, but base EverBee points on breadth, median sales, recency, and concentration. Keep `listingsAnalyzed` only in normalized/exported information. Do not add score from the loosely parsed `erankTrend` value.

- [ ] **Step 4: Extend regression CSV and validator**

Add fresh broad-market A, single-hit B/C, stale C, missing-evidence C/D, and concentrated-market cases. Make the validator assert both opportunity and confidence expected columns.

- [ ] **Step 5: Run focused and regression tests**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Run: `node market-finder/scripts/validate-scoring.mjs`

Expected: all assertions PASS and the output reports zero mismatches.

---

### Task 4: Improve shirt and sweatshirt candidate quality

**Files:**
- Modify: `shared/market-keyword-engine/index.js`
- Modify: `market-finder/src/app.js`
- Test: `market-finder/scripts/test-opportunity-model.mjs`

**Interfaces:**
- `generateKeywordCandidates(options)` no longer auto-adds `gift`; observed gift phrases may remain when supplied as seeds.
- App candidates carry `clusterKey`, `clusterSize`, source freshness fields, and stage.

- [ ] **Step 1: Add failing candidate tests**

```js
test('does not inject gift into ordinary garment candidates', () => {
  const rows = generateKeywordCandidates({ categoryId: 'shirt', seedKeywords: 'pickleball mom', limit: 40 })
  assert.equal(rows.some((row) => /\bgift\b/.test(row.keyword)), false)
})

test('keeps explicitly observed gift intent', () => {
  const rows = generateKeywordCandidates({ categoryId: 'shirt', seedKeywords: 'retirement gift for nurse', limit: 40 })
  assert.equal(rows.some((row) => /retirement gift for nurse/.test(row.keyword)), true)
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Expected: automatic gift-generation assertion FAILS.

- [ ] **Step 3: Simplify candidate templates and app ranking**

Generate combinations from identity/hobby/situation/motif plus exactly one garment family. Preserve each trend/seed row's original `capturedAt`; use freshness labels instead of the current run time. Cluster near-duplicates before display and research queue selection while retaining original result rows for CSV export.

- [ ] **Step 4: Run tests and syntax check**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Run: `node --check market-finder/src/app.js`

Expected: tests PASS and syntax check exits 0.

---

### Task 5: Modernize Etsy title and tag output

**Files:**
- Modify: `shared/market-keyword-engine/index.js`
- Test: `market-finder/scripts/test-opportunity-model.mjs`

**Interfaces:**
- `buildSeoPlanFromBuckets` keeps its existing public shape.
- Generated title is at most 14 words, contains one garment noun, removes generic gift phrasing, and deduplicates aliases.
- Tags are unique, at most 13, at most 20 characters each, and omit year-only tags.

- [ ] **Step 1: Add failing SEO tests**

```js
test('builds a short title with one product noun and no generic gift phrase', () => {
  const plan = buildSeoPlanFromBuckets({ primary: ['retro pickleball mom shirt'], support: ['gift for mom', 'funny pickleball tee'] }, { categoryId: 'shirt' })
  assert.ok(plan.title.split(/\s+/).length <= 14)
  assert.equal((plan.title.match(/\b(?:shirt|tee|t shirt|tshirt)\b/gi) || []).length, 1)
  assert.doesNotMatch(plan.title, /\bgift\b/i)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Expected: title length/product duplication/gift assertion FAILS against the old 140-character packer.

- [ ] **Step 3: Implement concise title and varied tags**

Use the strongest specific phrase first, normalize all product aliases to the selected category noun, append one product noun only when absent, and cap at 14 words. Keep identity, hobby/work, situation, motif/style, and product intent distributed across tags.

- [ ] **Step 4: Run the focused tests**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Expected: all SEO tests PASS.

---

### Task 6: App fields, exports, and outcome feedback template

**Files:**
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/index.html`
- Modify: `market-finder/styles.css`
- Create: `market-finder/validation/research-outcome-template.csv`
- Modify: `market-finder/README.md`

**Interfaces:**
- Research rows persist aggregate EverBee fields and both checked timestamps.
- UI and CSV expose `Opportunity`, `Confidence`, source age, timing, breadth, and concentration.
- Outcome template columns: `researchedAt,keyword,clusterKey,opportunityLabel,confidenceLabel,sourceSnapshot,launchedAt,listingId,impressions30d,visits30d,favorites30d,orders30d,revenue30d,notes`.

- [ ] **Step 1: Add aggregate fields to app merge/import/export paths**

Blank incoming fields retain existing values; real zero sales remains numeric zero; missing data remains blank/null.

- [ ] **Step 2: Update result and candidate presentation**

Show Opportunity and Confidence as separate compact labels, show stale/inspiration status, show seasonal timing, and describe the top-sales share warning when it is at least 70%.

- [ ] **Step 3: Add the outcome CSV template and README workflow**

Document that results are research prioritization, not a sales guarantee; record 30-day listing outcomes before recalibrating thresholds.

- [ ] **Step 4: Run syntax and static-file checks**

Run: `node --check market-finder/src/app.js`

Run: `node --check market-finder/scripts/static-server.mjs`

Expected: both exit 0.

---

### Task 7: Full verification and manual smoke test

**Files:**
- Verify all modified files above.

**Interfaces:**
- No new interface; this task validates the complete workflow.

- [ ] **Step 1: Run the full automated verification set**

```powershell
node --test market-finder/scripts/test-opportunity-model.mjs
node market-finder/scripts/validate-scoring.mjs
node --check shared/market-keyword-engine/index.js
node --check market-finder/src/app.js
npm.cmd run build --prefix etsy-chrome-extension
```

Expected: every command exits 0 with no test failures.

- [ ] **Step 2: Start Market Finder and smoke-test the browser workflow**

Run the existing secure static server, open `http://127.0.0.1:4173`, generate shirt and sweatshirt candidates, and confirm no layout overlap at desktop and mobile widths.

- [ ] **Step 3: Inspect the final diff**

Confirm that changes are limited to the opportunity model, collector schema, candidate generation, SEO output, app display/export, tests, and documentation. Do not include unrelated dirty files in a commit.
