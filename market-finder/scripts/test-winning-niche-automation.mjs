import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildNextWinningNicheBatch,
  createWinningNicheAutomation,
  evaluateWinningNicheRows,
  migrateWinningNicheState,
  pauseWinningNicheAutomation,
  resetWinningNicheCycle,
  resumeWinningNicheAutomation,
  startWinningNicheAutomation,
  stopWinningNicheAutomation,
} from '../src/winning-niche-automation.js'
import { candidateEvidenceKey } from '../src/multi-angle-candidates.js'

const HALLOWEEN_CONTEXT = {
  eventId: 'halloween',
  eventTerm: 'halloween',
  categoryId: 'shirt',
  productTerm: 'shirt',
}

test('starts a persistent event-locked search and builds a career batch', () => {
  const started = startWinningNicheAutomation(createWinningNicheAutomation(), HALLOWEEN_CONTEXT)
  const result = buildNextWinningNicheBatch({
    automation: started,
    eventTerm: 'christmas',
    batchSize: 3,
    now: '2026-07-26T10:00:00.000Z',
  })

  assert.equal(result.automation.status, 'running')
  assert.equal(result.automation.eventId, 'halloween')
  assert.equal(result.automation.eventTerm, 'halloween')
  assert.equal(result.automation.currentAxis, 'career')
  assert.equal(result.automation.round, 1)
  assert.equal(result.candidates.length, 3)
  assert.ok(result.candidates.every((candidate) => candidate.keyword.startsWith('halloween ')))
  assert.ok(result.candidates.every((candidate) => candidate.keyword.endsWith(' shirt')))
  assert.ok(result.candidates.every((candidate) => candidate.axisId === 'career'))
})

test('marks a completed batch researched and rotates to the next niche axis', () => {
  const first = buildNextWinningNicheBatch({
    automation: startWinningNicheAutomation(createWinningNicheAutomation(), HALLOWEEN_CONTEXT),
    batchSize: 2,
  })
  const evaluated = evaluateWinningNicheRows(first.automation, [
    { keyword: first.candidates[0].keyword, opportunityLabel: 'C', evidenceState: { status: 'verified' } },
    { keyword: first.candidates[1].keyword, opportunityLabel: 'D', evidenceState: { status: 'verified' } },
  ])
  const second = buildNextWinningNicheBatch({ automation: evaluated, batchSize: 2 })

  assert.equal(evaluated.status, 'running')
  assert.deepEqual(evaluated.researchedKeywords, first.candidates.map((candidate) => candidate.keyword))
  assert.equal(second.automation.currentAxis, 'hobby')
  assert.equal(second.automation.round, 2)
  assert.equal(second.candidates.some((candidate) => evaluated.researchedKeywords.includes(candidate.keyword)), false)
})

test('does not queue keywords already researched or already waiting', () => {
  const started = startWinningNicheAutomation(createWinningNicheAutomation({
    researchedKeywords: ['halloween dentist shirt'],
    queuedKeywords: ['halloween registered nurse shirt'],
  }), HALLOWEEN_CONTEXT)
  const result = buildNextWinningNicheBatch({
    automation: started,
    batchSize: 4,
    axisOrder: ['career'],
    termsByAxis: {
      career: ['dentist', 'registered nurse', 'teacher', 'school counselor', 'pharmacist'],
    },
  })

  assert.deepEqual(result.candidates.map((candidate) => candidate.keyword), [
    'halloween teacher shirt',
    'halloween school counselor shirt',
    'halloween pharmacist shirt',
  ])
})

test('builds a new fixed-context attribute candidate while excluding measured and queued combinations', () => {
  const started = startWinningNicheAutomation(createWinningNicheAutomation({
    researchedKeywords: ['christmas teacher mug'],
    queuedKeywords: ['christmas nurse mug'],
  }), {
    eventId: 'christmas',
    eventTerm: 'christmas',
    categoryId: 'mug',
    productTerm: 'mug',
  })
  const result = buildNextWinningNicheBatch({
    automation: started,
    batchSize: 8,
    axisOrder: ['career'],
    termsByAxis: {
      career: ['teacher', 'nurse', 'librarian'],
    },
  })

  assert.deepEqual(result.candidates.map((candidate) => candidate.keyword), [
    'christmas librarian mug',
  ])
  assert.equal(result.candidates[0].source, 'curated-taxonomy')
  assert.equal(result.candidates[0].eventId, 'christmas')
})

test('records risky terms as excluded instead of sending them to Etsy', () => {
  const started = startWinningNicheAutomation(createWinningNicheAutomation(), HALLOWEEN_CONTEXT)
  const result = buildNextWinningNicheBatch({
    automation: started,
    batchSize: 3,
    axisOrder: ['career'],
    termsByAxis: { career: ['star wars', 'teacher'] },
  })

  assert.deepEqual(result.candidates.map((candidate) => candidate.keyword), ['halloween teacher shirt'])
  assert.deepEqual(result.automation.excludedKeywords, ['halloween star wars shirt'])
})

