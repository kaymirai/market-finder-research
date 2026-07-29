#!/usr/bin/env node
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregateEverbeeListings,
  buildCrossNicheDrilldown,
  everbeeResultsToBroadListings,
  extractNicheHintsFromListings,
  advanceMarketplaceInsightResearch,
  buildMarketplaceInsightPlan,
  buildKeywordClusterKey,
  buildSeoPlanFromBuckets,
  BUYER_IDENTITY_LIBRARY,
  analyzeMarketplaceVocabulary,
  analyzeModifierUsage,
  classifyBuyerIdentitySpecificity,
  classifyBuyerIdentity,
  clusterKeywordCandidates,
  measuredModifierPhrases,
  detectRiskTerms,
  suggestBuyerIdentities,
  classifyBuyerIntentPhrase,
  classifyKeywordBucket,
  explainEverbeeScore,
  generateBroadEventCandidates,
  generateBuyerIntentCandidates,
  generateBuyerIdentityDrilldownCandidates,
  getBroadEventDiscoveryProfile,
  getMarketTiming,
  getMarketplaceInsightFreshness,
  getSourceFreshness,
  generateKeywordCandidates,
  keywordMatchesCategoryProduct,
  learnedBuyerIntentSignals,
  mergeMarketplaceInsightRelatedMetrics,
  rankMarketplaceInsightRelatedCandidates,
  newcomerAccess,
  scoreEverbeeResult,
  selectAutomaticBuyerIdentities,
  selectMarketplaceInsightFollowUpBatch,
  evaluateMarketplaceInsightResearchStop,
  parseBroadMarketListings,
  parseEverbeeRows,
  compareCrossNicheRows,
  selectCrossNicheParentMarkets,
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

test('round-trips cross-niche lineage through the research CSV parser', () => {
  const rows = parseEverbeeRows([
    'Keyword,Niche Root,Cross Niche Parent,Cross Niche Depth,Specificity Axis,Drilldown Sources JSON,Drilldown Verdict,Stop Reason,Parent Comparison JSON',
    'book club cat shirt,cat shirt,cat shirt,1,hobby,"[""etsy-related""]",watch,,"{""competitionReduction"":0.8}"',
  ].join('\n'))

  assert.equal(rows[0].crossNicheRoot, 'cat shirt')
  assert.equal(rows[0].crossNicheParent, 'cat shirt')
  assert.equal(rows[0].crossNicheDepth, '1')
  assert.equal(rows[0].specificityAxis, 'hobby')
  assert.deepEqual(rows[0].crossNicheSources, ['etsy-related'])
  assert.equal(rows[0].crossNicheVerdict, 'watch')
  assert.deepEqual(rows[0].crossNicheComparison, { competitionReduction: 0.8 })
})

test('round-trips event market track metadata through the research CSV parser', () => {
  const rows = parseEverbeeRows([
    'Keyword,Market Track,Research Event,Research Category,History Cluster',
    'teacher shirt,evergreen-adjacent,halloween,shirt,teacher',
  ].join('\n'))

  assert.equal(rows[0].intentTrack, 'evergreen-adjacent')
  assert.equal(rows[0].researchEventId, 'halloween')
  assert.equal(rows[0].researchCategoryId, 'shirt')
  assert.equal(rows[0].historyClusterKey, 'teacher')
})

test('parses research round, eRank provenance, and buyer intent CSV columns', () => {
  const [row] = parseEverbeeRows([
    'Keyword,Research Round,Round Type,Round Depth,Round Status,eRank Query,eRank Query Kind,eRank Source Keywords JSON,eRank Capture Status,eRank Attempted At,Buyer Intent Axes JSON,Wearer Intent,Recipient Role,Giver Role,Occasion,Personalization',
    'librarian gift from students shirt,cross-niche-1,cross-niche,1,complete,librarian gift from students shirt,direct,"[""librarian shirt""]",captured,2026-07-22T10:00:00.000Z,"[""Occupation"",""Relationship/recipient"",""Style/product""]",recipient,librarian,students,appreciation,name',
  ].join('\n'))

  assert.equal(row.researchRoundId, 'cross-niche-1')
  assert.equal(row.queryKind, 'direct')
  assert.deepEqual(row.sourceKeywords, ['librarian shirt'])
  assert.deepEqual(row.buyerIntentAxes, ['Occupation', 'Relationship/recipient', 'Style/product'])
  assert.equal(row.wearerIntent, 'recipient')
  assert.equal(row.recipientRole, 'librarian')
  assert.equal(row.giverRole, 'students')
})

test('keeps a saturated multi-seller market as a cross-niche exploration parent', () => {
  const parents = selectCrossNicheParentMarkets([{
    keyword: 'cat shirt',
    listingsAnalyzed: 43906,
    productRows: [
      { title: 'Book Club Cat Shirt', monthlySales: 40, listingAgeMonths: 6 },
      { title: 'Retro Book Club Cat Shirt', monthlySales: 25, listingAgeMonths: 10 },
    ],
  }], SCORE_OPTIONS)

  assert.equal(parents.length, 1)
  assert.equal(parents[0].keyword, 'cat shirt')
  assert.equal(parents[0].competition.source, 'everbee')
  assert.equal(parents[0].competition.value, 43906)
  assert.equal(parents[0].sales.sellingListingCount, 2)
  assert.equal(parents[0].sales.totalMonthlySales, 65)
  assert.equal(parents[0].depth, 0)
})

