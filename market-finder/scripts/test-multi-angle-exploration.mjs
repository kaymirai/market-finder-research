import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMultiAngleExplorationState,
  nextMultiAngleBatch,
  pauseMultiAngleExploration,
  reconcileMultiAngleWinners,
  recordMultiAngleBatch,
  recordMultiAngleFailure,
  resumeExhaustedMultiAngleExploration,
  resumeMultiAngleExploration,
  shouldAutoStartMultiAngleExploration,
  startMultiAngleExploration,
  stopMultiAngleExploration,
} from '../src/multi-angle-exploration.js'
import * as multiAngleApi from '../src/multi-angle-exploration.js'
import * as erankQueryApi from '../src/erank-query-plan.js'
import { candidateEvidenceKey } from '../src/multi-angle-candidates.js'

const context = {
  activeEventId: 'halloween',
  categoryId: 'shirt',
  targetWinnerCount: 2,
}

test('auto-starts deep dive only after complete initial evidence is below target', () => {
  const base = {
    hasResearchRows: true,
    decisionStatus: 'ready',
    winnerCount: 1,
    targetWinnerCount: 5,
    explorationStatus: 'idle',
    pendingCount: 0,
    activeWork: false,
    restoredAwaiting: false,
    crossNichePending: false,
    blocked: false,
  }

  assert.equal(shouldAutoStartMultiAngleExploration(base), true)
  assert.equal(shouldAutoStartMultiAngleExploration({ ...base, winnerCount: 5 }), false)
  assert.equal(shouldAutoStartMultiAngleExploration({ ...base, pendingCount: 1 }), false)
  assert.equal(shouldAutoStartMultiAngleExploration({ ...base, explorationStatus: 'running' }), false)
  assert.equal(shouldAutoStartMultiAngleExploration({ ...base, restoredAwaiting: true }), false)
  assert.equal(shouldAutoStartMultiAngleExploration({ ...base, blocked: true }), false)
})

test('starts a fresh cycle automatically when every angle is exhausted below target', () => {
  const shouldContinue = multiAngleApi.shouldAutoStartFreshCycle

  assert.equal(shouldContinue?.({
    reason: 'all-angles-exhausted',
    winnerCount: 3,
    targetWinnerCount: 5,
    blocked: false,
  }), true)
  assert.equal(shouldContinue?.({
    reason: 'all-angles-exhausted',
    winnerCount: 5,
    targetWinnerCount: 5,
    blocked: false,
  }), false)
  assert.equal(shouldContinue?.({
    reason: 'retry-wait',
    winnerCount: 3,
    targetWinnerCount: 5,
    blocked: false,
  }), false)
  assert.equal(shouldContinue?.({
    reason: 'all-angles-exhausted',
    winnerCount: 3,
    targetWinnerCount: 5,
    blocked: true,
  }), false)
})

test('reconciliation ignores historical title-like A/B rows', () => {
  const reconciled = reconcileMultiAngleWinners({ targetWinnerCount: 5 }, [{
    keyword: 'halloween running shirt',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'B',
    queryEligibility: { eligible: true },
  }, {
    keyword: 'long listing title with many unrelated product words shirt',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'A',
    queryEligibility: { eligible: false },
  }])

  assert.deepEqual(reconciled.winnerKeywords, ['halloween running shirt'])
})

test('drops persisted measured recombinations that are too long for Marketplace validation', () => {
  const restored = createMultiAngleExplorationState({
    status: 'paused',
    activeEventId: 'halloween',
    categoryId: 'shirt',
    currentAngleId: 'recent-sales',
    currentBatchCandidates: [{
      keyword: 'halloween medical assistant logo corporate gifting shirt',
      source: 'measured-c-recombination',
      eventId: 'halloween',
      categoryId: 'shirt',
    }, {
      keyword: 'halloween medical assistant shirt',
      source: 'measured-c-recombination',
      eventId: 'halloween',
      categoryId: 'shirt',
    }],
  })

  assert.deepEqual(
    restored.currentBatchCandidates.map((candidate) => candidate.keyword),
    ['halloween medical assistant shirt'],
  )
})

test('drops restored retry candidates that fail the Marketplace buyer-query gate', () => {
  const restored = createMultiAngleExplorationState({
    status: 'running',
    activeEventId: 'halloween',
    categoryId: 'shirt',
    retryQueue: [
      {
        candidate: {
          keyword: 'halloween nurse shirt',
          eventId: 'halloween',
          categoryId: 'shirt',
        },
        attempts: 1,
        retryAt: '2026-08-01T00:00:00.000Z',
      },
      {
        candidate: {
          keyword: 'halloween nurse mug',
          eventId: 'halloween',
          categoryId: 'shirt',
        },
        attempts: 1,
        retryAt: '2026-08-01T00:00:00.000Z',
      },
      {
        candidate: {
          keyword: 'halloween shirt',
          eventId: 'halloween',
          categoryId: 'shirt',
        },
        attempts: 1,
        retryAt: '2026-08-01T00:00:00.000Z',
      },
    ],
  })

  assert.deepEqual(
    restored.retryQueue.map((entry) => entry.candidate.keyword),
    ['halloween nurse shirt'],
  )
})

test('skips newly excluded restored and retry candidates without pausing the exploration', () => {
  const running = createMultiAngleExplorationState({
    status: 'running',
    activeEventId: 'halloween',
    categoryId: 'shirt',
    currentAngleId: 'demand-neighborhood',
    currentBatchCandidates: [{
      keyword: 'disney teacher shirt',
      eventId: 'halloween',
      categoryId: 'shirt',
    }],
    retryQueue: [{
      candidate: {
        keyword: 'disney nurse shirt',
        eventId: 'halloween',
        categoryId: 'shirt',
        angleId: 'demand-neighborhood',
      },
      retryAt: '2026-08-01T00:00:00.000Z',
    }],
  })

  const next = nextMultiAngleBatch({
    state: running,
    excludedRiskTerms: ['disney'],
    pools: {
      'demand-neighborhood': [{
        keyword: 'science teacher shirt',
        eventId: 'halloween',
        categoryId: 'shirt',
      }],
    },
    now: '2026-08-14T00:00:00.000Z',
  })

  assert.equal(next.state.status, 'running')
  assert.equal(next.state.pauseReason, '')
  assert.deepEqual(next.state.retryQueue, [])
  assert.deepEqual(next.candidates.map((candidate) => candidate.keyword), [
    'science teacher shirt',
  ])
})

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

test('requests a fresh cycle when an exhausted search has no unused candidates to reopen', () => {
  const exhausted = createMultiAngleExplorationState({
    status: 'exhausted',
    activeEventId: 'halloween',
    categoryId: 'shirt',
    evidenceKeys: ['ghost shirt|shirt|halloween'],
  })

  const result = resumeExhaustedMultiAngleExploration(exhausted, {
    'demand-neighborhood': [{
      keyword: 'ghost shirt',
      categoryId: 'shirt',
      eventId: 'halloween',
    }],
  })

  assert.equal(result.requiresFreshCycle, true)
  assert.equal(result.state.status, 'exhausted')
})

test('counts verified A/B rows when saved exhausted work finishes verification', () => {
  const exhausted = createMultiAngleExplorationState({
    ...context,
    status: 'exhausted',
    winnerKeywords: [],
  })

  const reconciled = reconcileMultiAngleWinners(exhausted, [
    {
      keyword: 'paramedic shirt',
      evidenceState: { status: 'verified' },
      opportunityLabel: 'A',
      resultLane: 'evergreen',
    },
    {
      keyword: 'pharmacy graduation gift',
      evidenceState: { status: 'verified' },
      opportunityLabel: 'B',
      resultLane: 'event',
    },
    {
      keyword: 'halloween ghost shirt',
      evidenceState: { status: 'verified' },
      opportunityLabel: 'C',
      resultLane: 'event',
    },
  ], '2026-08-01T00:00:00Z')

  assert.equal(reconciled.status, 'winner-found')
  assert.deepEqual(reconciled.winnerKeywords, [
    'paramedic shirt',
    'pharmacy graduation gift',
  ])
  assert.equal(reconciled.completedAt, '2026-08-01T00:00:00Z')
})

test('stores compact result-lane summaries instead of duplicating full evidence rows', () => {
  const started = startMultiAngleExploration({}, context)
  const productRows = Array.from({ length: 14 }, (_, index) => ({
    listingId: `listing-${index}`,
    title: `Spooky dental product ${index}`,
    monthlySales: index + 1,
    monthlyRevenue: (index + 1) * 25,
    listingAgeMonths: index + 1,
  }))
  const evaluated = recordMultiAngleBatch(started, [{
    keyword: 'halloween dentist shirt',
    categoryId: 'shirt',
    eventId: 'halloween',
    angleId: 'attribute-combination',
    source: 'curated-taxonomy',
    evidenceState: { status: 'verified', nextStage: '' },
    opportunityLabel: 'C',
    confidenceLabel: 'High',
    candidateStage: 'sales-checked',
    raw: { productRows, notes: 'full raw evidence' },
    normalized: { productRows, listingsAnalyzed: 2704 },
    everbeeRow: { productRows, listingsAnalyzed: 2704 },
    scoreState: { score: 42, details: { productRows } },
  }])

  const stored = evaluated.resultLanes.event[0]
  assert.equal(stored.keyword, 'halloween dentist shirt')
  assert.equal(stored.opportunityLabel, 'C')
  assert.equal(stored.confidenceLabel, 'High')
  assert.equal(stored.candidateStage, 'sales-checked')
  for (const heavyField of ['raw', 'normalized', 'everbeeRow', 'scoreState']) {
    assert.equal(Object.hasOwn(stored, heavyField), false)
  }
  assert.ok(JSON.stringify(stored).length < 2_000)
})

