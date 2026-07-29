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
import * as multiAngleApi from '../src/multi-angle-exploration.js'
import * as erankQueryApi from '../src/erank-query-plan.js'
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

test('treats winner-found and exhausted as completed cycles with one new-cycle action', () => {
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
      action: 'new-cycle',
      label: '新しい調査を始める',
    },
  )
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
        keyword: 'persisted winner',
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
    ['persisted winner'],
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
  assert.deepEqual(completed.winnerKeywords, ['persisted winner'])
  assert.deepEqual(completed.currentBatchCandidates, [])
})

test('selector changes pause the fixed research context and resume its batch', () => {
  assert.equal(typeof multiAngleApi.resolveMultiAngleResearchContext, 'function')
  assert.equal(typeof multiAngleApi.pauseMultiAngleForContextChange, 'function')

  const batch = nextMultiAngleBatch({
    state: startMultiAngleExploration({}, context),
    pools: {
      'demand-neighborhood': [{
        keyword: 'fixed halloween niche',
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
    ['fixed halloween niche'],
  )

  const resumed = resumeMultiAngleExploration(paused)
  const completed = recordMultiAngleBatch(resumed, [{
    ...resumed.currentBatchCandidates[0],
    evidenceState: { status: 'verified' },
    opportunityLabel: 'C',
  }])

  assert.equal(completed.status, 'running')
  assert.deepEqual(completed.evidenceKeys, ['fixed halloween niche|shirt|halloween'])
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

test('eRank narrowing and CSV metadata keep Alpha Shirt after selectors move to Beta Mug', () => {
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
    eventId: 'custom-event',
    categoryId: 'shirt',
  })
  assert.deepEqual(idleCsvContext, {
    eventId: 'custom-event',
    categoryId: 'mug',
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
          keyword: `${source} stop candidate`,
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
        targetKeywords: [`${source} stop candidate`],
      },
    }, source, '2026-07-30T00:01:00Z')

    assert.equal(stopped.source, source)
    assert.equal(stopped.exploration.status, 'stopped')
    assert.equal(stopped.pendingEvidenceAutomation.active, false)
    assert.equal(stopped.pendingEvidenceAutomation.scheduled, false)
    assert.deepEqual(
      stopped.pendingEvidenceAutomation.targetKeywords,
      [`${source} stop candidate`],
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
      [`${source} stop candidate|shirt|halloween`],
    )
  }
})
