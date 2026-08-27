# Market Finder Evidence-Based Audience Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace cross-category fixed buyer suggestions with evidence-backed recipient, giver, and subject roles across all Market Finder product categories.

**Architecture:** Add a pure audience-evidence module behind the shared keyword-engine public API. The module classifies roles, aggregates current-context Etsy/EverBee evidence, and generates role-aware long-tail candidates; `market-finder/src/app.js` only wires DOM, persistence, archive data, and rendering. Initial discovery remains possible with no audience, and only confirmed current-context signals are auto-selected for a later audience expansion.

**Tech Stack:** Browser ESM JavaScript, Node.js built-in test runner, static HTML/CSS, localStorage, JSON evidence archives, CSV export.

**Spec:** `docs/superpowers/specs/2026-08-27-market-finder-audience-role-evidence-design.md`

## Global Constraints

- Support Shirt, Sweatshirt, Mug, Ornament, Wall Art, Tote Bag, and Sticker with one evidence policy.
- Keep recipient, giver, and subject as separate roles; subject may be a person, pet, place, room, interest, or occasion.
- A static demand-entry seed is not marketplace evidence and cannot auto-confirm an audience.
- Auto-select only current-context `confirmed` signals: Etsy related-term plus one selling EverBee listing, or two distinct selling EverBee listings.
- A one-source signal is `verify`; same-category different-theme evidence is `reference`; neither is auto-selected.
- Do not fill missing evidence from the built-in identity library or a category-specific person list.
- Allow candidate discovery to continue when no audience is known.
- Keep Opportunity, Confidence, productization/profit scoring, Etsy/EverBee provider order, IP handling, and Chrome-extension behavior unchanged.
- Preserve old browser state, archive, and CSV compatibility; do not bump `PERSISTENCE_VERSION` in a way that discards version-1 state.
- Keep shared role and evidence decisions out of `market-finder/src/app.js`.
- Preserve unrelated working-tree changes. The current uncommitted Ornament fallback (`pet owner / daughter / son`) is provisional and must be replaced by this plan, not committed as the final behavior.

## File Structure

- Create `shared/market-keyword-engine/audience-evidence.js`: category role profiles, phrase-role parsing, context keys, evidence aggregation, role-aware candidate construction.
- Modify `shared/market-keyword-engine/index.js`: bind existing normalization/category helpers to the new module, expose public wrappers, and replace automatic fixed fallback behavior.
- Create `market-finder/src/audience-selection-state.js`: pure browser-state normalization, context-scoped selection updates, and version-1 migration.
- Create `market-finder/scripts/test-audience-evidence.mjs`: role parsing, evidence thresholds, context isolation, and candidate-generation tests.
- Create `market-finder/scripts/test-audience-selection-state.mjs`: persistence and migration tests.
- Modify `market-finder/index.html`: three role groups, status copy, evidence refresh control, and manual role input.
- Modify `market-finder/styles.css`: compact grouped audience layout and evidence/status labels.
- Modify `market-finder/src/app.js`: DOM wiring, evidence input adapter, context-scoped persistence, selection, candidate generation, archive fields, and CSV fields.
- Modify `market-finder/scripts/test-guided-entry-ui.mjs`: visible UI and wiring contract.
- Modify `market-finder/scripts/test-opportunity-model.mjs`: remove the provisional fixed Ornament expectation and cover shared API compatibility.
- Modify `market-finder/scripts/test-evidence-archive.mjs`: version-3 archive compatibility and new audience signal persistence.
- Modify `market-finder/scripts/test-fresh-start-workspace.mjs`: fresh-start handling for context-scoped audience state.

---

### Task 1: Role Classification and Category Profiles

**Files:**
- Create: `shared/market-keyword-engine/audience-evidence.js`
- Modify: `shared/market-keyword-engine/index.js:1-45,1174-1305,1862-2125`
- Create: `market-finder/scripts/test-audience-evidence.mjs`

**Interfaces:**
- Consumes: existing `normalizePhrase(value)`, `buildKeywordClusterKey(keyword, options)`, and `PRODUCT_CATEGORIES` through wrapper options supplied by `index.js`.
- Produces: `getAudienceCategoryProfile(categoryId) -> { categoryId, primaryRoles, secondaryRoles, allowsNoAudience }` and `extractAudienceRoleSignals(value, options) -> AudienceSignal[]`.

- [ ] **Step 1: Write the failing category-profile and role-classification tests**

Create `market-finder/scripts/test-audience-evidence.mjs` with literal expectations:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractAudienceRoleSignals,
  getAudienceCategoryProfile,
} from '../../shared/market-keyword-engine/index.js'

test('defines audience roles for every product category without requiring a person', () => {
  const expected = {
    shirt: ['recipient'],
    sweatshirt: ['recipient'],
    mug: ['recipient'],
    ornament: ['subject'],
    'wall-art': ['subject'],
    tote: ['recipient'],
    sticker: ['recipient', 'subject'],
  }
  for (const [categoryId, primaryRoles] of Object.entries(expected)) {
    const profile = getAudienceCategoryProfile(categoryId)
    assert.deepEqual(profile.primaryRoles, primaryRoles)
    assert.equal(profile.allowsNoAudience, true)
  }
})

