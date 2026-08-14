import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildFinalEvidenceKeywordPool,
  deriveFinalEvidenceState,
  deriveFinalKeywordDecision,
  deriveFinalScoreState,
  finalEvidenceFilterMatches,
  formatEvidenceMetric,
  hasCollectedEvidence,
  isAutomatableEvidenceRow,
  isEtsyEvidenceChecked,
  limitFinalEvidenceRows,
  pendingEvidenceBatch,
  sanitizeLegacyMarketplaceInsightRow,
  selectEtsyConfirmationKeywords,
  selectedResearchRoundKeywords,
  shouldExcludeFinalEvidenceRow,
  toggleFinalEvidenceSelection,
  verificationStageForRow,
} from '../src/final-evidence-matrix.js'

test('closes an expanded evidence row when its detail button is clicked again', () => {
  assert.equal(toggleFinalEvidenceSelection('paramedic|shirt|halloween', 'paramedic|shirt|halloween'), '')
  assert.equal(toggleFinalEvidenceSelection('', 'paramedic|shirt|halloween'), 'paramedic|shirt|halloween')
  assert.equal(toggleFinalEvidenceSelection('nurse|shirt|halloween', 'paramedic|shirt|halloween'), 'paramedic|shirt|halloween')
})

test('limits the initial evidence table render while preserving the total count', () => {
  const rows = Array.from({ length: 368 }, (_, index) => ({ keyword: `keyword ${index + 1}` }))

  assert.deepEqual(limitFinalEvidenceRows(rows, 40), {
    rows: rows.slice(0, 40),
    total: 368,
    shown: 40,
    hasMore: true,
  })
  assert.deepEqual(limitFinalEvidenceRows(rows.slice(0, 12), 40), {
    rows: rows.slice(0, 12),
    total: 12,
    shown: 12,
    hasMore: false,
  })
})

test('keeps empty and attempt-only rows out of evidence while retaining measured and failed rows', () => {
  const emptyRows = Array.from({ length: 1000 }, (_, index) => ({
    keyword: `generated idea ${index + 1}`,
  }))
  const evidenceRows = [
    { keyword: 'measured phrase', erankCompetition: 4639 },
    {
      keyword: 'failed phrase',
      erankAttemptedAt: '2026-07-24T00:00:00.000Z',
      erankCaptureStatus: 'failed',
    },
    { keyword: 'failed phrase', error: '取得失敗' },
    { keyword: 'sales phrase', productRows: [{ title: 'Listing' }] },
  ]

  assert.equal(emptyRows.filter(hasCollectedEvidence).length, 0)
  assert.equal(hasCollectedEvidence({
    keyword: 'attempted phrase',
    erankAttemptedAt: '2026-07-24T00:00:00.000Z',
  }), false)
  assert.deepEqual(
    evidenceRows.filter(hasCollectedEvidence).map((row) => row.keyword),
    ['measured phrase', 'failed phrase', 'failed phrase', 'sales phrase'],
  )
})

test('bounds accumulated round selections to the latest batch in each research lane', () => {
  const result = selectedResearchRoundKeywords([
    {
      type: 'initial',
      candidateKeywords: Array.from({ length: 120 }, (_, index) => `initial ${index + 1}`),
    },
    {
      type: 'cross-niche',
      candidateKeywords: Array.from({ length: 80 }, (_, index) => `cross one ${index + 1}`),
    },
    {
      type: 'cross-niche',
      candidateKeywords: Array.from({ length: 90 }, (_, index) => `cross two ${index + 1}`),
    },
  ], {
    initialLimit: 20,
    crossNicheLimit: 12,
  })

  assert.equal(result.length, 44)
  assert.equal(result.includes('initial 100'), false)
  assert.equal(result.includes('initial 101'), true)
  assert.equal(result.includes('cross one 68'), false)
  assert.equal(result.includes('cross one 69'), true)
  assert.equal(result.includes('cross two 79'), true)
})

