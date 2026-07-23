import assert from 'node:assert/strict'
import test from 'node:test'

import {
  deriveFinalEvidenceState,
  deriveFinalKeywordDecision,
  deriveFinalScoreState,
  finalEvidenceFilterMatches,
  formatEvidenceMetric,
  pendingEvidenceBatch,
} from '../src/final-evidence-matrix.js'

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

test('queues only the requested missing stage, without duplicates, up to twelve rows', () => {
  const rows = [
    { keyword: 'Ghost Shirt', evidenceState: { status: 'pending', nextStage: 'pending-erank' } },
    { keyword: 'ghost shirt', evidenceState: { status: 'pending', nextStage: 'pending-erank' } },
    { keyword: 'teacher shirt', evidenceState: { status: 'pending', nextStage: 'pending-etsy' } },
    ...Array.from({ length: 14 }, (_, index) => ({
      keyword: `niche ${index + 1}`,
      evidenceState: { status: 'pending', nextStage: 'pending-erank' },
    })),
  ]

  const batch = pendingEvidenceBatch(rows, 'pending-erank')
  assert.equal(batch.length, 12)
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
