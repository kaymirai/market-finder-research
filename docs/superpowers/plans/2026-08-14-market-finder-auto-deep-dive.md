# Market Finder Automatic Deep Dive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Etsyへ送る検索語を購入者が使う2〜6語へ限定し、初回確認後のA/B候補が5件未満なら既存の深掘り探索を同一調査内で自動継続する。

**Architecture:** 共通エンジンへ純粋な検索語適格性判定と長文タイトルからの短句派生を追加し、初回候補・Etsy送信直前・複数角度候補の3境界で同じ判定を使う。確認済み長文行は最終根拠一覧に保持しつつ、制作候補・スライド・CSVからは `queryEligibility.eligible === false` で除外する。初回EverBee完了後は純粋な自動開始判定を通し、既存の `multiAngleExploration` と `pendingEvidenceAutomation` を5件到達または明示的停止条件まで回す。

**Tech Stack:** Vanilla JavaScript ES modules、Node.js `node:test`、既存Chrome拡張連携、静的HTML/CSS。

## Global Constraints

- Etsyへ送る検索語は正規化後2〜6語とする。
- 初回候補と深掘り候補は同じ検索語ゲートを使う。
- 7語以上の入力全文はEtsy/EverBeeへ送らず、元データとして保持する。
- 商品カテゴリーとイベントは自動変更しない。
- 1バッチは最大8件とし、バッチ回数には固定上限を設けない。
- 初回調査と深掘り調査のA/B候補を同じ5件目標へ累積する。
- 単一語の0件、取得不能、ページタイムアウトだけでは全体を停止しない。
- 接続切れ、拡張バージョン不一致、ログイン切れ、レート制限、条件変更、制作時期ゲート、ユーザー停止では一時停止する。
- Chrome拡張の取得方式、Opportunity/Confidence採点式、CSV列形式、動画スライドのテンプレート構造は変更しない。
- 既存のユーザー変更を巻き込まず、各コミットでは記載したファイルだけをステージする。

---

### Task 1: 共通の購入者検索語ゲートと長文短句化

**Files:**
- Modify: `shared/market-keyword-engine/index.js:1443-1640`
- Modify: `shared/market-keyword-engine/index.js:3582-3700`
- Test: `market-finder/scripts/test-opportunity-model.mjs`

**Interfaces:**
- Produces: `classifyMarketplaceBuyerQuery(keyword: string, options?: object): { eligible: boolean, status: string, reason: string, normalized: string, wordCount: number, riskTerms: string[], classification: object }`
- Produces: `deriveBuyerSearchQueriesFromTitle(title: string, options?: object): string[]`
- Consumes: 既存の `normalizePhrase`、`classifyCandidateKeyword`、`keywordMatchesCategoryProduct`、`extractNicheHintsFromListings`、`detectRiskTerms`。

- [ ] **Step 1: 2〜6語、カテゴリ一致、具体語の失敗テストを書く**

`test-opportunity-model.mjs` の import に2関数を追加し、次を追加する。

```js
test('accepts only buyer-like Marketplace queries with two to six words', () => {
  const options = { eventId: 'halloween', categoryId: 'shirt' }
  assert.equal(classifyMarketplaceBuyerQuery('teacher shirt', options).eligible, true)
  assert.equal(
    classifyMarketplaceBuyerQuery('retro biology teacher halloween gift shirt', options).eligible,
    true,
  )
  assert.equal(classifyMarketplaceBuyerQuery('shirt', options).status, 'too-short')
  assert.equal(
    classifyMarketplaceBuyerQuery('retro biology teacher halloween gift for school shirt', options).status,
    'title-like',
  )
  assert.equal(classifyMarketplaceBuyerQuery('halloween teacher mug', options).status, 'category-mismatch')
})

test('keeps ordinary risk terms visible but blocks explicit exclusion terms', () => {
  const review = classifyMarketplaceBuyerQuery('disney halloween shirt', {
    eventId: 'halloween',
    categoryId: 'shirt',
  })
  const blocked = classifyMarketplaceBuyerQuery('star wars shirt', {
    eventId: 'halloween',
    categoryId: 'shirt',
    excludedRiskTerms: ['star wars'],
  })

  assert.equal(review.eligible, true)
  assert.ok(review.riskTerms.length > 0)
  assert.equal(blocked.eligible, false)
  assert.equal(blocked.status, 'blocked-risk')
})
```

