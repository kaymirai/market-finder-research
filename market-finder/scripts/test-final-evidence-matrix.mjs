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
  pendingEvidenceBatch,
  selectedResearchRoundKeywords,
} from '../src/final-evidence-matrix.js'

test('keeps empty generated rows out of evidence while retaining attempted and measured rows', () => {
  const emptyRows = Array.from({ length: 1000 }, (_, index) => ({
    keyword: `generated idea ${index + 1}`,
  }))
  const evidenceRows = [
    { keyword: 'measured phrase', erankCompetition: 4639 },
    { keyword: 'attempted phrase', erankAttemptedAt: '2026-07-24T00:00:00.000Z' },
    { keyword: 'failed phrase', error: '取得失敗' },
    { keyword: 'sales phrase', productRows: [{ title: 'Listing' }] },
  ]

  assert.equal(emptyRows.filter(hasCollectedEvidence).length, 0)
  assert.deepEqual(
    evidenceRows.filter(hasCollectedEvidence).map((row) => row.keyword),
    ['measured phrase', 'attempted phrase', 'failed phrase', 'sales phrase'],
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