test('classifies recipient giver and memorial subject from the complete phrase', () => {
  for (const categoryId of ['shirt', 'sweatshirt']) {
    assert.deepEqual(
      extractAudienceRoleSignals(`teacher ${categoryId}`, { categoryId })
        .map(({ phrase, role }) => ({ phrase, role })),
      [{ phrase: 'teacher', role: 'recipient' }],
    )
  }
  assert.deepEqual(
    extractAudienceRoleSignals('teacher ornament from students', { categoryId: 'ornament' })
      .map(({ phrase, role }) => ({ phrase, role })),
    [
      { phrase: 'teacher', role: 'recipient' },
      { phrase: 'students', role: 'giver' },
    ],
  )
  assert.deepEqual(
    extractAudienceRoleSignals('memorial ornament for mom', { categoryId: 'ornament' })
      .map(({ phrase, role, subjectType }) => ({ phrase, role, subjectType })),
    [{ phrase: 'mom', role: 'subject', subjectType: 'person' }],
  )
  assert.deepEqual(
    extractAudienceRoleSignals('pet memorial ornament', { categoryId: 'ornament' })
      .map(({ phrase, role, subjectType }) => ({ phrase, role, subjectType })),
    [{ phrase: 'pet', role: 'subject', subjectType: 'pet' }],
  )
})

test('does not invent an audience from product style or format words', () => {
  assert.deepEqual(extractAudienceRoleSignals('custom tote bag', { categoryId: 'tote' }), [])
  assert.deepEqual(extractAudienceRoleSignals('bumper sticker', { categoryId: 'sticker' }), [])
  assert.deepEqual(
    extractAudienceRoleSignals('landscape wall art', { categoryId: 'wall-art' })
      .map(({ phrase, role, subjectType }) => ({ phrase, role, subjectType })),
    [{ phrase: 'landscape', role: 'subject', subjectType: 'interest' }],
  )
})
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```powershell
node --test market-finder/scripts/test-audience-evidence.mjs
```

Expected: FAIL because `extractAudienceRoleSignals` and `getAudienceCategoryProfile` are not exported.

- [ ] **Step 3: Implement category profiles and deterministic phrase parsing**

In `audience-evidence.js`, define immutable profiles and a dependency-injected parser:

```js
export const AUDIENCE_ROLES = Object.freeze({
  recipient: 'recipient',
  giver: 'giver',
  subject: 'subject',
})

const CATEGORY_PROFILES = Object.freeze({
  shirt: Object.freeze({ primaryRoles: ['recipient'], secondaryRoles: ['giver', 'subject'] }),
  sweatshirt: Object.freeze({ primaryRoles: ['recipient'], secondaryRoles: ['giver', 'subject'] }),
  mug: Object.freeze({ primaryRoles: ['recipient'], secondaryRoles: ['giver', 'subject'] }),
  ornament: Object.freeze({ primaryRoles: ['subject'], secondaryRoles: ['recipient', 'giver'] }),
  'wall-art': Object.freeze({ primaryRoles: ['subject'], secondaryRoles: ['recipient', 'giver'] }),
  tote: Object.freeze({ primaryRoles: ['recipient'], secondaryRoles: ['giver', 'subject'] }),
  sticker: Object.freeze({ primaryRoles: ['recipient', 'subject'], secondaryRoles: ['giver'] }),
})

export function getAudienceCategoryProfileCore(categoryId, dependencies) {
  const id = dependencies.normalizePhrase(categoryId)
  const profile = CATEGORY_PROFILES[id] ?? CATEGORY_PROFILES.shirt
  return { categoryId: id, ...profile, allowsNoAudience: true }
}
```

Implement `extractAudienceRoleSignalsCore(value, options, dependencies)` with these ordered rules:

1. Normalize the whole phrase and remove recognized product aliases only for matching.
2. Detect memorial context with `memorial|remembrance|in memory of|loss of|sympathy` before generic `for` parsing.
3. Extract `from <identity>` as giver.
4. In memorial context, extract the identity/pet next to `for`, `of`, or `memorial` as subject.
5. Outside memorial context, extract `gift for <identity>` and known `<identity> <product>` as recipient.
6. For Wall Art room/place phrases and Sticker interest/place phrases, emit subject.
7. Return an empty array for product/style-only phrases.

In `index.js`, expose wrappers that inject the existing `normalizePhrase`, product aliases, and known identity vocabularies. Do not move or duplicate the current normalization implementation.

- [ ] **Step 4: Run the new test and existing identity tests**

Run:

```powershell
node --test market-finder/scripts/test-audience-evidence.mjs market-finder/scripts/test-opportunity-model.mjs
```

Expected: PASS, including all existing `test-opportunity-model.mjs` cases.

- [ ] **Step 5: Commit Task 1**

```powershell
git add shared/market-keyword-engine/audience-evidence.js shared/market-keyword-engine/index.js market-finder/scripts/test-audience-evidence.mjs
git commit -m "feat(market-finder): classify audience roles by phrase"
```

---

### Task 2: Context Keys and Evidence Status

**Files:**
- Modify: `shared/market-keyword-engine/audience-evidence.js`
- Modify: `shared/market-keyword-engine/index.js`
- Modify: `market-finder/scripts/test-audience-evidence.mjs`

