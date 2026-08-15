import assert from 'node:assert/strict'
import test from 'node:test'

import {
  archivedDemandNeighborhoodCandidates,
  buildMultiAngleCandidatePools,
  candidateEvidenceKey,
  candidateProvenanceKey,
  deriveMeasuredSeedCandidates,
  isEfficientMarketplaceProbe,
} from '../src/multi-angle-candidates.js'
import * as candidateApi from '../src/multi-angle-candidates.js'

const base = {
  event: { id: 'halloween', searchTerm: 'halloween' },
  category: { id: 'shirt', searchTerm: 'shirt', tags: ['tee'] },
  timingStatus: 'timely',
}

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

test('applies current explicit exclusion terms to multi-angle candidate selection', () => {
  assert.equal(isEfficientMarketplaceProbe({
    keyword: 'disney teacher shirt',
    eventId: 'halloween',
    categoryId: 'shirt',
  }, { excludedRiskTerms: ['disney'] }), false)

  const pools = buildMultiAngleCandidatePools({
    ...base,
    excludedRiskTerms: ['disney'],
    relatedTerms: [{
      keyword: 'disney teacher shirt',
      eventId: 'halloween',
      categoryId: 'shirt',
    }, {
      keyword: 'science teacher shirt',
      eventId: 'halloween',
      categoryId: 'shirt',
    }],
  })

  assert.deepEqual(pools['demand-neighborhood'].map((candidate) => candidate.keyword), [
    'science teacher shirt',
  ])
})

test('prioritizes unmeasured same-event Etsy related terms from archived evidence', () => {
  const candidates = archivedDemandNeighborhoodCandidates([{
    eventId: 'halloween',
    categoryId: 'shirt',
    demandKeywords: [{
      keyword: 'halloween dentist shirt',
      etsySearches30d: 87,
    }, {
      keyword: 'respiratory therapist halloween shirt',
      etsySearches30d: 65,
    }, {
      keyword: 'dental hygienist halloween shirt',
      etsySearches30d: 51,
    }, {
      keyword: 'seven word halloween dental office team shirt phrase',
      etsySearches30d: 100,
    }],
    drilldownNodes: [{ keyword: 'halloween dentist shirt' }],
  }, {
    eventId: 'christmas',
    categoryId: 'shirt',
    demandKeywords: [{ keyword: 'christmas dentist shirt', etsySearches30d: 200 }],
  }], {
    eventId: 'halloween',
    categoryId: 'shirt',
  })

  assert.deepEqual(candidates.map((candidate) => candidate.keyword), [
    'respiratory therapist halloween shirt',
    'dental hygienist halloween shirt',
  ])
  assert.equal(candidates[0].source, 'archived-etsy-related')
  assert.ok(candidates[0].priorityScore > candidates[1].priorityScore)
})

test('puts variants of a verified winner ahead of unrelated high-volume related terms', () => {
  const candidates = archivedDemandNeighborhoodCandidates([{
    eventId: 'halloween',
    categoryId: 'shirt',
    demandKeywords: [{
      keyword: 'school psychologist halloween shirt',
      etsySearches30d: 200,
    }, {
      keyword: 'dentist halloween shirt',
      etsySearches30d: 10,
    }, {
      keyword: 'dental office halloween shirt',
      etsySearches30d: 8,
    }],
  }], {
    eventId: 'halloween',
    categoryId: 'shirt',
    prioritySeeds: [{
      keyword: 'halloween dentist shirt',
      opportunityLabel: 'B',
      score: 74,
    }],
  })

  assert.deepEqual(candidates.slice(0, 2).map((candidate) => candidate.keyword), [
    'dentist halloween shirt',
    'dental office halloween shirt',
  ])

  const pools = buildMultiAngleCandidatePools({
    ...base,
    relatedTerms: [{
      keyword: 'school psychologist halloween shirt',
      eventId: 'halloween',
      categoryId: 'shirt',
    }],
    archivedDemandCandidates: candidates,
  })
  assert.equal(pools['demand-neighborhood'][0].keyword, 'dentist halloween shirt')
})