test('compacts legacy full result-lane evidence while restoring saved state', () => {
  const productRows = Array.from({ length: 14 }, (_, index) => ({
    listingId: `legacy-listing-${index}`,
    title: `Legacy product ${index}`,
    monthlySales: index + 1,
  }))
  const restored = createMultiAngleExplorationState({
    activeEventId: 'halloween',
    categoryId: 'shirt',
    resultLanes: {
      event: [{
        keyword: 'legacy halloween nurse shirt',
        categoryId: 'shirt',
        eventId: 'halloween',
        angleId: 'recent-sales',
        resultLane: 'event',
        opportunityLabel: 'B',
        confidenceLabel: 'High',
        raw: { productRows },
        normalized: { productRows },
        everbeeRow: { productRows },
        scoreState: { details: { productRows } },
      }],
    },
  })

  const stored = restored.resultLanes.event[0]
  assert.equal(stored.keyword, 'legacy halloween nurse shirt')
  assert.equal(stored.opportunityLabel, 'B')
  assert.equal(stored.confidenceLabel, 'High')
  for (const heavyField of ['raw', 'normalized', 'everbeeRow', 'scoreState']) {
    assert.equal(Object.hasOwn(stored, heavyField), false)
  }
  assert.ok(JSON.stringify(restored.resultLanes).length < 2_000)
})

test('finishes as exhausted after every angle has no unseen candidates', () => {
  const started = startMultiAngleExploration({}, context)
  const result = nextMultiAngleBatch({ state: started, pools: {}, limit: 8 })
  assert.equal(result.state.status, 'exhausted')
  assert.equal(result.reason, 'all-angles-exhausted')
  assert.deepEqual(result.state.completedAngles, [])
  assert.deepEqual(result.state.emptyAngles, [
    'demand-neighborhood',
    'attribute-combination',
    'recent-sales',
    'adjacent-product',
    'market-gap',
    'evergreen',
  ])
})

test('separates a researched demand angle from a later attribute angle with no candidates', () => {
  const pools = {
    'demand-neighborhood': [{
      keyword: 'spooky nurse shirt',
      categoryId: 'shirt',
      eventId: 'halloween',
    }],
    'recent-sales': [{
      keyword: 'ghost gardener shirt',
      categoryId: 'shirt',
      eventId: 'halloween',
    }],
  }
  const demand = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, context),
    pools,
  })
  const recorded = recordMultiAngleBatch(demand.state, [{
    ...demand.candidates[0],
    evidenceState: { status: 'verified' },
    opportunityLabel: 'C',
  }])
  assert.deepEqual(recorded.attemptedAngles, ['demand-neighborhood'])
  assert.deepEqual(recorded.completedAngles, [])
  const advanced = nextMultiAngleBatch({ state: recorded, pools })

  const restored = createMultiAngleExplorationState(
    JSON.parse(JSON.stringify(advanced.state)),
  )
  assert.deepEqual(restored.completedAngles, ['demand-neighborhood'])
  assert.deepEqual(restored.emptyAngles, ['attribute-combination'])
  assert.equal(restored.currentAngleId, 'recent-sales')
})

test('keeps a ninth candidate in the same angle after recording a limit-eight batch', () => {
  const demandCandidates = Array.from({ length: 9 }, (_, index) => ({
    keyword: `spooky niche ${index + 1} shirt`,
    categoryId: 'shirt',
    eventId: 'halloween',
  }))
  const pools = { 'demand-neighborhood': demandCandidates }
  const first = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, context),
    pools,
    limit: 8,
  })
  const recorded = recordMultiAngleBatch(first.state, first.candidates.map((candidate) => ({
    ...candidate,
    evidenceState: { status: 'verified' },
    opportunityLabel: 'C',
  })))
  const ninth = nextMultiAngleBatch({
    state: recorded,
    pools,
    limit: 8,
  })

  assert.equal(first.candidates.length, 8)
  assert.deepEqual(recorded.attemptedAngles, ['demand-neighborhood'])
  assert.deepEqual(recorded.completedAngles, [])
  assert.deepEqual(ninth.candidates.map((candidate) => candidate.keyword), [
    'spooky niche 9 shirt',
  ])
  assert.equal(ninth.state.currentAngleId, 'demand-neighborhood')
  assert.deepEqual(ninth.state.completedAngles, [])
})

test('returns to a completed higher-priority angle when new evidence adds an unseen candidate', () => {
  const state = createMultiAngleExplorationState({
    status: 'running',
    activeEventId: 'halloween',
    categoryId: 'shirt',
    currentAngleId: 'recent-sales',
    angleIndex: 2,
    evidenceKeys: ['halloween dentist shirt|shirt|halloween'],
    attemptedAngles: ['demand-neighborhood', 'attribute-combination', 'recent-sales'],
    completedAngles: ['demand-neighborhood', 'attribute-combination'],
  })
  const result = nextMultiAngleBatch({
    state,
    pools: {
      'demand-neighborhood': [{
        keyword: 'dentist halloween shirt',
        categoryId: 'shirt',
        eventId: 'halloween',
        source: 'archived-etsy-related',
        priorityScore: 95,
      }],
      'recent-sales': [{
        keyword: 'halloween teacher ghost shirt',
        categoryId: 'shirt',
        eventId: 'halloween',
      }],
    },
  })

  assert.equal(result.state.currentAngleId, 'demand-neighborhood')
  assert.deepEqual(result.candidates.map((candidate) => candidate.keyword), [
    'dentist halloween shirt',
  ])
  assert.deepEqual(result.state.completedAngles, ['attribute-combination'])
})

test('promotes a definitively failed angle only after no unseen or retry work remains', () => {
  const batch = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, context),
    pools: {
      'demand-neighborhood': [{
        keyword: 'spooky nurse shirt',
        categoryId: 'shirt',
        eventId: 'halloween',
      }],
    },
  })
  const failed = recordMultiAngleFailure(
    batch.state,
    batch.candidates[0],
    { code: 'invalid-page' },
  )
  const advanced = nextMultiAngleBatch({
    state: failed,
    pools: {
      'demand-neighborhood': [{
        keyword: 'spooky nurse shirt',
        categoryId: 'shirt',
        eventId: 'halloween',
      }],
    },
  })

  assert.deepEqual(failed.attemptedAngles, ['demand-neighborhood'])
  assert.deepEqual(failed.completedAngles, [])
  assert.deepEqual(failed.emptyAngles, [])
  assert.deepEqual(advanced.state.completedAngles, ['demand-neighborhood'])
})

test('keeps attempted timeout work incomplete until its retry is definitively resolved', () => {
  const pools = {
    'demand-neighborhood': [{
      keyword: 'spooky nurse shirt',
      categoryId: 'shirt',
      eventId: 'halloween',
    }],
  }
  const batch = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, context),
    pools,
    angleOrder: ['demand-neighborhood'],
  })
  const once = recordMultiAngleFailure(
    batch.state,
    batch.candidates[0],
    { code: 'page-timeout', retryAfterMs: 60_000 },
    '2026-07-30T00:00:00Z',
  )
  const waiting = nextMultiAngleBatch({
    state: once,
    pools,
    angleOrder: ['demand-neighborhood'],
    now: '2026-07-30T00:00:30Z',
  })
  const due = nextMultiAngleBatch({
    state: waiting.state,
    pools,
    angleOrder: ['demand-neighborhood'],
    now: '2026-07-30T00:01:00Z',
  })
  const failed = recordMultiAngleFailure(
    due.state,
    due.candidates[0],
    { code: 'page-timeout', retryAfterMs: 60_000 },
    '2026-07-30T00:01:01Z',
  )
  const finished = nextMultiAngleBatch({
    state: failed,
    pools,
    angleOrder: ['demand-neighborhood'],
    now: '2026-07-30T00:02:00Z',
  })

  assert.deepEqual(once.attemptedAngles, ['demand-neighborhood'])
  assert.deepEqual(once.completedAngles, [])
  assert.equal(waiting.reason, 'retry-wait')
  assert.deepEqual(waiting.state.completedAngles, [])
  assert.equal(due.reason, 'retry-ready')
  assert.deepEqual(failed.completedAngles, [])
  assert.deepEqual(finished.state.completedAngles, ['demand-neighborhood'])
})

test('keeps a paused unresolved batch attempted and incomplete across reload', () => {
  const batch = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, context),
    pools: {
      'demand-neighborhood': [{
        keyword: 'spooky nurse shirt',
        categoryId: 'shirt',
        eventId: 'halloween',
      }],
    },
  })
  const paused = pauseMultiAngleExploration(batch.state, 'service-unavailable')
  const restored = createMultiAngleExplorationState(
    JSON.parse(JSON.stringify(paused)),
  )

  assert.deepEqual(restored.currentBatchCandidates.map((candidate) => candidate.keyword), [
    'spooky nurse shirt',
  ])
  assert.deepEqual(restored.attemptedAngles, [])
  assert.deepEqual(restored.completedAngles, [])
})

test('normalizes legacy exhausted angles as empty without inferring completion from provenance', () => {
  const restored = createMultiAngleExplorationState({
    exhaustedAngles: ['attribute-combination'],
    provenance: {
      'shared|shirt|halloween': ['demand-neighborhood', 'recent-sales'],
    },
  })

  assert.deepEqual(restored.attemptedAngles, [])
  assert.deepEqual(restored.completedAngles, [])
  assert.deepEqual(restored.emptyAngles, ['attribute-combination'])
  assert.deepEqual(restored.exhaustedAngles, ['attribute-combination'])

  const partiallyMigrated = createMultiAngleExplorationState({
    completedAngles: ['demand-neighborhood'],
    exhaustedAngles: ['demand-neighborhood', 'attribute-combination'],
  })
  assert.deepEqual(partiallyMigrated.attemptedAngles, ['demand-neighborhood'])
  assert.deepEqual(partiallyMigrated.completedAngles, [])
  assert.deepEqual(partiallyMigrated.emptyAngles, ['attribute-combination'])

  const currentFormat = createMultiAngleExplorationState({
    attemptedAngles: ['demand-neighborhood'],
    completedAngles: ['demand-neighborhood'],
    emptyAngles: ['attribute-combination'],
  })
  assert.deepEqual(currentFormat.attemptedAngles, ['demand-neighborhood'])
  assert.deepEqual(currentFormat.completedAngles, ['demand-neighborhood'])
  assert.deepEqual(currentFormat.emptyAngles, ['attribute-combination'])
})

