import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DESIGN_CLUSTER_COUNT,
  DESIGN_PER_CLUSTER_MAX,
  DESIGN_PER_CLUSTER_MIN,
  isDesignShortlistEligible,
  selectDesignClusters,
} from '../src/design-shortlist.js'

function row(keyword, { label = 'A', score = 80, cluster = keyword, decision = 'Best first product', riskTerms = [] } = {}) {
  return {
    keyword,
    historyClusterKey: cluster,
    productRoute: { decision },
    score: { opportunityLabel: label, score, riskTerms, normalized: { keyword } },
  }
}

function clusterRows(clusterKey, count, baseScore) {
  return Array.from({ length: count }, (_, index) => row(`${clusterKey} shirt ${index}`, {
    cluster: clusterKey,
    score: baseScore - index,
  }))
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

test('hands over four themes with several keywords each, not one flat list', () => {
  const rows = [
    ...clusterRows('ghost', 6, 99),
    ...clusterRows('cat', 6, 92),
    ...clusterRows('teacher', 6, 85),
    ...clusterRows('nurse', 6, 78),
    ...clusterRows('coffee', 6, 70),
  ]

  const plan = selectDesignClusters(rows)

  assert.equal(plan.clusters.length, DESIGN_CLUSTER_COUNT)
  assert.deepEqual(plan.clusters.map((cluster) => cluster.key), ['ghost', 'cat', 'teacher', 'nurse'])
  plan.clusters.forEach((cluster) => {
    assert.ok(cluster.items.length >= DESIGN_PER_CLUSTER_MIN)
    assert.ok(cluster.items.length <= DESIGN_PER_CLUSTER_MAX)
  })
  assert.equal(plan.items.length, 24)
  assert.equal(plan.totalClusters, 5)
  assert.equal(plan.hasMore, true)
})

test('orders clusters by their strongest keyword', () => {
  const rows = [
    ...clusterRows('weak', 8, 71),
    ...clusterRows('strong', 2, 98),
  ]

  const plan = selectDesignClusters(rows)

  assert.equal(plan.clusters[0].key, 'strong')
  assert.equal(plan.clusters[1].key, 'weak')
})

test('prefers the deeper theme when scores tie', () => {
  const rows = [
    ...clusterRows('aaa', 2, 90).map((item) => ({ ...item, score: { ...item.score, score: 90 } })),
    ...clusterRows('zzz', 7, 90).map((item) => ({ ...item, score: { ...item.score, score: 90 } })),
  ]

  const plan = selectDesignClusters(rows)

  // Alphabetically 'aaa' wins, but only 'zzz' has enough keywords to become a series.
  assert.equal(plan.clusters[0].key, 'zzz')
  assert.equal(plan.clusters[1].key, 'aaa')
})

test('caps a deep cluster at the per-cluster maximum', () => {
  const plan = selectDesignClusters(clusterRows('ghost', 20, 95))

  assert.equal(plan.clusters.length, 1)
  assert.equal(plan.clusters[0].items.length, DESIGN_PER_CLUSTER_MAX)
  assert.equal(plan.clusters[0].available, 20)
})

test('flags a cluster too thin to carry a series instead of hiding it', () => {
  const rows = [
    ...clusterRows('ghost', 6, 95),
    ...clusterRows('thin', 2, 90),
  ]

  const plan = selectDesignClusters(rows)

  assert.equal(plan.clusters[1].key, 'thin')
  assert.equal(plan.clusters[1].thin, true)
  assert.equal(plan.clusters[0].thin, false)
  assert.equal(plan.thinClusters, 1)
})

test('pages to the next themes without dropping any', () => {
  const rows = [
    ...clusterRows('a', 5, 99),
    ...clusterRows('b', 5, 95),
    ...clusterRows('c', 5, 90),
    ...clusterRows('d', 5, 85),
    ...clusterRows('e', 5, 80),
    ...clusterRows('f', 5, 75),
  ]

  const first = selectDesignClusters(rows)
  const second = selectDesignClusters(rows, { offset: DESIGN_CLUSTER_COUNT })

  assert.deepEqual(first.clusters.map((cluster) => cluster.key), ['a', 'b', 'c', 'd'])
  assert.deepEqual(second.clusters.map((cluster) => cluster.key), ['e', 'f'])
  assert.equal(second.page, 2)
  assert.equal(second.pageCount, 2)
  assert.equal(second.hasMore, false)
})

test('falls back to the first page when the offset is past the end', () => {
  const plan = selectDesignClusters(clusterRows('only', 5, 90), { offset: 40 })

  assert.equal(plan.offset, 0)
  assert.equal(plan.page, 1)
  assert.equal(plan.clusters.length, 1)
})

test('returns an empty plan when nothing is eligible', () => {
  const plan = selectDesignClusters([
    row('c shirt', { label: 'C' }),
    row('blocked shirt', { decision: 'Do not use' }),
  ])

  assert.deepEqual(plan.clusters, [])
  assert.deepEqual(plan.items, [])
  assert.equal(plan.totalClusters, 0)
  assert.equal(plan.hasMore, false)
})
