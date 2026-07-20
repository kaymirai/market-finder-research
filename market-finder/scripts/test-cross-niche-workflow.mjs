import assert from 'node:assert/strict'
import test from 'node:test'

import {
  advanceCrossNicheWorkflow,
  createCrossNicheWorkflowState,
  isCrossNicheWorkflowPending,
} from '../src/cross-niche-workflow.js'

function candidate(keyword, depth = 1, priorityScore = 70) {
  return {
    keyword,
    parentKeyword: depth === 1 ? 'cat shirt' : 'book club cat shirt',
    modifier: keyword.replace(/ cat shirt$/, ''),
    depth,
    priorityScore,
    verdict: 'needs-research',
  }
}

test('automatically queues at most 12 unverified candidates and marks the pool considered', () => {
  const candidates = Array.from({ length: 15 }, (_, index) => candidate(`niche ${index + 1} cat shirt`, 1, 100 - index))
  const result = advanceCrossNicheWorkflow({
    workflow: createCrossNicheWorkflowState(),
    candidates,
    hasParents: true,
    stageForKeyword: () => 'pending-erank',
    now: '2026-07-20T10:00:00.000Z',
  })

  assert.equal(result.didQueue, true)
  assert.equal(result.workflow.status, 'pending-erank')
  assert.equal(result.workflow.round, 1)
  assert.equal(result.workflow.batch.length, 12)
  assert.equal(result.workflow.consideredKeywords.length, 15)
  assert.equal(result.workflow.queuedKeywords.length, 12)
})

test('skips fully verified candidates and resumes at the earliest remaining stage', () => {
  const verified = candidate('verified cat shirt', 1, 95)
  const etsyPending = candidate('book club cat shirt', 1, 90)
  const result = advanceCrossNicheWorkflow({
    workflow: createCrossNicheWorkflowState(),
    candidates: [verified, etsyPending],
    hasParents: true,
    stageForKeyword: (keyword) => keyword === verified.keyword ? 'done' : 'pending-etsy',
  })

  assert.equal(result.didQueue, true)
  assert.equal(result.workflow.status, 'pending-etsy')
  assert.deepEqual(result.workflow.batch.map((item) => item.keyword), [etsyPending.keyword])
})

test('keeps the earliest unfinished external verification stage for the active batch', () => {
  const workflow = createCrossNicheWorkflowState({
    status: 'pending-erank',
    round: 1,
    batch: [candidate('book club cat shirt'), candidate('teacher cat shirt')],
    consideredKeywords: ['book club cat shirt', 'teacher cat shirt'],
    queuedKeywords: ['book club cat shirt', 'teacher cat shirt'],
  })

  const etsy = advanceCrossNicheWorkflow({
    workflow,
    candidates: workflow.batch,
    hasParents: true,
    stageForKeyword: () => 'pending-etsy',
  })
  assert.equal(etsy.workflow.status, 'pending-etsy')
  assert.equal(etsy.didQueue, false)

  const everbee = advanceCrossNicheWorkflow({
    workflow: etsy.workflow,
    candidates: workflow.batch,
    hasParents: true,
    stageForKeyword: (keyword) => keyword.startsWith('book') ? 'done' : 'pending-everbee',
  })
  assert.equal(everbee.workflow.status, 'pending-everbee')
  assert.equal(isCrossNicheWorkflowPending(everbee.workflow), true)
})

test('queues only newly discovered depth-two candidates after the first batch completes', () => {
  const first = candidate('book club cat shirt', 1, 90)
  const resurfacedDepthOne = candidate('retro cat shirt', 1, 88)
  const second = candidate('librarian book club cat shirt', 2, 85)
  const workflow = createCrossNicheWorkflowState({
    status: 'pending-everbee',
    round: 1,
    batch: [first],
    consideredKeywords: [first.keyword],
    queuedKeywords: [first.keyword],
  })

  const result = advanceCrossNicheWorkflow({
    workflow,
    candidates: [first, resurfacedDepthOne, second],
    hasParents: true,
    stageForKeyword: (keyword) => keyword === first.keyword ? 'done' : 'pending-erank',
    now: '2026-07-20T11:00:00.000Z',
  })

  assert.equal(result.didQueue, true)
  assert.equal(result.workflow.round, 2)
  assert.deepEqual(result.workflow.batch.map((item) => item.keyword), [second.keyword])
  assert.deepEqual(result.workflow.queuedKeywords, [first.keyword, second.keyword])
})

test('completes after verified batches when no unconsidered candidates remain', () => {
  const first = candidate('book club cat shirt')
  const workflow = createCrossNicheWorkflowState({
    status: 'pending-everbee',
    round: 1,
    batch: [first],
    consideredKeywords: [first.keyword],
    queuedKeywords: [first.keyword],
  })

  const result = advanceCrossNicheWorkflow({
    workflow,
    candidates: [first],
    hasParents: true,
    stageForKeyword: () => 'done',
    now: '2026-07-20T12:00:00.000Z',
  })

  assert.equal(result.didQueue, false)
  assert.equal(result.workflow.status, 'complete')
  assert.equal(result.workflow.batch.length, 0)
  assert.equal(result.workflow.completedAt, '2026-07-20T12:00:00.000Z')
  assert.equal(isCrossNicheWorkflowPending(result.workflow), false)
})

test('stays idle when there is no saturated parent market', () => {
  const result = advanceCrossNicheWorkflow({
    workflow: createCrossNicheWorkflowState(),
    candidates: [],
    hasParents: false,
    stageForKeyword: () => 'done',
  })

  assert.equal(result.workflow.status, 'idle')
  assert.equal(result.didQueue, false)
})

test('restores only serializable workflow fields and valid pending status', () => {
  const restored = createCrossNicheWorkflowState({
    status: 'pending-etsy',
    round: '1',
    batch: [candidate('book club cat shirt')],
    consideredKeywords: ['Book Club Cat Shirt', '', 'book club cat shirt'],
    queuedKeywords: ['book club cat shirt'],
    startedAt: '2026-07-20T10:00:00.000Z',
  })

  assert.equal(restored.status, 'pending-etsy')
  assert.equal(restored.round, 1)
  assert.deepEqual(restored.consideredKeywords, ['book club cat shirt'])
  assert.equal(restored.batch[0].keyword, 'book club cat shirt')
})