test('starts a new cycle after winners but lets an exhausted cycle check newly derived candidates', () => {
  assert.equal(typeof multiAngleApi.multiAngleAutomationControl, 'function')

  assert.deepEqual(
    multiAngleApi.multiAngleAutomationControl({ status: 'winner-found' }),
    {
      action: 'new-cycle',
      label: '新しい調査を始める',
    },
  )
  assert.deepEqual(
    multiAngleApi.multiAngleAutomationControl({ status: 'exhausted' }),
    {
      action: 'resume',
      label: '目標まで探索を再開',
    },
  )
})

test('reopens only exhausted angles that gained unseen derived candidates', () => {
  assert.equal(typeof multiAngleApi.reopenExhaustedMultiAngleExploration, 'function')
  const exhausted = createMultiAngleExplorationState({
    status: 'exhausted',
    activeEventId: 'halloween',
    categoryId: 'shirt',
    currentAngleId: 'evergreen',
    angleIndex: 5,
    evidenceKeys: ['halloween carpenter shirt|shirt|halloween'],
    completedAngles: ['attribute-combination', 'recent-sales'],
    emptyAngles: ['demand-neighborhood', 'adjacent-product', 'market-gap', 'evergreen'],
    completedAt: '2026-08-01T00:00:00Z',
  })
  const reopened = multiAngleApi.reopenExhaustedMultiAngleExploration(exhausted, {
    'recent-sales': [{
      keyword: 'halloween retro carpenter shirt',
      categoryId: 'shirt',
      eventId: 'halloween',
    }],
    evergreen: [{
      keyword: 'retro carpenter shirt',
      categoryId: 'shirt',
      eventId: '',
    }],
  }, '2026-08-01T00:01:00Z')

  assert.equal(reopened.status, 'running')
  assert.equal(reopened.currentAngleId, 'recent-sales')
  assert.equal(reopened.angleIndex, 2)
  assert.equal(reopened.completedAt, '')
  assert.equal(reopened.completedAngles.includes('recent-sales'), false)
  assert.equal(reopened.emptyAngles.includes('evergreen'), false)
  assert.equal(reopened.emptyAngles.includes('market-gap'), true)
})

test('prepares an exhausted cycle as fresh idle work while preserving saved references and archives', () => {
  assert.equal(typeof multiAngleApi.prepareNewMultiAngleCycle, 'function')

  const savedSeasonalReferences = [{
    keyword: 'saved thanksgiving nurse shirt',
    eventId: 'thanksgiving',
    categoryId: 'shirt',
  }]
  const evidenceArchives = [{
    runId: 'prior-cycle',
    multiAngleExploration: { status: 'exhausted' },
  }]
  const prepared = multiAngleApi.prepareNewMultiAngleCycle({
    exploration: createMultiAngleExplorationState({
      status: 'exhausted',
      activeEventId: 'halloween',
      categoryId: 'shirt',
      currentAngleId: 'evergreen',
      angleIndex: 5,
      evidenceKeys: ['old|shirt|halloween'],
      provenance: { 'old|shirt|halloween': ['evergreen'] },
      queuedEvidenceKeys: ['queued|shirt|halloween'],
      currentBatchCandidates: [{
        keyword: 'queued',
        categoryId: 'shirt',
        eventId: 'halloween',
      }],
      retryQueue: [{
        keyword: 'retry',
        categoryId: 'shirt',
        eventId: 'halloween',
        attempts: 1,
        retryAt: '2026-08-01T00:00:00Z',
      }],
      failedEvidenceKeys: ['failed|shirt|halloween'],
      winnerKeywords: ['old winner'],
      resultLanes: {
        event: [{ keyword: 'old winner' }],
        evergreen: [{ keyword: 'old evergreen' }],
        seasonalReference: [{ keyword: 'old seasonal lead' }],
      },
      exhaustedAngles: [
        'demand-neighborhood',
        'attribute-combination',
        'recent-sales',
        'adjacent-product',
        'market-gap',
        'evergreen',
      ],
      startedAt: '2026-07-30T00:00:00Z',
      updatedAt: '2026-07-30T01:00:00Z',
      completedAt: '2026-07-30T01:00:00Z',
    }),
    pendingEvidenceAutomation: {
      active: false,
      scheduled: false,
      initialCount: 3,
      completedBatches: 2,
      currentStage: 'pending-everbee',
      targetKeywords: ['queued'],
    },
    savedSeasonalReferenceKeys: ['saved|shirt|thanksgiving'],
    savedSeasonalReferences,
    evidenceArchives,
    marketplaceInsightPlan: {
      eventId: 'halloween',
      categoryId: 'shirt',
      items: [{ query: 'old halloween shirt', status: 'planned' }],
    },
    marketplaceInsightMessage: 'old plan',
    candidates: [{ keyword: 'old halloween shirt' }],
    candidateCatalog: [{ keyword: 'old halloween shirt' }],
    crossNicheProposal: { candidates: [{ keyword: 'old cross niche shirt' }] },
  }, {
    activeEventId: 'christmas',
    categoryId: 'mug',
    eventSnapshot: {
      id: 'christmas',
      label: 'Christmas',
      searchTerm: 'christmas',
    },
    categorySnapshot: {
      id: 'mug',
      label: 'Mug',
      searchTerm: 'mug',
    },
    targetWinnerCount: 5,
  })

  assert.equal(prepared.exploration.status, 'idle')
  assert.equal(prepared.exploration.activeEventId, 'christmas')
  assert.equal(prepared.exploration.categoryId, 'mug')
  assert.equal(prepared.exploration.targetWinnerCount, 5)
  for (const key of [
    'evidenceKeys',
    'queuedEvidenceKeys',
    'currentBatchCandidates',
    'retryQueue',
    'failedEvidenceKeys',
    'winnerKeywords',
    'attemptedAngles',
    'completedAngles',
    'emptyAngles',
    'exhaustedAngles',
  ]) {
    assert.deepEqual(prepared.exploration[key], [])
  }
  assert.deepEqual(prepared.exploration.provenance, {})
  assert.deepEqual(prepared.exploration.resultLanes, {
    event: [],
    evergreen: [],
    seasonalReference: [],
  })
  assert.equal(prepared.exploration.startedAt, '')
  assert.equal(prepared.exploration.completedAt, '')
  assert.deepEqual(prepared.pendingEvidenceAutomation, {
    active: false,
    scheduled: false,
    initialCount: 0,
    completedBatches: 0,
    currentStage: '',
    targetKeywords: [],
  })
  assert.deepEqual(prepared.savedSeasonalReferenceKeys, ['saved|shirt|thanksgiving'])
  assert.deepEqual(prepared.savedSeasonalReferences, savedSeasonalReferences)
  assert.deepEqual(prepared.evidenceArchives, evidenceArchives)
  assert.equal(prepared.marketplaceInsightPlan, null)
  assert.equal(prepared.marketplaceInsightMessage, '')
  assert.deepEqual(prepared.candidates, [])
  assert.deepEqual(prepared.candidateCatalog, [])
  assert.equal(prepared.crossNicheProposal, null)
})

test('starts a reused custom-event id with no live evidence from the archived cycle', () => {
  const evidenceArchives = [{
    runId: 'custom-alpha-terminal',
    context: {
      eventId: 'custom-event',
      eventSnapshot: {
        id: 'custom-event',
        label: 'Alpha',
        searchTerm: 'alpha',
      },
      categoryId: 'shirt',
    },
  }]
  const prepared = multiAngleApi.prepareNewMultiAngleCycle({
    exploration: createMultiAngleExplorationState({
      status: 'winner-found',
      activeEventId: 'custom-event',
      categoryId: 'shirt',
    }),
    researchRows: [{
      keyword: 'teacher shirt',
      researchEventId: 'custom-event',
      researchCategoryId: 'shirt',
      eventSnapshot: {
        id: 'custom-event',
        label: 'Alpha',
        searchTerm: 'alpha',
      },
      opportunityLabel: 'A',
    }],
    researchRounds: {
      rounds: [{ id: 'multi-angle-evergreen-1' }],
      activeRoundId: 'multi-angle-evergreen-1',
      selectedRoundId: 'all',
    },
    candidateRoundId: 'multi-angle-evergreen-1',
    candidates: [{ keyword: 'teacher shirt' }],
    candidateCatalog: [{ keyword: 'teacher shirt' }],
    erankQueryPlan: [{ query: 'teacher shirt' }],
    restoredResearchSavedAt: '2026-07-30T00:00:00.000Z',
    restoredResultsAccepted: true,
    acceptExtensionResults: true,
    selectedResultKey: 'teacher shirt|shirt|custom-event',
    seoPlan: { keyword: 'teacher shirt' },
    evidenceArchives,
  }, {
    activeEventId: 'custom-event',
    categoryId: 'shirt',
    eventSnapshot: {
      id: 'custom-event',
      label: 'Beta',
      searchTerm: 'beta',
    },
    categorySnapshot: {
      id: 'shirt',
      label: 'Shirt',
      searchTerm: 'shirt',
    },
  })

  assert.deepEqual(prepared.evidenceArchives, evidenceArchives)
  assert.deepEqual(prepared.researchRows, [])
  assert.deepEqual(prepared.researchRounds, {
    rounds: [],
    activeRoundId: '',
    selectedRoundId: 'all',
  })
  assert.equal(prepared.candidateRoundId, '')
  assert.deepEqual(prepared.candidates, [])
  assert.deepEqual(prepared.candidateCatalog, [])
  assert.deepEqual(prepared.erankQueryPlan, [])
  assert.equal(prepared.restoredResearchSavedAt, '')
  assert.equal(prepared.restoredResultsAccepted, false)
  assert.equal(prepared.acceptExtensionResults, false)
  assert.equal(prepared.selectedResultKey, '')
  assert.equal(prepared.seoPlan, null)
})