test('does not use one old bestseller as a cross-niche exploration parent', () => {
  const parents = selectCrossNicheParentMarkets([{
    keyword: 'cat shirt',
    listingsAnalyzed: 43906,
    productRows: [
      { title: 'Vintage Cat Shirt', monthlySales: 300, listingAgeMonths: 48 },
    ],
  }], SCORE_OPTIONS)

  assert.equal(parents.length, 0)
})

test('does not reopen a buyer drilldown branch already stopped by parent-child evidence', () => {
  const parents = selectCrossNicheParentMarkets([{
    keyword: 'tiny demand teacher shirt',
    crossNicheParent: 'teacher shirt',
    crossNicheDepth: 1,
    crossNicheVerdict: 'weak-demand',
    listingsAnalyzed: 12000,
    sellingListingCount: 4,
    totalVisibleMonthlySales: 30,
    medianMonthlySales: 5,
  }], SCORE_OPTIONS)

  assert.equal(parents.length, 0)
})

test('compares parent and child using one demand and supply source', () => {
  const comparison = compareCrossNicheRows({
    keyword: 'cat shirt',
    etsySearches30d: 1000,
    etsyListings: 50000,
    medianMonthlySales: 10,
    sellingListingCount: 5,
    recentSellingListingCount: 3,
  }, {
    keyword: 'book club cat shirt',
    etsySearches30d: 200,
    etsyListings: 5000,
    medianMonthlySales: 5,
    sellingListingCount: 3,
    recentSellingListingCount: 2,
  })

  assert.equal(comparison.source, 'etsy')
  assert.equal(comparison.competitionReduction, 0.9)
  assert.equal(comparison.demandRetention, 0.2)
  assert.equal(comparison.efficiencyLift, 2)
  assert.equal(comparison.salesRetention, 0.5)
  assert.equal(comparison.verdict, 'promising')
})

test('does not reward a child whose demand collapses after drilldown', () => {
  const comparison = compareCrossNicheRows({
    keyword: 'cat shirt',
    erankSearchVolume: 1000,
    erankCompetition: 50000,
  }, {
    keyword: 'book club cat shirt',
    erankSearchVolume: 20,
    erankCompetition: 5000,
  })

  assert.equal(comparison.competitionReduction, 0.9)
  assert.equal(comparison.demandRetention, 0.02)
  assert.equal(comparison.verdict, 'weak-demand')
})

test('keeps a demand-efficient child on watch until EverBee sales is checked', () => {
  const comparison = compareCrossNicheRows({
    keyword: 'cat shirt',
    erankSearchVolume: 1000,
    erankCompetition: 50000,
  }, {
    keyword: 'book club cat shirt',
    erankSearchVolume: 200,
    erankCompetition: 5000,
  })

  assert.equal(comparison.efficiencyLift, 2)
  assert.equal(comparison.verdict, 'watch')
})

test('rejects a child whose median sales collapses despite better demand efficiency', () => {
  const comparison = compareCrossNicheRows({
    keyword: 'cat shirt',
    etsySearches30d: 1000,
    etsyListings: 50000,
    medianMonthlySales: 100,
    sellingListingCount: 5,
  }, {
    keyword: 'book club cat shirt',
    etsySearches30d: 200,
    etsyListings: 5000,
    medianMonthlySales: 5,
    sellingListingCount: 3,
  })

  assert.equal(comparison.salesRetention, 0.05)
  assert.equal(comparison.verdict, 'weak-sales')
})

test('builds cross-niche candidates from repeated recent selling-title phrases', () => {
  const drilldown = buildCrossNicheDrilldown([{
    keyword: 'cat shirt',
    listingsAnalyzed: 43906,
    productRows: [
      { title: 'Book Club Cat Shirt', monthlySales: 40, listingAgeMonths: 6 },
      { title: 'Retro Book Club Cat Shirt', monthlySales: 25, listingAgeMonths: 10 },
      { title: 'Teacher Cat Shirt', monthlySales: 12, listingAgeMonths: 8 },
    ],
  }], SCORE_OPTIONS)

  const candidate = drilldown.parents[0].candidates.find((row) => row.keyword === 'book club cat shirt')
  assert.ok(candidate)
  assert.equal(candidate.parentKeyword, 'cat shirt')
  assert.equal(candidate.modifier, 'book club')
  assert.equal(candidate.depth, 1)
  assert.ok(candidate.sources.includes('everbee-title'))
  assert.equal(candidate.verdict, 'needs-research')
})