- [ ] **Step 2: テストが未実装で失敗することを確認する**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Expected: `classifyMarketplaceBuyerQuery` または `deriveBuyerSearchQueriesFromTitle` のexportが存在せずFAIL。

- [ ] **Step 3: 共通適格性判定を実装する**

`classifyCandidateKeyword` の直後へ、次の形で実装する。通常のリスク語は警告情報に残し、ユーザー設定の明示的除外語だけを送信不可にする。

```js
export function classifyMarketplaceBuyerQuery(keyword, options = {}) {
  const normalized = normalizePhrase(keyword)
  const words = phraseTokens(normalized)
  const classification = classifyCandidateKeyword(normalized, options)
  const riskTerms = detectRiskTerms(normalized, [])
  const excludedRiskTerms = splitSeedText(options.excludedRiskTerms)
  const blockedRiskTerms = excludedRiskTerms.filter((term) => phraseHasTerm(normalized, term))

  const result = (eligible, status, reason) => ({
    eligible,
    status,
    reason,
    normalized,
    wordCount: words.length,
    riskTerms,
    classification,
  })

  if (words.length < 2) return result(false, 'too-short', '検索語は2語以上にします')
  if (words.length > 6) return result(false, 'title-like', '商品タイトル相当のため検索対象外です')
  if (blockedRiskTerms.length > 0) return result(false, 'blocked-risk', `除外語: ${blockedRiskTerms.join(', ')}`)
  if (!keywordMatchesCategoryProduct(normalized, options.categoryId)) {
    return result(false, 'category-mismatch', '選択中の商品カテゴリーと一致しません')
  }
  if (classification.action !== 'candidate') {
    return result(false, 'candidate-rejected', classification.reason)
  }
  if ((classification.specificTokens ?? []).length === 0) {
    return result(false, 'too-broad', '購入者・趣味・職業・場面などの具体語がありません')
  }
  return result(true, 'eligible', '購入者が入力し得る検索語です')
}
```

- [ ] **Step 4: 長文タイトルから安全な短句を派生する失敗テストを書く**

```js
test('derives category-matched buyer queries from a long listing title', () => {
  const queries = deriveBuyerSearchQueriesFromTitle(
    'breast cancer awareness bat shirt retro science illustration goth nature lover biology halloween teacher gift',
    { eventId: 'halloween', categoryId: 'shirt', limit: 8 },
  )

  assert.ok(queries.length > 0)
  assert.ok(queries.every((query) => query.split(' ').length >= 2 && query.split(' ').length <= 6))
  assert.ok(queries.every((query) => keywordMatchesCategoryProduct(query, 'shirt')))
  assert.equal(queries.includes('breast cancer awareness bat shirt retro science illustration goth nature lover biology halloween teacher gift'), false)
  assert.ok(queries.some((query) => /biology|teacher|science/.test(query)))
})

test('productizes a short Trend seed before applying the buyer-query gate', () => {
  assert.deepEqual(
    deriveBuyerSearchQueriesFromTitle('biology teacher', {
      eventId: 'halloween',
      categoryId: 'shirt',
      limit: 8,
    }),
    ['biology teacher shirt', 'halloween biology teacher shirt'],
  )
})
```

- [ ] **Step 5: 長文短句化を実装する**

`extractNicheHintsFromListings` の後へ追加する。入力自体が適格ならその1件を返す。1〜6語だが商品語がないTrend種は商品語を補い、カテゴリ一致する短句にする。7語以上ならイベント語・商品語を除いて抽出した1〜3語のヒントを、イベント語と商品語へ再結合して共通ゲートで再検証する。