test('reload preserves an active checkpoint for automatic resume without losing its batch', () => {
  assert.equal(typeof multiAngleApi.pauseMultiAngleWorkAfterReload, 'function')

  const snapshot = {
    exploration: createMultiAngleExplorationState({
      status: 'running',
      activeEventId: 'halloween',
      categoryId: 'shirt',
      currentBatchCandidates: [{
        keyword: 'spooky nurse shirt',
        eventId: 'halloween',
        categoryId: 'shirt',
      }],
      retryQueue: [{
        evidenceKey: 'ghost nurse shirt|shirt|halloween',
        candidate: {
          keyword: 'ghost nurse shirt',
          eventId: 'halloween',
          categoryId: 'shirt',
        },
        attempts: 1,
        retryAt: '2026-08-01T00:00:00.000Z',
      }],
    }),
    pendingEvidenceAutomation: {
      active: true,
      scheduled: true,
      initialCount: 1,
      completedBatches: 0,
      currentStage: 'pending-etsy',
      targetKeywords: ['spooky nurse shirt'],
    },
  }
  const restored = multiAngleApi.pauseMultiAngleWorkAfterReload(snapshot)

  assert.equal(restored.exploration.status, 'paused')
  assert.equal(restored.exploration.pauseReason, 'reload-required')
  assert.deepEqual(
    restored.exploration.currentBatchCandidates,
    snapshot.exploration.currentBatchCandidates,
  )
  assert.deepEqual(restored.exploration.retryQueue, snapshot.exploration.retryQueue)
  assert.equal(restored.pendingEvidenceAutomation.active, true)
  assert.equal(restored.pendingEvidenceAutomation.scheduled, false)
  assert.deepEqual(
    restored.pendingEvidenceAutomation.targetKeywords,
    ['spooky nurse shirt'],
  )
})

test('restores only saved targets that belong to the current batch or retry queue', () => {
  assert.equal(typeof multiAngleApi.restoredMultiAngleTargetKeywords, 'function')
  const exploration = createMultiAngleExplorationState({
    status: 'running',
    activeEventId: 'christmas',
    categoryId: 'shirt',
    currentBatchCandidates: [{
      keyword: 'christmas nurse shirt',
      eventId: 'christmas',
      categoryId: 'shirt',
    }],
    retryQueue: [{
      candidate: {
        keyword: 'christmas teacher shirt',
        eventId: 'christmas',
        categoryId: 'shirt',
      },
      attempts: 1,
      retryAt: '2026-08-01T00:00:00.000Z',
    }],
  })

  assert.deepEqual(
    multiAngleApi.restoredMultiAngleTargetKeywords(
      exploration,
      ['halloween nurse mug'],
    ),
    ['christmas nurse shirt', 'christmas teacher shirt'],
  )
  assert.deepEqual(
    multiAngleApi.restoredMultiAngleTargetKeywords(
      exploration,
      ['christmas teacher shirt'],
    ),
    ['christmas teacher shirt'],
  )
})

test('distinguishes ordinary Marketplace restore from meaningful multi-angle context', () => {
  assert.equal(typeof multiAngleApi.hasMeaningfulMultiAngleContext, 'function')
  assert.equal(typeof multiAngleApi.restoreMarketplaceInsightPlanForResearchFlow, 'function')
  const ordinaryExploration = createMultiAngleExplorationState({ status: 'idle' })
  const ordinaryContext = {
    eventId: 'halloween',
    categoryId: 'shirt',
    eventSnapshot: {
      id: 'halloween',
      label: 'Halloween',
      searchTerm: 'halloween',
    },
  }
  const matchingPlan = {
    eventId: 'halloween',
    categoryId: 'shirt',
    items: [{ query: 'halloween nurse shirt', status: 'planned' }],
  }
  const mismatchedPlan = {
    eventId: 'christmas',
    categoryId: 'mug',
    items: [{ query: 'christmas nurse mug', status: 'planned' }],
  }
  const legacyPlan = {
    items: [{ query: 'legacy halloween shirt', status: 'planned' }],
  }

  assert.equal(
    multiAngleApi.hasMeaningfulMultiAngleContext(ordinaryExploration),
    false,
  )
  assert.equal(
    multiAngleApi.restoreMarketplaceInsightPlanForResearchFlow(
      matchingPlan,
      {
        exploration: ordinaryExploration,
        ordinaryContext,
      },
    ),
    matchingPlan,
  )
  assert.equal(
    multiAngleApi.restoreMarketplaceInsightPlanForResearchFlow(
      mismatchedPlan,
      {
        exploration: ordinaryExploration,
        ordinaryContext,
      },
    ),
    null,
  )
  assert.equal(
    multiAngleApi.restoreMarketplaceInsightPlanForResearchFlow(
      legacyPlan,
      {
        exploration: ordinaryExploration,
        ordinaryContext,
      },
    ),
    legacyPlan,
  )

  const activeExploration = createMultiAngleExplorationState({
    status: 'running',
    activeEventId: 'christmas',
    categoryId: 'shirt',
    currentBatchCandidates: [{
      keyword: 'christmas nurse shirt',
      eventId: 'christmas',
      categoryId: 'shirt',
    }],
  })
  assert.equal(
    multiAngleApi.hasMeaningfulMultiAngleContext(activeExploration),
    true,
  )
  assert.equal(
    multiAngleApi.restoreMarketplaceInsightPlanForResearchFlow(
      matchingPlan,
      {
        exploration: activeExploration,
        ordinaryContext,
      },
    ),
    null,
  )
})

test('migrates a legacy custom-event Marketplace plan only for the matching ordinary form context', () => {
  const ordinaryExploration = createMultiAngleExplorationState({ status: 'idle' })
  const customEventSnapshot = {
    id: 'custom-event',
    label: 'Alpha Launch',
    searchTerm: 'alpha launch',
  }
  const categorySnapshot = {
    id: 'shirt',
    label: 'Shirt',
  }
  const legacyCustomPlan = {
    eventId: 'custom-event',
    categoryId: 'shirt',
    items: [{ query: 'alpha launch shirt', status: 'planned' }],
  }

  assert.deepEqual(
    multiAngleApi.restoreMarketplaceInsightPlanForResearchFlow(
      legacyCustomPlan,
      {
        exploration: ordinaryExploration,
        ordinaryContext: {
          eventId: 'custom-event',
          categoryId: 'shirt',
          eventSnapshot: customEventSnapshot,
          categorySnapshot,
        },
      },
    ),
    {
      ...legacyCustomPlan,
      eventSnapshot: customEventSnapshot,
      categorySnapshot,
    },
  )
  assert.equal(
    multiAngleApi.restoreMarketplaceInsightPlanForResearchFlow(
      legacyCustomPlan,
      {
        exploration: ordinaryExploration,
        ordinaryContext: {
          eventId: 'custom-event',
          categoryId: 'mug',
          eventSnapshot: customEventSnapshot,
        },
      },
    ),
    null,
  )

  const activeCustomExploration = createMultiAngleExplorationState({
    status: 'running',
    activeEventId: 'custom-event',
    categoryId: 'shirt',
    eventSnapshot: customEventSnapshot,
    categorySnapshot,
    currentBatchCandidates: [{
      keyword: 'alpha launch shirt',
      eventId: 'custom-event',
      categoryId: 'shirt',
    }],
  })
  assert.equal(
    multiAngleApi.restoreMarketplaceInsightPlanForResearchFlow(
      legacyCustomPlan,
      {
        exploration: activeCustomExploration,
        ordinaryContext: {
          eventId: 'custom-event',
          categoryId: 'shirt',
          eventSnapshot: customEventSnapshot,
          categorySnapshot,
        },
      },
    ),
    null,
  )
})

test('explicit normal discovery releases terminal context while selector changes alone do not', () => {
  const terminal = createMultiAngleExplorationState({
    status: 'winner-found',
    activeEventId: 'halloween',
    categoryId: 'shirt',
    eventSnapshot: {
      id: 'halloween',
      label: 'Halloween',
      searchTerm: 'halloween',
    },
    categorySnapshot: {
      id: 'shirt',
      label: 'Shirt',
      searchTerm: 'shirt',
    },
    winnerKeywords: ['halloween nurse shirt'],
  })
  const selected = {
    eventId: 'christmas',
    categoryId: 'mug',
    eventSnapshot: {
      id: 'christmas',
      label: 'Christmas',
      searchTerm: 'christmas',
    },
    categorySnapshot: {
      id: 'mug',
      label: 'Mug',
      searchTerm: 'mug',
    },
  }
  const beforeAction = multiAngleApi.resolveMultiAngleResearchOptions(
    terminal,
    selected,
  )
  const archived = [{ runId: 'halloween-terminal' }]
  const afterAction = multiAngleApi.prepareNewMultiAngleCycle({
    exploration: terminal,
    pendingEvidenceAutomation: {},
    evidenceArchives: archived,
  }, {
    activeEventId: selected.eventId,
    categoryId: selected.categoryId,
    eventSnapshot: selected.eventSnapshot,
    categorySnapshot: selected.categorySnapshot,
  })
  const afterActionOptions = multiAngleApi.resolveMultiAngleResearchOptions(
    afterAction.exploration,
    selected,
  )

  assert.equal(beforeAction.eventId, 'halloween')
  assert.equal(beforeAction.categoryId, 'shirt')
  assert.equal(afterAction.exploration.status, 'idle')
  assert.equal(afterActionOptions.eventId, 'christmas')
  assert.equal(afterActionOptions.categoryId, 'mug')
  assert.deepEqual(afterAction.evidenceArchives, archived)
})