test('keeps generated ideas out of the final verification queue until they are selected', () => {
  const catalog = Array.from({ length: 1000 }, (_, index) => `idea ${index + 1}`)
  const selected = catalog.slice(0, 20)
  const result = buildFinalEvidenceKeywordPool({
    evidenceKeywords: ['measured keyword'],
    selectedKeywords: selected,
    fallbackKeywords: catalog,
    hasSelection: true,
    fallbackLimit: 20,
  })

  assert.equal(result.length, 21)
  assert.equal(result.includes('measured keyword'), true)
  assert.equal(result.includes('idea 20'), true)
  assert.equal(result.includes('idea 21'), false)
})

test('uses only a bounded fallback when older saved research has no selected round', () => {
  const catalog = Array.from({ length: 1000 }, (_, index) => `legacy idea ${index + 1}`)
  const result = buildFinalEvidenceKeywordPool({
    evidenceKeywords: [],
    selectedKeywords: [],
    fallbackKeywords: catalog,
    hasSelection: false,
    fallbackLimit: 20,
  })

  assert.equal(result.length, 20)
  assert.equal(result.at(-1), 'legacy idea 20')
})

test('keeps every unfinished verification stage actionable', () => {
  assert.deepEqual(deriveFinalEvidenceState({ nextStage: 'pending-erank' }), {
    status: 'pending',
    label: '検証待ち',
    nextStage: 'pending-erank',
    actionLabel: 'eRankを確認',
    terminal: false,
  })
  assert.equal(deriveFinalEvidenceState({ nextStage: 'pending-etsy' }).actionLabel, 'Etsy公式を確認')
  assert.equal(deriveFinalEvidenceState({ nextStage: 'pending-everbee' }).actionLabel, 'EverBeeを確認')
})

test('treats an eRank Unknown response as a checked terminal hold', () => {
  assert.deepEqual(deriveFinalEvidenceState({ nextStage: 'done', erankStatus: 'no-data' }), {
    status: 'hold',
    label: '需要Unknown・保留',
    nextStage: '',
    actionLabel: '',
    terminal: true,
  })
})

test('keeps Etsy and EverBee verified evidence final when optional eRank has no data', () => {
  assert.equal(deriveFinalEvidenceState({
    nextStage: 'done',
    hasEverbeeData: true,
    erankStatus: 'no-data',
  }).status, 'verified')
})

test('distinguishes verified, excluded, and failed terminal outcomes', () => {
  assert.equal(deriveFinalEvidenceState({ nextStage: 'done', hasEverbeeData: true }).status, 'verified')
  assert.equal(deriveFinalEvidenceState({ nextStage: 'done', excluded: true }).status, 'excluded')
  const failed = deriveFinalEvidenceState({
    nextStage: 'done',
    erankStatus: 'failed',
    failureStage: 'pending-erank',
  })
  assert.equal(failed.status, 'failed')
  assert.equal(failed.actionLabel, '再試行')
  assert.equal(failed.nextStage, 'pending-erank')
  assert.equal(failed.terminal, true)
})

test('never presents exploration priority as a final opportunity score', () => {
  assert.deepEqual(deriveFinalScoreState({ candidateStage: 'idea', explorationPriority: 80 }), {
    type: 'pending',
    label: '採点前',
    score: null,
    explorationPriority: 80,
  })
  assert.deepEqual(deriveFinalScoreState({ candidateStage: 'demand-checked', score: 53 }), {
    type: 'reference',
    label: '参考点 53',
    score: 53,
    explorationPriority: null,
  })
  assert.deepEqual(deriveFinalScoreState({ candidateStage: 'sales-checked', score: 71 }), {
    type: 'overall',
    label: '71',
    score: 71,
    explorationPriority: null,
  })
})

test('formats zero, Unknown, and uncollected metrics as different values', () => {
  assert.deepEqual(formatEvidenceMetric(0, { checked: true }), { kind: 'value', text: '0' })
  assert.deepEqual(formatEvidenceMetric('', { checked: true }), { kind: 'unknown', text: 'Unknown' })
  assert.deepEqual(formatEvidenceMetric(null, { checked: false }), { kind: 'pending', text: '未取得' })
  assert.deepEqual(formatEvidenceMetric(13, { checked: true, suffix: '%' }), { kind: 'value', text: '13%' })
})

