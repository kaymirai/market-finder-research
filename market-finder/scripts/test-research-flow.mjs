import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildEtsyCandidatesFromPool,
  buildEtsyCandidatesFromErank,
  extensionResultsImportMode,
  marketplaceCompletedKeywords,
  shouldDiscardMarketplacePlan,
} from '../src/research-flow.js'

test('builds Etsy candidates only from usable eRank results', () => {
  const rows = [
    {
      keyword: 'retro ghost shirt',
      erankOpportunity: { action: 'everbee', score: 82 },
      score: { riskTerms: [], exclusionReasons: [] },
    },
    {
      keyword: 'cute ghost shirt',
      erankOpportunity: { action: 'expand', score: 64 },
      score: { riskTerms: [], exclusionReasons: [] },
    },
    {
      keyword: 'weak ghost shirt',
      erankOpportunity: { action: 'reject', score: 12 },
      score: { riskTerms: [], exclusionReasons: [] },
    },
    {
      keyword: 'brand ghost shirt',
      erankOpportunity: { action: 'everbee', score: 90 },
      score: { riskTerms: ['brand'], exclusionReasons: [] },
    },
  ]
  const candidates = [
    { keyword: 'retro ghost shirt', discoveryLane: 'aesthetic', queryStrategy: 'direct' },
    { keyword: 'cute ghost shirt', discoveryLane: 'motif', queryStrategy: 'adjacent' },
  ]

  assert.deepEqual(buildEtsyCandidatesFromErank(rows, candidates), [
    {
      keyword: 'retro ghost shirt',
      query: 'retro ghost shirt',
      discoveryLane: 'aesthetic',
      queryStrategy: 'direct',
      opportunityIndex: 82,
    },
    {
      keyword: 'cute ghost shirt',
      query: 'cute ghost shirt',
      discoveryLane: 'motif',
      queryStrategy: 'adjacent',
      opportunityIndex: 64,
    },
  ])
})

test('deduplicates normalized eRank keywords and keeps the stronger row', () => {
  const rows = [
    {
      keyword: 'Retro   Ghost Shirt',
      erankOpportunity: { action: 'expand', score: 65 },
      score: { riskTerms: [], exclusionReasons: [] },
    },
    {
      keyword: 'retro ghost shirt',
      erankOpportunity: { action: 'everbee', score: 84 },
      score: { riskTerms: [], exclusionReasons: [] },
    },
  ]

  assert.deepEqual(buildEtsyCandidatesFromErank(rows, []), [{
    keyword: 'retro ghost shirt',
    query: 'retro ghost shirt',
    discoveryLane: 'baseline',
    queryStrategy: 'direct',
    opportunityIndex: 84,
  }])
})

test('carries event track and cross-event history into the Etsy queue', () => {
  const rows = [{
    keyword: 'teacher shirt',
    erankOpportunity: { action: 'everbee', score: 82 },
    score: { riskTerms: [], exclusionReasons: [] },
  }]
  const candidates = [{
    keyword: 'teacher shirt',
    discoveryLane: 'audience',
    queryStrategy: 'adjacent',
    intentTrack: 'evergreen-adjacent',
    historyClusterKey: 'teacher',
    previouslyResearchedElsewhere: true,
    priorEventIds: ['halloween'],
  }]

  assert.deepEqual(buildEtsyCandidatesFromErank(rows, candidates), [{
    keyword: 'teacher shirt',
    query: 'teacher shirt',
    discoveryLane: 'audience',
    queryStrategy: 'adjacent',
    intentTrack: 'evergreen-adjacent',
    historyClusterKey: 'teacher',
    previouslyResearchedElsewhere: true,
    priorEventIds: ['halloween'],
    opportunityIndex: 82,
  }])
})

test('keeps a new market ahead of a stronger evergreen cluster already checked in another event', () => {
  const rows = [
    {
      keyword: 'teacher shirt',
      erankOpportunity: { action: 'everbee', score: 90 },
      score: { riskTerms: [], exclusionReasons: [] },
    },
    {
      keyword: 'candy cane shirt',
      erankOpportunity: { action: 'everbee', score: 80 },
      score: { riskTerms: [], exclusionReasons: [] },
    },
  ]
  const candidates = [
    { keyword: 'teacher shirt', previouslyResearchedElsewhere: true },
    { keyword: 'candy cane shirt', previouslyResearchedElsewhere: false },
  ]

  assert.deepEqual(
    buildEtsyCandidatesFromErank(rows, candidates).map((candidate) => candidate.keyword),
    ['candy cane shirt', 'teacher shirt'],
  )
})