```js
export function deriveBuyerSearchQueriesFromTitle(title, options = {}) {
  const normalized = normalizePhrase(title)
  const direct = classifyMarketplaceBuyerQuery(normalized, options)
  if (direct.eligible) return [direct.normalized]

  const event = getEvent(options)
  const category = getCategory(options.categoryId)
  const eventTerm = normalizePhrase(event.searchTerm)
  const productTerm = normalizePhrase(category.searchTerm)
  const limit = Math.max(1, Math.min(12, Number(options.limit) || 8))
  const seen = new Set()
  const queries = []
  const pushEligible = (rawQuery) => {
    const eligibility = classifyMarketplaceBuyerQuery(rawQuery, options)
    if (!eligibility.eligible || seen.has(eligibility.normalized)) return false
    seen.add(eligibility.normalized)
    queries.push(eligibility.normalized)
    return queries.length >= limit
  }

  if (direct.wordCount <= 6) {
    if (pushEligible(`${normalized} ${productTerm}`)) return queries
    pushEligible(`${eventTerm} ${normalized} ${productTerm}`)
    return queries
  }
  if (direct.status !== 'title-like') return []

  const hints = extractNicheHintsFromListings([{ title: normalized }], 40, {
    stopWords: [eventTerm, productTerm, ...(category.tags ?? [])],
    blockedPhrases: splitSeedText(options.excludedRiskTerms),
  })
  for (const hint of hints) {
    const hintWords = phraseTokens(hint.keyword)
    if (hintWords.length < 1 || hintWords.length > 3) continue
    for (const rawQuery of [
      `${eventTerm} ${hint.keyword} ${productTerm}`,
      `${hint.keyword} ${productTerm}`,
    ]) {
      if (pushEligible(rawQuery)) return queries
    }
  }
  return queries
}
```

