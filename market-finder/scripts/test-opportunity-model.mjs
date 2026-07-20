#!/usr/bin/env node
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregateEverbeeListings,
  everbeeResultsToBroadListings,
  extractNicheHintsFromListings,
  advanceMarketplaceInsightResearch,
  buildMarketplaceInsightPlan,
  buildKeywordClusterKey,
  buildSeoPlanFromBuckets,
  clusterKeywordCandidates,
  classifyKeywordBucket,
  explainEverbeeScore,
  generateBroadEventCandidates,
  getBroadEventDiscoveryProfile,
  getMarketTiming,
  getMarketplaceInsightFreshness,
  getSourceFreshness,
  generateKeywordCandidates,
  keywordMatchesCategoryProduct,
  mergeMarketplaceInsightRelatedMetrics,
  rankMarketplaceInsightRelatedCandidates,
  scoreEverbeeResult,
  selectMarketplaceInsightFollowUpBatch,
  evaluateMarketplaceInsightResearchStop,
  parseBroadMarketListings,
  parseEverbeeRows,
} from '../../shared/market-keyword-engine/index.js'

const SCORE_OPTIONS = { categoryId: 'shirt', now: '2026-07-19T00:00:00Z' }

function freshRow(overrides = {}) {
  return {
    keyword: 'pickleball mom shirt',
    erankSearchVolume: 400,
    erankClicks: 120,
    erankCompetition: 8000,
    erankKeywordDifficulty: 30,
    erankCheckedAt: '2026-07-01T00:00:00Z',
    visibleListingCount: 12,
    sellingListingCount: 4,
    recentSellingListingCount: 3,
    medianMonthlySales: 4,
    medianMonthlyRevenue: 100,
    totalVisibleMonthlySales: 30,
    topMonthlySales: 12,
    topSalesShare: 0.4,
    medianListingAgeMonths: 8,
    everbeeCheckedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

test('keeps the original capture date and makes 46-day-old data inspiration-only', () => {
  const result = getSourceFreshness('2026-05-01T00:00:00Z', '2026-06-16T00:00:00Z')

  assert.equal(result.capturedAt, '2026-05-01T00:00:00.000Z')
  assert.equal(result.freshnessDays, 46)
  assert.equal(result.freshnessLabel, 'inspiration')
  assert.equal(result.eligibleForRanking, false)
})

test('marks missing and invalid capture dates as unavailable', () => {
  assert.equal(getSourceFreshness('', '2026-06-16T00:00:00Z').freshnessLabel, 'unavailable')
  assert.equal(getSourceFreshness('not-a-date', '2026-06-16T00:00:00Z').freshnessDays, null)
})

test('classifies source freshness at 30, 45, 90, and 91 days', () => {
  const now = '2026-06-16T00:00:00Z'

  assert.equal(getSourceFreshness('2026-05-17T00:00:00Z', now).freshnessLabel, 'fresh')
  assert.equal(getSourceFreshness('2026-05-02T00:00:00Z', now).freshnessLabel, 'usable')
  assert.equal(getSourceFreshness('2026-03-18T00:00:00Z', now).freshnessLabel, 'inspiration')
  assert.equal(getSourceFreshness('2026-03-17T00:00:00Z', now).freshnessLabel, 'expired')
})

test('clusters product and style variants under one niche', () => {
  const rows = clusterKeywordCandidates([
    { keyword: 'retro pickleball mom shirt', score: 80 },
    { keyword: 'pickleball mom tee', score: 70 },
  ], { categoryId: 'shirt' })

  assert.equal(rows.length, 1)
  assert.equal(rows[0].clusterKey, 'pickleball mom')
  assert.equal(rows[0].clusterSize, 2)
  assert.equal(rows[0].keyword, 'retro pickleball mom shirt')
})

test('does not erase the specific niche when building a cluster key', () => {
  assert.equal(buildKeywordClusterKey('funny dog dad sweatshirt', { categoryId: 'sweatshirt' }), 'dog dad')
})

test('keeps each EverBee title bound to its own sales and age metrics', () => {
  const listings = everbeeResultsToBroadListings([
    {
      keyword: 'teacher shirt',
      topMonthlySales: 999,
      listingSnippets: ['Fallback title'],
      productRows: [
        { title: 'Book Club Teacher Shirt', monthlySales: 42, totalSales: 140, listingAgeMonths: 6, monthlyRevenue: 1260 },
        { title: 'Old Cat Shirt', monthlySales: 85, totalSales: 3100, listingAgeMonths: 31, monthlyRevenue: 1700 },
      ],
    },
  ])

  assert.deepEqual(listings, [
    {
      title: 'Old Cat Shirt',
      tags: '',
      sales: 85,
      totalSales: 3100,
      revenue: 1700,
      listingAgeMonths: 31,
      price: '',
      shopName: '',
    },
    {
      title: 'Book Club Teacher Shirt',
      tags: '',
      sales: 42,
      totalSales: 140,
      revenue: 1260,
      listingAgeMonths: 6,
      price: '',
      shopName: '',
    },
  ])
})

test('does not assign a keyword-level sales maximum to unpaired fallback titles', () => {
  const listings = everbeeResultsToBroadListings([
    { keyword: 'cat shirt', topMonthlySales: 999, listingSnippets: ['Cat Mom Shirt'] },
  ])

  assert.equal(listings[0].sales, '')
})

test('prioritizes phrases repeated across recent selling products over one old bestseller', () => {
  const hints = extractNicheHintsFromListings([
    { title: 'Vintage Mega Cat Shirt', monthlySales: 1000, listingAgeMonths: 48 },
    { title: 'Book Club Teacher Shirt', monthlySales: 40, listingAgeMonths: 6 },
    { title: 'Retro Book Club Teacher Shirt', monthlySales: 25, listingAgeMonths: 10 },
  ], 10)

  assert.equal(hints[0].keyword, 'book club teacher')
  assert.equal(hints[0].listingCount, 2)
  assert.equal(hints[0].recentListingCount, 2)
})

test('parses EverBee product age and per-product metrics from broad-listing CSV', () => {
  const rows = parseBroadMarketListings([
    'Product Name,Tags,Sales,Total Sales,Revenue,Listing Age Months,Price,Shop Name',
    'Book Club Teacher Shirt,teacher shirt,42,140,1260,6,30,FreshShop',
  ].join('\n'))

  assert.deepEqual(rows, [{
    title: 'Book Club Teacher Shirt',
    tags: 'teacher shirt',
    sales: '42',
    totalSales: '140',
    revenue: '1260',
    listingAgeMonths: '6',
    price: '30',
    shopName: 'FreshShop',
  }])
})

test('round-trips EverBee product rows through the research CSV parser', () => {
  const productRows = [{ title: 'Book Club Teacher Shirt', monthlySales: 42, listingAgeMonths: 6 }]
  const rows = parseEverbeeRows([
    'Keyword,EverBee Product Rows JSON',
    `teacher shirt,"${JSON.stringify(productRows).replace(/"/g, '""')}"`,
  ].join('\n'))

  assert.deepEqual(rows[0].productRows, productRows)
})

test('returns evergreen timing for auto discovery', () => {
  const result = getMarketTiming({ id: 'auto-discovery', month: 0 }, '2026-07-19T00:00:00Z')

  assert.equal(result.label, 'evergreen')
  assert.equal(result.weeksUntil, null)
})

test('labels an event 12 weeks away as prepare', () => {
  const result = getMarketTiming({ id: 'halloween', month: 10 }, '2026-08-08T00:00:00Z')

  assert.equal(result.label, 'prepare')
  assert.ok(result.weeksUntil >= 10 && result.weeksUntil <= 16)
})

test('defines five reusable discovery lanes for Halloween', () => {
  const profile = getBroadEventDiscoveryProfile({ eventId: 'halloween' })

  assert.equal(profile.enabled, true)
  assert.deepEqual(Object.keys(profile.lanes).sort(), ['adjacent', 'aesthetic', 'audience', 'moment', 'motif'])
  assert.ok(profile.lanes.motif.includes('ghost'))
  assert.ok(profile.lanes.adjacent.includes('spooky season'))
})

test('builds a balanced Halloween shortlist with direct and adjacent strategies', () => {
  const rows = generateBroadEventCandidates({
    eventId: 'halloween',
    categoryId: 'shirt',
    limit: 40,
  })
  const direct = rows.filter((row) => row.queryStrategy === 'direct')
  const adjacent = rows.filter((row) => row.queryStrategy === 'adjacent')
  const lanes = new Set(rows.map((row) => row.discoveryLane))

  assert.equal(rows.length, 40)
  assert.equal(lanes.size, 5)
  assert.ok(direct.length / rows.length <= 0.3)
  assert.ok(adjacent.length / rows.length >= 0.4)
  assert.ok(rows.every((row) => Array.isArray(row.axisTerms) && row.axisTerms.length > 0))
  assert.ok(rows.every((row) => row.containsEventTerm === /\bhalloween\b/.test(row.keyword)))
  assert.equal(rows.some((row) => /\b(?:tee shirt|shirt tee|tshirt shirt)\b/.test(row.keyword)), false)
})

test('keeps at least 40 percent adjacent candidates when many observed terms are available', () => {
  const profile = getBroadEventDiscoveryProfile({ eventId: 'halloween' })
  const observedTerms = Object.values(profile.lanes).flat().join('\n')
  const rows = generateBroadEventCandidates({
    eventId: 'halloween',
    categoryId: 'shirt',
    limit: 40,
    observedTerms,
  })
  const adjacent = rows.filter((row) => row.queryStrategy === 'adjacent')
  const observed = rows.filter((row) => row.queryStrategy === 'observed')

  assert.ok(adjacent.length / rows.length >= 0.4)
  assert.ok(observed.length / rows.length <= 0.25)
})

test('creates a unique 15-query Etsy plan split 5 discovery, 7 validation, 3 reserve', () => {
  const candidates = generateBroadEventCandidates({
    eventId: 'halloween',
    categoryId: 'shirt',
    limit: 40,
  })
  const plan = buildMarketplaceInsightPlan(candidates, {
    eventId: 'halloween',
    categoryId: 'shirt',
  })

  assert.equal(plan.items.length, 15)
  assert.equal(new Set(plan.items.map((item) => item.query)).size, 15)
  assert.equal(plan.items.filter((item) => item.stage === 'discovery').length, 5)
  assert.equal(plan.items.filter((item) => item.stage === 'validation').length, 7)
  assert.equal(plan.items.filter((item) => item.stage === 'reserve').length, 3)
  assert.equal(plan.items[0].query, 'halloween shirt')
  assert.ok(plan.items.every((item) => item.status === 'planned'))
})

test('creates 20 Etsy Plus seeds and reserves 40 adaptive follow-up slots', () => {
  const candidates = generateBroadEventCandidates({
    eventId: 'halloween',
    categoryId: 'shirt',
    limit: 80,
  })
  const plan = buildMarketplaceInsightPlan(candidates, {
    eventId: 'halloween',
    categoryId: 'shirt',
    marketplaceInsightMode: 'plus',
  })

  assert.equal(plan.mode, 'plus')
  assert.equal(plan.quota, 60)
  assert.equal(plan.seedQuota, 20)
  assert.equal(plan.followUpCapacity, 40)
  assert.equal(plan.items.length, 20)
  assert.equal(new Set(plan.items.map((item) => item.query)).size, 20)
  assert.equal(plan.counts.discovery, 6)
  assert.equal(plan.counts.validation, 11)
  assert.equal(plan.counts.reserve, 3)
  assert.equal(plan.counts.followup, 0)
  assert.deepEqual(plan.candidatePool, [])
  assert.equal(plan.followUpBatchSize, 5)
})

test('carries eRank cohort priority into the Etsy verification queue', () => {
  const plan = buildMarketplaceInsightPlan([{
    keyword: 'retro ghost shirt',
    query: 'retro ghost shirt',
    discoveryLane: 'aesthetic',
    queryStrategy: 'direct',
    opportunityIndex: 78,
    cohortIndex: 100,
    priorityIndex: 84,
    officialProbe: true,
  }], {
    eventId: 'halloween',
    categoryId: 'shirt',
  })

  const item = plan.items.find((candidate) => candidate.query === 'retro ghost shirt')
  assert.equal(item.cohortIndex, 100)
  assert.equal(item.priorityIndex, 84)
  assert.equal(item.officialProbe, true)
})

test('merges repeated Etsy related metrics without losing source queries', () => {
  const merged = mergeMarketplaceInsightRelatedMetrics([
    {
      keyword: 'retro halloween book club shirt',
      etsySearches30d: 10,
      etsyListings: 4500,
      conversionLabel: 'Low',
      sourceQuery: 'halloween book lover shirt',
      sourceModes: ['similar'],
    },
  ], [
    {
      keyword: 'Retro Halloween Book Club Shirt',
      etsySearches30d: 12,
      etsyListings: 4000,
      conversionLabel: 'Medium',
      sourceQuery: 'spooky reader shirt',
      sourceModes: ['explore'],
    },
  ])

  assert.equal(merged.length, 1)
  assert.equal(merged[0].keyword, 'retro halloween book club shirt')
  assert.equal(merged[0].etsySearches30d, 12)
  assert.equal(merged[0].etsyListings, 4000)
  assert.equal(merged[0].conversionLabel, 'Medium')
  assert.deepEqual(merged[0].sourceQueries, ['halloween book lover shirt', 'spooky reader shirt'])
  assert.equal(merged[0].sourceCount, 2)
  assert.deepEqual(merged[0].sourceModes, ['similar', 'explore'])
  assert.equal(merged[0].sourceModeCount, 2)
})

test('ranks safe product-matched Etsy related terms with explainable score parts', () => {
  const pool = rankMarketplaceInsightRelatedCandidates([
    { keyword: 'halloween shirt', etsySearches30d: 520, etsyListings: 157200, conversionLabel: 'Very low', sourceQuery: 'halloween shirt' },
    { keyword: 'retro halloween book club shirt', etsySearches30d: 12, etsyListings: 4000, conversionLabel: 'Low', sourceQuery: 'halloween book lover shirt' },
    { keyword: 'retro halloween book club shirt', etsySearches30d: 14, etsyListings: 3800, conversionLabel: 'Medium', sourceQuery: 'spooky reader shirt' },
    { keyword: 'boo spooky striped halloween ghost shirt', etsySearches30d: 7, etsyListings: 2200, conversionLabel: 'Very low', sourceQuery: 'halloween ghost shirt' },
    { keyword: 'disney halloween shirt', etsySearches30d: 200, etsyListings: 100, conversionLabel: 'High', sourceQuery: 'halloween shirt' },
    { keyword: 'summerween ghost shirt', etsySearches30d: 81, etsyListings: 9800, conversionLabel: 'Very low', sourceQuery: 'halloween ghost shirt' },
    { keyword: 'halloween ghost mug', etsySearches30d: 100, etsyListings: 100, conversionLabel: 'High', sourceQuery: 'halloween shirt' },
  ], {
    eventId: 'halloween',
    categoryId: 'shirt',
  })

  assert.equal(pool[0].query, 'retro halloween book club shirt')
  assert.equal(pool.some((item) => item.query === 'disney halloween shirt'), false)
  assert.equal(pool.some((item) => item.query === 'summerween ghost shirt'), false)
  assert.equal(pool.some((item) => item.query === 'halloween ghost mug'), false)
  assert.equal(pool.find((item) => item.query === 'halloween shirt').eligibleForFollowUp, false)
  assert.equal(pool.find((item) => item.query === 'boo spooky striped halloween ghost shirt').eligibleForFollowUp, false)
  assert.ok(Object.hasOwn(pool[0].scoreBreakdown, 'demand'))
  assert.ok(Array.isArray(pool[0].selectionReasons))
})

test('keeps a very-low-conversion phrase when Etsy shows exceptional supply scarcity', () => {
  const pool = rankMarketplaceInsightRelatedCandidates([
    {
      keyword: 'french ghost halloween t-shirt',
      etsySearches30d: 34,
      etsyListings: 46,
      conversionLabel: 'Very low',
      sourceQuery: 'halloween ghost shirt',
      sourceModes: ['explore'],
    },
    {
      keyword: 'halloween teacher shirt personalized',
      etsySearches30d: 7,
      etsyListings: 47,
      conversionLabel: 'Very low',
      sourceQuery: 'halloween teacher shirt',
      sourceModes: ['similar'],
    },
  ], {
    eventId: 'halloween',
    categoryId: 'shirt',
  })

  const scarce = pool.find((item) => item.query === 'french ghost halloween t shirt')
  const tooSmall = pool.find((item) => item.query === 'halloween teacher shirt personalized')
  assert.equal(scarce?.eligibleForFollowUp, true)
  assert.equal(scarce?.scarceVeryLowOpportunity, true)
  assert.ok(scarce?.selectionReasons.includes('Scarce supply signal'))
  assert.equal(tooSmall?.eligibleForFollowUp, false)
})

test('caps the related candidate pool at 200 phrases', () => {
  const metrics = Array.from({ length: 240 }, (_, index) => ({
    keyword: `halloween niche ${index + 1} shirt`,
    etsySearches30d: 20 + index,
    etsyListings: 1000 + index,
    conversionLabel: 'Medium',
    sourceQuery: `halloween source ${index % 8} shirt`,
  }))

  const pool = rankMarketplaceInsightRelatedCandidates(metrics, {
    eventId: 'halloween',
    categoryId: 'shirt',
  })

  assert.equal(pool.length, 200)
})

test('selects five follow-ups with no more than two phrases per cluster', () => {
  const pool = [
    ['ghost', 100], ['ghost', 99], ['ghost', 98], ['reader', 97], ['reader', 96],
    ['nurse', 95], ['teacher', 94], ['pumpkin', 93],
  ].map(([clusterKey, score], index) => ({
    query: `${clusterKey} halloween niche ${index} shirt`,
    clusterKey,
    score,
    eligibleForFollowUp: true,
  }))
  const batch = selectMarketplaceInsightFollowUpBatch(pool, [], { batchSize: 5, maxPerCluster: 2 })
  const clusterCounts = batch.reduce((counts, item) => ({
    ...counts,
    [item.clusterKey]: (counts[item.clusterKey] ?? 0) + 1,
  }), {})

  assert.equal(batch.length, 5)
  assert.ok(Math.max(...Object.values(clusterCounts)) <= 2)
})

test('stops adaptive research only after its minimum depth or a depleted pool', () => {
  assert.equal(evaluateMarketplaceInsightResearchStop({
    completedFollowUpCount: 15,
    stagnantRounds: 2,
    remainingCandidateCount: 30,
  }).shouldStop, false)
  assert.equal(evaluateMarketplaceInsightResearchStop({
    completedFollowUpCount: 20,
    stagnantRounds: 2,
    remainingCandidateCount: 30,
  }).reason, 'stagnant')
  assert.equal(evaluateMarketplaceInsightResearchStop({
    completedFollowUpCount: 40,
    stagnantRounds: 0,
    remainingCandidateCount: 30,
  }).reason, 'max-followups')
  assert.equal(evaluateMarketplaceInsightResearchStop({
    completedFollowUpCount: 5,
    stagnantRounds: 0,
    remainingCandidateCount: 4,
  }).reason, 'candidate-pool-depleted')
})

test('releases one five-query follow-up batch after ten completed seeds', () => {
  const candidates = generateBroadEventCandidates({
    eventId: 'halloween',
    categoryId: 'shirt',
    limit: 40,
  })
  const metrics = Array.from({ length: 12 }, (_, index) => ({
    keyword: `halloween adaptive niche ${index + 1} shirt`,
    etsySearches30d: 30 + index,
    etsyListings: 1200 + index,
    conversionLabel: 'Medium',
    sourceQuery: `halloween source ${index % 6} shirt`,
  }))
  const plan = buildMarketplaceInsightPlan(candidates, {
    eventId: 'halloween',
    categoryId: 'shirt',
    marketplaceInsightMode: 'plus',
    relatedKeywordMetrics: metrics,
  })
  plan.items = plan.items.map((item, index) => ({
    ...item,
    status: index < 10 ? 'completed' : 'planned',
  }))

  const advanced = advanceMarketplaceInsightResearch(plan, {
    eventId: 'halloween',
    categoryId: 'shirt',
  })

  assert.equal(advanced.addedCount, 5)
  assert.equal(advanced.plan.researchRound, 1)
  assert.equal(advanced.plan.releasedFollowUpCount, 5)
  assert.equal(advanced.plan.items.filter((item) => item.stage === 'followup').length, 5)
  assert.equal(advanced.plan.items[10].stage, 'followup')
})

test('does not release follow-ups before ten seeds or while a batch is unfinished', () => {
  const candidates = generateBroadEventCandidates({ eventId: 'halloween', categoryId: 'shirt', limit: 40 })
  const metrics = Array.from({ length: 10 }, (_, index) => ({
    keyword: `halloween gated niche ${index + 1} shirt`,
    etsySearches30d: 30 + index,
    etsyListings: 1000,
    conversionLabel: 'Medium',
    sourceQuery: `halloween source ${index % 5} shirt`,
  }))
  const plan = buildMarketplaceInsightPlan(candidates, {
    eventId: 'halloween', categoryId: 'shirt', marketplaceInsightMode: 'plus', relatedKeywordMetrics: metrics,
  })
  plan.items = plan.items.map((item, index) => ({ ...item, status: index < 9 ? 'completed' : 'planned' }))

  const tooEarly = advanceMarketplaceInsightResearch(plan, { eventId: 'halloween', categoryId: 'shirt' })
  assert.equal(tooEarly.addedCount, 0)
  assert.equal(tooEarly.reason, 'need-more-seeds')

  plan.items = plan.items.map((item, index) => ({ ...item, status: index < 10 ? 'completed' : 'planned' }))
  const firstBatch = advanceMarketplaceInsightResearch(plan, { eventId: 'halloween', categoryId: 'shirt' })
  const blocked = advanceMarketplaceInsightResearch(firstBatch.plan, { eventId: 'halloween', categoryId: 'shirt' })
  assert.equal(blocked.addedCount, 0)
  assert.equal(blocked.reason, 'batch-in-progress')
})

test('makes Marketplace Insights ranking evidence expire after seven days', () => {
  assert.equal(getMarketplaceInsightFreshness('2026-07-12T00:00:00Z', '2026-07-19T00:00:00Z').eligibleForRanking, true)
  assert.equal(getMarketplaceInsightFreshness('2026-07-11T00:00:00Z', '2026-07-19T00:00:00Z').eligibleForRanking, false)
  assert.equal(getMarketplaceInsightFreshness('', '2026-07-19T00:00:00Z').freshnessLabel, 'unavailable')
})

test('aggregates sales breadth without using Listings Analyzed', () => {
  const result = aggregateEverbeeListings([
    { monthlySales: 12, monthlyRevenue: 300, listingAgeMonths: 4 },
    { monthlySales: 8, monthlyRevenue: 200, listingAgeMonths: 6 },
    { monthlySales: 0, monthlyRevenue: 0, listingAgeMonths: 20 },
  ])

  assert.equal(result.visibleListingCount, 3)
  assert.equal(result.sellingListingCount, 2)
  assert.equal(result.recentSellingListingCount, 2)
  assert.equal(result.medianMonthlySales, 8)
  assert.equal(result.medianMonthlyRevenue, 200)
  assert.equal(result.totalVisibleMonthlySales, 20)
  assert.equal(result.topMonthlySales, 12)
  assert.equal(result.topSalesShare, 0.6)
  assert.equal(result.medianListingAgeMonths, 6)
})

test('returns null aggregate values when listing metrics are unavailable', () => {
  const result = aggregateEverbeeListings([{ title: 'Unknown listing' }])

  assert.equal(result.visibleListingCount, 1)
  assert.equal(result.sellingListingCount, 0)
  assert.equal(result.medianMonthlySales, null)
  assert.equal(result.totalVisibleMonthlySales, null)
  assert.equal(result.topSalesShare, null)
})

test('does not award A to a single hit', () => {
  const result = scoreEverbeeResult(freshRow({
    sellingListingCount: 1,
    recentSellingListingCount: 1,
    medianMonthlySales: 0,
    totalVisibleMonthlySales: 100,
    topMonthlySales: 100,
    topSalesShare: 1,
  }), SCORE_OPTIONS)

  assert.notEqual(result.opportunityLabel, 'A')
  assert.ok(result.gateReasons.includes('sales-breadth'))
  assert.ok(result.gateReasons.includes('sales-concentration'))
})

test('awards A only to fresh broad sales evidence', () => {
  const result = scoreEverbeeResult(freshRow(), SCORE_OPTIONS)

  assert.equal(result.opportunityLabel, 'A')
  assert.equal(result.confidenceLabel, 'High')
  assert.equal(result.candidateStage, 'opportunity')
})

test('allows fresh official Etsy demand and supply to replace eRank for A', () => {
  const result = scoreEverbeeResult(freshRow({
    erankSearchVolume: '',
    erankClicks: '',
    erankCompetition: '',
    erankKeywordDifficulty: '',
    erankCheckedAt: '',
    etsySearches30d: 180,
    etsyListings: 9000,
    etsyCheckedAt: '2026-07-15T00:00:00Z',
  }), SCORE_OPTIONS)

  assert.equal(result.opportunityLabel, 'A')
  assert.equal(result.confidenceLabel, 'High')
  assert.equal(result.validation.hasEtsyMarketplaceData, true)
})

test('does not combine demand and supply passes from different sources', () => {
  const result = scoreEverbeeResult(freshRow({
    erankSearchVolume: 400,
    erankClicks: 120,
    erankCompetition: 50000,
    erankKeywordDifficulty: 70,
    etsySearches30d: 20,
    etsyListings: 9000,
    etsyCheckedAt: '2026-07-15T00:00:00Z',
  }), SCORE_OPTIONS)

  assert.equal(result.opportunityLabel, 'C')
  assert.notEqual(result.validation.demandSupplySource, 'mixed')
})

test('explains fresh eRank evidence when Etsy official data is stale', () => {
  const result = scoreEverbeeResult(freshRow({
    etsySearches30d: 500,
    etsyListings: 3000,
    etsyCheckedAt: '2026-07-01T00:00:00Z',
  }), SCORE_OPTIONS)
  const evidence = explainEverbeeScore(result)

  assert.equal(result.opportunityLabel, 'A')
  assert.equal(result.validation.demandSupplySource, 'erank')
  assert.equal(evidence.rows[0].metric, 'eRank需要')
})

test('awards B to a fresh moderate Etsy niche with two selling listings', () => {
  const result = scoreEverbeeResult(freshRow({
    erankSearchVolume: '',
    erankClicks: '',
    erankCompetition: '',
    erankKeywordDifficulty: '',
    erankCheckedAt: '',
    etsySearches30d: 60,
    etsyListings: 32000,
    etsyCheckedAt: '2026-07-15T00:00:00Z',
    sellingListingCount: 2,
    recentSellingListingCount: 1,
    medianMonthlySales: 1,
    totalVisibleMonthlySales: 10,
    topSalesShare: 0.72,
  }), SCORE_OPTIONS)

  assert.equal(result.opportunityLabel, 'B')
  assert.equal(result.confidenceLabel, 'High')
})

test('ranks a lower-competition Etsy B candidate above a more crowded one', () => {
  const base = {
    erankSearchVolume: '',
    erankClicks: '',
    erankCompetition: '',
    erankKeywordDifficulty: '',
    erankCheckedAt: '',
    etsySearches30d: 1300,
    etsyCheckedAt: '2026-07-15T00:00:00Z',
  }
  const lowerCompetition = scoreEverbeeResult(freshRow({ ...base, etsyListings: 20100 }), SCORE_OPTIONS)
  const higherCompetition = scoreEverbeeResult(freshRow({ ...base, etsyListings: 31700 }), SCORE_OPTIONS)

  assert.equal(lowerCompetition.opportunityLabel, 'B')
  assert.equal(higherCompetition.opportunityLabel, 'B')
  assert.ok(lowerCompetition.score > higherCompetition.score)
  assert.ok(lowerCompetition.parts.erankCompetitionScore > higherCompetition.parts.erankCompetitionScore)
})

test('penalizes conflicting Etsy and eRank demand bands without hiding a B test', () => {
  const conflicting = scoreEverbeeResult(freshRow({
    etsySearches30d: 59,
    etsyListings: 11900,
    etsyCheckedAt: '2026-07-15T00:00:00Z',
    erankSearchVolume: 19,
    erankClicks: '',
    erankCompetition: 32251,
  }), SCORE_OPTIONS)
  const etsyOnly = scoreEverbeeResult(freshRow({
    etsySearches30d: 59,
    etsyListings: 11900,
    etsyCheckedAt: '2026-07-15T00:00:00Z',
    erankSearchVolume: '',
    erankClicks: '',
    erankCompetition: '',
    erankKeywordDifficulty: '',
    erankCheckedAt: '',
  }), SCORE_OPTIONS)

  assert.equal(conflicting.opportunityLabel, 'B')
  assert.equal(conflicting.validation.demandSourceConflict, true)
  assert.equal(conflicting.parts.sourceConsistencyScore, -5)
  assert.equal(conflicting.score, etsyOnly.score - 5)
  assert.match(conflicting.exclusionReasons.join(' '), /需要の強さが不一致/)
})

test('does not award A or B when Marketplace Insights evidence is older than seven days', () => {
  const result = scoreEverbeeResult(freshRow({
    erankSearchVolume: '',
    erankClicks: '',
    erankCompetition: '',
    erankKeywordDifficulty: '',
    erankCheckedAt: '',
    etsySearches30d: 500,
    etsyListings: 3000,
    etsyCheckedAt: '2026-07-01T00:00:00Z',
  }), SCORE_OPTIONS)

  assert.equal(result.opportunityLabel, 'C')
  assert.notEqual(result.confidenceLabel, 'High')
})

test('legacy rows without aggregate evidence cannot receive A', () => {
  const result = scoreEverbeeResult({
    keyword: 'pickleball mom shirt',
    listingsAnalyzed: 500,
    topMonthlySales: 100,
    topRevenue: 3000,
  }, SCORE_OPTIONS)

  assert.notEqual(result.opportunityLabel, 'A')
  assert.notEqual(result.confidenceLabel, 'High')
})

test('stale checks cannot receive A or B', () => {
  const result = scoreEverbeeResult(freshRow({
    erankCheckedAt: '2026-05-01T00:00:00Z',
    everbeeCheckedAt: '2026-05-01T00:00:00Z',
  }), SCORE_OPTIONS)

  assert.ok(['C', 'D'].includes(result.opportunityLabel))
  assert.notEqual(result.confidenceLabel, 'High')
  assert.ok(result.gateReasons.includes('freshness'))
})

test('scores EverBee competition more strongly at 800 listings than at 4,800', () => {
  const scarce = scoreEverbeeResult(freshRow({ listingsAnalyzed: 800 }), SCORE_OPTIONS)
  const broader = scoreEverbeeResult(freshRow({ listingsAnalyzed: 4800 }), SCORE_OPTIONS)

  assert.equal(scarce.parts.everbeeCompetitionScore, 18)
  assert.equal(broader.parts.everbeeCompetitionScore, 12)
  assert.ok(scarce.score > broader.score)
  assert.equal(scarce.normalized.everbeeCompetitionBand, 'very-low')
  assert.equal(broader.normalized.everbeeCompetitionBand, 'low')
})

test('keeps an oversaturated EverBee keyword out of A and B even when visible sales are strong', () => {
  const result = scoreEverbeeResult(freshRow({ listingsAnalyzed: 43906 }), SCORE_OPTIONS)

  assert.equal(result.opportunityLabel, 'C')
  assert.ok(result.score <= 39)
  assert.ok(result.gateReasons.includes('everbee-competition'))
  assert.equal(result.normalized.everbeeCompetitionBand, 'saturated')
})

test('treats exactly 30,000 EverBee listings as saturated', () => {
  const result = scoreEverbeeResult(freshRow({ listingsAnalyzed: 30000 }), SCORE_OPTIONS)

  assert.equal(result.opportunityLabel, 'C')
  assert.ok(result.score <= 39)
  assert.equal(result.normalized.everbeeCompetitionBand, 'saturated')
})

test('does not reward an empty EverBee result as ultra-low competition', () => {
  const result = scoreEverbeeResult(freshRow({ listingsAnalyzed: 0 }), SCORE_OPTIONS)

  assert.equal(result.opportunityLabel, 'C')
  assert.equal(result.parts.everbeeCompetitionScore, 0)
  assert.equal(result.normalized.everbeeCompetitionBand, 'empty')
})

test('caps sales-only evidence when every competition source is unavailable', () => {
  const result = scoreEverbeeResult(freshRow({
    listingsAnalyzed: '',
    erankSearchVolume: '',
    erankClicks: '',
    erankCompetition: '',
    erankKeywordDifficulty: '',
    erankCheckedAt: '',
  }), SCORE_OPTIONS)

  assert.equal(result.opportunityLabel, 'C')
  assert.ok(result.score <= 39)
  assert.ok(result.gateReasons.includes('competition-unverified'))
  assert.equal(result.normalized.everbeeCompetitionBand, 'unknown')
})

test('explains the EverBee competition count and its band', () => {
  const evidence = explainEverbeeScore(scoreEverbeeResult(freshRow({ listingsAnalyzed: 800 }), SCORE_OPTIONS))
  const competition = evidence.rows.find((row) => row.key === 'everbeeCompetition')

  assert.equal(competition.value, '800')
  assert.equal(competition.status, 'strong')
  assert.match(competition.label, /競合/)
})

test('uses low EverBee competition for the final keyword bucket when eRank supply is missing', () => {
  const row = freshRow({
    listingsAnalyzed: 800,
    erankCompetition: '',
    erankKeywordDifficulty: '',
  })
  const score = scoreEverbeeResult(row, SCORE_OPTIONS)
  const bucket = classifyKeywordBucket({ ...row, score }, SCORE_OPTIONS)

  assert.equal(bucket.bucket, 'visibility')
})

test('explains A with demand, supply, and multiple-listing evidence', () => {
  const evidence = explainEverbeeScore(scoreEverbeeResult(freshRow(), SCORE_OPTIONS))

  assert.match(evidence.summary, /複数商品/)
  assert.doesNotMatch(evidence.summary, /販売密度|商品数/)
  assert.ok(evidence.rows.some((row) => row.key === 'salesBreadth'))
  assert.ok(evidence.rows.some((row) => row.key === 'concentration'))
})

test('does not inject gift into ordinary garment candidates', () => {
  const rows = generateKeywordCandidates({
    eventId: 'auto-discovery',
    categoryId: 'shirt',
    seedKeywords: 'pickleball mom',
    limit: 80,
  })

  assert.equal(rows.some((row) => /\bgift\b/.test(row.keyword)), false)
})

test('keeps explicitly observed gift intent from a seed', () => {
  const rows = generateKeywordCandidates({
    eventId: 'auto-discovery',
    categoryId: 'shirt',
    seedKeywords: 'retirement gift for nurse',
    limit: 250,
  })

  assert.equal(rows.some((row) => row.keyword === 'retirement gift for nurse shirt'), true)
})

test('does not mix shirt and sweatshirt product families', () => {
  const shirtRows = generateKeywordCandidates({ eventId: 'auto-discovery', categoryId: 'shirt', limit: 80 })
  const sweatshirtRows = generateKeywordCandidates({ eventId: 'auto-discovery', categoryId: 'sweatshirt', limit: 80 })

  assert.equal(shirtRows.some((row) => /\b(?:sweatshirt|crewneck|hoodie)\b/.test(row.keyword)), false)
  assert.equal(sweatshirtRows.some((row) => /\b(?:shirt|tshirt|tee)\b/.test(row.keyword)), false)
})

test('does not duplicate garment aliases in seeded candidates', () => {
  const rows = generateKeywordCandidates({
    eventId: 'auto-discovery',
    categoryId: 'shirt',
    seedKeywords: 'baby tee',
    limit: 250,
  })
  const malformedSeedRows = generateKeywordCandidates({
    eventId: 'auto-discovery',
    categoryId: 'shirt',
    seedKeywords: 'baby tee shirt',
    limit: 250,
  })

  assert.equal(rows.some((row) => row.keyword === 'baby tee'), true)
  assert.equal(rows.some((row) => /\b(?:tee shirt|shirt tee|tshirt shirt)\b/.test(row.keyword)), false)
  assert.equal(malformedSeedRows.some((row) => /\b(?:tee shirt|shirt tee|tshirt shirt)\b/.test(row.keyword)), false)
})

test('recognizes category product aliases before productizing trend seeds', () => {
  assert.equal(keywordMatchesCategoryProduct('baby tee', 'shirt'), true)
  assert.equal(keywordMatchesCategoryProduct('retro tshirt', 'shirt'), true)
  assert.equal(keywordMatchesCategoryProduct('cozy crewneck', 'sweatshirt'), true)
  assert.equal(keywordMatchesCategoryProduct('cozy crewneck', 'shirt'), false)
})

test('does not combine conflicting recipient roles without a matching intent', () => {
  const rows = generateKeywordCandidates({
    eventId: 'auto-discovery',
    categoryId: 'shirt',
    seedKeywords: 'funny mom',
    limit: 250,
  })

  assert.equal(rows.some((row) => row.keyword === 'funny mom shirt'), true)
  assert.equal(rows.some((row) => /\bdad\b.*\bmom\b|\bmom\b.*\bdad\b/.test(row.keyword)), false)
  assert.equal(rows.some((row) => /\bgrandma\b.*\bmom\b|\bmom\b.*\bgrandma\b/.test(row.keyword)), false)
})

test('builds a short title with one product noun and no generic gift phrase', () => {
  const plan = buildSeoPlanFromBuckets({
    visibility: ['retro pickleball mom shirt', 'western nurse graphic tee', 'cute librarian sweatshirt'],
    reach: ['gift for mom', 'funny gardening teacher tee', 'personalized family reunion shirt', 'embroidered book lover top'],
    bestSeller: ['pickleball shirt', 'teacher appreciation gift shirt', 'nurse life shirt'],
  }, { eventId: 'auto-discovery', categoryId: 'shirt' })
  const productMatches = plan.title.match(/\b(?:shirt|tee|tshirt)\b/gi) || []

  assert.ok(plan.title.split(/\s+/).length <= 14)
  assert.equal(productMatches.length, 1)
  assert.doesNotMatch(plan.title, /\bgift\b/i)
})

test('builds no more than 13 valid tags and omits year-only tags', () => {
  const plan = buildSeoPlanFromBuckets({
    visibility: ['retro pickleball mom shirt'],
    reach: ['funny pickleball mom', 'pickleball team mom'],
    bestSeller: ['pickleball shirt'],
  }, { eventId: 'auto-discovery', categoryId: 'shirt', year: 2026 })

  assert.ok(plan.tags.length <= 13)
  assert.equal(plan.tags.every((tag) => tag.length <= 20), true)
  assert.equal(plan.tags.some((tag) => /^\d{4}$/.test(tag)), false)
})