test('persists terminal evidence once before allowing an explicit new cycle', async () => {
  assert.equal(
    typeof multiAngleApi.persistTerminalMultiAngleEvidenceBeforeReset,
    'function',
  )
  const exploration = createMultiAngleExplorationState({
    status: 'winner-found',
    activeEventId: 'custom-event',
    categoryId: 'mug',
    eventSnapshot: {
      id: 'custom-event',
      label: 'Alpha Launch',
      searchTerm: 'alpha launch',
    },
  })
  const archiveRecord = {
    runId: 'alpha-terminal',
    eventId: 'custom-event',
    categoryId: 'mug',
    eventSnapshot: exploration.eventSnapshot,
  }
  const persistedRecords = []
  let persistCalls = 0
  const persistArchiveRecord = async (record) => {
    persistCalls += 1
    persistedRecords.push(JSON.parse(JSON.stringify(record)))
    return true
  }
  const hasArchivedRecord = (record) => persistedRecords.some(
    (persisted) => persisted.runId === record.runId,
  )

  const first = await multiAngleApi.persistTerminalMultiAngleEvidenceBeforeReset({
    exploration,
    archiveRecord,
    hasArchivedRecord,
    persistArchiveRecord,
  })
  const second = await multiAngleApi.persistTerminalMultiAngleEvidenceBeforeReset({
    exploration,
    archiveRecord,
    hasArchivedRecord,
    persistArchiveRecord,
  })
  const reloadedRecords = JSON.parse(JSON.stringify(persistedRecords))

  assert.deepEqual(first, { ok: true, persisted: true })
  assert.deepEqual(second, { ok: true, persisted: false })
  assert.equal(persistCalls, 1)
  assert.deepEqual(reloadedRecords, [archiveRecord])
})

test('keeps terminal exploration intact when its archive cannot be persisted', async () => {
  const exploration = createMultiAngleExplorationState({
    status: 'exhausted',
    activeEventId: 'halloween',
    categoryId: 'shirt',
    winnerKeywords: [],
  })
  const before = JSON.parse(JSON.stringify(exploration))
  const result = await multiAngleApi.persistTerminalMultiAngleEvidenceBeforeReset({
    exploration,
    archiveRecord: { runId: 'failed-terminal' },
    hasArchivedRecord: () => false,
    persistArchiveRecord: async () => false,
  })

  assert.deepEqual(result, {
    ok: false,
    persisted: false,
    error: 'archive-persist-failed',
  })
  assert.deepEqual(exploration, before)
})

test('matches researched evidence to a multi-angle candidate by keyword event category and lane', () => {
  assert.equal(typeof multiAngleApi.researchRowForMultiAngleCandidate, 'function')
  const halloween = {
    keyword: 'nurse life shirt',
    researchEventId: 'halloween',
    researchCategoryId: 'shirt',
    opportunityLabel: 'A',
  }
  const christmas = {
    keyword: 'nurse life shirt',
    researchEventId: 'christmas',
    researchCategoryId: 'shirt',
    opportunityLabel: 'B',
  }
  const legacy = {
    keyword: 'nurse life shirt',
    opportunityLabel: 'A',
  }
  const explicitEvergreen = {
    keyword: 'nurse life shirt',
    researchEventId: '',
    researchCategoryId: 'shirt',
    intentTrack: 'evergreen',
  }
  const christmasCandidate = {
    keyword: 'nurse life shirt',
    eventId: 'christmas',
    categoryId: 'shirt',
    resultLane: 'event',
  }
  const evergreenCandidate = {
    keyword: 'nurse life shirt',
    eventId: '',
    categoryId: 'shirt',
    resultLane: 'evergreen',
  }

  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(
      [halloween, legacy],
      christmasCandidate,
    ),
    null,
  )
  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(
      [halloween, christmas],
      christmasCandidate,
    ),
    christmas,
  )
  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(
      [halloween, legacy],
      evergreenCandidate,
    ),
    null,
  )
  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(
      [halloween, explicitEvergreen],
      evergreenCandidate,
    ),
    explicitEvergreen,
  )
  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(
      [explicitEvergreen],
      { ...christmasCandidate, resultLane: 'seasonal-reference' },
    ),
    null,
  )
})

test('rejects contradictory and seasonal evidence for event and evergreen candidates', () => {
  const christmasCandidate = {
    keyword: 'nurse life shirt',
    eventId: 'christmas',
    categoryId: 'shirt',
    resultLane: 'event',
  }
  const evergreenCandidate = {
    keyword: 'nurse life shirt',
    eventId: '',
    categoryId: 'shirt',
    resultLane: 'evergreen',
  }
  const christmasMarkedEvergreen = {
    keyword: 'nurse life shirt',
    researchEventId: 'christmas',
    researchCategoryId: 'shirt',
    intentTrack: 'evergreen',
    resultLane: 'evergreen',
  }
  const eventlessEventLane = {
    keyword: 'nurse life shirt',
    researchEventId: '',
    researchCategoryId: 'shirt',
    intentTrack: 'event-specific',
    resultLane: 'event',
  }
  const christmasSeasonalReference = {
    keyword: 'nurse life shirt',
    researchEventId: 'christmas',
    researchCategoryId: 'shirt',
    intentTrack: 'event-specific',
    resultLane: 'seasonal-reference',
  }
  const exactChristmasEvent = {
    keyword: 'nurse life shirt',
    researchEventId: 'christmas',
    researchCategoryId: 'shirt',
    intentTrack: 'event-specific',
    resultLane: 'event',
  }
  const explicitEventlessEvergreen = {
    keyword: 'nurse life shirt',
    researchEventId: '',
    researchCategoryId: 'shirt',
    intentTrack: 'evergreen',
    resultLane: 'evergreen',
  }

  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(
      [christmasMarkedEvergreen],
      evergreenCandidate,
    ),
    null,
  )
  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(
      [christmasMarkedEvergreen],
      christmasCandidate,
    ),
    null,
  )
  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(
      [eventlessEventLane],
      christmasCandidate,
    ),
    null,
  )
  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(
      [christmasSeasonalReference],
      christmasCandidate,
    ),
    null,
  )
  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(
      [exactChristmasEvent],
      christmasCandidate,
    ),
    exactChristmasEvent,
  )
  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(
      [explicitEventlessEvergreen],
      evergreenCandidate,
    ),
    explicitEventlessEvergreen,
  )
})

test('merges research rows only after assigning their exact event category and lane context', () => {
  assert.equal(typeof multiAngleApi.researchRowContextKey, 'function')
  assert.equal(typeof multiAngleApi.mergeResearchRowsByContext, 'function')
  const keyword = 'nurse life shirt'
  const christmasShirt = {
    keyword,
    researchEventId: 'christmas',
    researchCategoryId: 'shirt',
    intentTrack: 'event-specific',
    resultLane: 'event',
    erankSearchVolume: 100,
  }
  const evergreenShirt = {
    keyword,
    researchEventId: '',
    researchCategoryId: 'shirt',
    intentTrack: 'evergreen',
    resultLane: 'evergreen',
    erankSearchVolume: 80,
  }
  const legacy = {
    keyword,
    erankSearchVolume: 10,
  }
  const imported = [{
    keyword,
    importContext: 'christmas-shirt',
    topMonthlySales: 12,
  }, {
    keyword,
    importContext: 'evergreen-shirt',
    topMonthlySales: 9,
  }, {
    keyword,
    importContext: 'christmas-mug',
    topMonthlySales: 5,
  }]
  const contextualize = (row) => {
    if (row.importContext === 'evergreen-shirt') {
      return {
        ...row,
        researchEventId: '',
        researchCategoryId: 'shirt',
        intentTrack: 'evergreen',
        resultLane: 'evergreen',
      }
    }
    if (row.importContext === 'christmas-mug') {
      return {
        ...row,
        researchEventId: 'christmas',
        researchCategoryId: 'mug',
        intentTrack: 'event-specific',
        resultLane: 'event',
      }
    }
    return {
      ...row,
      researchEventId: 'christmas',
      researchCategoryId: 'shirt',
      intentTrack: 'event-specific',
      resultLane: 'event',
    }
  }
  const merged = multiAngleApi.mergeResearchRowsByContext(
    [christmasShirt, evergreenShirt, legacy],
    imported,
    {
      contextualize,
      merge: (existing, incoming) => ({ ...existing, ...incoming }),
    },
  )
  const restored = JSON.parse(JSON.stringify(merged))
  const keys = restored.map(multiAngleApi.researchRowContextKey)

  assert.equal(restored.length, 4)
  assert.equal(new Set(keys).size, 4)
  assert.equal(
    restored.find((row) => row.researchEventId === 'christmas' && row.researchCategoryId === 'shirt')
      .topMonthlySales,
    12,
  )
  assert.equal(
    restored.find((row) => row.researchEventId === '' && row.researchCategoryId === 'shirt')
      .topMonthlySales,
    9,
  )
  assert.equal(
    restored.find((row) => row.researchCategoryId === 'mug').topMonthlySales,
    5,
  )
  assert.equal(restored.filter((row) => !Object.hasOwn(row, 'researchEventId')).length, 1)
  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(restored, {
      keyword,
      eventId: 'christmas',
      categoryId: 'shirt',
      resultLane: 'event',
    }).topMonthlySales,
    12,
  )
  assert.equal(
    multiAngleApi.researchRowForMultiAngleCandidate(restored, {
      keyword,
      eventId: '',
      categoryId: 'shirt',
      resultLane: 'evergreen',
    }).topMonthlySales,
    9,
  )
  assert.notEqual(
    multiAngleApi.researchRowContextKey(christmasShirt),
    multiAngleApi.researchRowContextKey({
      ...christmasShirt,
      intentTrack: 'evergreen',
      resultLane: 'evergreen',
    }),
  )
})