test('adds evidence-first buyer identity drilldowns to cross-niche research', () => {
  const drilldown = buildCrossNicheDrilldown([{
    keyword: 'teacher shirt',
    listingsAnalyzed: 50000,
    etsyRelatedTerms: 'art teacher shirt',
    productRows: [
      { title: 'Special Education Teacher Shirt', monthlySales: 12, listingAgeMonths: 6 },
      { title: 'Retro Special Education Teacher Shirt', monthlySales: 8, listingAgeMonths: 8 },
    ],
  }], SCORE_OPTIONS)

  const measured = drilldown.candidates.find((row) => row.keyword === 'special education teacher shirt')
  assert.ok(measured)
  assert.equal(measured.rootKeyword, 'teacher shirt')
  assert.equal(measured.specificityAxis, 'specialty')
  assert.ok(measured.sources.includes('everbee-title'))

  const related = drilldown.candidates.find((row) => row.keyword === 'art teacher shirt')
  assert.ok(related)
  assert.equal(related.specificityAxis, 'subject')
  assert.ok(related.sources.includes('etsy-related'))
  assert.equal(drilldown.researchCandidates.length <= 8, true)
})

test('filters title noise and one-off title phrases from cross-niche candidates', () => {
  const drilldown = buildCrossNicheDrilldown([{
    keyword: 'teacher shirt',
    listingsAnalyzed: 50000,
    productRows: [
      { title: 'Comfort Colors Teacher Shirt', monthlySales: 40, listingAgeMonths: 6 },
      { title: 'Colors Teacher Shirt', monthlySales: 25, listingAgeMonths: 8 },
      { title: 'Carl Teacher Shirt', monthlySales: 18, listingAgeMonths: 5 },
      { title: 'Math Teacher Shirt', monthlySales: 16, listingAgeMonths: 7 },
    ],
  }], SCORE_OPTIONS)

  assert.equal(drilldown.candidates.some((row) => /\b(?:comfort|colors|carl)\b/.test(row.keyword)), false)
  assert.equal(drilldown.candidates.some((row) => row.keyword === 'math teacher shirt'), false)
})

test('keeps repeated sold-title modifiers and Etsy-confirmed recipient intent', () => {
  const drilldown = buildCrossNicheDrilldown([{
    keyword: 'librarian shirt',
    listingsAnalyzed: 50000,
    etsyRelatedTerms: 'school librarian retirement shirt, librarian gift from students shirt',
    productRows: [
      { title: 'Book Club Librarian Shirt', monthlySales: 40, listingAgeMonths: 6 },
      { title: 'Retro Book Club Librarian Shirt', monthlySales: 25, listingAgeMonths: 8 },
    ],
  }], SCORE_OPTIONS)

  assert.ok(drilldown.candidates.some((row) => row.keyword === 'book club librarian shirt'))
  const retirement = drilldown.candidates.find((row) => row.keyword === 'school librarian retirement shirt')
  assert.ok(retirement)
  assert.deepEqual(retirement.buyerIntentAxes, ['Occupation', 'Life transition', 'Style/product'])
  assert.equal(retirement.wearerIntent, 'self')

  const gift = drilldown.candidates.find((row) => row.keyword === 'librarian gift from students shirt')
  assert.ok(gift)
  assert.equal(gift.wearerIntent, 'recipient')
  assert.equal(gift.recipientRole, 'librarian')
  assert.equal(gift.giverRole, 'students')
})

test('rejects generic gift intent without a specific recipient', () => {
  assert.equal(classifyBuyerIntentPhrase('gift for her shirt').eligible, false)
  assert.equal(classifyBuyerIntentPhrase('birthday gift shirt').eligible, false)
  assert.equal(classifyBuyerIntentPhrase('teacher retirement gift shirt').eligible, true)
})

test('stops cross-niche expansion at depth three', () => {
  const drilldown = buildCrossNicheDrilldown([{
    keyword: 'book club cat shirt',
    crossNicheParent: 'cat shirt',
    crossNicheDepth: 3,
    listingsAnalyzed: 20000,
    productRows: [
      { title: 'Teacher Book Club Cat Shirt', monthlySales: 25, listingAgeMonths: 5 },
      { title: 'Funny Teacher Book Club Cat Shirt', monthlySales: 18, listingAgeMonths: 7 },
    ],
  }], SCORE_OPTIONS)

  assert.equal(drilldown.parents.length, 0)
  assert.equal(drilldown.candidates.length, 0)
})

test('returns evergreen timing for auto discovery', () => {
  const result = getMarketTiming({ id: 'auto-discovery', month: 0 }, '2026-07-19T00:00:00Z')

  assert.equal(result.label, 'evergreen')
  assert.equal(result.status, 'evergreen')
  assert.equal(result.weeksUntil, null)
})