test('stops external exploration when a verified A or B candidate exists', () => {
  const queued = buildNextWinningNicheBatch({
    automation: startWinningNicheAutomation(createWinningNicheAutomation(), HALLOWEEN_CONTEXT),
    batchSize: 2,
  })
  const winner = evaluateWinningNicheRows(queued.automation, [
    { keyword: queued.candidates[0].keyword, opportunityLabel: 'B', evidenceState: { status: 'verified' } },
    { keyword: queued.candidates[1].keyword, opportunityLabel: 'C', evidenceState: { status: 'verified' } },
  ], '2026-07-26T11:00:00.000Z')

  assert.equal(winner.status, 'winner-found')
  assert.deepEqual(winner.winnerKeywords, [queued.candidates[0].keyword])
  assert.equal(winner.queuedKeywords.length, 0)
  assert.equal(winner.updatedAt, '2026-07-26T11:00:00.000Z')
})

test('keeps searching after one verified B when the weekly target is five', () => {
  const started = startWinningNicheAutomation(createWinningNicheAutomation(), {
    ...HALLOWEEN_CONTEXT,
    targetWinnerCount: 5,
  })
  const evaluated = evaluateWinningNicheRows(started, [
    {
      keyword: 'halloween reading shirt',
      opportunityLabel: 'B',
      evidenceState: { status: 'verified' },
    },
  ])

  assert.equal(evaluated.status, 'running')
  assert.equal(evaluated.targetWinnerCount, 5)
  assert.deepEqual(evaluated.winnerKeywords, ['halloween reading shirt'])
  assert.equal(evaluated.completedAt, '')
})

test('stops only after five unique verified A or B keywords', () => {
  const started = startWinningNicheAutomation(createWinningNicheAutomation(), {
    ...HALLOWEEN_CONTEXT,
    targetWinnerCount: 5,
  })
  const evaluated = evaluateWinningNicheRows(started, [
    { keyword: 'one', opportunityLabel: 'A', evidenceState: { status: 'verified' } },
    { keyword: 'two', opportunityLabel: 'B', evidenceState: { status: 'verified' } },
    { keyword: 'three', opportunityLabel: 'B', evidenceState: { status: 'verified' } },
    { keyword: 'four', opportunityLabel: 'A', evidenceState: { status: 'verified' } },
    { keyword: 'five', opportunityLabel: 'B', evidenceState: { status: 'verified' } },
    { keyword: 'five', opportunityLabel: 'A', evidenceState: { status: 'verified' } },
    { keyword: 'not verified', opportunityLabel: 'A', evidenceState: { status: 'pending' } },
    { keyword: 'not a winner', opportunityLabel: 'C', evidenceState: { status: 'verified' } },
  ], '2026-07-27T01:00:00.000Z')

  assert.equal(evaluated.status, 'winner-found')
  assert.equal(evaluated.targetWinnerCount, 5)
  assert.deepEqual(evaluated.winnerKeywords, ['one', 'two', 'three', 'four', 'five'])
  assert.equal(evaluated.completedAt, '2026-07-27T01:00:00.000Z')
})

test('resumes a legacy one-winner state when the configured target increases to five', () => {
  const restored = createWinningNicheAutomation({
    status: 'winner-found',
    eventId: 'halloween',
    eventTerm: 'halloween',
    categoryId: 'shirt',
    productTerm: 'shirt',
    winnerKeywords: ['halloween reading shirt'],
  })
  const resumed = startWinningNicheAutomation(restored, {
    ...HALLOWEEN_CONTEXT,
    targetWinnerCount: 5,
  })

  assert.equal(resumed.status, 'running')
  assert.equal(resumed.targetWinnerCount, 5)
  assert.deepEqual(resumed.winnerKeywords, ['halloween reading shirt'])
})

test('starts a new weekly cycle without losing researched keywords', () => {
  const previous = createWinningNicheAutomation({
    status: 'winner-found',
    eventId: 'halloween',
    eventTerm: 'halloween',
    categoryId: 'shirt',
    productTerm: 'shirt',
    targetWinnerCount: 5,
    researchedKeywords: ['halloween reading shirt'],
    winnerKeywords: ['halloween reading shirt'],
    completedAt: '2026-07-27T01:00:00.000Z',
  })
  const reset = resetWinningNicheCycle(previous, '2026-08-03T00:00:00.000Z')

  assert.equal(reset.status, 'idle')
  assert.equal(reset.targetWinnerCount, 5)
  assert.deepEqual(reset.researchedKeywords, ['halloween reading shirt'])
  assert.deepEqual(reset.winnerKeywords, [])
  assert.equal(reset.cycleId, 'cycle-2026-08-03T00:00:00.000Z')
  assert.equal(reset.completedAt, '')
})

