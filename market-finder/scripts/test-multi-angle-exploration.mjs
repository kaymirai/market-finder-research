import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMultiAngleExplorationState,
  nextMultiAngleBatch,
  pauseMultiAngleExploration,
  recordMultiAngleBatch,
  recordMultiAngleFailure,
  resumeMultiAngleExploration,
  startMultiAngleExploration,
  stopMultiAngleExploration,
} from '../src/multi-angle-exploration.js'
import { candidateEvidenceKey } from '../src/multi-angle-candidates.js'

const context = {
  activeEventId: 'halloween',
  categoryId: 'shirt',
  targetWinnerCount: 2,
}

test('moves to the next angle without repeating the same evidence lookup and preserves provenance', () => {
  const started = startMultiAngleExploration({}, context, '2026-07-30T00:00:00Z')
  const pools = {
    'demand-neighborhood': [{ keyword: 'spooky nurse shirt', categoryId: 'shirt', eventId: 'halloween' }],
    'attribute-combination': [{ keyword: 'spooky nurse shirt', categoryId: 'shirt', eventId: 'halloween' }],
    'recent-sales': [{ keyword: 'ghost gardener shirt', categoryId: 'shirt', eventId: 'halloween' }],
  }
  const first = nextMultiAngleBatch({
    state: started,
    pools,
    limit: 8,
  })
  const researched = recordMultiAngleBatch(first.state, [{
    keyword: 'spooky nurse shirt',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'C',
  }], '2026-07-30T00:05:00Z')
  const second = nextMultiAngleBatch({ state: researched, pools, limit: 8 })
  const evidenceKey = candidateEvidenceKey(pools['demand-neighborhood'][0])

  assert.deepEqual(second.candidates.map((item) => item.keyword), ['ghost gardener shirt'])
  assert.deepEqual(second.state.provenance[evidenceKey], [
    'demand-neighborhood',
    'attribute-combination',
  ])
})

test('finishes when the verified A/B target is reached', () => {
  const started = startMultiAngleExploration({}, context)
  const completed = recordMultiAngleBatch(started, [
    { keyword: 'one', evidenceState: { status: 'verified' }, opportunityLabel: 'A' },
    { keyword: 'two', evidenceState: { status: 'verified' }, opportunityLabel: 'B' },
  ])
  assert.equal(completed.status, 'winner-found')
  assert.equal(completed.winnerKeywords.length, 2)
})

test('does not count unverified A/B or verified C/D rows as winners', () => {
  const started = startMultiAngleExploration({}, context)
  const evaluated = recordMultiAngleBatch(started, [
    { keyword: 'pending a', evidenceState: { status: 'pending' }, opportunityLabel: 'A' },
    { keyword: 'verified c', evidenceState: { status: 'verified' }, opportunityLabel: 'C' },
  ])

  assert.equal(evaluated.status, 'running')
  assert.deepEqual(evaluated.winnerKeywords, [])
})

test('finishes as exhausted after every angle has no unseen candidates', () => {
  const started = startMultiAngleExploration({}, context)
  const result = nextMultiAngleBatch({ state: started, pools: {}, limit: 8 })
  assert.equal(result.state.status, 'exhausted')
  assert.equal(result.reason, 'all-angles-exhausted')
})

test('moves one timed-out keyword to retry wait and continues other candidates', () => {
  const started = startMultiAngleExploration({}, context)
  const candidate = {
    keyword: 'spooky nurse shirt',
    categoryId: 'shirt',
    eventId: 'halloween',
  }
  const failed = recordMultiAngleFailure(started, candidate, {
    code: 'page-timeout',
    retryAfterMs: 60_000,
  }, '2026-07-30T00:00:00Z')
  assert.equal(failed.retryQueue[0].attempts, 1)
  assert.equal(failed.retryQueue[0].retryAt, '2026-07-30T00:01:00.000Z')
  assert.equal(failed.status, 'running')
})

test('stops retrying one keyword after two timeouts', () => {
  const candidate = {
    keyword: 'spooky nurse shirt',
    categoryId: 'shirt',
    eventId: 'halloween',
  }
  const started = startMultiAngleExploration({}, context)
  const once = recordMultiAngleFailure(started, candidate, {
    code: 'page-timeout',
    retryAfterMs: 1,
  }, '2026-07-30T00:00:00Z')
  const twice = recordMultiAngleFailure(once, candidate, {
    code: 'page-timeout',
    retryAfterMs: 1,
  }, '2026-07-30T00:01:00Z')
  assert.equal(twice.retryQueue.length, 0)
  assert.equal(twice.failedEvidenceKeys.length, 1)
})

test('keeps timeout attempts in saved state until a due retry finishes', () => {
  const candidate = {
    keyword: 'spooky nurse shirt',
    categoryId: 'shirt',
    eventId: 'halloween',
  }
  const once = recordMultiAngleFailure(
    startMultiAngleExploration({}, context),
    candidate,
    { code: 'page-timeout', retryAfterMs: 60_000 },
    '2026-07-30T00:00:00Z',
  )
  const due = nextMultiAngleBatch({
    state: once,
    pools: {},
    now: '2026-07-30T00:01:00Z',
  })
  const restored = createMultiAngleExplorationState(
    JSON.parse(JSON.stringify(due.state)),
  )
  const twice = recordMultiAngleFailure(
    restored,
    { ...candidate },
    { code: 'page-timeout', retryAfterMs: 60_000 },
    '2026-07-30T00:02:00Z',
  )

  assert.equal(restored.retryQueue[0].attempts, 1)
  assert.equal(twice.retryQueue.length, 0)
  assert.deepEqual(twice.failedEvidenceKeys, [candidateEvidenceKey(candidate)])
})

