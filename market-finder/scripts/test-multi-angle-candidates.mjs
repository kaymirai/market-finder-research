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
    drilldownCandidates: [{
      keyword: 'ghost book lover shirt',
      sources: ['everbee-title', 'measured-child'],
      priorityScore: 81,
    }],
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
  assert.equal(pools['recent-sales'][0].source, 'everbee-title')
  assert.deepEqual(pools['recent-sales'][0].sources, ['everbee-title', 'measured-child'])
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

test('keeps singular everbee-title compatibility and excludes unmatched drilldowns', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    drilldownCandidates: [
      { keyword: 'halloween teacher shirt', sources: ['etsy-related'] },
      { keyword: 'halloween librarian shirt', source: 'everbee-title' },
    ],
  })

  assert.deepEqual(
    pools['recent-sales'].map((candidate) => candidate.keyword),
    ['halloween librarian shirt'],
  )
})

test('keeps live candidate sources inside the active event and category', () => {
  assert.equal(candidateApi.candidateMatchesResearchContext(
    { keyword: 'legacy contextless drilldown' },
    { eventId: 'christmas', categoryId: 'shirt' },
    { requireContext: true },
  ), false)
  const pools = buildMultiAngleCandidatePools({
    event: { id: 'christmas', searchTerm: 'christmas' },
    category: { id: 'shirt', searchTerm: 'shirt', tags: ['tee'] },
    timingStatus: 'timely',
    relatedTerms: [
      {
        keyword: 'halloween nurse mug',
        eventId: 'halloween',
        categoryId: 'mug',
      },
      {
        keyword: 'christmas nurse shirt',
        eventId: 'christmas',
        categoryId: 'shirt',
      },
    ],
    taxonomyCandidates: [
      {
        keyword: 'halloween gardener mug',
        eventId: 'halloween',
        categoryId: 'mug',
      },
      {
        keyword: 'christmas gardener shirt',
        eventId: 'christmas',
        categoryId: 'shirt',
      },
    ],
    drilldownCandidates: [
      {
        keyword: 'halloween librarian mug',
        eventId: 'halloween',
        categoryId: 'mug',
        source: 'everbee-title',
      },
      {
        keyword: 'christmas librarian shirt',
        eventId: 'christmas',
        categoryId: 'shirt',
        source: 'everbee-title',
      },
    ],
    evergreenCandidates: [
      {
        keyword: 'evergreen librarian mug',
        eventId: '',
        categoryId: 'mug',
      },
      {
        keyword: 'evergreen librarian shirt',
        eventId: '',
        categoryId: 'shirt',
      },
    ],
  })
  const keywords = Object.values(pools).flat().map((candidate) => candidate.keyword)

  assert.equal(keywords.some((keyword) => keyword.includes('halloween')), false)
  assert.equal(keywords.includes('evergreen librarian mug'), false)
  assert.equal(keywords.includes('christmas nurse shirt'), true)
  assert.equal(keywords.includes('christmas gardener shirt'), true)
  assert.equal(keywords.includes('christmas librarian shirt'), true)
  assert.equal(keywords.includes('evergreen librarian shirt'), true)
})

test('uses Marketplace related terms only when the saved plan matches the active context', () => {
  assert.equal(typeof candidateApi.marketplaceRelatedTermCandidates, 'function')
  const oldPlan = {
    eventId: 'halloween',
    categoryId: 'mug',
    relatedKeywordMetrics: [{ keyword: 'halloween nurse mug' }],
    items: [],
  }
  const matchingPlan = {
    eventId: 'christmas',
    categoryId: 'shirt',
    relatedKeywordMetrics: [{ keyword: 'christmas nurse shirt' }],
    items: [{
      query: 'christmas teacher shirt',
      status: 'completed',
      result: {
        etsyRelatedTerms: ['christmas librarian shirt'],
      },
    }],
  }
  const context = {
    eventId: 'christmas',
    categoryId: 'shirt',
  }

  assert.deepEqual(
    candidateApi.marketplaceRelatedTermCandidates(oldPlan, context),
    [],
  )
  assert.deepEqual(
    candidateApi.marketplaceRelatedTermCandidates({
      relatedKeywordMetrics: [{ keyword: 'christmas legacy shirt' }],
    }, context),
    [],
  )
  assert.deepEqual(
    candidateApi.marketplaceRelatedTermCandidates(matchingPlan, context),
    [
      {
        keyword: 'christmas nurse shirt',
        eventId: 'christmas',
        categoryId: 'shirt',
        source: 'marketplace-insights',
      },
      {
        keyword: 'christmas librarian shirt',
        eventId: 'christmas',
        categoryId: 'shirt',
        source: 'marketplace-insights',
      },
    ],
  )
})