test('reload leaves idle and terminal multi-angle states terminal', () => {
  assert.equal(typeof multiAngleApi.pauseMultiAngleWorkAfterReload, 'function')

  for (const status of ['idle', 'winner-found', 'exhausted']) {
    const restored = multiAngleApi.pauseMultiAngleWorkAfterReload({
      exploration: createMultiAngleExplorationState({ status }),
      pendingEvidenceAutomation: {
        active: true,
        scheduled: true,
        targetKeywords: [],
      },
    })
    assert.equal(restored.exploration.status, status)
    assert.equal(restored.pendingEvidenceAutomation.active, false)
    assert.equal(restored.pendingEvidenceAutomation.scheduled, false)
  }
})

test('starting prepared idle work replaces its old context with the current cycle context', () => {
  const prepared = multiAngleApi.prepareNewMultiAngleCycle({}, {
    activeEventId: 'halloween',
    categoryId: 'shirt',
    eventSnapshot: {
      id: 'halloween',
      label: 'Halloween',
      searchTerm: 'halloween',
    },
    categorySnapshot: {
      id: 'shirt',
      label: 'Shirt',
      searchTerm: 'shirt',
    },
  }).exploration
  const started = startMultiAngleExploration(prepared, {
    activeEventId: 'christmas',
    categoryId: 'mug',
    eventSnapshot: {
      id: 'christmas',
      label: 'Christmas',
      searchTerm: 'christmas',
    },
    categorySnapshot: {
      id: 'mug',
      label: 'Mug',
      searchTerm: 'mug',
    },
  })

  assert.equal(started.status, 'running')
  assert.equal(started.activeEventId, 'christmas')
  assert.equal(started.eventSnapshot.searchTerm, 'christmas')
  assert.equal(started.categoryId, 'mug')
  assert.equal(started.categorySnapshot.searchTerm, 'mug')
})

test('winner-found and exhausted runs retain their fixed snapshots until a new cycle is prepared', () => {
  const fixedContext = {
    activeEventId: 'custom-event',
    categoryId: 'shirt',
    eventSnapshot: {
      id: 'custom-event',
      label: 'Alpha Launch',
      jpLabel: 'Alpha Launch',
      searchTerm: 'alpha launch',
    },
    categorySnapshot: {
      id: 'shirt',
      label: 'Shirt',
      searchTerm: 'shirt',
    },
  }
  const selectedNextCycle = {
    eventId: 'christmas',
    categoryId: 'mug',
    eventSnapshot: {
      id: 'christmas',
      label: 'Christmas',
      jpLabel: 'Christmas',
      searchTerm: 'christmas',
    },
    categorySnapshot: {
      id: 'mug',
      label: 'Mug',
      searchTerm: 'mug',
    },
  }

  for (const status of ['winner-found', 'exhausted']) {
    const terminal = createMultiAngleExplorationState({
      ...fixedContext,
      status,
    })
    const resolved = multiAngleApi.resolveMultiAngleResearchContext(
      terminal,
      selectedNextCycle,
    )

    assert.equal(resolved.fixed, true)
    assert.equal(resolved.eventId, 'custom-event')
    assert.equal(resolved.eventSnapshot.searchTerm, 'alpha launch')
    assert.equal(resolved.categoryId, 'shirt')
    assert.equal(resolved.categorySnapshot.searchTerm, 'shirt')
  }
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
    restored.currentBatchCandidates[0],
    { code: 'page-timeout', retryAfterMs: 60_000 },
    '2026-07-30T00:02:00Z',
  )

  assert.equal(restored.retryQueue.length, 0)
  assert.equal(restored.currentBatchCandidates[0].retryAttempts, 1)
  assert.equal(twice.retryQueue.length, 0)
  assert.deepEqual(twice.failedEvidenceKeys, [candidateEvidenceKey(candidate)])
})

test('restores a dequeued retry through a global pause without pending targets or retry-wait loops', () => {
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
  const paused = pauseMultiAngleExploration(
    due.state,
    'service-unavailable',
    '2026-07-30T00:01:01Z',
  )
  const restored = createMultiAngleExplorationState(
    JSON.parse(JSON.stringify(paused)),
  )
  const resumed = resumeMultiAngleExploration(restored)
  const recovered = nextMultiAngleBatch({
    state: resumed,
    pools: {},
    now: '2026-07-30T00:02:00Z',
  })
  const twice = recordMultiAngleFailure(
    recovered.state,
    recovered.candidates[0],
    { code: 'page-timeout', retryAfterMs: 60_000 },
    '2026-07-30T00:02:01Z',
  )

  assert.equal(due.state.retryQueue.length, 0)
  assert.equal(due.state.currentBatchCandidates[0].retryAttempts, 1)
  assert.equal(recovered.reason, 'current-batch')
  assert.deepEqual(recovered.candidates.map((item) => item.keyword), [candidate.keyword])
  assert.equal(twice.retryQueue.length, 0)
  assert.deepEqual(twice.failedEvidenceKeys, [candidateEvidenceKey(candidate)])
})

test('normalizes a legacy retry without a valid retry time as immediately recoverable', () => {
  const candidate = {
    keyword: 'legacy retry shirt',
    categoryId: 'shirt',
    eventId: 'halloween',
  }
  const restored = createMultiAngleExplorationState({
    ...startMultiAngleExploration({}, context),
    retryQueue: [{
      candidate,
      attempts: 1,
      retryAt: '',
    }],
  })
  const recovered = nextMultiAngleBatch({
    state: restored,
    pools: {},
    now: '2026-07-30T00:01:00Z',
  })

  assert.equal(recovered.reason, 'retry-ready')
  assert.deepEqual(recovered.candidates.map((item) => item.keyword), [candidate.keyword])
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
  const afterOther = recordMultiAngleBatch(waiting.state, waiting.candidates.map((item) => ({
    ...item,
    evidenceState: { status: 'verified' },
    opportunityLabel: 'C',
  })), '2026-07-30T00:00:45Z')
  const due = nextMultiAngleBatch({
    state: afterOther,
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

test('global failure stays paused when another row reaches the winner target', () => {
  const batch = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, {
      ...context,
      targetWinnerCount: 1,
    }),
    pools: {
      'demand-neighborhood': [
        { keyword: 'unresolved', categoryId: 'shirt', eventId: 'halloween' },
        { keyword: 'winner', categoryId: 'shirt', eventId: 'halloween' },
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
    opportunityLabel: 'A',
  }], '2026-07-30T00:01:00Z')

  assert.equal(recorded.status, 'paused')
  assert.equal(recorded.pauseReason, 'service-unavailable')
  assert.equal(recorded.completedAt, '')
  assert.deepEqual(recorded.winnerKeywords, ['winner'])
  assert.deepEqual(recorded.queuedEvidenceKeys, [candidateEvidenceKey(batch.candidates[0])])

  const resumed = resumeMultiAngleExploration(recorded, '2026-07-30T00:02:00Z')
  const completed = recordMultiAngleBatch(resumed, [{
    ...batch.candidates[0],
    evidenceState: { status: 'verified' },
    opportunityLabel: 'C',
  }], '2026-07-30T00:03:00Z')

  assert.equal(completed.status, 'winner-found')
  assert.equal(completed.completedAt, '2026-07-30T00:03:00Z')
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

test('reload resume and external completion use the persisted current batch', () => {
  const batch = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, {
      ...context,
      targetWinnerCount: 1,
    }),
    pools: {
      'demand-neighborhood': [{
        keyword: 'persisted winner shirt',
        categoryId: 'shirt',
        eventId: 'halloween',
      }],
    },
  })
  const restored = createMultiAngleExplorationState(
    JSON.parse(JSON.stringify(batch.state)),
  )

  assert.deepEqual(
    (restored.currentBatchCandidates ?? []).map((candidate) => candidate.keyword),
    ['persisted winner shirt'],
  )

  const paused = pauseMultiAngleExploration(restored, 'input-context-changed')
  const resumed = resumeMultiAngleExploration(
    createMultiAngleExplorationState(JSON.parse(JSON.stringify(paused))),
  )
  const completed = recordMultiAngleBatch(resumed, [{
    ...resumed.currentBatchCandidates[0],
    evidenceState: { status: 'verified' },
    opportunityLabel: 'A',
  }])

  assert.equal(completed.status, 'winner-found')
  assert.deepEqual(completed.winnerKeywords, ['persisted winner shirt'])
  assert.deepEqual(completed.currentBatchCandidates, [])
})

test('selector changes pause the fixed research context and resume its batch', () => {
  assert.equal(typeof multiAngleApi.resolveMultiAngleResearchContext, 'function')
  assert.equal(typeof multiAngleApi.pauseMultiAngleForContextChange, 'function')

  const batch = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, context),
    pools: {
      'demand-neighborhood': [{
        keyword: 'fixed halloween niche shirt',
        categoryId: 'shirt',
        eventId: 'halloween',
      }],
    },
  })
  const selectedNextCycle = {
    eventId: 'christmas',
    categoryId: 'mug',
  }
  const fixed = multiAngleApi.resolveMultiAngleResearchContext(
    batch.state,
    selectedNextCycle,
  )
  const paused = multiAngleApi.pauseMultiAngleForContextChange(
    batch.state,
    selectedNextCycle,
    'input-context-changed',
    '2026-07-30T00:01:00Z',
  )

  assert.deepEqual(fixed, {
    eventId: 'halloween',
    categoryId: 'shirt',
    fixed: true,
  })
  assert.equal(paused.status, 'paused')
  assert.equal(paused.pauseReason, 'input-context-changed')
  assert.deepEqual(
    paused.currentBatchCandidates.map((candidate) => candidate.keyword),
    ['fixed halloween niche shirt'],
  )

  const resumed = resumeMultiAngleExploration(paused)
  const completed = recordMultiAngleBatch(resumed, [{
    ...resumed.currentBatchCandidates[0],
    evidenceState: { status: 'verified' },
    opportunityLabel: 'C',
  }])

  assert.equal(completed.status, 'running')
  assert.deepEqual(completed.evidenceKeys, ['fixed halloween niche shirt|shirt|halloween'])
})