test('queues only the requested missing stage, without duplicates, up to fifty rows', () => {
  const rows = [
    { keyword: 'Ghost Shirt', evidenceState: { status: 'pending', nextStage: 'pending-erank' } },
    { keyword: 'ghost shirt', evidenceState: { status: 'pending', nextStage: 'pending-erank' } },
    { keyword: 'teacher shirt', evidenceState: { status: 'pending', nextStage: 'pending-etsy' } },
    ...Array.from({ length: 64 }, (_, index) => ({
      keyword: `niche ${index + 1}`,
      evidenceState: { status: 'pending', nextStage: 'pending-erank' },
    })),
  ]

  const batch = pendingEvidenceBatch(rows, 'pending-erank')
  assert.equal(batch.length, 50)
  assert.equal(batch[0].keyword, 'Ghost Shirt')
  assert.equal(batch.some((row) => row.keyword === 'teacher shirt'), false)
})

test('keeps graph dates and non-candidate phrases out of automatic evidence verification', () => {
  const rows = [
    {
      keyword: 'nicu nurse halloween shirt',
      evidenceState: { status: 'pending', nextStage: 'pending-everbee' },
      normalized: { candidateClass: { action: 'candidate' } },
      candidateStage: 'demand-checked',
    },
    {
      keyword: 'jul 10',
      evidenceState: { status: 'pending', nextStage: 'pending-everbee' },
      normalized: { candidateClass: { action: 'explore' } },
      candidateStage: 'reject',
    },
    {
      keyword: 'daily searches',
      evidenceState: { status: 'pending', nextStage: 'pending-everbee' },
      normalized: { candidateClass: { action: 'explore' } },
      candidateStage: 'demand-checked',
    },
    {
      keyword: 'unsupported celebrity shirt',
      evidenceState: { status: 'pending', nextStage: 'pending-everbee' },
      normalized: { candidateClass: { action: 'reject' } },
      candidateStage: 'reject',
    },
  ]

  assert.deepEqual(
    pendingEvidenceBatch(rows, 'pending-everbee').map((row) => row.keyword),
    ['nicu nurse halloween shirt'],
  )
})

test('keeps measured broad entry phrases eligible for the next automatic evidence stage', () => {
  assert.equal(isAutomatableEvidenceRow({
    keyword: 'halloween shirt',
    normalized: {
      candidateClass: { action: 'explore' },
      etsySearches30d: 66900,
      etsyListings: 597500,
    },
    candidateStage: 'demand-checked',
  }), true)

  assert.equal(isAutomatableEvidenceRow({
    keyword: 'daily searches',
    normalized: { candidateClass: { action: 'explore' } },
    candidateStage: 'demand-checked',
  }), false)

  assert.equal(isAutomatableEvidenceRow({
    keyword: 'halloween sweatshirt',
    normalized: {
      candidateClass: { action: 'reject' },
      etsySearches30d: 14500,
      etsyListings: 225600,
    },
    candidateStage: 'reject',
  }), false)
})

test('excludes a rejected product mismatch without spending an EverBee lookup', () => {
  assert.equal(shouldExcludeFinalEvidenceRow({
    candidateStage: 'reject',
    hasEverbeeData: false,
    opportunityLabel: '',
  }), true)

  assert.equal(shouldExcludeFinalEvidenceRow({
    candidateStage: 'demand-checked',
    hasEverbeeData: false,
    opportunityLabel: '',
  }), false)
})