test('returns only due timeout retries before queuing new evidence', () => {
  const candidate = {
    keyword: 'spooky nurse shirt',
    categoryId: 'shirt',
    eventId: 'halloween',
  }
  const once = recordMultiAngleFailure(
    startMultiAngleExploration({}, context),
    candidate,
    { code: 'page-timeout', retryAfterMs: 60_000 },
    '2026-07-30T00:00:00Z',
  )
  const waiting = nextMultiAngleBatch({
    state: once,
    pools: { 'demand-neighborhood': [{ keyword: 'other', categoryId: 'shirt', eventId: 'halloween' }] },
    now: '2026-07-30T00:00:30Z',
  })
  const due = nextMultiAngleBatch({
    state: waiting.state,
    pools: {},
    now: '2026-07-30T00:01:00Z',
  })

  assert.deepEqual(waiting.candidates.map((item) => item.keyword), ['other'])
  assert.deepEqual(due.candidates.map((item) => item.keyword), ['spooky nurse shirt'])
  assert.equal(due.reason, 'retry-ready')
})

test('pauses the whole state on a service failure without dropping the current batch', () => {
  const batch = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, context),
    pools: {
      'demand-neighborhood': [
        { keyword: 'one', categoryId: 'shirt', eventId: 'halloween' },
        { keyword: 'two', categoryId: 'shirt', eventId: 'halloween' },
      ],
    },
  })
  const paused = recordMultiAngleFailure(
    batch.state,
    batch.candidates[0],
    { code: 'rate-limited' },
    '2026-07-30T00:00:00Z',
  )

  assert.equal(paused.status, 'paused')
  assert.equal(paused.pauseReason, 'rate-limited')
  assert.deepEqual(paused.queuedEvidenceKeys, batch.state.queuedEvidenceKeys)
})

test('recording completed rows cannot resume a batch paused by a global failure', () => {
  const batch = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, context),
    pools: {
      'demand-neighborhood': [
        { keyword: 'one', categoryId: 'shirt', eventId: 'halloween' },
        { keyword: 'two', categoryId: 'shirt', eventId: 'halloween' },
      ],
    },
  })
  const paused = recordMultiAngleFailure(
    batch.state,
    batch.candidates[0],
    { code: 'service-unavailable' },
    '2026-07-30T00:00:00Z',
  )
  const recorded = recordMultiAngleBatch(paused, [{
    ...batch.candidates[1],
    evidenceState: { status: 'verified' },
    opportunityLabel: 'C',
  }], '2026-07-30T00:01:00Z')

  assert.equal(recorded.status, 'paused')
  assert.equal(recorded.pauseReason, 'service-unavailable')
  assert.deepEqual(recorded.queuedEvidenceKeys, [candidateEvidenceKey(batch.candidates[0])])
})

test('keeps the active event fixed when start is called with another event', () => {
  const started = startMultiAngleExploration({}, context, '2026-07-30T00:00:00Z')
  const restarted = startMultiAngleExploration(started, {
    ...context,
    activeEventId: 'christmas',
  }, '2026-07-30T01:00:00Z')

  assert.equal(restarted.activeEventId, 'halloween')
  assert.equal(restarted.startedAt, '2026-07-30T00:00:00Z')
})

test('stores seasonal references without queuing or counting them', () => {
  const started = startMultiAngleExploration({}, context)
  const result = nextMultiAngleBatch({
    state: started,
    angleOrder: ['seasonal-reference', 'demand-neighborhood'],
    pools: {
      'seasonal-reference': [{
        keyword: 'thanksgiving nurse shirt',
        categoryId: 'shirt',
        eventId: 'thanksgiving',
        resultLane: 'seasonal-reference',
      }],
    },
  })
  const evaluated = recordMultiAngleBatch(result.state, [{
    keyword: 'thanksgiving nurse shirt',
    categoryId: 'shirt',
    eventId: 'thanksgiving',
    resultLane: 'seasonal-reference',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'A',
  }])

  assert.equal(result.candidates.length, 0)
  assert.equal(result.state.queuedEvidenceKeys.length, 0)
  assert.equal(result.state.resultLanes.seasonalReference.length, 1)
  assert.deepEqual(evaluated.winnerKeywords, [])
})

test('pause resume and stop keep the current batch serializable', () => {
  const batch = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, context),
    pools: {
      'demand-neighborhood': [{ keyword: 'one', categoryId: 'shirt', eventId: 'halloween' }],
    },
  }).state
  const paused = pauseMultiAngleExploration(batch, 'login-required')
  const restored = createMultiAngleExplorationState(JSON.parse(JSON.stringify(paused)))
  const resumed = resumeMultiAngleExploration(restored)
  const stopped = stopMultiAngleExploration(resumed)

  assert.equal(paused.status, 'paused')
  assert.deepEqual(restored.queuedEvidenceKeys, batch.queuedEvidenceKeys)
  assert.equal(resumed.status, 'running')
  assert.equal(stopped.status, 'stopped')
  assert.deepEqual(stopped.queuedEvidenceKeys, batch.queuedEvidenceKeys)
})