test('uses within-research demand and competition only to reprioritize qualified candidates', () => {
  const rows = [
    {
      keyword: 'steady ghost shirt',
      erankOpportunity: {
        action: 'everbee',
        score: 80,
        normalized: {
          erankSearchVolume: 100,
          erankClicks: 80,
          erankCompetition: 5000,
          erankKeywordDifficulty: 30,
        },
      },
      score: { riskTerms: [], exclusionReasons: [] },
    },
    {
      keyword: 'strong niche ghost shirt',
      erankOpportunity: {
        action: 'everbee',
        score: 78,
        normalized: {
          erankSearchVolume: 400,
          erankClicks: 300,
          erankCompetition: 1000,
          erankKeywordDifficulty: 20,
        },
      },
      score: { riskTerms: [], exclusionReasons: [] },
    },
    {
      keyword: 'weak niche ghost shirt',
      erankOpportunity: {
        action: 'expand',
        score: 76,
        normalized: {
          erankSearchVolume: 20,
          erankClicks: 15,
          erankCompetition: 20000,
          erankKeywordDifficulty: 50,
        },
      },
      score: { riskTerms: [], exclusionReasons: [] },
    },
  ]

  const result = buildEtsyCandidatesFromErank(rows, [])

  assert.deepEqual(result.map((candidate) => candidate.keyword), [
    'strong niche ghost shirt',
    'steady ghost shirt',
    'weak niche ghost shirt',
  ])
  assert.deepEqual(result.map(({ cohortIndex, priorityIndex }) => ({ cohortIndex, priorityIndex })), [
    { cohortIndex: 100, priorityIndex: 84 },
    { cohortIndex: 50, priorityIndex: 73 },
    { cohortIndex: 0, priorityIndex: 57 },
  ])
})

test('excludes missing eRank metrics from the cohort comparison', () => {
  const rows = [
    {
      keyword: 'smaller demand ghost shirt',
      erankOpportunity: {
        action: 'everbee',
        score: 80,
        normalized: {
          erankSearchVolume: 100,
          erankClicks: 80,
          erankCompetition: null,
          erankKeywordDifficulty: null,
        },
      },
      score: { riskTerms: [], exclusionReasons: [] },
    },
    {
      keyword: 'larger demand ghost shirt',
      erankOpportunity: {
        action: 'everbee',
        score: 78,
        normalized: {
          erankSearchVolume: 200,
          erankClicks: 160,
          erankCompetition: null,
          erankKeywordDifficulty: null,
        },
      },
      score: { riskTerms: [], exclusionReasons: [] },
    },
  ]

  const result = buildEtsyCandidatesFromErank(rows, [])
  assert.deepEqual(result.map(({ cohortIndex }) => cohortIndex), [100, 0])
})

test('lets safe hold candidates with measured demand reach Etsy official verification', () => {
  const rows = [{
    keyword: 'small demand ghost shirt',
    erankOpportunity: {
      action: 'hold',
      score: 28,
      normalized: {
        erankSearchVolume: 18,
        erankClicks: 7,
        erankCompetition: 12000,
        erankKeywordDifficulty: 48,
      },
    },
    score: { riskTerms: [], exclusionReasons: [] },
  }]

  assert.deepEqual(buildEtsyCandidatesFromErank(rows, []), [{
    keyword: 'small demand ghost shirt',
    query: 'small demand ghost shirt',
    discoveryLane: 'baseline',
    queryStrategy: 'direct',
    opportunityIndex: 28,
    officialProbe: true,
  }])
})