test('removes legacy 30-day label artifacts while preserving versioned real values', () => {
  const legacy = sanitizeLegacyMarketplaceInsightRow({
    keyword: 'halloween sewing shirt',
    etsySearches30d: 30,
    etsyListings: 30,
    etsyCheckedAt: '2026-07-27T00:00:00.000Z',
    notes: 'Etsy Marketplace Insights / 直近30日',
  })
  assert.equal(legacy.etsySearches30d, null)
  assert.equal(legacy.etsyListings, null)
  assert.equal(legacy.etsyCheckedAt, '')

  const incompleteLegacy = sanitizeLegacyMarketplaceInsightRow({
    keyword: 'halloween knitting shirt',
    etsySearches30d: 30,
    etsyListings: null,
    etsyCheckedAt: '2026-07-27T00:00:00.000Z',
  })
  assert.equal(incompleteLegacy.etsySearches30d, null)
  assert.equal(incompleteLegacy.etsyCheckedAt, '')

  const current = sanitizeLegacyMarketplaceInsightRow({
    keyword: 'real thirty shirt',
    etsySearches30d: 30,
    etsyListings: 30,
    etsyCheckedAt: '2026-07-27T00:00:00.000Z',
    etsyMetricCaptureVersion: 2,
  })
  assert.equal(current.etsySearches30d, 30)
  assert.equal(current.etsyListings, 30)
  assert.equal(current.etsyCheckedAt, '2026-07-27T00:00:00.000Z')
})

test('uses EverBee first for continuous niches and confirms only selling candidates on Etsy', () => {
  assert.equal(verificationStageForRow({
    queryStrategy: 'cross-niche',
    hasEverbeeData: false,
    hasEtsyData: false,
    etsyChecked: false,
    eligibleForEtsy: true,
  }), 'pending-everbee')

  assert.equal(verificationStageForRow({
    queryStrategy: 'cross-niche',
    hasEverbeeData: true,
    hasEtsyData: false,
    etsyChecked: false,
    eligibleForEtsy: true,
    selectedForEtsyConfirmation: true,
  }), 'pending-etsy')

  assert.equal(verificationStageForRow({
    queryStrategy: 'cross-niche',
    hasEverbeeData: true,
    hasEtsyData: false,
    etsyChecked: false,
    eligibleForEtsy: true,
    selectedForEtsyConfirmation: false,
  }), 'done')
})

test('does not treat skipped or failed Etsy plan items as captured evidence', () => {
  assert.equal(isEtsyEvidenceChecked({}, { status: 'skipped' }), false)
  assert.equal(isEtsyEvidenceChecked({}, { status: 'error' }), false)
  assert.equal(isEtsyEvidenceChecked({}, { status: 'completed', result: {} }), false)
  assert.equal(isEtsyEvidenceChecked({}, {
    status: 'completed',
    result: { etsySearches30d: 120 },
  }), true)
  assert.equal(isEtsyEvidenceChecked({
    etsyCheckedAt: '2026-07-27T00:00:00.000Z',
    etsyListings: 900,
  }), true)
})

test('prioritizes low-competition EverBee sellers for limited Etsy confirmation', () => {
  const selected = selectEtsyConfirmationKeywords([
    {
      keyword: 'halloween sewing shirt',
      sellingListingCount: 11,
      recentSellingListingCount: 3,
      listingsAnalyzed: 915,
      medianMonthlySales: 5.5,
      topSalesShare: 0.5,
    },
    {
      keyword: 'halloween saturated shirt',
      sellingListingCount: 20,
      recentSellingListingCount: 10,
      listingsAnalyzed: 60000,
      medianMonthlySales: 8,
      topSalesShare: 0.4,
    },
    {
      keyword: 'halloween no sales shirt',
      sellingListingCount: 0,
      recentSellingListingCount: 0,
      listingsAnalyzed: 200,
      medianMonthlySales: 0,
      topSalesShare: 0,
    },
    {
      keyword: 'halloween pottery shirt',
      sellingListingCount: 3,
      recentSellingListingCount: 2,
      listingsAnalyzed: 103,
      medianMonthlySales: 0,
      topSalesShare: 0.6,
    },
  ], 8)

  assert.deepEqual(selected, ['halloween pottery shirt', 'halloween sewing shirt'])
})