test('derives unseen style and recipient hypotheses from strong verified C seeds without changing their grade', () => {
  const candidates = deriveMeasuredSeedCandidates({
    measuredRows: [{
      keyword: 'halloween carpenter shirt',
      opportunityLabel: 'C',
      evidenceState: { status: 'verified' },
      scoreState: { score: 80 },
      raw: {
        researchEventId: 'halloween',
        researchCategoryId: 'shirt',
      },
    }],
    modifierCandidates: [{
      axisId: 'style',
      axisTerm: 'retro',
    }, {
      axisId: 'relationship',
      axisTerm: 'dad',
    }, {
      axisId: 'career',
      axisTerm: 'nurse',
    }],
    event: base.event,
    category: base.category,
  })

  assert.deepEqual(
    candidates.map((candidate) => candidate.keyword),
    [
      'halloween retro carpenter shirt',
      'retro carpenter shirt',
      'halloween dad carpenter shirt',
      'dad carpenter shirt',
    ],
  )
  assert.equal(candidates.every((candidate) => candidate.source === 'measured-c-recombination'), true)
  assert.equal(candidates.every((candidate) => candidate.parentOpportunityLabel === 'C'), true)
  assert.equal(candidates.some((candidate) => candidate.keyword.includes('nurse')), false)

  const pools = buildMultiAngleCandidatePools({
    ...base,
    measuredRows: [{
      keyword: 'halloween carpenter shirt',
      opportunityLabel: 'C',
      evidenceState: { status: 'verified' },
      scoreState: { score: 80 },
      raw: {
        researchEventId: 'halloween',
        researchCategoryId: 'shirt',
      },
    }],
    modifierCandidates: [{ axisId: 'style', axisTerm: 'retro' }],
  })
  assert.deepEqual(pools['recent-sales'].map((candidate) => candidate.keyword), [
    'halloween retro carpenter shirt',
  ])
  assert.deepEqual(pools.evergreen.map((candidate) => candidate.keyword), [
    'retro carpenter shirt',
  ])

  const restoredPools = buildMultiAngleCandidatePools({
    ...base,
    measuredRows: [{
      keyword: 'halloween carpenter shirt',
      opportunityLabel: 'C',
      evidenceState: { status: 'verified' },
      scoreState: { score: 80 },
      raw: {
        researchEventId: 'halloween',
        researchCategoryId: 'shirt',
      },
    }],
  })
  assert.equal(restoredPools['recent-sales'][0].keyword, 'halloween retro carpenter shirt')
  assert.equal(restoredPools.evergreen[0].keyword, 'retro carpenter shirt')
})

test('does not turn a long selling-title fragment into an even longer Marketplace probe', () => {
  const candidates = deriveMeasuredSeedCandidates({
    measuredRows: [{
      keyword: 'vintage logo corporate gifting employee shirt',
      opportunityLabel: 'C',
      evidenceState: { status: 'verified' },
      scoreState: { score: 82 },
      raw: {
        researchEventId: 'halloween',
        researchCategoryId: 'shirt',
      },
    }],
    modifierCandidates: [{ axisId: 'career', axisTerm: 'medical assistant' }],
    event: base.event,
    category: base.category,
  })

  assert.deepEqual(candidates, [])
})

test('never sends a long listing title to either Etsy or EverBee validation', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    drilldownCandidates: [{
      keyword: 'halloween 1978 michael myers shirt horror movie shirt john carpenter shirt',
      eventId: 'halloween',
      categoryId: 'shirt',
      source: 'everbee-title',
    }, {
      keyword: 'dentist halloween shirt',
      eventId: 'halloween',
      categoryId: 'shirt',
      source: 'everbee-title',
    }],
  })

  assert.deepEqual(pools['recent-sales'].map((candidate) => candidate.keyword), [
    'dentist halloween shirt',
  ])
})

test('does not recombine a C seed whose buyer intent was already judged ambiguous', () => {
  const candidates = deriveMeasuredSeedCandidates({
    measuredRows: [{
      keyword: 'halloween tail shirt',
      opportunityLabel: 'C',
      evidenceState: { status: 'verified' },
      scoreState: { score: 79 },
      everbeeRow: {
        score: { validation: { ambiguousIntent: true } },
      },
      raw: {
        researchEventId: 'halloween',
        researchCategoryId: 'shirt',
      },
    }],
    modifierCandidates: [{ axisId: 'career', axisTerm: 'pharmacist' }],
    event: base.event,
    category: base.category,
  })

  assert.deepEqual(candidates, [])
})

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

