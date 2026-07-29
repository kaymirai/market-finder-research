import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMultiAngleCandidatePools,
  candidateEvidenceKey,
  candidateProvenanceKey,
} from '../src/multi-angle-candidates.js'
import * as candidateApi from '../src/multi-angle-candidates.js'

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

test('keeps only current-category Marketplace terms in demand neighborhood', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    relatedTerms: [
      'halloween mug',
      'halloween tee',
      'halloween tshirt',
      'halloween shirt',
      'halloween shirtless costume',
    ],
  })

  assert.deepEqual(
    pools['demand-neighborhood'].map((candidate) => candidate.keyword),
    ['halloween tee', 'halloween tshirt', 'halloween shirt'],
  )
})

test('keeps only everbee-title drilldowns in recent sales', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    drilldownCandidates: [
      { keyword: 'halloween teacher shirt', source: 'etsy-related' },
      { keyword: 'halloween librarian shirt', source: 'everbee-title' },
    ],
  })

  assert.deepEqual(
    pools['recent-sales'].map((candidate) => candidate.keyword),
    ['halloween librarian shirt'],
  )
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

test('does not allow a raw event lane to promote a timely other-event reference', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    seasonalReferenceCandidates: [{
      keyword: 'thanksgiving nurse shirt',
      eventId: 'thanksgiving',
      timingStatus: 'timely',
      resultLane: 'event',
    }],
  })

  assert.equal(pools['seasonal-reference'][0].resultLane, 'seasonal-reference')
  assert.equal(pools.event, undefined)
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

test('saved seasonal references persist as useful objects and enter only a compatible later cycle', () => {
  assert.equal(typeof candidateApi.restoreSavedSeasonalReferences, 'function')

  const availableCandidates = [{
    keyword: 'thanksgiving nurse shirt',
    categoryId: 'shirt',
    eventId: 'thanksgiving',
    timingStatus: 'timely',
    source: 'timely-seasonal-suggestion',
    legacyKeys: ['thanksgiving|thanksgiving'],
  }]
  const restored = candidateApi.restoreSavedSeasonalReferences({
    saved: [{
      keyword: 'christmas teacher shirt',
      categoryId: 'shirt',
      eventId: 'christmas',
      timingStatus: 'timely',
      source: 'seasonal-result-lane',
    }],
    legacyKeys: ['thanksgiving|thanksgiving'],
    availableCandidates,
  })
  const persisted = JSON.parse(JSON.stringify(restored))

  assert.deepEqual(persisted, [
    {
      keyword: 'christmas teacher shirt',
      categoryId: 'shirt',
      eventId: 'christmas',
      timingStatus: 'timely',
      source: 'seasonal-result-lane',
    },
    {
      keyword: 'thanksgiving nurse shirt',
      categoryId: 'shirt',
      eventId: 'thanksgiving',
      timingStatus: 'timely',
      source: 'timely-seasonal-suggestion',
    },
  ])

  const currentPools = buildMultiAngleCandidatePools({
    ...base,
    savedNextCycleCandidates: persisted,
  })
  assert.equal(
    currentPools['demand-neighborhood'].some(
      (candidate) => candidate.keyword === 'thanksgiving nurse shirt',
    ),
    false,
  )

  const laterPools = buildMultiAngleCandidatePools({
    ...base,
    event: { id: 'thanksgiving', searchTerm: 'thanksgiving' },
    savedNextCycleCandidates: persisted,
  })
  const laterCandidate = laterPools['demand-neighborhood'].find(
    (candidate) => candidate.keyword === 'thanksgiving nurse shirt',
  )
  assert.equal(laterCandidate.source, 'saved-next-cycle-seasonal-reference')
  assert.equal(laterCandidate.resultLane, 'event')
})

test('legacy reference can enter the selected later event while origin-tagged references stay out of their source cycle', () => {
  const legacyRestored = candidateApi.restoreSavedSeasonalReferences({
    legacyKeys: ['thanksgiving|thanksgiving'],
    availableCandidates: [{
      keyword: 'thanksgiving nurse shirt',
      categoryId: 'shirt',
      eventId: 'thanksgiving',
      timingStatus: 'timely',
      source: 'legacy-seasonal-reference-key',
      legacyKeys: ['thanksgiving|thanksgiving'],
    }],
  })
  const originTagged = candidateApi.restoreSavedSeasonalReferences({
    saved: [{
      keyword: 'thanksgiving teacher shirt',
      categoryId: 'shirt',
      eventId: 'thanksgiving',
      originEventId: 'thanksgiving',
      originCategoryId: 'shirt',
      timingStatus: 'timely',
      source: 'seasonal-result-lane',
    }],
  })
  const laterEventPools = buildMultiAngleCandidatePools({
    ...base,
    event: { id: 'thanksgiving', searchTerm: 'thanksgiving' },
    savedNextCycleCandidates: [...legacyRestored, ...originTagged],
  })

  assert.deepEqual(legacyRestored, [{
    keyword: 'thanksgiving nurse shirt',
    categoryId: 'shirt',
    eventId: 'thanksgiving',
    timingStatus: 'timely',
    source: 'legacy-seasonal-reference-key',
  }])
  assert.equal(
    laterEventPools['demand-neighborhood'].some(
      (candidate) => candidate.keyword === 'thanksgiving nurse shirt',
    ),
    true,
  )
  assert.equal(
    laterEventPools['demand-neighborhood'].some(
      (candidate) => candidate.keyword === 'thanksgiving teacher shirt',
    ),
    false,
  )
})
