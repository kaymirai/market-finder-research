import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildNicheDrilldownGraph,
  mergeNicheDrilldownNodes,
} from '../src/niche-drilldown-graph.js'

test('builds one traceable node per parent and child keyword', () => {
  const nodes = buildNicheDrilldownGraph({
    rows: [
      {
        keyword: 'teacher shirt',
        erankSearchVolume: 1200,
        erankCompetition: 50000,
        sellingListingCount: 5,
        recentSellingListingCount: 3,
        medianMonthlySales: 20,
        everbeeCheckedAt: '2026-07-26T01:00:00.000Z',
      },
      {
        keyword: 'special education teacher shirt',
        crossNicheParent: 'teacher shirt',
        crossNicheRoot: 'teacher shirt',
        crossNicheDepth: 1,
        specificityAxis: 'specialty',
        erankSearchVolume: 240,
        erankCompetition: 5000,
        sellingListingCount: 3,
        recentSellingListingCount: 2,
        medianMonthlySales: 8,
        everbeeCheckedAt: '2026-07-26T02:00:00.000Z',
      },
    ],
    candidates: [{
      keyword: 'special education teacher shirt',
      parentKeyword: 'teacher shirt',
      rootKeyword: 'teacher shirt',
      depth: 1,
      specificityAxis: 'specialty',
      sources: ['everbee-title'],
      verdict: 'promising',
    }],
    categoryId: 'shirt',
    eventId: 'auto-discovery',
    createdAt: '2026-07-26T00:00:00.000Z',
  })

  assert.deepEqual(nodes.map((node) => node.keyword), [
    'teacher shirt',
    'special education teacher shirt',
  ])
  const child = nodes[1]
  assert.equal(child.rootKeyword, 'teacher shirt')
  assert.equal(child.parentKeyword, 'teacher shirt')
  assert.equal(child.depth, 1)
  assert.equal(child.specificityAxis, 'specialty')
  assert.deepEqual(child.source, ['everbee-title'])
  assert.equal(child.metrics.erank.competition, 5000)
  assert.equal(child.metrics.everbee.sellingListings, 3)
  assert.equal(child.comparison.competitionReduction, 0.9)
  assert.equal(child.verdict, 'promising')
  assert.equal(child.stopReason, '')
})

test('records why weak branches stop', () => {
  const [node] = buildNicheDrilldownGraph({
    candidates: [{
      keyword: 'tiny demand teacher shirt',
      parentKeyword: 'teacher shirt',
      rootKeyword: 'teacher shirt',
      depth: 1,
      verdict: 'weak-demand',
      comparison: { verdict: 'weak-demand', demandRetention: 0.01 },
    }],
    categoryId: 'shirt',
    eventId: 'auto-discovery',
  })

  assert.equal(node.verdict, 'weak-demand')
  assert.equal(node.stopReason, 'demand-collapsed')
})

test('normalizes a legacy scalar candidate source into the drilldown source list', () => {
  const [node] = buildNicheDrilldownGraph({
    rows: [{
      keyword: 'halloween shirt',
      crossNicheRoot: 'halloween shirt',
    }],
    candidates: [{
      keyword: 'halloween shirt',
      source: 'product-condition',
    }],
  })

  assert.deepEqual(node.source, ['product-condition'])
})

test('infers the specificity axis from legacy parent and child keywords', () => {
  const [node] = buildNicheDrilldownGraph({
    rows: [{
      keyword: 'book club cat shirt',
      crossNicheParent: 'cat shirt',
      crossNicheRoot: 'cat shirt',
      crossNicheDepth: 1,
    }],
  })

  assert.equal(node.specificityAxis, 'book club')
})

test('updates the same exploration node without duplicating it', () => {
  const previous = [{
    keyword: 'maine coon mom shirt',
    rootKeyword: 'cat mom shirt',
    parentKeyword: 'cat mom shirt',
    depth: 1,
    createdAt: '2026-07-26T01:00:00.000Z',
    checkedAt: '',
    verdict: 'needs-research',
    metrics: { erank: { competition: null } },
  }]
  const incoming = [{
    ...previous[0],
    createdAt: '2026-07-26T02:00:00.000Z',
    checkedAt: '2026-07-26T02:30:00.000Z',
    verdict: 'watch',
    metrics: { erank: { competition: 1200 } },
  }]

  const merged = mergeNicheDrilldownNodes(previous, incoming)

  assert.equal(merged.length, 1)
  assert.equal(merged[0].createdAt, '2026-07-26T01:00:00.000Z')
  assert.equal(merged[0].checkedAt, '2026-07-26T02:30:00.000Z')
  assert.equal(merged[0].metrics.erank.competition, 1200)
  assert.equal(merged[0].verdict, 'watch')
})