test('pauses resumes and manually stops without discarding its queue', () => {
  const queued = buildNextWinningNicheBatch({
    automation: startWinningNicheAutomation(createWinningNicheAutomation(), HALLOWEEN_CONTEXT),
    batchSize: 2,
  }).automation
  const paused = pauseWinningNicheAutomation(queued, 'EverBeeへログインしてください')
  const restored = createWinningNicheAutomation(JSON.parse(JSON.stringify(paused)))
  const resumed = resumeWinningNicheAutomation(restored)
  const stopped = stopWinningNicheAutomation(resumed)

  assert.equal(paused.status, 'paused')
  assert.equal(paused.pauseReason, 'EverBeeへログインしてください')
  assert.deepEqual(restored.queuedKeywords, queued.queuedKeywords)
  assert.equal(resumed.status, 'running')
  assert.equal(resumed.pauseReason, '')
  assert.equal(stopped.status, 'stopped')
  assert.deepEqual(stopped.queuedKeywords, queued.queuedKeywords)
})

test('becomes exhausted instead of busy-looping when no safe new term exists', () => {
  const started = startWinningNicheAutomation(createWinningNicheAutomation(), HALLOWEEN_CONTEXT)
  const result = buildNextWinningNicheBatch({
    automation: started,
    batchSize: 2,
    axisOrder: ['career'],
    termsByAxis: { career: [] },
  })

  assert.equal(result.automation.status, 'exhausted')
  assert.equal(result.candidates.length, 0)
  assert.equal(result.reason, 'candidate-pool-exhausted')
})

test('normalizes malformed saved state to safe serializable defaults', () => {
  const restored = createWinningNicheAutomation({
    status: 'not-real',
    round: -2,
    researchedKeywords: [' Halloween Teacher Shirt ', 'halloween teacher shirt'],
    excludedKeywords: null,
    winnerKeywords: 'wrong',
  })

  assert.equal(restored.status, 'idle')
  assert.equal(restored.round, 0)
  assert.deepEqual(restored.researchedKeywords, ['halloween teacher shirt'])
  assert.deepEqual(restored.excludedKeywords, [])
  assert.deepEqual(restored.winnerKeywords, [])
})

test('migrates a legacy saved search without changing its event or losing progress', () => {
  const migrated = migrateWinningNicheState({
    status: 'paused',
    eventId: 'halloween',
    categoryId: 'shirt',
    currentAxis: 'career',
    researchedKeywords: ['halloween teacher shirt'],
    queuedKeywords: ['halloween nurse shirt'],
    winnerKeywords: ['halloween librarian shirt'],
    targetWinnerCount: 5,
    pauseReason: 'login-required',
    startedAt: '2026-07-29T00:00:00Z',
    updatedAt: '2026-07-29T01:00:00Z',
  })

  assert.equal(migrated.status, 'paused')
  assert.equal(migrated.activeEventId, 'halloween')
  assert.equal(migrated.categoryId, 'shirt')
  assert.equal(migrated.currentAngleId, 'attribute-combination')
  assert.deepEqual(migrated.evidenceKeys, [
    candidateEvidenceKey({
      keyword: 'halloween teacher shirt',
      categoryId: 'shirt',
      eventId: 'halloween',
    }),
  ])
  assert.deepEqual(migrated.queuedEvidenceKeys, [
    candidateEvidenceKey({
      keyword: 'halloween nurse shirt',
      categoryId: 'shirt',
      eventId: 'halloween',
    }),
  ])
  assert.deepEqual(migrated.winnerKeywords, ['halloween librarian shirt'])
  assert.equal(migrated.targetWinnerCount, 5)
  assert.equal(migrated.pauseReason, 'login-required')
})

test('migrates a legacy exhausted state as resumable running work', () => {
  const migrated = migrateWinningNicheState({
    status: 'exhausted',
    eventId: 'halloween',
    categoryId: 'shirt',
  })

  assert.equal(migrated.status, 'running')
  assert.equal(migrated.activeEventId, 'halloween')
})

test('safely migrates malformed legacy keyword lists and an unknown status', () => {
  const migrated = migrateWinningNicheState({
    status: 'not-real',
    eventId: ' halloween ',
    categoryId: ' shirt ',
    researchedKeywords: 'wrong',
    queuedKeywords: { keyword: 'wrong' },
    winnerKeywords: 'wrong',
  })

  assert.equal(migrated.status, 'idle')
  assert.equal(migrated.activeEventId, 'halloween')
  assert.equal(migrated.categoryId, 'shirt')
  assert.deepEqual(migrated.evidenceKeys, [])
  assert.deepEqual(migrated.queuedEvidenceKeys, [])
  assert.deepEqual(migrated.winnerKeywords, [])
})