test('excludes non-timely adjacent evidence from another event', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    adjacentProductListings: [{
      title: 'Christmas Nurse Mug',
      categoryId: 'mug',
      eventId: 'christmas',
      timingStatus: 'prepare',
      sales: 6,
      listingAgeMonths: 4,
    }],
  })

  assert.deepEqual(pools['adjacent-product'], [])
  assert.deepEqual(pools['seasonal-reference'], [])
  assert.equal(
    Object.values(pools).flat().some((candidate) => candidate.keyword === 'christmas nurse shirt'),
    false,
  )
})

test('routes timely adjacent evidence from another event only to seasonal references', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    adjacentProductListings: [{
      title: 'Christmas Nurse Mug',
      categoryId: 'mug',
      eventId: 'christmas',
      timingStatus: 'timely',
      sales: 6,
      listingAgeMonths: 4,
    }],
  })

  assert.deepEqual(pools['adjacent-product'], [])
  assert.equal(pools['seasonal-reference'].length, 1)
  assert.deepEqual(pools['seasonal-reference'][0], {
    keyword: 'christmas nurse shirt',
    categoryId: 'shirt',
    eventId: 'christmas',
    angleId: 'seasonal-reference',
    angleIds: ['seasonal-reference', 'adjacent-product'],
    source: 'adjacent-product-title',
    sources: ['adjacent-product-title'],
    sourceKeywords: ['christmas nurse mug'],
    resultLane: 'seasonal-reference',
    priorityScore: null,
    timingStatus: 'timely',
    activeEventId: 'halloween',
  })
})

test('transforms valid same-event adjacent evidence into the active product category', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    adjacentProductListings: [{
      title: 'Halloween Nurse Mug',
      categoryId: 'mug',
      eventId: 'halloween',
      timingStatus: 'prepare',
      sales: 1,
      listingAgeMonths: 12,
    }],
  })

  assert.equal(pools['adjacent-product'].length, 1)
  assert.equal(pools['adjacent-product'][0].keyword, 'halloween nurse shirt')
  assert.equal(pools['adjacent-product'][0].eventId, 'halloween')
  assert.equal(pools['adjacent-product'][0].timingStatus, 'prepare')
  assert.equal(pools['adjacent-product'][0].resultLane, 'event')
})