test('requires the saved custom-event snapshot to match the fixed exploration snapshot', () => {
  assert.equal(typeof candidateApi.marketplaceInsightPlanForContext, 'function')
  const plan = {
    eventId: 'custom-event',
    categoryId: 'shirt',
    eventSnapshot: {
      id: 'custom-event',
      label: 'Alpha Launch',
      searchTerm: 'alpha launch',
    },
    items: [],
  }
  const active = {
    activeEventId: 'custom-event',
    categoryId: 'shirt',
    eventSnapshot: {
      id: 'custom-event',
      label: 'Alpha Launch',
      searchTerm: 'alpha launch',
    },
  }

  assert.equal(candidateApi.marketplaceInsightPlanForContext(plan, active), plan)
  assert.equal(candidateApi.marketplaceInsightPlanForContext({
    ...plan,
    eventSnapshot: {
      id: 'custom-event',
      label: 'Beta Launch',
      searchTerm: 'beta launch',
    },
  }, active), null)
  assert.equal(candidateApi.marketplaceInsightPlanForContext({
    ...plan,
    eventSnapshot: undefined,
  }, active), null)
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

test('uses only measured market gaps from the active event and category', () => {
  const measuredRow = ({
    keyword,
    eventId,
    categoryId,
  }) => ({
    keyword,
    raw: {
      researchEventId: eventId,
      researchCategoryId: categoryId,
    },
    normalized: {
      metrics: {
        etsy: { searches30d: 120 },
        everbee: { sellingListings: 3 },
      },
    },
    drilldownNode: {
      comparison: { competitionReduction: 0.4 },
    },
    scoreState: {
      score: 78,
      explorationPriority: 70,
    },
  })
  const pools = buildMultiAngleCandidatePools({
    event: { id: 'christmas', searchTerm: 'christmas' },
    category: { id: 'mug', searchTerm: 'mug', tags: ['coffee cup'] },
    timingStatus: 'timely',
    measuredRows: [
      measuredRow({
        keyword: 'halloween librarian shirt',
        eventId: 'halloween',
        categoryId: 'shirt',
      }),
      measuredRow({
        keyword: 'christmas librarian mug',
        eventId: 'christmas',
        categoryId: 'mug',
      }),
      measuredRow({
        keyword: 'evergreen librarian mug',
        eventId: '',
        categoryId: 'mug',
      }),
    ],
  })

  assert.deepEqual(
    pools['market-gap'].map((candidate) => candidate.keyword),
    ['christmas librarian mug'],
  )
})

test('round-trips listing age through archives and excludes unknown or stale adjacent products', () => {
  assert.equal(typeof candidateApi.normalizeArchivedSupplyListings, 'function')
  assert.equal(typeof candidateApi.adjacentProductListingsFromLearningRecords, 'function')

  const archived = candidateApi.normalizeArchivedSupplyListings([
    {
      title: 'Fresh Witchy Gardener Mug',
      monthlySales: 9,
      listingAgeMonths: 12,
    },
    {
      title: 'Unknown Age Gardener Mug',
      monthlySales: 8,
    },
    {
      title: 'Old Gardener Mug',
      monthlySales: 7,
      listingAgeMonths: 13,
    },
  ])
  const persisted = JSON.parse(JSON.stringify([{
    eventId: 'halloween',
    categoryId: 'mug',
    supplyListings: archived,
  }]))
  const adjacent = candidateApi.adjacentProductListingsFromLearningRecords(
    persisted,
    { categoryId: 'shirt' },
  )
  const pools = buildMultiAngleCandidatePools({
    ...base,
    adjacentProductListings: adjacent,
  })

  assert.deepEqual(archived, [
    {
      title: 'Fresh Witchy Gardener Mug',
      monthlySales: 9,
      listingAgeMonths: 12,
    },
    {
      title: 'Unknown Age Gardener Mug',
      monthlySales: 8,
      listingAgeMonths: null,
    },
    {
      title: 'Old Gardener Mug',
      monthlySales: 7,
      listingAgeMonths: 13,
    },
  ])
  assert.deepEqual(
    pools['adjacent-product'].map((candidate) => candidate.keyword),
    ['fresh witchy gardener shirt'],
  )
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
