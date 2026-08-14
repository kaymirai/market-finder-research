import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  createMemoizedAnalysis,
  createReferenceMemoizedComputation,
  mergeRowsByKey,
  shouldPersistWorkspaceRender,
} from '../src/research-performance.js'
import * as researchPerformance from '../src/research-performance.js'
import { detectRiskTerms } from '../../shared/market-keyword-engine/index.js'

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8')

test('reuses one analysis while rows and options are unchanged', () => {
  let analysisCalls = 0
  const analyze = createMemoizedAnalysis((rows, options) => {
    analysisCalls += 1
    return { count: rows.length, categoryId: options.categoryId }
  })
  const rows = [{ keyword: 'ghost shirt' }]
  const options = { categoryId: 'shirt', eventId: 'halloween' }

  for (let index = 0; index < 7; index += 1) {
    assert.deepEqual(analyze(rows, options), { count: 1, categoryId: 'shirt' })
  }

  assert.equal(analysisCalls, 1)
  analyze(rows, { ...options, eventId: 'christmas' })
  assert.equal(analysisCalls, 2)
  analyze([...rows], { ...options, eventId: 'christmas' })
  assert.equal(analysisCalls, 3)
})

test('reuses an expensive computation until a source reference or progress signature changes', () => {
  let computationCalls = 0
  const compute = createReferenceMemoizedComputation(() => {
    computationCalls += 1
    return { call: computationCalls }
  })
  const rows = [{ keyword: 'ghost shirt' }]
  const candidates = [{ keyword: 'pumpkin shirt' }]

  assert.deepEqual(compute([rows, candidates], 'etsy:completed'), { call: 1 })
  assert.deepEqual(compute([rows, candidates], 'etsy:completed'), { call: 1 })
  assert.equal(computationCalls, 1)

  assert.deepEqual(compute([rows, candidates], 'etsy:opened'), { call: 2 })
  assert.deepEqual(compute([[...rows], candidates], 'etsy:opened'), { call: 3 })
  assert.equal(computationCalls, 3)
})

test('merges a large result batch with one key lookup per row', () => {
  const existing = Array.from({ length: 445 }, (_, index) => ({
    keyword: `niche ${index + 1} shirt`,
    searches: 100,
  }))
  const incoming = Array.from({ length: 445 }, (_, index) => ({
    keyword: `niche ${index + 1} shirt`,
    clicks: 50,
  }))
  let keyCalls = 0

  const merged = mergeRowsByKey(existing, incoming, {
    keyOf(row) {
      keyCalls += 1
      return row.keyword
    },
    merge(existingRow, incomingRow) {
      return { ...existingRow, ...incomingRow }
    },
  })

  assert.equal(merged.length, 445)
  assert.deepEqual(merged[0], {
    keyword: 'niche 1 shirt',
    searches: 100,
    clicks: 50,
  })
  assert.equal(keyCalls, existing.length + incoming.length)
})