test('keeps only current-category Marketplace terms in demand neighborhood', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    relatedTerms: [
      'halloween mug',
      'halloween nurse tee',
      'halloween nurse tshirt',
      'halloween nurse shirt',
      'halloween shirtless costume',
    ],
  })

  assert.deepEqual(
    pools['demand-neighborhood'].map((candidate) => candidate.keyword),
    ['halloween nurse tee', 'halloween nurse tshirt', 'halloween nurse shirt'],
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

test('keeps adjacent custom-event listings inside the same saved custom snapshot', () => {
  const betaSnapshot = {
    id: 'custom-event',
    label: 'Beta Launch',
    searchTerm: 'beta launch',
  }
  const records = [
    {
      eventId: 'custom-event',
      categoryId: 'mug',
      eventSnapshot: {
        id: 'custom-event',
        label: 'Alpha Launch',
        searchTerm: 'alpha launch',
      },
      supplyListings: [{
        title: 'Alpha Gardener Mug',
        monthlySales: 8,
        listingAgeMonths: 4,
      }],
    },
    {
      eventId: 'custom-event',
      categoryId: 'shirt',
      context: { eventSnapshot: betaSnapshot },
      supplyListings: [{
        title: 'Beta Gardener Shirt',
        monthlySales: 7,
        listingAgeMonths: 5,
      }],
    },
    {
      eventId: 'custom-event',
      categoryId: 'poster',
      supplyListings: [{
        title: 'Legacy Gardener Poster',
        monthlySales: 6,
        listingAgeMonths: 3,
      }],
    },
    {
      eventId: 'halloween',
      categoryId: 'mug',
      timingStatus: 'timely',
      supplyListings: [{
        title: 'Halloween Gardener Mug',
        monthlySales: 5,
        listingAgeMonths: 6,
      }],
    },
  ]
  const adjacent = candidateApi.adjacentProductListingsFromLearningRecords(
    JSON.parse(JSON.stringify(records)),
    {
      eventId: 'custom-event',
      eventSnapshot: betaSnapshot,
      categoryId: 'tote',
    },
  )

  assert.deepEqual(
    adjacent.map((listing) => listing.title),
    ['Beta Gardener Shirt', 'Halloween Gardener Mug'],
  )
  assert.deepEqual(adjacent[0].eventSnapshot, betaSnapshot)
  const pools = buildMultiAngleCandidatePools({
    event: betaSnapshot,
    category: { id: 'tote', searchTerm: 'tote', tags: [] },
    timingStatus: 'timely',
    adjacentProductListings: adjacent,
  })
  assert.deepEqual(
    pools['adjacent-product'].map((candidate) => candidate.keyword),
    ['beta gardener tote'],
  )
  assert.deepEqual(
    pools['seasonal-reference'].map((candidate) => candidate.keyword),
    ['halloween gardener tote'],
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

test('promotes an event-stripped phrase to evergreen only when related and selling-title sources match exactly', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    relatedTerms: [
      { keyword: 'teacher shirt', source: 'marketplace-insights' },
      { keyword: 'halloween nurse shirt', source: 'marketplace-insights' },
    ],
    drilldownCandidates: [{
      keyword: 'halloween teacher shirt',
      source: 'everbee-title',
    }, {
      keyword: 'halloween gardener shirt',
      source: 'everbee-title',
    }],
  })

  assert.deepEqual(
    pools.evergreen.map((candidate) => ({
      keyword: candidate.keyword,
      eventId: candidate.eventId,
      resultLane: candidate.resultLane,
      sources: candidate.sources,
      sourceKeywords: candidate.sourceKeywords,
    })),
    [{
      keyword: 'teacher shirt',
      eventId: '',
      resultLane: 'evergreen',
      sources: ['marketplace-insights', 'everbee-title'],
      sourceKeywords: ['teacher shirt', 'halloween teacher shirt'],
    }],
  )
})

test('does not invent cross-source evergreen provenance when both observations came from EverBee titles', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    relatedTerms: [{
      keyword: 'teacher shirt',
      source: 'everbee-title',
      sources: ['everbee-title'],
    }],
    drilldownCandidates: [{
      keyword: 'halloween teacher shirt',
      source: 'everbee-title',
      sources: ['everbee-title'],
    }],
  })

  assert.deepEqual(pools.evergreen, [])
})

test('does not call a phrase evergreen when another known event remains after removing the active event', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    relatedTerms: [{
      keyword: 'thanksgiving teacher shirt',
      source: 'marketplace-insights',
    }],
    drilldownCandidates: [{
      keyword: 'halloween thanksgiving teacher shirt',
      source: 'everbee-title',
    }],
  })

  assert.deepEqual(pools.evergreen, [])
})

test('recognizes another event by its formal label without losing ordinary evergreen phrases', () => {
  const pools = buildMultiAngleCandidatePools({
    ...base,
    relatedTerms: [{
      keyword: 'teacher shirt',
      source: 'marketplace-insights',
    }, {
      keyword: 'independence day teacher shirt',
      source: 'marketplace-insights',
    }, {
      keyword: '4th of july teacher shirt',
      source: 'marketplace-insights',
    }],
    drilldownCandidates: [{
      keyword: 'halloween teacher shirt',
      source: 'everbee-title',
    }, {
      keyword: 'halloween independence day teacher shirt',
      source: 'everbee-title',
    }, {
      keyword: 'halloween 4th of july teacher shirt',
      source: 'everbee-title',
    }],
  })

  assert.deepEqual(
    pools.evergreen.map((candidate) => candidate.keyword),
    ['teacher shirt'],
  )
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
    timingStatus: 'prepare',
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
  assert.equal(adjacent[0].timingStatus, 'prepare')
  assert.equal(pools['adjacent-product'][0].timingStatus, 'prepare')
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