**Interfaces:**
- Consumes: `extractAudienceRoleSignals(value, options)` from Task 1 and existing cluster normalization through injected `buildKeywordClusterKey`.
- Produces: `buildAudienceContextKey(context) -> string` and `analyzeAudienceEvidence(records, context, options) -> { contextKey, signals, totals }`.

- [ ] **Step 1: Add failing evidence and context-isolation tests**

Append tests that use complete literal fixtures:

```js
import {
  analyzeAudienceEvidence,
  buildAudienceContextKey,
} from '../../shared/market-keyword-engine/index.js'

test('confirms an audience only from current-context Etsy and selling EverBee evidence', () => {
  const context = { categoryId: 'mug', eventId: '', rootKeyword: 'teacher mug' }
  const analysis = analyzeAudienceEvidence([
    {
      runId: 'mug-1',
      capturedAt: '2026-08-27T00:00:00Z',
      categoryId: 'mug',
      eventId: '',
      rootKeyword: 'teacher mug',
      demandKeywords: [{ keyword: 'teacher mug', etsySearches30d: 1200 }],
      supplyListings: [{ title: 'Teacher Mug Gift', monthlySales: 8 }],
    },
  ], context, { now: '2026-08-27T12:00:00Z' })

  assert.equal(analysis.contextKey, buildAudienceContextKey(context))
  assert.deepEqual(
    analysis.signals.map(({ phrase, role, status, autoSelectable }) => ({ phrase, role, status, autoSelectable })),
    [{ phrase: 'teacher', role: 'recipient', status: 'confirmed', autoSelectable: true }],
  )
})

test('keeps one-source and different-theme audience evidence unselected', () => {
  const analysis = analyzeAudienceEvidence([
    {
      runId: 'teacher-ornament',
      capturedAt: '2026-08-27T00:00:00Z',
      categoryId: 'ornament',
      eventId: '',
      rootKeyword: 'teacher ornament',
      demandKeywords: [{ keyword: 'teacher ornament', etsySearches30d: 400 }],
      supplyListings: [],
    },
    {
      runId: 'shirt-history',
      capturedAt: '2026-08-27T00:00:00Z',
      categoryId: 'shirt',
      eventId: '',
      rootKeyword: 'mom shirt',
      demandKeywords: [{ keyword: 'mom shirt', etsySearches30d: 9000 }],
      supplyListings: [{ title: 'Mom Shirt', monthlySales: 20 }],
    },
  ], {
    categoryId: 'ornament',
    eventId: '',
    rootKeyword: 'memorial ornament',
  }, { now: '2026-08-27T12:00:00Z' })

  assert.deepEqual(
    analysis.signals.map(({ phrase, status, autoSelectable }) => ({ phrase, status, autoSelectable })),
    [{ phrase: 'teacher', status: 'reference', autoSelectable: false }],
  )
  assert.equal(analysis.signals.some((signal) => signal.phrase === 'mom'), false)
})

test('does not count a static demand seed as audience evidence', () => {
  const analysis = analyzeAudienceEvidence([], {
    categoryId: 'ornament',
    eventId: '',
    rootKeyword: 'memorial ornament',
    staticSeedKeywords: ['memorial ornament'],
  }, { now: '2026-08-27T12:00:00Z' })
  assert.deepEqual(analysis.signals, [])
})

test('keeps exact-context Etsy-only evidence at verify', () => {
  const analysis = analyzeAudienceEvidence([{
    runId: 'etsy-only',
    capturedAt: '2026-08-27T00:00:00Z',
    categoryId: 'mug',
    eventId: '',
    rootKeyword: 'teacher mug',
    demandKeywords: [{ keyword: 'teacher mug', etsySearches30d: 1200 }],
    supplyListings: [],
  }], { categoryId: 'mug', eventId: '', rootKeyword: 'teacher mug' }, {
    now: '2026-08-27T12:00:00Z',
  })
  assert.deepEqual(
    analysis.signals.map(({ phrase, status, autoSelectable }) => ({ phrase, status, autoSelectable })),
    [{ phrase: 'teacher', status: 'verify', autoSelectable: false }],
  )
})

test('confirms repeated selling-title evidence without Etsy related terms', () => {
  const analysis = analyzeAudienceEvidence([{
    runId: 'everbee-two',
    capturedAt: '2026-08-27T00:00:00Z',
    categoryId: 'mug',
    eventId: '',
    rootKeyword: 'teacher mug',
    demandKeywords: [],
    supplyListings: [
      { title: 'Teacher Mug Gift', monthlySales: 8 },
      { title: 'Personalized Teacher Mug', monthlySales: 5 },
    ],
  }], { categoryId: 'mug', eventId: '', rootKeyword: 'teacher mug' }, {
    now: '2026-08-27T12:00:00Z',
  })
  assert.equal(analysis.signals[0].status, 'confirmed')
  assert.equal(analysis.signals[0].autoSelectable, true)
})
```

- [ ] **Step 2: Run the new evidence tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="confirms an audience|keeps one-source|static demand seed" market-finder/scripts/test-audience-evidence.mjs
```

Expected: FAIL because the evidence API does not exist.

- [ ] **Step 3: Implement context matching and evidence aggregation**

Implement these exact status rules in the shared module:

```js
const status = exactContext
  ? ((etsyRelatedTermCount >= 1 && everbeeSellingListingCount >= 1)
      || everbeeSellingListingCount >= 2)
    ? 'confirmed'
    : 'verify'
  : sameCategory
    ? 'reference'
    : ''
