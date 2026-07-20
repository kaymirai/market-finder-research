import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  createMemoizedAnalysis,
  mergeRowsByKey,
} from '../src/research-performance.js'
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

test('risk matching stays fast across a large keyword result set', () => {
  assert.deepEqual(detectRiskTerms('Disney halloween shirt', []), ['disney'])
  assert.deepEqual(detectRiskTerms('custom phrase shirt', ['custom phrase']), ['custom phrase'])

  const startedAt = performance.now()
  for (let index = 0; index < 5000; index += 1) {
    detectRiskTerms(`synthetic niche ${index + 1} shirt`, [])
  }
  const elapsed = performance.now() - startedAt

  assert.ok(elapsed < 900, `5000 risk checks took ${Math.round(elapsed)}ms`)
})