test('filters recommendations separately from verification states', () => {
  const verifiedA = { evidenceState: { status: 'verified' }, opportunityLabel: 'A' }
  const verifiedC = { evidenceState: { status: 'verified' }, opportunityLabel: 'C' }
  const pending = { evidenceState: { status: 'pending' }, opportunityLabel: '' }
  assert.equal(finalEvidenceFilterMatches(verifiedA, 'recommended'), true)
  assert.equal(finalEvidenceFilterMatches(verifiedC, 'recommended'), false)
  assert.equal(finalEvidenceFilterMatches(pending, 'pending'), true)
  assert.equal(finalEvidenceFilterMatches(pending, 'all'), true)
})

test('names one verified A or B keyword as the primary keyword to use', () => {
  const decision = deriveFinalKeywordDecision([
    {
      keyword: 'retro ghost teacher shirt',
      evidenceState: { status: 'verified' },
      opportunityLabel: 'B',
      scoreState: { score: 88 },
    },
    {
      keyword: 'halloween nurse ghost shirt',
      evidenceState: { status: 'verified' },
      opportunityLabel: 'A',
      scoreState: { score: 74 },
    },
    {
      keyword: 'gothic bat teacher shirt',
      evidenceState: { status: 'verified' },
      opportunityLabel: 'A',
      scoreState: { score: 69 },
    },
  ])

  assert.equal(decision.status, 'ready')
  assert.equal(decision.primaryKeyword, 'halloween nurse ghost shirt')
  assert.equal(decision.primaryLabel, 'A')
  assert.deepEqual(decision.alternatives, ['gothic bat teacher shirt', 'retro ghost teacher shirt'])
  assert.equal(decision.recommendedCount, 3)
  assert.deepEqual(decision.recommendedKeywords.map((item) => item.keyword), ['halloween nurse ghost shirt', 'gothic bat teacher shirt', 'retro ghost teacher shirt'])
  assert.deepEqual(decision.gradeCounts, { A: 2, B: 1, C: 0, D: 0 })
})

test('does not count a verified title-like row as an A/B production candidate', () => {
  const decision = deriveFinalKeywordDecision([{
    keyword: 'short buyer shirt',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'B',
    queryEligibility: { eligible: true },
  }, {
    keyword: 'long listing title with many unrelated product words shirt',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'A',
    queryEligibility: { eligible: false, status: 'title-like' },
  }])

  assert.equal(decision.recommendedCount, 1)
  assert.deepEqual(decision.recommendedKeywords.map((row) => row.keyword), ['short buyer shirt'])
})

test('does not pretend to recommend a keyword while verification remains', () => {
  const decision = deriveFinalKeywordDecision([
    {
      keyword: 'halloween ghost shirt',
      evidenceState: { status: 'pending' },
      opportunityLabel: '',
      scoreState: { score: null },
    },
    {
      keyword: 'cat shirt',
      evidenceState: { status: 'verified' },
      opportunityLabel: 'C',
      scoreState: { score: 53 },
    },
  ])

  assert.equal(decision.status, 'pending')
  assert.equal(decision.primaryKeyword, '')
  assert.equal(decision.pendingCount, 1)
})

test('separates retryable failures from pending automatic verification', () => {
  const decision = deriveFinalKeywordDecision([
    {
      keyword: 'halloween nurse shirt',
      evidenceState: { status: 'failed', nextStage: 'pending-everbee' },
      opportunityLabel: '',
      scoreState: { score: null },
    },
  ])

  assert.equal(decision.status, 'retry')
  assert.equal(decision.pendingCount, 0)
  assert.equal(decision.actionablePendingCount, 0)
  assert.equal(decision.failedCount, 1)
})
test('clearly rejects the batch when verification is finished without an A or B keyword', () => {
  const decision = deriveFinalKeywordDecision([
    {
      keyword: 'cat shirt',
      evidenceState: { status: 'verified' },
      opportunityLabel: 'C',
      scoreState: { score: 53 },
    },
    {
      keyword: 'generic halloween shirt',
      evidenceState: { status: 'excluded' },
      opportunityLabel: 'D',
      scoreState: { score: 24 },
    },
  ])

  assert.equal(decision.status, 'none')
  assert.equal(decision.primaryKeyword, '')
  assert.equal(decision.pendingCount, 0)
})