```

Required details:

- Deduplicate observations by `runId + source + normalized keyword/title`.
- Count EverBee evidence only when `monthlySales > 0` or the existing normalized row explicitly reports a selling state.
- Use existing source-freshness behavior; stale evidence can appear only as `reference`.
- Sort `confirmed` before `verify` before `reference`, then by selling-listing count, source count, observation runs, and normalized phrase.
- Exclude different-category signals from the returned list.
- Return explicit evidence counts and source names on every signal.

- [ ] **Step 4: Run the audience evidence test file**

Run:

```powershell
node --test market-finder/scripts/test-audience-evidence.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 5: Commit Task 2**

```powershell
git add shared/market-keyword-engine/audience-evidence.js shared/market-keyword-engine/index.js market-finder/scripts/test-audience-evidence.mjs
git commit -m "feat(market-finder): rank audience signals by evidence"
```

---

### Task 3: Role-Aware Candidate Generation

**Files:**
- Modify: `shared/market-keyword-engine/audience-evidence.js`
- Modify: `shared/market-keyword-engine/index.js:2382-2440,2854-2907`
- Modify: `market-finder/scripts/test-audience-evidence.mjs`
- Modify: `market-finder/scripts/test-opportunity-model.mjs:1516-1660`

**Interfaces:**
- Consumes: `AudienceSignal[]` from Task 2.
- Produces: `generateAudienceIntentCandidates(options) -> Candidate[]`; preserves `generateBuyerIntentCandidates(options)` as a legacy wrapper during migration.

- [ ] **Step 1: Add failing grammar and empty-audience tests**

Add tests with explicit output requirements:

```js
import { generateAudienceIntentCandidates } from '../../shared/market-keyword-engine/index.js'

test('generates recipient giver and subject phrases without crossing their grammar', () => {
  const candidates = generateAudienceIntentCandidates({
    categoryId: 'ornament',
    baseKeywords: ['memorial ornament'],
    audienceSelections: [
      { phrase: 'pet', role: 'subject', subjectType: 'pet', status: 'confirmed' },
      { phrase: 'students', role: 'giver', subjectType: '', status: 'confirmed' },
    ],
    limit: 20,
  })
  const keywords = candidates.map((candidate) => candidate.keyword)
  assert.ok(keywords.includes('pet memorial ornament'))
  assert.equal(keywords.some((keyword) => keyword.includes('gift for pet memorial')), false)
  assert.equal(keywords.some((keyword) => keyword === 'students ornament'), false)
})

test('keeps theme discovery active when audience is empty', () => {
  assert.deepEqual(generateAudienceIntentCandidates({
    categoryId: 'wall-art',
    baseKeywords: ['landscape wall art'],
    audienceSelections: [],
  }), [])
})
```

Also replace the provisional `uses memorial ornament starters...` test in `test-opportunity-model.mjs`. The new expectation is that unrelated Shirt history produces no auto-selected audience when Ornament has no confirmed current-context evidence.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test market-finder/scripts/test-audience-evidence.mjs market-finder/scripts/test-opportunity-model.mjs
```

Expected: FAIL on the missing role-aware generator and on the old fixed fallback behavior.

- [ ] **Step 3: Implement the role-aware generator and compatibility wrapper**

Implement `generateAudienceIntentCandidates(options)` with the following contract:

```js
{
  categoryId,
  baseKeywords,
  audienceSelections,
  actions,
  learnedSignals,
  customRiskTerms,
  perSelection,
  limit,
}
```

Generation rules:

- Accept `confirmed` and `manual`; ignore `verify`, `reference`, and `legacy` unless the caller explicitly promotes them through a manual selection.
- recipient: reuse the existing identity, personalization, transition, and grammatically valid gift patterns.
- giver: append only to a phrase that already has a recipient or subject; never generate a standalone giver product phrase.
- subject: combine with each base keyword after removing an already repeated subject token.
- Add `audienceRole`, `audiencePhrase`, `audienceStatus`, and `audienceContextKey` to candidate provenance.
- Reuse current risk, duplicate-product, repeated-phrase, and conflicting-recipient gates.
- Keep `generateBuyerIntentCandidates({ identitySeeds })` working for tests and old callers until Task 5 switches the UI.

- [ ] **Step 4: Run focused and shared engine tests**

Run:

```powershell
node --test market-finder/scripts/test-audience-evidence.mjs market-finder/scripts/test-opportunity-model.mjs market-finder/scripts/test-multi-angle-candidates.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 5: Commit Task 3**

```powershell
git add shared/market-keyword-engine/audience-evidence.js shared/market-keyword-engine/index.js market-finder/scripts/test-audience-evidence.mjs market-finder/scripts/test-opportunity-model.mjs
git commit -m "feat(market-finder): generate candidates from audience roles"
```

---

### Task 4: Context-Scoped Selection State and Version-1 Migration

**Files:**
- Create: `market-finder/src/audience-selection-state.js`
- Create: `market-finder/scripts/test-audience-selection-state.mjs`
- Modify: `market-finder/src/multi-angle-exploration.js:466-497`
- Modify: `market-finder/scripts/test-fresh-start-workspace.mjs`

