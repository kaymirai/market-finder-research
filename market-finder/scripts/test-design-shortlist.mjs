import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDesignShortlistOrder,
  isDesignShortlistEligible,
  selectDesignShortlist,
} from '../src/design-shortlist.js'

function row(keyword, { label = 'A', score = 80, cluster = keyword, decision = 'Best first product', riskTerms = [] } = {}) {
  return {
    keyword,
    historyClusterKey: cluster,
    productRoute: { decision },
    score: { opportunityLabel: label, score, riskTerms, normalized: { keyword } },
  }
}

test('keeps only A and B rows that are safe to design', () => {
  assert.equal(isDesignShortlistEligible(row('a shirt', { label: 'A' })), true)
  assert.equal(isDesignShortlistEligible(row('b shirt', { label: 'B' })), true)
  assert.equal(isDesignShortlistEligible(row('c shirt', { label: 'C' })), false)
  assert.equal(isDesignShortlistEligible(row('d shirt', { label: 'D' })), false)
  assert.equal(isDesignShortlistEligible(row('ip shirt', { decision: 'Do not use' })), false)
  assert.equal(isDesignShortlistEligible(row('risky shirt', { riskTerms: ['lego'] })), false)
})

test('reads the grade from a labelled opportunity value', () => {
  assert.equal(isDesignShortlistEligible(row('a shirt', { label: 'A: 今すぐ候補' })), true)
  assert.equal(isDesignShortlistEligible(row('d shirt', { label: 'D: 除外候補' })), false)
})

test('spreads the first page across themes instead of stacking one cluster', () => {
  const rows = [
    row('ghost shirt 1', { score: 99, cluster: 'ghost' }),
    row('ghost shirt 2', { score: 98, cluster: 'ghost' }),
    row('ghost shirt 3', { score: 97, cluster: 'ghost' }),
    row('cat shirt 1', { score: 90, cluster: 'cat' }),
    row('pumpkin shirt 1', { score: 85, cluster: 'pumpkin' }),
  ]

  const { items } = selectDesignShortlist(rows, { size: 3 })

  assert.deepEqual(items.map((item) => item.keyword), [
    'ghost shirt 1',
    'cat shirt 1',
    'pumpkin shirt 1',
  ])
})

test('never drops a candidate: later pages continue the same order', () => {
  const rows = Array.from({ length: 25 }, (_, index) => row(`shirt ${index}`, {
    score: 100 - index,
    cluster: `cluster ${index % 5}`,
  }))

  const first = selectDesignShortlist(rows, { size: 20 })
  const second = selectDesignShortlist(rows, { size: 20, offset: 20 })

  assert.equal(first.total, 25)
  assert.equal(first.items.length, 20)
  assert.equal(first.hasMore, true)
  assert.equal(second.items.length, 5)
  assert.equal(second.hasMore, false)
  assert.equal(second.page, 2)
  assert.equal(second.pageCount, 2)

  const seen = [...first.items, ...second.items].map((item) => item.keyword)
  assert.equal(new Set(seen).size, 25)
  assert.deepEqual(seen, buildDesignShortlistOrder(rows).map((item) => item.keyword))
})

test('fills the page even when every row shares one cluster', () => {
  const rows = Array.from({ length: 6 }, (_, index) => row(`ghost shirt ${index}`, {
    score: 90 - index,
    cluster: 'ghost',
  }))

  const { items, clusterCount } = selectDesignShortlist(rows, { size: 5 })

  assert.equal(items.length, 5)
  assert.equal(clusterCount, 1)
})

test('falls back to the first page when the offset is past the end', () => {
  const rows = [row('only shirt')]
  const { items, offset, page } = selectDesignShortlist(rows, { size: 20, offset: 40 })

  assert.equal(items.length, 1)
  assert.equal(offset, 0)
  assert.equal(page, 1)
})

test('returns an empty shortlist when nothing is eligible', () => {
  const { items, total, hasMore } = selectDesignShortlist([
    row('c shirt', { label: 'C' }),
    row('blocked shirt', { decision: 'Do not use' }),
  ])

  assert.deepEqual(items, [])
  assert.equal(total, 0)
  assert.equal(hasMore, false)
})
