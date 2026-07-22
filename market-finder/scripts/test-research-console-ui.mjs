import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createResearchConsoleUi,
  deriveResearchStageStates,
  selectResearchQueueFilter,
  selectResearchStage,
} from '../src/research-console-ui.js'

test('restores only known stage and queue values', () => {
  assert.deepEqual(createResearchConsoleUi({ activeStage: 'etsy', queueFilter: 'failed' }), {
    activeStage: 'etsy',
    queueFilter: 'failed',
    selectedKeyword: '',
  })
  assert.equal(createResearchConsoleUi({ activeStage: 'unknown' }).activeStage, 'conditions')
})

test('selects stage and queue filter without mutating input', () => {
  const initial = createResearchConsoleUi()
  const selected = selectResearchQueueFilter(selectResearchStage(initial, 'erank'), 'completed')
  assert.equal(initial.activeStage, 'conditions')
  assert.deepEqual(selected, { activeStage: 'erank', queueFilter: 'completed', selectedKeyword: '' })
})

test('derives progress, review, complete, and available states', () => {
  const stages = deriveResearchStageStates({
    candidateCount: 20,
    readyCandidateCount: 14,
    erankResultCount: 16,
    erankFailureCount: 3,
    erankPendingCount: 0,
    etsyEligibleCount: 14,
    etsyCompletedCount: 0,
    etsyPendingCount: 14,
    everbeeResultCount: 0,
    activeService: 'etsy',
  })
  assert.equal(stages.find((item) => item.id === 'conditions').status, 'complete')
  assert.equal(stages.find((item) => item.id === 'erank').status, 'review')
  assert.equal(stages.find((item) => item.id === 'etsy').status, 'progress')
  assert.equal(stages.find((item) => item.id === 'results').status, 'locked')
})