**Interfaces:**
- Consumes: context keys and audience signals from Tasks 1-2.
- Produces: `normalizeAudienceSelectionsByContext(value)`, `migrateLegacyAudienceState(form, contextKey)`, `audienceSelectionsForContext(state, contextKey)`, `setAudienceSelectionsForContext(state, contextKey, selections, updatedAt)`, `clearCurrentAudienceSelection(state, contextKey)`, and `deriveAudienceUiStatus(input)`.

- [ ] **Step 1: Write failing migration and isolation tests**

Create `test-audience-selection-state.mjs`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  audienceSelectionsForContext,
  deriveAudienceUiStatus,
  migrateLegacyAudienceState,
  setAudienceSelectionsForContext,
} from '../src/audience-selection-state.js'

test('migrates old buyer identities as unselected legacy recipients', () => {
  const migrated = migrateLegacyAudienceState({
    buyerIdentitySeeds: 'teacher\nnew mom',
    buyerIdentitySelectionMode: 'auto',
  }, 'ornament||memorial')
  assert.deepEqual(migrated['ornament||memorial'].selections, [
    { phrase: 'teacher', role: 'recipient', subjectType: '', status: 'legacy', source: 'legacy', selected: false },
    { phrase: 'new mom', role: 'recipient', subjectType: '', status: 'legacy', source: 'legacy', selected: false },
  ])
})

test('keeps manual selections isolated by audience context key', () => {
  const first = setAudienceSelectionsForContext({}, 'shirt||teacher', [
    { phrase: 'teacher', role: 'recipient', status: 'manual', selected: true },
  ], '2026-08-27T00:00:00Z')
  const second = setAudienceSelectionsForContext(first, 'ornament||memorial', [], '2026-08-27T00:01:00Z')
  assert.equal(audienceSelectionsForContext(second, 'shirt||teacher')[0].phrase, 'teacher')
  assert.deepEqual(audienceSelectionsForContext(second, 'ornament||memorial'), [])
})

test('distinguishes no evidence from a provider failure', () => {
  assert.equal(deriveAudienceUiStatus({ signals: [], providerFailed: false }).label, 'まだ実績がないため未選択')
  assert.equal(deriveAudienceUiStatus({ signals: [], providerFailed: true }).label, '取得失敗のため未判定')
})
```

- [ ] **Step 2: Run the state tests and verify RED**

Run:

```powershell
node --test market-finder/scripts/test-audience-selection-state.mjs
```

Expected: FAIL because `audience-selection-state.js` does not exist.

- [ ] **Step 3: Implement immutable state helpers**

Implement normalization that accepts malformed or partial values without throwing. Normalize every selection to:

```js
{
  phrase,
  role: 'recipient' | 'giver' | 'subject',
  subjectType,
  status: 'confirmed' | 'verify' | 'reference' | 'manual' | 'legacy',
  source,
  selected: Boolean,
}
```

Requirements:

- Never mutate the input object or selection arrays.
- Remove empty phrases and unsupported roles.
- Deduplicate by `role + normalized phrase`.
- Preserve only ISO-like `updatedAt` strings; otherwise use the caller-supplied timestamp.
- Migrate old auto values as `legacy` and `selected: false`; migrate old manual values as `manual` and `selected: true`.
- Keep `PERSISTENCE_VERSION = 1`; migration is based on missing `audienceSelectionsByContext`, not a destructive version bump.
- `deriveAudienceUiStatus` must return the exact labels in the test and must prefer provider failure over the empty-evidence state.

- [ ] **Step 4: Update fresh-start state and tests**

Extend `prepareFreshStartWorkspace` so the active form no longer supplies three automatic buyers. Its result must contain:

```js
freshStartAudienceState: {
  activeContextKey: '',
  audienceSelectionsByContext: {},
}
```

Keep `buyerIdentitySeeds: ''` in `freshStartForm` only for old caller compatibility. Update `test-fresh-start-workspace.mjs` to assert that evidence archives and research history remain while active audience selections are cleared.

- [ ] **Step 5: Run state and fresh-start tests**

Run:

```powershell
node --test market-finder/scripts/test-audience-selection-state.mjs market-finder/scripts/test-fresh-start-workspace.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 6: Commit Task 4**

```powershell
git add market-finder/src/audience-selection-state.js market-finder/src/multi-angle-exploration.js market-finder/scripts/test-audience-selection-state.mjs market-finder/scripts/test-fresh-start-workspace.mjs
git commit -m "feat(market-finder): scope audience selections by context"
```

---

### Task 5: Replace the Buyer UI and Wire Evidence-Backed Selection

**Files:**
- Modify: `market-finder/index.html:417-436,1151`
- Modify: `market-finder/styles.css`
- Modify: `market-finder/src/app.js:395-575,904-1097,1311-1341,1532-1540,1718-2291,8423-8450,11324-11420,11698-11759`
- Modify: `market-finder/scripts/test-guided-entry-ui.mjs:1030-1090`

**Interfaces:**
- Consumes: `analyzeAudienceEvidence`, `buildAudienceContextKey`, `generateAudienceIntentCandidates`, and Task 4 state helpers.
- Produces: visible grouped audience controls and `currentAudienceSelections()` for candidate generation and archive export.