test('does not send rejected or risky hold candidates to Etsy official verification', () => {
  const rows = [
    {
      keyword: 'zero demand ghost shirt',
      erankOpportunity: {
        action: 'reject',
        score: 0,
        normalized: { erankSearchVolume: 0, erankClicks: 0 },
      },
      score: { riskTerms: [], exclusionReasons: [] },
    },
    {
      keyword: 'brand ghost shirt',
      erankOpportunity: {
        action: 'hold',
        score: 28,
        normalized: { erankSearchVolume: 18, erankClicks: 7 },
      },
      score: { riskTerms: ['brand'], exclusionReasons: [] },
    },
  ]

  assert.deepEqual(buildEtsyCandidatesFromErank(rows, []), [])
})

test('does not send rank-number artifacts to Etsy official verification', () => {
  const candidates = [
    { keyword: '1 4 nicu nurse shirt', status: 'ready' },
    { keyword: '4th grade teacher shirt', status: 'ready' },
    { keyword: '2026 halloween shirt', status: 'ready' },
    { keyword: 'nicu nurse halloween shirt', status: 'ready' },
  ]

  assert.deepEqual(
    buildEtsyCandidatesFromPool(candidates).map((candidate) => candidate.keyword),
    [
      '2026 halloween shirt',
      '4th grade teacher shirt',
      'nicu nurse halloween shirt',
    ],
  )
})

test('does not reuse final sales-stage freshness exclusions for Etsy verification candidates', () => {
  const rows = [{
    keyword: 'cat meme shirt',
    erankOpportunity: {
      action: 'everbee',
      score: 71,
      normalized: {
        erankSearchVolume: 1388,
        erankClicks: 1669,
        erankCompetition: 21396,
        erankKeywordDifficulty: 59,
      },
    },
    score: {
      riskTerms: [],
      exclusionReasons: ['需要・供給データまたはEverBeeの取得日が期限超過または不明'],
    },
  }]

  assert.equal(buildEtsyCandidatesFromErank(rows, []).length, 1)
})

test('restores completed extension results only when the page has no local results', () => {
  const completed = { active: false, results: [{ keyword: 'ghost shirt' }] }

  assert.equal(extensionResultsImportMode(completed, [], false), 'restore')
  assert.equal(extensionResultsImportMode(completed, [{ keyword: 'local shirt' }], false), 'ignore')
  assert.equal(extensionResultsImportMode(completed, [], true), 'current')
})

test('imports active extension results as the current research run', () => {
  assert.equal(extensionResultsImportMode({
    active: true,
    results: [{ keyword: 'ghost shirt' }],
  }, [], false), 'current')
  assert.equal(extensionResultsImportMode({ active: false, results: [] }, [], false), 'ignore')
})

test('prioritizes completed Etsy queries and related metrics for EverBee', () => {
  const plan = {
    items: [
      {
        query: 'retro ghost shirt',
        status: 'completed',
        result: {
          etsySearches30d: 80,
          etsyListings: 1200,
          etsyRelatedKeywordMetrics: [
            { keyword: 'small ghost shirt', etsySearches30d: 12, etsyListings: 90 },
            { keyword: 'cute retro ghost shirt', etsySearches30d: 35, etsyListings: 420 },
          ],
        },
      },
      {
        query: 'pending ghost shirt',
        status: 'planned',
        result: { etsySearches30d: 100, etsyListings: 100 },
      },
    ],
  }

  assert.deepEqual(marketplaceCompletedKeywords(plan), [
    'retro ghost shirt',
    'cute retro ghost shirt',
    'small ghost shirt',
  ])
})

test('ignores completed Etsy items without captured metrics', () => {
  assert.deepEqual(marketplaceCompletedKeywords({
    items: [{ query: 'empty ghost shirt', status: 'completed', result: {} }],
  }), [])
})

test('discards only legacy planned Etsy queues that have no eRank or captured evidence', () => {
  const plannedOnly = { items: [{ query: 'halloween shirt', status: 'planned' }] }
  const captured = {
    items: [{
      query: 'retro ghost shirt',
      status: 'completed',
      result: { etsySearches30d: 80, etsyListings: 1200 },
    }],
  }

  assert.equal(shouldDiscardMarketplacePlan(plannedOnly, []), true)
  assert.equal(shouldDiscardMarketplacePlan(plannedOnly, [{ keyword: 'retro ghost shirt' }]), false)
  assert.equal(shouldDiscardMarketplacePlan(captured, []), false)
})