- [ ] **Step 6: 対象テストを通す**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs`

Expected: PASS。

- [ ] **Step 7: Task 1をコミットする**

```powershell
git add -- shared/market-keyword-engine/index.js market-finder/scripts/test-opportunity-model.mjs
git commit -m "feat: add buyer query eligibility gate"
```

---

### Task 2: 初回候補と深掘り候補を共通ゲートへ通す

**Files:**
- Modify: `market-finder/src/app.js:1-45,1519-1605,2455-2460,8145-8225`
- Modify: `market-finder/src/multi-angle-candidates.js:1-40`
- Modify: `market-finder/src/multi-angle-exploration.js:1-10,275-290`
- Modify: `market-finder/scripts/test-multi-angle-candidates.mjs`
- Modify: `market-finder/scripts/test-multi-angle-exploration.mjs`
- Create: `market-finder/scripts/test-buyer-query-gate-ui.mjs`

**Interfaces:**
- Consumes: Task 1の `classifyMarketplaceBuyerQuery` と `deriveBuyerSearchQueriesFromTitle`。
- Produces: すべての `state.candidates` と `currentBatchCandidates` がEtsy送信時点で2〜6語・カテゴリ一致になる。

- [ ] **Step 1: 深掘り側で6語を許可し7語を除外する失敗テストを書く**

`test-multi-angle-candidates.mjs` へ追加する。

```js
test('uses the shared two-to-six word Marketplace boundary', () => {
  assert.equal(isEfficientMarketplaceProbe({
    keyword: 'retro biology teacher halloween gift shirt',
    eventId: 'halloween',
    categoryId: 'shirt',
  }), true)
  assert.equal(isEfficientMarketplaceProbe({
    keyword: 'retro biology teacher halloween gift for shirt',
    eventId: 'halloween',
    categoryId: 'shirt',
  }), false)
})
```

`test-multi-angle-exploration.mjs` の既存復元テストへ、6語候補は保持され7語候補は破棄される期待値を追加する。

- [ ] **Step 2: 初回経路の3境界を固定するソーステストを書く**

`test-buyer-query-gate-ui.mjs` を作成する。

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8')

function functionBody(name) {
  const start = app.indexOf(`function ${name}(`)
  const end = app.indexOf('\nfunction ', start + 1)
  assert.notEqual(start, -1, `${name} must exist`)
  return app.slice(start, end === -1 ? app.length : end)
}

test('derives short queries before Trend Scout entries become candidates', () => {
  assert.match(functionBody('trendCandidateEntries'), /deriveBuyerSearchQueriesFromTitle/)
})

test('rechecks both candidate creation and Etsy handoff with the shared gate', () => {
  assert.match(functionBody('candidateFromKeyword'), /classifyMarketplaceBuyerQuery/)
  assert.match(functionBody('etsyValidationCandidates'), /classifyMarketplaceBuyerQuery/)
})
```

- [ ] **Step 3: テストが現状コードで失敗することを確認する**

Run: `node --test market-finder/scripts/test-multi-angle-candidates.mjs market-finder/scripts/test-multi-angle-exploration.mjs market-finder/scripts/test-buyer-query-gate-ui.mjs`

Expected: 6語候補が旧5語制限で落ち、app.jsに共通ゲート呼び出しがないためFAIL。

- [ ] **Step 4: 初回Trend候補・候補化・Etsy送信直前へゲートを適用する**

`app.js` の共有エンジンimportへ2関数を追加し、キャッシュバスターを `v=20260814-3` へ更新する。

`trendCandidateEntries()` は各入力を次のように展開する。

```js
.flatMap((entry) => deriveBuyerSearchQueriesFromTitle(entry.keyword, {
  ...keywordClassificationOptions(),
  excludedRiskTerms: elements.riskInput.value,
  limit: 8,
}).map((keyword) => ({
  ...entry,
  keyword,
  baseKeyword: normalizePhrase(entry.keyword),
})))
```

`candidateFromKeyword()` の先頭は次の判定に置き換え、生成済み候補にも `queryEligibility` を付ける。

```js
const queryEligibility = classifyMarketplaceBuyerQuery(normalized, {
  ...keywordClassificationOptions(),
  excludedRiskTerms: elements.riskInput.value,
})
if (!queryEligibility.eligible) return null
```

`etsyValidationCandidates()` では保存済み・復元済み候補も再検証する。

```js
function etsyValidationCandidates() {
  if (restoredResultsAwaitingConfirmation()) return []
  const options = {
    ...activeResearchOptions(),
    excludedRiskTerms: elements.riskInput.value,
  }
  return buildEtsyCandidatesFromPool(state.candidates.filter((candidate) => (
    classifyMarketplaceBuyerQuery(candidate.keyword ?? candidate.query, options).eligible
  )))
}
```

- [ ] **Step 5: 深掘り候補と復元バッチへ同じゲートを適用する**

`multi-angle-candidates.js` へ共通関数をimportし、`isEfficientMarketplaceProbe` を置き換える。

```js
export function isEfficientMarketplaceProbe(candidate = {}) {
  return classifyMarketplaceBuyerQuery(candidate.keyword, {
    eventId: candidate.eventId,
    categoryId: candidate.categoryId,
  }).eligible
}
```

`multi-angle-exploration.js` の復元処理は既存どおり `filter(isEfficientMarketplaceProbe)` を使い、保存済み7語以上のバッチを次回送信から除外する。両moduleのクエリ文字列を1段階上げる。

- [ ] **Step 6: 対象テストを通す**

Run: `node --test market-finder/scripts/test-opportunity-model.mjs market-finder/scripts/test-multi-angle-candidates.mjs market-finder/scripts/test-multi-angle-exploration.mjs market-finder/scripts/test-buyer-query-gate-ui.mjs`

Expected: PASS。

- [ ] **Step 7: Task 2をコミットする**

```powershell
git add -- market-finder/src/app.js market-finder/src/multi-angle-candidates.js market-finder/src/multi-angle-exploration.js market-finder/scripts/test-multi-angle-candidates.mjs market-finder/scripts/test-multi-angle-exploration.mjs market-finder/scripts/test-buyer-query-gate-ui.mjs
git commit -m "feat: gate Market Finder query pipelines"
```

---

### Task 3: 過去の長文行を監査用に残して制作候補から隔離する

**Files:**
- Modify: `market-finder/src/app.js:5164-5550,5574-5635,5728-5905,8640-8705`
- Modify: `market-finder/src/final-evidence-matrix.js:368-430`
- Modify: `market-finder/src/video-slide-prompts.js:115-145`
- Modify: `market-finder/styles.css`
- Modify: `market-finder/scripts/test-final-evidence-matrix.mjs`
- Modify: `market-finder/scripts/test-final-evidence-ui.mjs`
- Modify: `market-finder/scripts/test-video-slide-prompts.mjs`

**Interfaces:**
- Consumes: Task 1の `classifyMarketplaceBuyerQuery`。
- Produces: 最終根拠行の `queryEligibility`。
- Produces: `deriveFinalKeywordDecision`、デザインCSV、動画スライドが `queryEligibility.eligible === false` を除外する。

- [ ] **Step 1: A/B集計とスライド除外の失敗テストを書く**

`test-final-evidence-matrix.mjs` へ追加する。

```js
test('does not count a verified title-like row as an A/B production candidate', () => {
  const decision = deriveFinalKeywordDecision([{
    keyword: 'short buyer shirt',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'B',
    queryEligibility: { eligible: true },
  }, {
    keyword: 'long listing title with many unrelated product words shirt',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'A',
    queryEligibility: { eligible: false, status: 'title-like' },
  }])

  assert.equal(decision.recommendedCount, 1)
  assert.deepEqual(decision.recommendedKeywords.map((row) => row.keyword), ['short buyer shirt'])
})
```

`test-video-slide-prompts.mjs` へ追加する。

```js
test('excludes title-like historical evidence from slide candidates', () => {
  const result = selectVideoSlideCandidates([
    makeRow('halloween running shirt', 78, 'B'),
    makeRow('seven word listing title that should not become shirt', 99, 'A', {
      queryEligibility: { eligible: false, status: 'title-like' },
    }),
  ], CONTEXT)
  assert.deepEqual(result.candidates.map((row) => row.keyword), ['halloween running shirt'])
})
```

`makeRow()` は `queryEligibility: overrides.queryEligibility ?? { eligible: true }` を返すようにする。

- [ ] **Step 2: テストが長文A/Bを数えて失敗することを確認する**

Run: `node --test market-finder/scripts/test-final-evidence-matrix.mjs market-finder/scripts/test-video-slide-prompts.mjs`

Expected: 長文行もA/B・スライド候補へ入りFAIL。

- [ ] **Step 3: 最終根拠行へ適格性を記録し各制作経路から除外する**

`finalEvidenceRows()` の行生成内で、行自身の保存済みコンテキストを優先して判定する。

```js
const queryEligibility = classifyMarketplaceBuyerQuery(keyword, {
  eventId: raw.researchEventId ?? candidate.eventId ?? activeContext.eventId,
  categoryId: raw.researchCategoryId ?? candidate.categoryId ?? activeContext.categoryId,
  excludedRiskTerms: elements.riskInput.value,
})
```

返却行へ `queryEligibility` を追加する。`deriveFinalKeywordDecision()` のrecommended filter、`selectVideoSlideCandidates()` のverified filterには次を追加する。

```js
row?.queryEligibility?.eligible !== false
```

`currentDesignClusterPlan()` は `queryEligibility.eligible !== false` のverified行だけを `everbeeRow` へ変換する。`copyFinalKeywords()` は `deriveFinalKeywordDecision(finalEvidenceRows()).recommendedKeywords` をコピー元にし、EverBee生行を直接使わない。

- [ ] **Step 4: 監査表示と除外件数のUIテストを書く**

`test-final-evidence-ui.mjs` へ次を追加する。

```js
test('labels title-like history without deleting it from the evidence table', () => {
  assert.match(app, /商品タイトル相当・検索語対象外/)
  assert.match(app, /titleLikeCount/)
  assert.match(css, /final-evidence-query-exclusion/)
})
```

- [ ] **Step 5: 長文行の警告表示を実装する**

`renderFinalEvidenceMatrixRow()` のキーワードセルに、対象外時だけ次を表示する。

```js
const queryExclusion = row.queryEligibility?.eligible === false
  ? '<small class="final-evidence-query-exclusion">商品タイトル相当・検索語対象外</small>'
  : ''
```

`renderFinalEvidenceMatrix()` で `titleLikeCount` を数え、`finalEvidenceScopeStatus` に「長文N件は履歴に保持し、候補数・スライドから除外」と追記する。`styles.css` では `.final-evidence-query-exclusion` を既存の注意色オレンジ、表内で読める既存相当サイズ、太字で表示する。

- [ ] **Step 6: 対象テストを通す**

Run: `node --test market-finder/scripts/test-final-evidence-matrix.mjs market-finder/scripts/test-final-evidence-ui.mjs market-finder/scripts/test-video-slide-prompts.mjs`

Expected: PASS。

- [ ] **Step 7: Task 3をコミットする**

```powershell
git add -- market-finder/src/app.js market-finder/src/final-evidence-matrix.js market-finder/src/video-slide-prompts.js market-finder/styles.css market-finder/scripts/test-final-evidence-matrix.mjs market-finder/scripts/test-final-evidence-ui.mjs market-finder/scripts/test-video-slide-prompts.mjs
git commit -m "fix: isolate title-like Market Finder evidence"
```

---

### Task 4: A/B 5件未達時の自動開始判定と既存勝者の累積

**Files:**
- Modify: `market-finder/src/multi-angle-exploration.js:880-950,1180-1220`
- Modify: `market-finder/scripts/test-multi-angle-exploration.mjs`

**Interfaces:**
- Produces: `shouldAutoStartMultiAngleExploration(input?: object): boolean`
- Changes: `reconcileMultiAngleWinners` は検索対象外行をwinnerに数えない。
- Consumes: `decisionStatus`、`winnerCount`、`targetWinnerCount`、`explorationStatus`、未検証数、実行中/復元待ち/別探索待ちのフラグ。

- [ ] **Step 1: 自動開始・停止条件の失敗テストを書く**

`test-multi-angle-exploration.mjs` のimportへ `shouldAutoStartMultiAngleExploration` を追加する。

```js
test('auto-starts deep dive only after complete initial evidence is below target', () => {
  const base = {
    hasResearchRows: true,
    decisionStatus: 'ready',
    winnerCount: 1,
    targetWinnerCount: 5,
    explorationStatus: 'idle',
    pendingCount: 0,
    activeWork: false,
    restoredAwaiting: false,
    crossNichePending: false,
    blocked: false,
  }
  assert.equal(shouldAutoStartMultiAngleExploration(base), true)
  assert.equal(shouldAutoStartMultiAngleExploration({ ...base, winnerCount: 5 }), false)
  assert.equal(shouldAutoStartMultiAngleExploration({ ...base, pendingCount: 1 }), false)
  assert.equal(shouldAutoStartMultiAngleExploration({ ...base, explorationStatus: 'running' }), false)
  assert.equal(shouldAutoStartMultiAngleExploration({ ...base, restoredAwaiting: true }), false)
  assert.equal(shouldAutoStartMultiAngleExploration({ ...base, blocked: true }), false)
})

test('reconciliation ignores historical title-like A/B rows', () => {
  const reconciled = reconcileMultiAngleWinners({ targetWinnerCount: 5 }, [{
    keyword: 'halloween running shirt',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'B',
    queryEligibility: { eligible: true },
  }, {
    keyword: 'long listing title with many unrelated product words shirt',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'A',
    queryEligibility: { eligible: false },
  }])
  assert.deepEqual(reconciled.winnerKeywords, ['halloween running shirt'])
})
```

- [ ] **Step 2: テストがexport不足・長文winner混入で失敗することを確認する**

Run: `node --test market-finder/scripts/test-multi-angle-exploration.mjs`

Expected: FAIL。

- [ ] **Step 3: 純粋な自動開始判定を実装する**

```js
export function shouldAutoStartMultiAngleExploration(input = {}) {
  const targetWinnerCount = Math.max(1, Number(input.targetWinnerCount) || 5)
  const winnerCount = Math.max(0, Number(input.winnerCount) || 0)
  if (!input.hasResearchRows || winnerCount >= targetWinnerCount) return false
  if (input.decisionStatus === 'pending' || Number(input.pendingCount) > 0) return false
  if (String(input.explorationStatus ?? 'idle') !== 'idle') return false
  if (input.activeWork || input.restoredAwaiting || input.crossNichePending || input.blocked) return false
  return ['ready', 'none', 'retry'].includes(String(input.decisionStatus ?? ''))
}
```

`reconcileMultiAngleWinners()` のwinner filterへ `row?.queryEligibility?.eligible !== false` を追加する。初回の短いA/B 1件は保持され、長文のA/Bは保持されない。

- [ ] **Step 4: 対象テストを通す**

Run: `node --test market-finder/scripts/test-multi-angle-exploration.mjs`

Expected: PASS。

- [ ] **Step 5: Task 4をコミットする**

```powershell
git add -- market-finder/src/multi-angle-exploration.js market-finder/scripts/test-multi-angle-exploration.mjs
git commit -m "feat: decide automatic Market Finder deep dive"
```

---

### Task 5: 初回EverBee完了から深掘りへ自動接続しUIを整合させる

**Files:**
- Modify: `market-finder/src/app.js:190-225,4400-4530,6640-7020,7149-7215,8621-8685,9980-10025`
- Modify: `market-finder/scripts/test-multi-angle-ui.mjs`
- Modify: `market-finder/scripts/test-buyer-query-gate-ui.mjs`

**Interfaces:**
- Consumes: Task 4の `shouldAutoStartMultiAngleExploration`。
- Produces: `maybeAutoStartMultiAngleSearch(source?: string): Promise<boolean>`。
- Preserves: 既存の `queueNextMultiAngleBatch()` → `schedulePendingEvidenceAutomation()` → `completeMultiAngleBatch()` ループ。

- [ ] **Step 1: 自動接続とCSV抑制の失敗テストを書く**

`test-buyer-query-gate-ui.mjs` へ次を追加する。

```js
test('checks automatic deep dive after idle EverBee completion', () => {
  assert.match(app, /async function maybeAutoStartMultiAngleSearch/)
  assert.match(app, /shouldAutoStartMultiAngleExploration/)
  assert.match(app, /MARKET_STATE[\s\S]*maybeAutoStartMultiAngleSearch/)
})
```

`test-multi-angle-ui.mjs` へ次を追加する。

```js
test('does not make CSV the primary action while the five-candidate target is unmet', () => {
  const start = app.indexOf('function researchExperienceAction(')
  const end = app.indexOf('\nfunction ', start + 1)
  const body = app.slice(start, end)
  assert.ok(body.indexOf('remainingWinnerCount > 0') < body.indexOf("action: 'export-design'"))
  assert.match(body, /A\/Bをあと\$\{remainingWinnerCount\}件探す/)
})
```

- [ ] **Step 2: 現状コードで失敗することを確認する**

Run: `node --test market-finder/scripts/test-multi-angle-ui.mjs market-finder/scripts/test-buyer-query-gate-ui.mjs`

Expected: 自動接続helperがなく、idle + A/B 1/5ではCSV分岐が先に選ばれるためFAIL。

- [ ] **Step 3: 重複起動を防ぐ自動開始helperを実装する**

module scopeへ `let autoDeepDiveStartPromise = null` を追加し、次を実装する。

```js
async function maybeAutoStartMultiAngleSearch(source = '') {
  if (autoDeepDiveStartPromise) return autoDeepDiveStartPromise
  const rows = finalEvidenceRows()
  const decision = deriveFinalKeywordDecision(rows)
  const target = calculateListingResearchTarget(state.listingResearchTargetSettings)
  const activeWork = Boolean(state.extensionState?.active)
    || state.marketplaceInsightAutoRunning
    || state.marketplaceInsightBusy
    || state.pendingEvidenceAutomation.active
    || state.pendingEvidenceAutomation.scheduled
  const blockedReason = extensionBlockReason()
  const failureCode = multiAngleFailureCode(state.progress.message)
  const globallyBlocked = ['service-unavailable', 'login-required', 'rate-limited'].includes(failureCode)
  const timing = classifyProductionWindow(activeResearchContext().event)
  const timingBlocked = ['early', 'late'].includes(timing.status) && !state.timingOverrideConfirmed
  const shouldStart = shouldAutoStartMultiAngleExploration({
    hasResearchRows: rows.length > 0,
    decisionStatus: decision.status,
    winnerCount: decision.recommendedCount,
    targetWinnerCount: target.targetWinnerCount,
    explorationStatus: state.multiAngleExploration.status,
    pendingCount: decision.pendingCount,
    activeWork,
    restoredAwaiting: restoredResultsAwaitingConfirmation(),
    crossNichePending: isCrossNicheWorkflowPending(state.crossNicheWorkflow),
    blocked: Boolean(blockedReason) || globallyBlocked || timingBlocked,
  })
  if (!shouldStart) return false

  state.multiAngleExploration = reconcileMultiAngleWinners(
    createMultiAngleExplorationState({
      ...state.multiAngleExploration,
      targetWinnerCount: target.targetWinnerCount,
    }),
    rows,
  )
  setSimpleStatus(`A/B候補${decision.recommendedCount}/${target.targetWinnerCount}件。${source || '初回確認完了'}から深掘りを続けます。`)
  autoDeepDiveStartPromise = startMultiAngleSearch()
    .finally(() => { autoDeepDiveStartPromise = null })
  return autoDeepDiveStartPromise
}
```

- [ ] **Step 4: 初回完了の2経路からhelperを呼ぶ**

1. `MARKET_STATE` のidle heartbeatで `importExtensionResults(data.state)` と既存のpending/recovery処理後に、`void maybeAutoStartMultiAngleSearch('EverBee確認完了')` を呼ぶ。
2. `schedulePendingEvidenceAutomation()` の `remainingRows.length === 0` かつ複数角度探索中でない完了分岐で、状態保存後に `await maybeAutoStartMultiAngleSearch('未検証候補の確認完了')` を呼ぶ。

重複heartbeatは `autoDeepDiveStartPromise` と探索statusで抑止する。既存の複数角度バッチ完了は引き続き `completeMultiAngleBatch()` が処理し、このhelperへ分岐させない。

- [ ] **Step 5: 目標未達時の主操作と説明を自動探索へ統一する**

`researchExperienceAction()` では `decision.status === 'ready'` のCSV分岐より前に、`remainingWinnerCount > 0` を処理する。

```js
if (decision.status === 'ready' && remainingWinnerCount > 0) {
  const blockedReason = extensionBlockReason()
  return {
    action: 'automation',
    label: `A/Bをあと${remainingWinnerCount}件探す`,
    disabled: Boolean(blockedReason),
    reason: blockedReason || '初回候補を保持したまま、職業・趣味・ペットなどを自動で深掘りします。',
  }
}
```

`researchExperienceDescription()` と `nextResearchAction()` も、A/Bが目標未達ならCSV案内ではなく現在軸・完了バッチ・残り件数を案内する。`winner-found` は5/5、`exhausted` は安全な未調査候補枯渇として既存コピーを維持する。

- [ ] **Step 6: 対象テストと自動ループ回帰を通す**

Run: `node --test market-finder/scripts/test-multi-angle-ui.mjs market-finder/scripts/test-buyer-query-gate-ui.mjs market-finder/scripts/test-persistent-evidence-automation.mjs market-finder/scripts/test-research-experience-ui.mjs market-finder/scripts/test-research-flow.mjs`

Expected: PASS。

- [ ] **Step 7: Task 5をコミットする**

```powershell
git add -- market-finder/src/app.js market-finder/scripts/test-multi-angle-ui.mjs market-finder/scripts/test-buyer-query-gate-ui.mjs
git commit -m "feat: auto-continue Market Finder to five candidates"
```

---

### Task 6: 全体回帰とローカル画面確認

**Files:**
- Verify only: `market-finder/`

**Interfaces:**
- Verifies: 共通ゲート、A/B集計、スライド候補、状態復元、自動バッチ継続、停止条件。

- [ ] **Step 1: 変更対象の構文を確認する**

Run:

```powershell
node --check shared/market-keyword-engine/index.js
node --check market-finder/src/multi-angle-candidates.js
node --check market-finder/src/multi-angle-exploration.js
node --check market-finder/src/final-evidence-matrix.js
node --check market-finder/src/video-slide-prompts.js
node --check market-finder/src/app.js
```

Expected: 全ファイル exit 0。

- [ ] **Step 2: 関連テストをまとめて実行する**

Run:

```powershell
node --test market-finder/scripts/test-opportunity-model.mjs market-finder/scripts/test-multi-angle-candidates.mjs market-finder/scripts/test-multi-angle-exploration.mjs market-finder/scripts/test-buyer-query-gate-ui.mjs market-finder/scripts/test-final-evidence-matrix.mjs market-finder/scripts/test-final-evidence-ui.mjs market-finder/scripts/test-video-slide-prompts.mjs market-finder/scripts/test-multi-angle-ui.mjs market-finder/scripts/test-persistent-evidence-automation.mjs market-finder/scripts/test-research-experience-ui.mjs market-finder/scripts/test-research-flow.mjs
```

Expected: 全テストPASS。

- [ ] **Step 3: Market Finderの全テストを実行する**

Run:

```powershell
Get-ChildItem market-finder\scripts\test-*.mjs | ForEach-Object {
  node --test $_.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Expected: 全ファイルPASS。既存の無関係な失敗がある場合はファイル名・失敗内容・今回変更との関係を分けて記録する。

- [ ] **Step 4: 外部検索枠を消費せずローカル画面を確認する**

Market Finderを既存手順で起動し、保存済み調査データまたはテストfixtureを復元して次を確認する。自動検証ではEtsy/EverBeeへ新しい検索を送らず、無料枠・レート枠を消費しない。実サービスを使う最終確認はユーザーが次回調査を実行した際に行う。

1. 7語以上のタイトル由来語がEtsy公式キューへ入らない。
2. 派生した候補が2〜6語で、選択商品カテゴリーを含む。
3. 初回A/B 1/5の完了後、操作なしで職業・趣味・ペット等の深掘りが開始する。
4. 1バッチ最大8件でEtsy→EverBeeへ進み、1/5のままなら次軸へ進む。
5. 5/5で停止する。
6. 既存長文行は一覧に警告付きで残り、候補数・CSV・スライドには入らない。
7. 停止ボタン、接続切れ、ログイン切れ、レート制限では候補を保持して停止する。

- [ ] **Step 5: 最終差分を確認する**

Run:

```powershell
git diff --check
git status --short
git log --oneline -6
```

Expected: whitespace errorなし。今回のファイル以外のユーザー変更がコミットへ混入していない。Task 1〜5のコミットが確認できる。