test('custom event snapshot survives Alpha to Beta input changes and reload', () => {
  assert.equal(typeof multiAngleApi.resolveMultiAngleResearchOptions, 'function')

  const alphaEvent = {
    id: 'custom-event',
    label: 'Alpha Launch',
    jpLabel: 'Alpha Launch',
    searchTerm: 'alpha launch',
    displayTerm: 'Alpha Launch',
    month: 0,
    defaultYear: 2026,
    targets: ['teacher'],
    intents: ['alpha launch gift'],
    designAngles: ['clear typography'],
    peakDate: '',
    peakStatus: 'evergreen',
  }
  const shirt = {
    id: 'shirt',
    label: 'Shirt',
    searchTerm: 'shirt',
    tags: ['shirt', 'graphic tee'],
  }
  const started = startMultiAngleExploration({}, {
    activeEventId: alphaEvent.id,
    categoryId: shirt.id,
    eventSnapshot: alphaEvent,
    categorySnapshot: shirt,
  })
  const reloaded = createMultiAngleExplorationState(
    JSON.parse(JSON.stringify(started)),
  )
  const betaSelection = {
    eventId: 'custom-event',
    categoryId: 'shirt',
    eventSnapshot: {
      ...alphaEvent,
      label: 'Beta Launch',
      jpLabel: 'Beta Launch',
      searchTerm: 'beta launch',
      displayTerm: 'Beta Launch',
      intents: ['beta launch gift'],
    },
    categorySnapshot: shirt,
  }

  const paused = multiAngleApi.pauseMultiAngleForContextChange(
    reloaded,
    betaSelection,
    'input-context-changed',
  )
  const resumed = resumeMultiAngleExploration(paused)
  const fixed = multiAngleApi.resolveMultiAngleResearchContext(
    resumed,
    betaSelection,
  )
  const options = multiAngleApi.resolveMultiAngleResearchOptions(
    resumed,
    {
      eventId: 'custom-event',
      customEventName: 'Beta Launch',
      categoryId: 'shirt',
      eventSnapshot: betaSelection.eventSnapshot,
      categorySnapshot: shirt,
      year: 2026,
    },
  )

  assert.equal(paused.status, 'paused')
  assert.equal(fixed.eventSnapshot.searchTerm, 'alpha launch')
  assert.equal(fixed.eventSnapshot.label, 'Alpha Launch')
  assert.equal(fixed.eventSnapshot.peakStatus, 'evergreen')
  assert.equal(options.eventId, 'custom-event')
  assert.equal(options.customEventName, 'Alpha Launch')
  assert.equal(options.categoryId, 'shirt')
})

test('custom event candidate and imported row keep the frozen Alpha metadata after selector changes', () => {
  assert.equal(typeof multiAngleApi.resolveMultiAngleCandidateResearchContext, 'function')
  assert.equal(typeof multiAngleApi.resolveMultiAngleImportedResearchContext, 'function')

  const alphaEvent = {
    id: 'custom-event',
    label: 'Alpha Launch',
    jpLabel: 'Alpha Launch',
    searchTerm: 'alpha launch',
    displayTerm: 'Alpha Launch',
    month: 0,
  }
  const shirt = {
    id: 'shirt',
    label: 'Shirt',
    searchTerm: 'shirt',
    tags: ['shirt'],
  }
  const started = startMultiAngleExploration({}, {
    activeEventId: alphaEvent.id,
    categoryId: shirt.id,
    eventSnapshot: alphaEvent,
    categorySnapshot: shirt,
  })
  const betaMugSelection = {
    eventId: 'custom-event',
    categoryId: 'mug',
    eventSnapshot: {
      ...alphaEvent,
      label: 'Beta Launch',
      jpLabel: 'Beta Launch',
      searchTerm: 'beta launch',
      displayTerm: 'Beta Launch',
    },
    categorySnapshot: {
      id: 'mug',
      label: 'Mug',
      searchTerm: 'mug',
      tags: ['mug'],
    },
  }
  const candidateContext = multiAngleApi.resolveMultiAngleCandidateResearchContext(
    started,
    {
      keyword: 'alpha launch teacher shirt',
      eventId: 'custom-event',
      categoryId: 'shirt',
    },
    betaMugSelection,
  )
  const candidate = {
    keyword: 'alpha launch teacher shirt',
    eventId: candidateContext.eventId,
    eventLabel: candidateContext.eventSnapshot.jpLabel,
    eventSearchTerm: candidateContext.eventSnapshot.searchTerm,
    categoryId: candidateContext.categoryId,
    categoryLabel: candidateContext.categorySnapshot.label,
    categorySearchTerm: candidateContext.categorySnapshot.searchTerm,
  }
  const imported = multiAngleApi.resolveMultiAngleImportedResearchContext(
    started,
    {
      row: {},
      existingRow: {},
      candidate,
      selected: betaMugSelection,
    },
  )

  assert.equal(candidateContext.eventSnapshot.label, 'Alpha Launch')
  assert.equal(candidateContext.eventSnapshot.searchTerm, 'alpha launch')
  assert.equal(candidateContext.categorySnapshot.id, 'shirt')
  assert.deepEqual(imported, {
    eventId: 'custom-event',
    eventLabel: 'Alpha Launch',
    eventSearchTerm: 'alpha launch',
    categoryId: 'shirt',
    categoryLabel: 'Shirt',
    categorySearchTerm: 'shirt',
  })
})

test('first Etsy import accepts a null existing row', () => {
  const halloween = {
    id: 'halloween',
    label: 'Halloween',
    jpLabel: 'ハロウィン',
    searchTerm: 'halloween',
    displayTerm: 'Halloween',
    month: 10,
  }
  const shirt = {
    id: 'shirt',
    label: 'Shirt',
    searchTerm: 'shirt',
    tags: ['shirt'],
  }
  const started = startMultiAngleExploration({}, {
    activeEventId: halloween.id,
    categoryId: shirt.id,
    eventSnapshot: halloween,
    categorySnapshot: shirt,
  })

  const imported = multiAngleApi.resolveMultiAngleImportedResearchContext(
    started,
    {
      row: { etsySearches30d: 0, etsyListings: 0 },
      existingRow: null,
      candidate: { eventId: 'halloween', categoryId: 'shirt' },
    },
  )

  assert.deepEqual(imported, {
    eventId: 'halloween',
    eventLabel: 'ハロウィン',
    eventSearchTerm: 'halloween',
    categoryId: 'shirt',
    categoryLabel: 'Shirt',
    categorySearchTerm: 'shirt',
  })
})

test('automatic Etsy batches defer related-candidate regeneration until the batch is idle', () => {
  assert.equal(typeof multiAngleApi.shouldRegenerateMarketplaceCandidates, 'function')
  assert.equal(multiAngleApi.shouldRegenerateMarketplaceCandidates({
    addedCount: 9,
    autoRunning: true,
  }), false)
  assert.equal(multiAngleApi.shouldRegenerateMarketplaceCandidates({
    addedCount: 9,
    autoRunning: false,
  }), true)
  assert.equal(multiAngleApi.shouldRegenerateMarketplaceCandidates({
    addedCount: 0,
    autoRunning: false,
  }), false)
})

test('Marketplace Insights date-axis labels are not research keywords', () => {
  assert.equal(typeof multiAngleApi.isMarketplaceDateAxisLabel, 'function')
  assert.equal(multiAngleApi.isMarketplaceDateAxisLabel('jul 1'), true)
  assert.equal(multiAngleApi.isMarketplaceDateAxisLabel('September 30'), true)
  assert.equal(multiAngleApi.isMarketplaceDateAxisLabel('7月1日'), true)
  assert.equal(multiAngleApi.isMarketplaceDateAxisLabel('july 4th shirt'), false)
  assert.equal(multiAngleApi.isMarketplaceDateAxisLabel('halloween nurse shirt'), false)
})

test('fixed imports replace stale row metadata consistently and keep only explicit evergreen eventless', () => {
  const christmas = {
    id: 'christmas',
    label: 'Christmas',
    jpLabel: 'Christmas',
    searchTerm: 'christmas',
    displayTerm: 'Christmas',
    month: 12,
  }
  const mug = {
    id: 'mug',
    label: 'Mug',
    searchTerm: 'mug',
    tags: ['mug'],
  }
  const frozen = startMultiAngleExploration({}, {
    activeEventId: christmas.id,
    categoryId: mug.id,
    eventSnapshot: christmas,
    categorySnapshot: mug,
  })
  const stale = multiAngleApi.resolveMultiAngleImportedResearchContext(
    frozen,
    {
      row: {
        researchEventId: 'halloween',
        researchEventLabel: 'Halloween',
        researchEventSearchTerm: 'halloween',
        researchCategoryId: 'shirt',
        researchCategoryLabel: 'Shirt',
        researchCategorySearchTerm: 'shirt',
      },
    },
  )
  const evergreen = multiAngleApi.resolveMultiAngleImportedResearchContext(
    frozen,
    {
      row: {
        researchEventId: '',
        intentTrack: 'evergreen',
        researchCategoryId: 'shirt',
        researchCategoryLabel: 'Shirt',
        researchCategorySearchTerm: 'shirt',
      },
    },
  )

  assert.deepEqual(stale, {
    eventId: 'christmas',
    eventLabel: 'Christmas',
    eventSearchTerm: 'christmas',
    categoryId: 'mug',
    categoryLabel: 'Mug',
    categorySearchTerm: 'mug',
  })
  assert.deepEqual(evergreen, {
    eventId: '',
    eventLabel: 'Evergreen',
    eventSearchTerm: '',
    categoryId: 'mug',
    categoryLabel: 'Mug',
    categorySearchTerm: 'mug',
  })
})