test('the app batches CSV rows and routes repeated ranking through the analysis cache', () => {
  assert.match(appSource, /createMemoizedAnalysis/)
  assert.match(appSource, /addResearchRows\(rows\)/)
  assert.doesNotMatch(appSource, /rows\.forEach\(addResearchRow\)/)
  assert.doesNotMatch(appSource, /rankResearchRows\(/)
  assert.match(appSource, /everbeeRows/)
})

test('forced workspace renders skip the full-state signature walk', () => {
  const body = appSource.match(/function shouldRenderActiveWorkspace\(options = \{\}\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(body, 'workspace render gate must be extractable')
  let fingerprintCalls = 0
  const shouldRender = new Function(
    'activeWorkspaceRenderFingerprint',
    'trackActiveWorkspaceRender',
    `return function shouldRenderActiveWorkspace(options = {}) {${body}\n}`,
  )(
    () => {
      fingerprintCalls += 1
      return 'large-state-signature'
    },
    () => true,
  )

  assert.equal(shouldRender({ force: true }), true)
  assert.equal(fingerprintCalls, 0)
  assert.equal(shouldRender({ force: false }), true)
  assert.equal(fingerprintCalls, 1)
})

test('the active Workspace fingerprint does not serialize the whole application state', () => {
  const body = appSource.match(/function activeWorkspaceRenderFingerprint\(\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(body, 'workspace fingerprint must be extractable')
  assert.doesNotMatch(body, /\.\.\.workspaceState|workspaceState\s*,/)
  assert.match(body, /researchRows:/)
  assert.match(body, /marketplaceInsightPlan:/)
})

test('market vocabulary analysis is reused while its source references stay unchanged', () => {
  const body = appSource.match(/function currentModifierAnalysis\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(body, /modifierAnalysisCache/)
  assert.match(body, /researchRows === state\.researchRows/)
  assert.match(body, /marketplaceInsightPlan === state\.marketplaceInsightPlan/)
  assert.match(body, /evidenceArchives === state\.evidenceArchives/)
})

test('skips full-state persistence while showing a restored preview', () => {
  assert.equal(shouldPersistWorkspaceRender({ restoredPreview: true }), false)
  assert.equal(shouldPersistWorkspaceRender({ restoredPreview: false }), true)
})

test('risk matching stays fast across a large keyword result set', () => {
  assert.deepEqual(detectRiskTerms('Disney halloween shirt', []), ['disney'])
  assert.deepEqual(detectRiskTerms('resident evil shirt', []), ['resident evil'])
  assert.deepEqual(detectRiskTerms('custom phrase shirt', ['custom phrase']), ['custom phrase'])

  const startedAt = performance.now()
  for (let index = 0; index < 5000; index += 1) {
    detectRiskTerms(`synthetic niche ${index + 1} shirt`, [])
  }
  const elapsed = performance.now() - startedAt

  assert.ok(elapsed < 900, `5000 risk checks took ${Math.round(elapsed)}ms`)
})

test('builds one research-row batch for an Etsy result and all related metrics', () => {
  assert.equal(typeof researchPerformance.buildMarketplaceCaptureRows, 'function')
  const rows = researchPerformance.buildMarketplaceCaptureRows({
    query: 'halloween nurse shirt',
    checkedAt: '2026-08-12T10:00:00.000Z',
    insight: {
      keyword: 'halloween nurse shirt',
      etsySearches30d: 120,
      etsyListings: 8400,
      etsyRelatedTerms: ['spooky nurse shirt', 'nurse ghost shirt'],
    },
    relatedMetrics: [{
      keyword: 'spooky nurse shirt',
      etsySearches30d: 45,
      etsyListings: 900,
      conversionLabel: 'High',
      sourceModes: ['similar'],
    }, {
      keyword: 'nurse ghost shirt',
      etsySearches30d: 18,
      etsyListings: 420,
      conversionLabel: 'Medium',
      sourceModes: ['explore'],
    }],
  })

  assert.equal(rows.length, 3)
  assert.equal(rows[0].keyword, 'halloween nurse shirt')
  assert.equal(rows[1].keyword, 'spooky nurse shirt')
  assert.equal(rows[2].etsyListings, 420)
  assert.match(rows[1].notes, /related to halloween nurse shirt/)
})

test('keeps the visible Etsy queue bounded around the current checkpoint', () => {
  assert.equal(typeof researchPerformance.visibleMarketplaceQueue, 'function')
  const items = Array.from({ length: 200 }, (_, index) => ({
    id: `etsy-insight-${index + 1}`,
    query: `query ${index + 1}`,
  }))
  const result = researchPerformance.visibleMarketplaceQueue(items, 'etsy-insight-170', 40)

  assert.equal(result.items.length, 40)
  assert.equal(result.items.some((item) => item.id === 'etsy-insight-170'), true)
  assert.equal(result.hiddenBefore + result.items.length + result.hiddenAfter, 200)
  assert.ok(result.hiddenBefore > 0)
  assert.ok(result.hiddenAfter > 0)
})

test('accepts restored results automatically only when they belong to unfinished work', () => {
  assert.equal(typeof researchPerformance.acceptRestoredCheckpoint, 'function')
  assert.equal(researchPerformance.acceptRestoredCheckpoint({
    hasSavedAutomationWork: true,
    savedAccepted: false,
  }), true)
  assert.equal(researchPerformance.acceptRestoredCheckpoint({
    hasSavedAutomationWork: false,
    savedAccepted: false,
  }), false)
  assert.equal(researchPerformance.acceptRestoredCheckpoint({
    hasSavedAutomationWork: false,
    savedAccepted: true,
  }), true)
})

test('defers expensive archive construction until the debounce timer fires', () => {
  assert.equal(typeof researchPerformance.deferLatestWork, 'function')
  let archived = 0
  let scheduledCallback = null
  let clearedTimer = null
  const timerId = researchPerformance.deferLatestWork({
    currentTimer: 41,
    clearTimer(value) {
      clearedTimer = value
    },
    setTimer(callback, delayMs) {
      assert.equal(delayMs, 1200)
      scheduledCallback = callback
      return 42
    },
    delayMs: 1200,
    work() {
      archived += 1
    },
  })

  assert.equal(timerId, 42)
  assert.equal(clearedTimer, 41)
  assert.equal(archived, 0)
  scheduledCallback()
  assert.equal(archived, 1)
})