test('labels an event 12 weeks away as prepare', () => {
  const result = getMarketTiming({ id: 'halloween', month: 10 }, '2026-08-08T00:00:00Z')

  assert.equal(result.label, 'prepare')
  assert.equal(result.status, 'early')
  assert.equal(result.priority, 2)
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

test('builds a balanced Christmas shortlist with seasonal signals and evergreen lanes', () => {
  const profile = getBroadEventDiscoveryProfile({ eventId: 'christmas' })
  const rows = generateBroadEventCandidates({
    eventId: 'christmas',
    categoryId: 'shirt',
    limit: 40,
  })
  const direct = rows.filter((row) => row.queryStrategy === 'direct')
  const adjacent = rows.filter((row) => row.queryStrategy === 'adjacent')

  assert.equal(profile.enabled, true)
  assert.ok(profile.lanes.motif.includes('candy cane'))
  assert.equal(rows.length, 40)
  assert.equal(new Set(rows.map((row) => row.discoveryLane)).size, 5)
  assert.ok(direct.length / rows.length <= 0.3)
  assert.ok(adjacent.length / rows.length >= 0.4)
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

test('builds keywords from who the buyer is, not from an event name', () => {
  const rows = generateBuyerIntentCandidates({
    identitySeeds: 'school librarian\ntrail crew volunteer',
    categoryId: 'shirt',
  })
  const keywords = rows.map((row) => row.keyword)

  assert.ok(rows.length > 0)
  // The identity has to survive into the phrase, or the axis added nothing.
  assert.ok(keywords.some((keyword) => keyword.includes('school librarian')))
  assert.ok(keywords.some((keyword) => keyword.includes('trail crew volunteer')))
  assert.ok(keywords.every((keyword) => keyword.includes('shirt')))
  // Life transition, personalization and style axes each reach the output.
  assert.ok(keywords.some((keyword) => keyword.startsWith('retirement ')))
  assert.ok(keywords.some((keyword) => keyword.startsWith('personalized ')))
  assert.ok(keywords.some((keyword) => keyword.startsWith('retro ')))
  rows.forEach((row) => {
    assert.equal(row.queryStrategy, 'buyer-intent')
    assert.equal(row.categoryId, 'shirt')
  })
})

test('takes the niche vocabulary from the user and folds in their own actions', () => {
  const rows = generateBuyerIntentCandidates({
    identitySeeds: 'handbell choir member',
    categoryId: 'shirt',
    actions: ['bell ringing', 'sunday practice'],
  })
  const keywords = rows.map((row) => row.keyword)

  assert.ok(keywords.some((keyword) => keyword.includes('bell ringing')))
  assert.ok(keywords.some((keyword) => keyword.includes('sunday practice')))
})

test('supplies the identity vocabulary so the operator never starts from a blank field', () => {
  const suggestions = suggestBuyerIdentities({ limit: 12 })
  assert.equal(suggestions.length, 12)

  // A single press has to span different worlds. Twelve nurse specialties would be a
  // worse answer than four occupations, a family role and a hobby, because the operator
  // picks by what they understand, not by what scores highest.
  assert.ok(new Set(suggestions.map((item) => item.groupId)).size >= 6)
  assert.ok(new Set(suggestions.map((item) => item.axis)).size >= 3)
  suggestions.forEach((item) => {
    assert.equal(item.phrase, item.phrase.trim().toLowerCase())
    assert.ok(item.groupLabel.length > 0)
  })

  // Every suggestion must survive the generator it feeds, or the chip is a dead end.
  const rows = generateBuyerIntentCandidates({
    identitySeeds: suggestions.map((item) => item.phrase).join('\n'),
    categoryId: 'shirt',
  })
  assert.ok(rows.length > 0)
  assert.equal(rows.every((row) => row.status === 'ready'), true)
})

test('automatically selects buyer identities from current-market evidence', () => {
  const analysis = analyzeMarketplaceVocabulary([
    {
      runId: 'halloween-1',
      capturedAt: '2026-07-20T00:00:00Z',
      categoryId: 'shirt',
      eventId: 'halloween',
      identitySeeds: ['nicu nurse'],
      demandKeywords: [
        { keyword: 'nicu nurse halloween shirt', etsySearches30d: 140 },
      ],
      supplyListings: [
        { title: 'NICU Nurse Halloween Shirt', monthlySales: 12 },
        { title: 'Retro NICU Nurse Halloween Shirt', monthlySales: 8 },
      ],
    },
    {
      runId: 'christmas-1',
      capturedAt: '2026-07-21T00:00:00Z',
      categoryId: 'shirt',
      eventId: 'christmas',
      identitySeeds: ['book club member'],
      demandKeywords: [
        { keyword: 'book club member christmas shirt', etsySearches30d: 4000 },
      ],
      supplyListings: [
        { title: 'Book Club Member Christmas Shirt', monthlySales: 80 },
        { title: 'Book Club Member Holiday Shirt', monthlySales: 60 },
      ],
    },
    {
      runId: 'halloween-stale',
      capturedAt: '2026-01-01T00:00:00Z',
      categoryId: 'shirt',
      eventId: 'halloween',
      identitySeeds: ['school librarian'],
      demandKeywords: [
        { keyword: 'school librarian halloween shirt', etsySearches30d: 9000 },
      ],
    },
  ], {
    categoryId: 'shirt',
    eventId: 'halloween',
    now: '2026-07-26T00:00:00Z',
  })

  const selected = selectAutomaticBuyerIdentities(analysis, { limit: 3 })
  assert.deepEqual(selected.map((item) => item.phrase), ['nicu nurse'])
  assert.equal(selected[0].source, 'learned')
})

test('classifies broad buyer markets separately from specific buyer niches', () => {
  assert.deepEqual(
    classifyBuyerIdentitySpecificity('teacher'),
    { level: 'parent', rootIdentity: 'teacher', axis: '', axes: [] },
  )
  assert.deepEqual(
    classifyBuyerIdentitySpecificity('special education teacher'),
    { level: 'leaf', rootIdentity: 'teacher', axis: 'specialty', axes: ['specialty'] },
  )
  assert.deepEqual(
    classifyBuyerIdentitySpecificity('cat mom'),
    { level: 'parent', rootIdentity: 'cat mom', axis: '', axes: [] },
  )
  assert.deepEqual(
    classifyBuyerIdentitySpecificity('maine coon mom'),
    { level: 'leaf', rootIdentity: 'cat mom', axis: 'breed', axes: ['breed'] },
  )
})

test('generates measured buyer drilldowns before safe dictionary fallbacks', () => {
  const candidates = generateBuyerIdentityDrilldownCandidates({
    parentKeyword: 'halloween teacher shirt',
    categoryId: 'shirt',
    eventId: 'halloween',
    depth: 1,
    etsyRelatedTerms: [
      'halloween art teacher shirt',
      'halloween disney teacher shirt',
    ],
    productRows: [
      { title: 'Special Education Teacher Halloween Shirt', monthlySales: 12, listingAgeMonths: 6 },
      { title: 'Retro Special Education Teacher Halloween Shirt', monthlySales: 8, listingAgeMonths: 9 },
    ],
    savedPhrases: ['second grade teacher'],
    customRiskTerms: 'disney',
    limit: 8,
  })

  assert.ok(candidates.length > 0)
  assert.equal(candidates[0].sources.includes('everbee-title'), true)
  assert.ok(candidates.some((candidate) => candidate.keyword === 'halloween art teacher shirt'))
  assert.ok(candidates.some((candidate) => candidate.keyword === 'halloween second grade teacher shirt'))
  assert.equal(candidates.some((candidate) => candidate.keyword.includes('disney')), false)
  assert.equal(candidates.every((candidate) => candidate.parentKeyword === 'halloween teacher shirt'), true)
  assert.equal(candidates.every((candidate) => candidate.rootKeyword === 'halloween teacher shirt'), true)
  assert.equal(candidates.every((candidate) => candidate.depth === 1), true)
})

test('adds a different specificity axis on the next buyer drilldown depth', () => {
  const candidates = generateBuyerIdentityDrilldownCandidates({
    parentKeyword: 'special education teacher shirt',
    rootKeyword: 'teacher shirt',
    categoryId: 'shirt',
    depth: 2,
    limit: 8,
  })

  assert.ok(candidates.some((candidate) => candidate.keyword === 'special education second grade teacher shirt'))
  assert.equal(candidates.some((candidate) => candidate.keyword.includes('art special education teacher')), false)
  assert.equal(candidates.every((candidate) => candidate.depth === 2), true)
  assert.equal(candidates.every((candidate) => candidate.rootKeyword === 'teacher shirt'), true)
})

test('falls back to safe starter identities when there is no measured buyer history', () => {
  const selected = selectAutomaticBuyerIdentities({ rows: [] }, { limit: 3 })

  assert.equal(selected.length, 3)
  assert.equal(selected.every((item) => item.source === 'starter'), true)
  assert.equal(selected.every((item) => detectRiskTerms(item.phrase, []).length === 0), true)
})

test('rotates and excludes so pressing for more never repeats what is already chosen', () => {
  const first = suggestBuyerIdentities({ limit: 12 })
  const second = suggestBuyerIdentities({ limit: 12, offset: 1 })
  const firstPhrases = first.map((item) => item.phrase)
  assert.notDeepEqual(firstPhrases, second.map((item) => item.phrase))

  const afterPicking = suggestBuyerIdentities({ limit: 12, exclude: firstPhrases.join('\n') })
  assert.equal(afterPicking.some((item) => firstPhrases.includes(item.phrase)), false)

  const occupationsOnly = suggestBuyerIdentities({ limit: 8, axis: 'occupation' })
  assert.equal(occupationsOnly.every((item) => item.axis === 'occupation'), true)
})

test('keeps the suggested vocabulary specific enough to be worth entering', () => {
  const phrases = BUYER_IDENTITY_LIBRARY.flatMap((group) => group.phrases)
  assert.ok(phrases.length >= 200)
  assert.equal(new Set(phrases).size, phrases.length, 'a phrase must not appear in two groups')

  // Head terms every seller already targets are the reason this lane stopped working.
  // The catalog exists to carry the qualifier, so the bare terms must not be in it.
  for (const bare of ['nurse', 'teacher', 'mom', 'dad', 'runner', 'gift']) {
    assert.equal(phrases.includes(bare), false, `${bare} is too broad to suggest`)
  }
  assert.equal(phrases.every((phrase) => phrase === phrase.trim().toLowerCase()), true)
  // A suggestion carrying someone else's trademark would be a defect we shipped, not a
  // risk the operator chose to take.
  assert.equal(phrases.every((phrase) => detectRiskTerms(phrase, []).length === 0), true)
})

test('counts modifiers from collected evidence instead of trusting the built-in list', () => {
  const analysis = analyzeModifierUsage({
    demandKeywords: [
      { keyword: 'halloween nurse shirt', etsySearches30d: 1300 },
      { keyword: 'nicu nurse halloween shirt', etsySearches30d: 97 },
      { keyword: 'halloween teacher shirt personalized', etsySearches30d: 7 },
    ],
    supplyListings: [
      { title: 'Personalized Halloween Nurse Sweatshirt', monthlySales: 5 },
      { title: 'Retro Ghost Reading Books Sweatshirt', monthlySales: 14 },
      { title: 'NICU Nurse Halloween Sweatshirt', monthlySales: 4 },
    ],
  }, { categoryId: 'shirt', eventId: 'halloween' })

  const byModifier = new Map(analysis.rows.map((row) => [row.modifier, row]))
  // The product and the event are the core, not modifiers.
  assert.equal(byModifier.has('shirt'), false)
  assert.equal(byModifier.has('halloween'), false)

  // "personalized" is exactly the word the built-in list asserts, so it has to be countable
  // rather than filtered out as a generic word before the count happens.
  assert.equal(byModifier.get('personalized').demandKeywords, 1)
  assert.equal(byModifier.get('personalized').supplyListings, 1)
  // A word neither side used must be absent, not present with a zero.
  assert.equal(byModifier.has('gift'), false)
  assert.equal(byModifier.has('from'), false)

  // Demand without supply is the opportunity the table exists to expose.
  assert.equal(byModifier.get('teacher').demandOnly, true)
  assert.ok(byModifier.get('teacher').gap > 0)
  assert.equal(byModifier.get('nicu').demandOnly, false)
})

test('learns people reasons scenes and modifiers without mixing their roles', () => {
  const analysis = analyzeMarketplaceVocabulary([
    {
      version: 2,
      runId: 'halloween-nicu-1',
      capturedAt: '2026-07-20T00:00:00Z',
      categoryId: 'shirt',
      eventId: 'halloween',
      identitySeeds: ['nicu nurse'],
      demandKeywords: [
        { keyword: 'funny nicu nurse halloween shirt', etsySearches30d: 320 },
        { keyword: 'nicu nurse appreciation shirt', etsySearches30d: 140 },
      ],
      supplyListings: [
        { title: 'Personalized NICU Nurse Halloween Shirt', monthlySales: 12 },
      ],
    },
  ], {
    categoryId: 'shirt',
    eventId: 'halloween',
    identitySeeds: 'nicu nurse',
    now: '2026-07-26T00:00:00Z',
  })

  const signals = new Map(analysis.rows.map((row) => [`${row.signalType}:${row.phrase}`, row]))
  assert.equal(signals.get('person:nicu nurse').demandKeywords, 2)
  assert.equal(signals.get('reason:appreciation').demandKeywords, 1)
  assert.equal(signals.get('scene:halloween').demandKeywords, 1)
  assert.equal(signals.get('modifier:funny').demandKeywords, 1)
  assert.equal(signals.get('modifier:personalized').supplyListings, 1)
})

test('assigns an observed phrase to one buyer role', () => {
  const analysis = analyzeMarketplaceVocabulary([{
    runId: 'graduation-1',
    capturedAt: '2026-07-20T00:00:00Z',
    categoryId: 'shirt',
    eventId: 'graduation',
    identitySeeds: ['grandma'],
    demandKeywords: [{ keyword: 'grandma graduation shirt', etsySearches30d: 90 }],
    supplyListings: [],
  }], {
    categoryId: 'shirt',
    eventId: 'graduation',
    identitySeeds: 'grandma',
    now: '2026-07-26T00:00:00Z',
  })

  const graduationRoles = analysis.rows
    .filter((row) => row.phrase === 'graduation')
    .map((row) => row.signalType)
  assert.deepEqual(graduationRoles, ['reason'])
})

test('treats a known hobby audience as a person signal instead of a modifier', () => {
  const analysis = analyzeMarketplaceVocabulary([{
    runId: 'book-club-1',
    capturedAt: '2026-07-20T00:00:00Z',
    categoryId: 'shirt',
    eventId: 'auto-discovery',
    identitySeeds: [],
    demandKeywords: [{ keyword: 'book club cat shirt', etsySearches30d: 180 }],
    supplyListings: [],
  }], {
    categoryId: 'shirt',
    eventId: 'auto-discovery',
    now: '2026-07-26T00:00:00Z',
  })

  assert.ok(analysis.rows.some((row) => row.signalType === 'person' && row.phrase === 'book club'))
  assert.equal(analysis.rows.some((row) => row.signalType === 'modifier' && row.phrase === 'book club'), false)
})

test('prefers vocabulary from the current market over a larger unrelated event', () => {
  const analysis = analyzeMarketplaceVocabulary([
    {
      version: 2,
      runId: 'halloween-1',
      capturedAt: '2026-07-20T00:00:00Z',
      categoryId: 'shirt',
      eventId: 'halloween',
      identitySeeds: ['nicu nurse'],
      demandKeywords: [{ keyword: 'spooky nicu nurse shirt', etsySearches30d: 80 }],
      supplyListings: [],
    },
    {
      version: 2,
      runId: 'christmas-1',
      capturedAt: '2026-07-20T00:00:00Z',
      categoryId: 'shirt',
      eventId: 'christmas',
      identitySeeds: ['dog mom'],
      demandKeywords: [{ keyword: 'retro dog mom christmas shirt', etsySearches30d: 9000 }],
      supplyListings: [],
    },
  ], {
    categoryId: 'shirt',
    eventId: 'halloween',
    identitySeeds: 'nicu nurse',
    now: '2026-07-26T00:00:00Z',
  })

  const learned = learnedBuyerIntentSignals(analysis, { limit: 1 })
  assert.equal(learned[0].phrase, 'spooky')
  assert.equal(learned[0].signalType, 'modifier')
  assert.equal(learned[0].contextLevel, 'identity')
})

test('keeps repeat observations across dates but deduplicates one saved run', () => {
  const base = {
    version: 2,
    categoryId: 'shirt',
    eventId: 'halloween',
    identitySeeds: ['nicu nurse'],
    demandKeywords: [{ keyword: 'spooky nicu nurse shirt', etsySearches30d: 80 }],
    supplyListings: [],
  }
  const analysis = analyzeMarketplaceVocabulary([
    { ...base, runId: 'run-1', capturedAt: '2026-07-20T00:00:00Z' },
    { ...base, runId: 'run-1', capturedAt: '2026-07-20T00:00:00Z' },
    { ...base, runId: 'run-2', capturedAt: '2026-07-25T00:00:00Z' },
  ], {
    categoryId: 'shirt',
    eventId: 'halloween',
    identitySeeds: 'nicu nurse',
    now: '2026-07-26T00:00:00Z',
  })

  const spooky = analysis.rows.find((row) => row.signalType === 'modifier' && row.phrase === 'spooky')
  assert.equal(spooky.demandKeywords, 2)
  assert.equal(spooky.observationRuns, 2)
})

test('applies learned vocabulary with grammar for each signal type', () => {
  const rows = generateBuyerIntentCandidates({
    identitySeeds: 'nicu nurse',
    categoryId: 'shirt',
    perIdentity: 40,
    learnedSignals: [
      { signalType: 'reason', phrase: 'appreciation' },
      { signalType: 'scene', phrase: 'halloween' },
      { signalType: 'modifier', phrase: 'spooky' },
    ],
  })
  const byKeyword = new Map(rows.map((row) => [row.keyword, row]))

  assert.equal(byKeyword.get('nicu nurse appreciation shirt').modifierEvidence, 'learned-reason')
  assert.equal(byKeyword.get('halloween nicu nurse shirt').modifierEvidence, 'learned-scene')
  assert.equal(byKeyword.get('spooky nicu nurse shirt').modifierEvidence, 'learned-modifier')
})

test('never promotes a measured modifier that carries someone else s trademark', () => {
  const analysis = analyzeModifierUsage({
    demandKeywords: [
      { keyword: 'summerween shirt', etsySearches30d: 5700 },
      { keyword: 'spooky season shirt', etsySearches30d: 2300 },
    ],
    supplyListings: [],
  }, { categoryId: 'shirt', eventId: 'halloween' })

  // Volume is precisely why a seller would reach for it, so the risk gate runs after the
  // measurement rather than being assumed away by it.
  assert.equal(analysis.rows[0].modifier, 'summerween')
  assert.equal(measuredModifierPhrases(analysis).includes('summerween'), false)
  assert.ok(measuredModifierPhrases(analysis).includes('spooky'))
})

test('marks whether a candidate rests on measured or assumed vocabulary', () => {
  const rows = generateBuyerIntentCandidates({
    identitySeeds: 'nicu nurse',
    categoryId: 'shirt',
    perIdentity: 40,
    measuredModifiers: ['spooky', 'book lover'],
  })
  const byKeyword = new Map(rows.map((row) => [row.keyword, row]))

  assert.equal(byKeyword.get('spooky nicu nurse shirt').modifierEvidence, 'measured')
  assert.equal(byKeyword.get('book lover nicu nurse shirt').modifierEvidence, 'measured')
  assert.equal(byKeyword.get('retro nicu nurse shirt').modifierEvidence, 'assumed')
  assert.equal(byKeyword.get('nicu nurse shirt').modifierEvidence, 'identity')

  // With no evidence yet the generator still works, and says so on every row.
  const noEvidence = generateBuyerIntentCandidates({ identitySeeds: 'nicu nurse', categoryId: 'shirt' })
  assert.equal(noEvidence.some((row) => row.modifierEvidence === 'measured'), false)
  assert.ok(noEvidence.every((row) => ['assumed', 'identity', 'operator'].includes(row.modifierEvidence)))
})

test('names the giver, because on Etsy the buyer is often not the wearer', () => {
  const nurse = generateBuyerIntentCandidates({ identitySeeds: 'nicu nurse', categoryId: 'shirt', perIdentity: 40 })
  const nurseKeywords = nurse.map((row) => row.keyword)
  // A colleague buying for a nurse types something the nurse would never type.
  assert.ok(nurseKeywords.includes('nicu nurse shirt from coworkers'))
  assert.ok(nurseKeywords.includes('nicu nurse shirt from patients'))
  assert.ok(nurseKeywords.includes('nicu nurse appreciation shirt'))

  const teacher = generateBuyerIntentCandidates({ identitySeeds: 'kindergarten teacher', categoryId: 'shirt', perIdentity: 40 })
  assert.ok(teacher.map((row) => row.keyword).includes('kindergarten teacher shirt from students'))

  const mom = generateBuyerIntentCandidates({ identitySeeds: 'dog mom', categoryId: 'shirt', perIdentity: 40 })
  const momKeywords = mom.map((row) => row.keyword)
  assert.ok(momKeywords.includes('dog mom shirt from daughter'))
  assert.ok(momKeywords.includes('dog mom shirt from the kids'))
})

test('keeps gift phrasing grammatical for the kind of identity it is attached to', () => {
  assert.equal(classifyBuyerIdentity('nicu nurse').kind, 'occupation')
  assert.equal(classifyBuyerIdentity('dog mom').kind, 'identity')
  assert.equal(classifyBuyerIdentity('crocheter').kind, 'hobby')
  // Not in the catalog, so shape has to carry it.
  assert.equal(classifyBuyerIdentity('handbell choir member').kind, 'hobby')
  assert.equal(classifyBuyerIdentity('my grandma').kind, 'identity')

  const nurse = generateBuyerIntentCandidates({ identitySeeds: 'nicu nurse', categoryId: 'shirt', perIdentity: 40 })
    .map((row) => row.keyword)
  const mom = generateBuyerIntentCandidates({ identitySeeds: 'dog mom', categoryId: 'shirt', perIdentity: 40 })
    .map((row) => row.keyword)

  // "for my dog mom" is how people search; "for my nicu nurse" is not.
  assert.ok(mom.includes('for my dog mom shirt'))
  assert.equal(nurse.includes('for my nicu nurse shirt'), false)
  // "nurse appreciation" is a real occasion; "dog mom appreciation" is not.
  assert.equal(mom.some((keyword) => keyword.includes('appreciation')), false)
  // A colleague giver makes no sense for a hobby, and a club does for an occupation.
  const crocheter = generateBuyerIntentCandidates({ identitySeeds: 'crocheter', categoryId: 'shirt', perIdentity: 40 })
    .map((keyword) => keyword.keyword)
  assert.ok(crocheter.includes('crocheter shirt from the club'))
  assert.equal(crocheter.includes('crocheter shirt from coworkers'), false)
})

test('marks the personalization price lever and the gift intent on every candidate', () => {
  const rows = generateBuyerIntentCandidates({ identitySeeds: 'nicu nurse', categoryId: 'shirt', perIdentity: 40 })
  const byKeyword = new Map(rows.map((row) => [row.keyword, row]))

  assert.equal(byKeyword.get('personalized nicu nurse shirt').personalizable, true)
  assert.equal(byKeyword.get('custom name nicu nurse shirt').personalizable, true)
  assert.equal(byKeyword.get('retro nicu nurse shirt').personalizable, false)

  assert.equal(byKeyword.get('gift for nicu nurse shirt').giftIntent, true)
  assert.equal(byKeyword.get('nicu nurse shirt from patients').giftIntent, true)
  assert.equal(byKeyword.get('retro nicu nurse shirt').giftIntent, false)

  // Personalization is a price lever, so it must not be a rarity in the output.
  assert.ok(rows.filter((row) => row.personalizable).length >= 4)
  assert.ok(rows.filter((row) => row.giftIntent).length >= 4)
})

test('applies the same risk and structure gates as the event generator', () => {
  const rows = generateBuyerIntentCandidates({
    identitySeeds: 'lord of the rings fan\nschool librarian',
    categoryId: 'shirt',
  })

  // An IP identity must not come back as ready to research.
  const ipRows = rows.filter((row) => row.keyword.includes('lord of the rings'))
  assert.ok(ipRows.every((row) => row.status === 'review' && row.riskTerms.length > 0))
  assert.ok(rows.some((row) => row.keyword.includes('school librarian') && row.status === 'ready'))
})

test('returns nothing when no identity is given rather than inventing one', () => {
  assert.deepEqual(generateBuyerIntentCandidates({ categoryId: 'shirt' }), [])
  assert.deepEqual(generateBuyerIntentCandidates({ identitySeeds: '   ', categoryId: 'shirt' }), [])
})

test('reports whether a new shop can compete with the reviews already on the page', () => {
  const easy = newcomerAccess({
    productRows: [
      { monthlySales: 10, reviews: 12 },
      { monthlySales: 8, reviews: 40 },
      { monthlySales: 5, reviews: 30 },
    ],
  })
  assert.equal(easy.hasReviewData, true)
  assert.equal(easy.medianSellerReviews, 30)
  assert.equal(easy.lowReviewSellerCount, 3)
  assert.equal(easy.lowReviewSellerShare, 1)

  const hard = newcomerAccess({
    productRows: [
      { monthlySales: 10, reviews: 900 },
      { monthlySales: 8, reviews: 480 },
      { monthlySales: 5, reviews: 12 },
    ],
  })
  assert.equal(hard.medianSellerReviews, 480)
  assert.equal(hard.lowReviewSellerCount, 1)

  // Listings that are not selling say nothing about how hard the top of the page is.
  const sellingOnly = newcomerAccess({
    productRows: [
      { monthlySales: 0, reviews: 1 },
      { monthlySales: 6, reviews: 300 },
    ],
  })
  assert.equal(sellingOnly.medianSellerReviews, 300)

  // Review data is optional: a capture without it must not invent a verdict.
  const missing = newcomerAccess({ productRows: [{ monthlySales: 6 }] })
  assert.equal(missing.hasReviewData, false)
  assert.equal(missing.medianSellerReviews, null)
})