test('eRank narrowing stays fixed while CSV export preserves explicit row context', () => {
  assert.equal(typeof erankQueryApi.extractErankSpecificTokens, 'function')
  assert.equal(typeof multiAngleApi.resolveMultiAngleExportResearchContext, 'function')

  const alphaEvent = {
    id: 'custom-event',
    label: 'Alpha Launch',
    jpLabel: 'Alpha Launch',
    searchTerm: 'alpha launch',
    displayTerm: 'Alpha Launch',
    month: 0,
  }
  const shirt = {
    id: 'shirt',
    label: 'Shirt',
    searchTerm: 'shirt',
    tags: ['shirt', 'graphic tee'],
  }
  const started = startMultiAngleExploration({}, {
    activeEventId: alphaEvent.id,
    categoryId: shirt.id,
    eventSnapshot: alphaEvent,
    categorySnapshot: shirt,
  })
  const betaMugSelection = {
    eventId: 'custom-event',
    categoryId: 'mug',
    eventSnapshot: {
      ...alphaEvent,
      label: 'Beta Launch',
      jpLabel: 'Beta Launch',
      searchTerm: 'beta launch',
      displayTerm: 'Beta Launch',
    },
    categorySnapshot: {
      id: 'mug',
      label: 'Mug',
      searchTerm: 'mug',
      tags: ['mug'],
    },
  }
  const frozen = multiAngleApi.resolveMultiAngleResearchContext(
    started,
    betaMugSelection,
  )
  const specificTokens = erankQueryApi.extractErankSpecificTokens(
    'alpha launch special education graphic tee',
    {
      event: frozen.eventSnapshot,
      category: frozen.categorySnapshot,
    },
  )
  const csvContext = multiAngleApi.resolveMultiAngleExportResearchContext(
    started,
    {
      row: {
        researchEventId: 'custom-event-beta',
        researchCategoryId: 'mug',
      },
      selected: betaMugSelection,
    },
  )
  const idleCsvContext = multiAngleApi.resolveMultiAngleExportResearchContext(
    {},
    {
      row: {},
      selected: betaMugSelection,
    },
  )

  assert.deepEqual(specificTokens, ['special', 'education'])
  assert.deepEqual(csvContext, {
    eventId: 'custom-event-beta',
    categoryId: 'mug',
  })
  assert.deepEqual(idleCsvContext, {
    eventId: 'custom-event',
    categoryId: 'mug',
  })
})

test('CSV export keeps evergreen and historical row context but falls back for planned rows', () => {
  const halloweenShirt = startMultiAngleExploration({}, {
    activeEventId: 'halloween',
    categoryId: 'shirt',
  })
  const selected = {
    eventId: 'halloween',
    categoryId: 'shirt',
  }

  const evergreen = multiAngleApi.resolveMultiAngleExportResearchContext(
    halloweenShirt,
    {
      row: {
        researchEventId: '',
        researchCategoryId: 'shirt',
        intentTrack: 'evergreen',
        resultLane: 'evergreen',
      },
      selected,
    },
  )
  const historical = multiAngleApi.resolveMultiAngleExportResearchContext(
    halloweenShirt,
    {
      row: {
        researchEventId: 'christmas',
        researchCategoryId: 'mug',
      },
      selected,
    },
  )
  const planned = multiAngleApi.resolveMultiAngleExportResearchContext(
    halloweenShirt,
    {
      row: {},
      selected,
    },
  )

  assert.deepEqual(evergreen, {
    eventId: '',
    categoryId: 'shirt',
  })
  assert.deepEqual(historical, {
    eventId: 'christmas',
    categoryId: 'mug',
  })
  assert.deepEqual(planned, {
    eventId: 'halloween',
    categoryId: 'shirt',
  })
})

test('backfills snapshots when safely migrating an older fixed-context state', () => {
  assert.equal(typeof multiAngleApi.backfillMultiAngleResearchSnapshots, 'function')
  const legacy = createMultiAngleExplorationState({
    status: 'paused',
    activeEventId: 'custom-event',
    categoryId: 'shirt',
  })
  const migrated = multiAngleApi.backfillMultiAngleResearchSnapshots(legacy, {
    eventSnapshot: {
      id: 'custom-event',
      label: 'Legacy Alpha',
      searchTerm: 'legacy alpha',
      month: 0,
    },
    categorySnapshot: {
      id: 'shirt',
      label: 'Shirt',
      searchTerm: 'shirt',
      tags: ['shirt'],
    },
  })

  assert.equal(migrated.eventSnapshot.label, 'Legacy Alpha')
  assert.equal(migrated.eventSnapshot.searchTerm, 'legacy alpha')
  assert.equal(migrated.categorySnapshot.id, 'shirt')
})

test('paused normal selector changes keep analysis and plan options on the original context', () => {
  const halloween = {
    id: 'halloween',
    label: 'Halloween',
    jpLabel: 'Halloween',
    searchTerm: 'halloween',
    month: 10,
    defaultYear: 2026,
  }
  const shirt = {
    id: 'shirt',
    label: 'Shirt',
    searchTerm: 'shirt',
    tags: ['shirt'],
  }
  const started = startMultiAngleExploration({}, {
    activeEventId: halloween.id,
    categoryId: shirt.id,
    eventSnapshot: halloween,
    categorySnapshot: shirt,
  })
  const nextSelection = {
    eventId: 'christmas',
    customEventName: '',
    categoryId: 'mug',
    eventSnapshot: {
      id: 'christmas',
      label: 'Christmas',
      searchTerm: 'christmas',
      month: 12,
    },
    categorySnapshot: {
      id: 'mug',
      label: 'Mug',
      searchTerm: 'mug',
      tags: ['mug'],
    },
    year: 2026,
  }
  const paused = multiAngleApi.pauseMultiAngleForContextChange(
    started,
    nextSelection,
  )
  const resumed = resumeMultiAngleExploration(paused)
  const analysisOptions = multiAngleApi.resolveMultiAngleResearchOptions(
    resumed,
    nextSelection,
  )
  const planOptions = multiAngleApi.resolveMultiAngleResearchOptions(
    resumed,
    nextSelection,
  )

  assert.deepEqual(
    {
      eventId: analysisOptions.eventId,
      categoryId: analysisOptions.categoryId,
      customEventName: analysisOptions.customEventName,
    },
    {
      eventId: 'halloween',
      categoryId: 'shirt',
      customEventName: '',
    },
  )
  assert.deepEqual(planOptions, analysisOptions)
})

test('marketplace extension and global stops preserve a resumable batch', () => {
  assert.equal(typeof multiAngleApi.stopMultiAngleWork, 'function')

  for (const source of ['marketplace', 'extension', 'global']) {
    const batch = nextMultiAngleBatch({
      state: startMultiAngleExploration({}, context),
      pools: {
        'demand-neighborhood': [{
          keyword: `${source} stop candidate shirt`,
          categoryId: 'shirt',
          eventId: 'halloween',
        }],
      },
    })
    const stopped = multiAngleApi.stopMultiAngleWork({
      exploration: batch.state,
      pendingEvidenceAutomation: {
        active: true,
        scheduled: true,
        initialCount: 1,
        currentStage: 'pending-everbee',
        targetKeywords: [`${source} stop candidate shirt`],
      },
    }, source, '2026-07-30T00:01:00Z')

    assert.equal(stopped.source, source)
    assert.equal(stopped.exploration.status, 'stopped')
    assert.equal(stopped.pendingEvidenceAutomation.active, false)
    assert.equal(stopped.pendingEvidenceAutomation.scheduled, false)
    assert.deepEqual(
      stopped.pendingEvidenceAutomation.targetKeywords,
      [`${source} stop candidate shirt`],
    )
    assert.equal(stopped.exploration.currentBatchCandidates.length, 1)

    const resumed = resumeMultiAngleExploration(stopped.exploration)
    const completed = recordMultiAngleBatch(resumed, [{
      ...resumed.currentBatchCandidates[0],
      evidenceState: { status: 'verified' },
      opportunityLabel: 'C',
    }])
    assert.deepEqual(
      completed.evidenceKeys,
      [`${source} stop candidate shirt|shirt|halloween`],
    )
  }
})

test('removes stale winners and reopens a winner-found run when current evidence no longer qualifies', () => {
  const stale = createMultiAngleExplorationState({
    ...context,
    status: 'winner-found',
    winnerKeywords: ['old a', 'old b'],
    completedAt: '2026-08-01T00:00:00Z',
  })
  const reconciled = reconcileMultiAngleWinners(stale, [
    { keyword: 'old a', evidenceState: { status: 'verified' }, opportunityLabel: 'C' },
    { keyword: 'old b', evidenceState: { status: 'failed' }, opportunityLabel: 'A' },
  ], '2026-08-12T00:00:00Z')
  assert.equal(reconciled.status, 'running')
  assert.deepEqual(reconciled.winnerKeywords, [])
  assert.equal(reconciled.completedAt, '')
})

test('drops a saved winner that is absent from the current reevaluated evidence', () => {
  const stale = createMultiAngleExplorationState({
    ...context,
    status: 'winner-found',
    winnerKeywords: ['old unreviewed winner'],
    completedAt: '2026-08-01T00:00:00Z',
  })
  const reconciled = reconcileMultiAngleWinners(stale, [{
    keyword: 'current verified winner',
    evidenceState: { status: 'verified' },
    opportunityLabel: 'B',
  }], '2026-08-12T00:00:00Z')

  assert.deepEqual(reconciled.winnerKeywords, ['current verified winner'])
})