- [ ] **Step 1: Add failing UI-contract tests**

Update `test-guided-entry-ui.mjs` to assert these IDs and labels:

```js
test('groups evidence-backed audience roles without fixed starter people', () => {
  assert.match(html, /誰向け・何向けの商品ですか/)
  assert.match(html, /id="audienceStatus"/)
  assert.match(html, /id="audienceRecipientSuggestions"/)
  assert.match(html, /id="audienceGiverSuggestions"/)
  assert.match(html, /id="audienceSubjectSuggestions"/)
  assert.match(html, /id="audienceReferenceSuggestions"/)
  assert.match(html, /id="audienceRefreshBtn"[^>]*>実績候補を更新<\/button>/)
  assert.doesNotMatch(html, /id="buyerIdentityShuffleBtn"/)
})

test('passes selected audience roles into candidate generation', () => {
  assert.match(app, /generateAudienceIntentCandidates\(\{[\s\S]*audienceSelections:\s*currentAudienceSelections\(\)/)
  assert.match(app, /analyzeAudienceEvidence\(marketplaceLearningRecords\(\),\s*currentAudienceContext\(\)/)
})
```

- [ ] **Step 2: Run the UI test and verify RED**

Run:

```powershell
node --test --test-name-pattern="evidence-backed audience|selected audience roles" market-finder/scripts/test-guided-entry-ui.mjs
```

Expected: FAIL because the new controls and wiring do not exist.

- [ ] **Step 3: Replace the visible buyer panel**

In `index.html`, replace the old randomized suggestion block with:

```html
<div class="field audience-field">
  <span class="field-label">誰向け・何向けの商品ですか</span>
  <div class="audience-heading">
    <span id="audienceStatus" class="soft-pill">まだ実績がないため未選択</span>
    <button id="audienceRefreshBtn" type="button" class="text-btn">実績候補を更新</button>
  </div>
  <div class="audience-role-group">
    <strong>受取人・利用者</strong>
    <div id="audienceRecipientSuggestions" class="chip-grid buyer-identity-chips"></div>
  </div>
  <div class="audience-role-group">
    <strong>贈り手</strong>
    <div id="audienceGiverSuggestions" class="chip-grid buyer-identity-chips"></div>
  </div>
  <div class="audience-role-group">
    <strong>商品で表す対象</strong>
    <div id="audienceSubjectSuggestions" class="chip-grid buyer-identity-chips"></div>
  </div>
  <details class="audience-reference-group">
    <summary>別テーマの参考候補</summary>
    <div id="audienceReferenceSuggestions" class="chip-grid buyer-identity-chips"></div>
  </details>
  <div class="audience-manual-row">
    <select id="audienceManualRoleSelect">
      <option value="recipient">受取人・利用者</option>
      <option value="giver">贈り手</option>
      <option value="subject">商品で表す対象</option>
    </select>
    <input id="audienceManualInput" type="text" placeholder="例: teacher / students / pet">
    <button id="audienceAddManualBtn" type="button" class="ghost-btn">手動仮説を追加</button>
  </div>
</div>
```

Remove the visible random shuffle button and the free-form buyer textarea. Keep old JSON fields readable in migration code rather than retaining hidden stale DOM controls.

- [ ] **Step 4: Wire current-context analysis and rendering in `app.js`**

Add these orchestration functions:

```js
function currentAudienceContext() {
  const research = activeResearchContext()
  const rootKeyword = selectedAudienceRootKeyword()
  return {
    categoryId: research.categoryId,
    eventId: research.eventId,
    rootKeyword,
  }
}

function currentAudienceAnalysis() {
  return analyzeAudienceEvidence(
    marketplaceLearningRecords(),
    currentAudienceContext(),
    { now: new Date().toISOString(), customRiskTerms: elements.riskInput?.value ?? '' },
  )
}
```

`selectedAudienceRootKeyword()` must use the active candidate/root when one exists; before a candidate exists, use the highest-ranked current-category entrance keyword. Do not count that static keyword as evidence.

Render each signal in the role container with its status and counts. Auto-select only `signal.autoSelectable === true`. Clicking `verify` or `reference` converts that selection to `manual`, preserving its evidence details but not changing its evidence status to confirmed.

On category, event, or root-keyword changes:

1. Persist the previous context selection.
2. Load the new context selection.
3. Recompute evidence.
4. Add current confirmed signals without carrying previous-context selections.

On evidence/archive updates, refresh the analysis. On provider failure, show `取得失敗のため未判定` rather than `候補なし`.

- [ ] **Step 5: Replace candidate generation input**

Replace `buyerIntentCandidates()` with `audienceIntentCandidates()`:

```js
function audienceIntentCandidates() {
  return generateAudienceIntentCandidates({
    ...currentOptions(),
    baseKeywords: combinedSeedKeywords(),
    audienceSelections: currentAudienceSelections(),
    actions: (elements.buyerActionInput?.value ?? '').split(/\r?\n|,/),
    learnedSignals: learnedSignalsForGeneration(),
  })
}
```

In `generateCandidates()`, prepend `audienceIntentCandidates()` instead of `buyerIntentCandidates()`. An empty result must leave `baseGenerated` intact.

