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

test('keeps measured market gaps separate from source-angle candidates', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    marketGapCandidates: [{
      keyword: 'halloween librarian shirt',
      comparison: { competitionReduction: 0.4 },
      metrics: {
        etsy: { searches30d: 120 },
        everbee: { sellingListings: 3 },
      },
    }],
  })

  assert.equal(pools['market-gap'][0].keyword, 'halloween librarian shirt')
})