- [ ] **Step 6: Persist and restore context-scoped selections**

Add `audienceSelectionsByContext` and `activeAudienceContextKey` under `marketState`. During restore:

1. Normalize new state if present.
2. Otherwise migrate `form.buyerIdentitySeeds`, `buyerIdentitySelectionMode`, and `buyerIdentityAutoSource` with Task 4.
3. Do not reject `PERSISTENCE_VERSION = 1` data.
4. Continue writing the old `buyerIdentitySeeds` field as an empty string for one compatibility cycle; do not use it for active generation.

- [ ] **Step 7: Add focused styles and update cache versions**

Add only layout rules needed for `.audience-field`, `.audience-role-group`, `.audience-heading`, `.audience-manual-row`, and evidence labels. Reuse existing chips, pills, field spacing, desktop sidebar, and mobile breakpoint.

Update `index.html` cache versions together:

```html
<link rel="stylesheet" href="./styles.css?v=20260827-1">
<script type="module" src="./src/app.js?v=20260827-1"></script>
```

Update the shared engine import in `app.js` to `index.js?v=20260827-2` so the provisional Ornament fallback cannot remain cached.

- [ ] **Step 8: Run UI, syntax, and focused generation tests**

Run:

```powershell
node --check market-finder/src/app.js
node --check market-finder/src/audience-selection-state.js
node --test market-finder/scripts/test-guided-entry-ui.mjs market-finder/scripts/test-audience-evidence.mjs market-finder/scripts/test-audience-selection-state.mjs market-finder/scripts/test-opportunity-model.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 9: Commit Task 5**

```powershell
git add market-finder/index.html market-finder/styles.css market-finder/src/app.js market-finder/scripts/test-guided-entry-ui.mjs
git commit -m "feat(market-finder): show evidence-backed audience roles"
```

---

### Task 6: Archive and CSV Compatibility

**Files:**
- Modify: `market-finder/src/app.js:1759-1938,9129-9547`
- Modify: `market-finder/scripts/test-evidence-archive.mjs`
- Modify: `market-finder/scripts/test-opportunity-model.mjs`
- Modify: `market-finder/scripts/test-fresh-start-workspace.mjs`

**Interfaces:**
- Consumes: `currentAudienceAnalysis()`, `currentAudienceSelections()`, and Task 4 migration functions.
- Produces: archive `audienceSignals`, legacy-compatible `identitySeeds`, and appended Audience CSV fields.

- [ ] **Step 1: Add failing archive and CSV tests**

Extend archive tests to require a new record shape:

```js
assert.deepEqual(record.audienceSignals, [{
  phrase: 'teacher',
  role: 'recipient',
  subjectType: '',
  status: 'confirmed',
  autoSelectable: true,
  evidence: {
    etsyRelatedTermCount: 1,
    everbeeSellingListingCount: 2,
  },
}])
```

Add CSV header assertions for:

```js
[
  'Audience Subject',
  'Audience Subject Type',
  'Audience Status',
  'Audience Sources JSON',
  'Audience Evidence JSON',
  'Audience Context Key',
]
```

Add a version-3 archive fixture without `audienceSignals` and assert that it still loads and is reanalyzed only from `demandKeywords` and `supplyListings`, not from `identitySeeds` alone.

- [ ] **Step 2: Run archive and CSV tests and verify RED**

Run:

```powershell
node --test market-finder/scripts/test-evidence-archive.mjs market-finder/scripts/test-opportunity-model.mjs
```

Expected: FAIL because the new archive and CSV fields are absent.

- [ ] **Step 3: Persist new audience evidence without breaking old readers**

In `evidenceArchiveRecord()`:

- Set archive `version: 4`.
- Add `audienceContext` and normalized `audienceSignals`.
- Keep `identitySeeds`, derived only from selected recipient signals with `confirmed` or `manual` status.
- Keep `context.buyerIdentities` with the same compatibility value.
- Do not serialize DOM state, chip markup, or reference-only signals as selected identities.

In `normalizeLearningRecord()`:

- Accept versions 1-4.
- Prefer version-4 `audienceSignals` only when its context matches.
- For older archives, analyze `demandKeywords` and `supplyListings` through the new parser.
- Never turn an old `identitySeeds` value into confirmed marketplace evidence.

- [ ] **Step 4: Append CSV role and evidence fields**

Keep all existing columns and append the six new fields. For each row:

- recipient maps to existing `Recipient Role`.
- giver maps to existing `Giver Role`.
- subject maps to `Audience Subject` and `Audience Subject Type`.
- Export exact status, sources, evidence counts, and context key from the candidate/result provenance.
- Use empty strings for old rows without audience metadata.

- [ ] **Step 5: Run archive, CSV, and fresh-start tests**

Run:

```powershell
node --test market-finder/scripts/test-evidence-archive.mjs market-finder/scripts/test-opportunity-model.mjs market-finder/scripts/test-fresh-start-workspace.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 6: Commit Task 6**

```powershell
git add market-finder/src/app.js market-finder/scripts/test-evidence-archive.mjs market-finder/scripts/test-opportunity-model.mjs market-finder/scripts/test-fresh-start-workspace.mjs
git commit -m "feat(market-finder): persist audience evidence and CSV roles"
```

---

### Task 7: Remove Provisional Fallbacks and Verify the Complete Flow

**Files:**
- Modify: `shared/market-keyword-engine/index.js`
- Modify: `market-finder/src/app.js`
- Modify: `market-finder/scripts/test-audience-evidence.mjs`
- Modify: `market-finder/scripts/test-opportunity-model.mjs`
- Modify: `PROJECT_STATIC_CONTEXT.md`
- Verify: all files changed in Tasks 1-6

**Interfaces:**
- Consumes: the complete audience evidence system.
- Produces: one clean, tested implementation with no fixed-person fallback path.

- [ ] **Step 1: Add a final regression test for the reported bug across every category**

Add a table-driven test with literal expected empty auto-selection:

```js
test('never auto-selects audience people from unrelated category history', () => {
  const categories = ['shirt', 'sweatshirt', 'mug', 'ornament', 'wall-art', 'tote', 'sticker']
  for (const categoryId of categories) {
    const analysis = analyzeAudienceEvidence([
      {
        runId: 'other-category',
        capturedAt: '2026-08-27T00:00:00Z',
        categoryId: categoryId === 'shirt' ? 'mug' : 'shirt',
        eventId: '',
        rootKeyword: 'teacher gift',
        demandKeywords: [{ keyword: 'teacher gift shirt', etsySearches30d: 5000 }],
        supplyListings: [{ title: 'Teacher Gift Shirt', monthlySales: 20 }],
      },
    ], { categoryId, eventId: '', rootKeyword: 'custom product' }, {
      now: '2026-08-27T12:00:00Z',
    })
    assert.equal(analysis.signals.some((signal) => signal.autoSelectable), false)
  }
})
```

- [ ] **Step 2: Verify RED against any remaining provisional path**

Run:

```powershell
node --test --test-name-pattern="unrelated category history" market-finder/scripts/test-audience-evidence.mjs
```

Expected: FAIL if any fixed or global fallback still auto-selects people; otherwise PASS confirms Tasks 1-6 already removed the path.

- [ ] **Step 3: Remove the old fallback and dead buyer-selection state**

Remove:

- `contextualBuyerIdentitySuggestions` and its fixed Ornament people.
- Global-rank learned auto-selection for current audience UI.
- `buyerIdentitySuggestOffset` and random shuffle wiring.
- `buyerIdentitySelectionMode` and `buyerIdentityAutoSource` as active runtime state after migration has read them.
- Any candidate-generation call that still reads `buyerIdentityInput` or `identitySeeds` from the current form.

Keep only compatibility readers/writers explicitly required by Task 4 and Task 6.

- [ ] **Step 4: Run the complete Market Finder test suite**

Run:

```powershell
$tests = Get-ChildItem -LiteralPath 'market-finder\scripts' -Filter 'test-*.mjs' -File | ForEach-Object { $_.FullName }
node --test $tests
```

Expected: all tests pass, zero failures.

- [ ] **Step 5: Run syntax and diff verification**

Run:

```powershell
node --check shared/market-keyword-engine/audience-evidence.js
node --check shared/market-keyword-engine/index.js
node --check market-finder/src/audience-selection-state.js
node --check market-finder/src/app.js
git diff --check
```

Expected: every command exits 0. CRLF conversion warnings are acceptable; whitespace errors are not.

- [ ] **Step 6: Verify the real local UI**

Start the supported local server:

```powershell
.\scripts\start-market-finder.ps1
```

Open `http://127.0.0.1:4174/market-finder/` and verify:

1. Select Ornament while only Shirt evidence archives exist: no teacher/new mom/mom is auto-selected.
2. Confirm `memorial ornament` as the visible static entrance word: status remains `まだ実績がないため未選択` until Etsy/EverBee evidence exists.
3. Select Wall Art, Tote Bag, Mug, Sweatshirt, Sticker, and Shirt: unrelated people never carry between categories.
4. Add a manual recipient in Shirt, switch to Mug, then switch back: Shirt restores its manual choice and Mug remains separate.
5. Load a fixture/current run with Etsy-only audience evidence: chip shows verify and remains unselected.
6. Load evidence meeting the confirmed threshold: the matching role chip auto-selects and shows both evidence counts.
7. Confirm there are no console errors.

- [ ] **Step 7: Commit final cleanup**

Update `PROJECT_STATIC_CONTEXT.md` under shared domain logic with one durable sentence: Audience roles are classified in `shared/market-keyword-engine/audience-evidence.js`; only current category/event/root evidence can auto-select recipient, giver, or subject, and no-audience is a valid discovery state.

```powershell
git add shared/market-keyword-engine/index.js market-finder/src/app.js market-finder/scripts/test-audience-evidence.mjs market-finder/scripts/test-opportunity-model.mjs market-finder/index.html market-finder/styles.css PROJECT_STATIC_CONTEXT.md
git commit -m "fix(market-finder): prevent unsupported audience auto-selection"
```

- [ ] **Step 8: Review the final commit range**

Run:

```powershell
git log --oneline 11e88fe..HEAD
git diff --stat 11e88fe..HEAD
git status --short
```

Expected: only the planned audience-role implementation is committed; unrelated pre-existing working-tree changes remain uncommitted and are reported separately.
