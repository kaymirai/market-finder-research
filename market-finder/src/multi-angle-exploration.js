import {
  candidateEvidenceKey,
  EXPLORATION_ANGLE_ORDER,
  normalizeExplorationCandidate,
} from './multi-angle-candidates.js'

const VALID_STATUSES = new Set([
  'idle',
  'running',
  'paused',
  'winner-found',
  'stopped',
  'exhausted',
])
const TERMINAL_STATUSES = new Set([
  'winner-found',
  'paused',
  'stopped',
  'exhausted',
])
const GLOBAL_PAUSE_FAILURES = new Set([
  'service-unavailable',
  'login-required',
  'rate-limited',
])

function timestamp(value = '') {
  const supplied = String(value ?? '').trim()
  return supplied || new Date().toISOString()
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))]
}

function positiveInteger(value, fallback = 1) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.ceil(number) : fallback
}

function normalizedProvenance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .map(([key, angleIds]) => [String(key).trim(), uniqueStrings(angleIds)])
    .filter(([key]) => key))
}

function normalizedResultLanes(value) {
  const lanes = value && typeof value === 'object' ? value : {}
  return {
    event: Array.isArray(lanes.event) ? [...lanes.event] : [],
    evergreen: Array.isArray(lanes.evergreen) ? [...lanes.evergreen] : [],
    seasonalReference: Array.isArray(lanes.seasonalReference)
      ? [...lanes.seasonalReference]
      : [],
  }
}

function normalizedRetryQueue(value) {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const candidate = normalizeExplorationCandidate(entry?.candidate ?? entry)
    if (!candidate) return []
    return [{
      evidenceKey: String(entry?.evidenceKey ?? candidateEvidenceKey(candidate)).trim(),
      candidate,
      attempts: Math.max(0, Number(entry?.attempts) || 0),
      retryAt: String(entry?.retryAt ?? '').trim(),
    }]
  })
}

function laneFor(candidate, activeEventId) {
  if (candidate.resultLane === 'seasonal-reference'
    || candidate.angleId === 'seasonal-reference'
    || (candidate.eventId && candidate.eventId !== activeEventId)) {
    return 'seasonal-reference'
  }
  if (candidate.resultLane === 'evergreen' || candidate.angleId === 'evergreen') {
    return 'evergreen'
  }
  return 'event'
}

function hydrateCandidate(rawCandidate, state, angleId = '') {
  const supplied = {
    ...rawCandidate,
    angleId: String(rawCandidate?.angleId ?? angleId).trim(),
    categoryId: String(rawCandidate?.categoryId ?? state.categoryId).trim(),
  }
  const preliminary = normalizeExplorationCandidate(supplied)
  if (!preliminary) return null
  const resultLane = laneFor(preliminary, state.activeEventId)
  const eventId = resultLane === 'evergreen'
    ? ''
    : preliminary.eventId || state.activeEventId
  return {
    ...preliminary,
    eventId,
    resultLane,
  }
}

function withProvenance(provenance, candidate, angleId = '') {
  const evidenceKey = candidateEvidenceKey(candidate)
  const angleIds = uniqueStrings([
    ...(provenance[evidenceKey] ?? []),
    angleId,
    candidate.angleId,
    ...(candidate.angleIds ?? []),
  ])
  return {
    ...provenance,
    [evidenceKey]: angleIds,
  }
}

function appendLane(resultLanes, lane, candidate) {
  const laneKey = lane === 'seasonal-reference'
    ? 'seasonalReference'
    : lane
  const evidenceKey = candidateEvidenceKey(candidate)
  const existing = resultLanes[laneKey] ?? []
  const index = existing.findIndex((item) => candidateEvidenceKey(item) === evidenceKey)
  const next = index < 0
    ? [...existing, candidate]
    : existing.map((item, itemIndex) => itemIndex === index ? { ...item, ...candidate } : item)
  return {
    ...resultLanes,
    [laneKey]: next,
  }
}

function annotatePools(state, pools) {
  let provenance = state.provenance
  let resultLanes = state.resultLanes
  for (const [angleId, candidates] of Object.entries(pools ?? {})) {
    if (!Array.isArray(candidates)) continue
    for (const rawCandidate of candidates) {
      const candidate = hydrateCandidate(rawCandidate, state, angleId)
      if (!candidate) continue
      provenance = withProvenance(provenance, candidate, angleId)
      if (candidate.resultLane === 'seasonal-reference') {
        resultLanes = appendLane(resultLanes, candidate.resultLane, candidate)
      }
    }
  }
  return { ...state, provenance, resultLanes }
}

export function createMultiAngleExplorationState(saved = {}) {
  const status = VALID_STATUSES.has(saved?.status) ? saved.status : 'idle'
  return {
    status,
    activeEventId: String(saved?.activeEventId ?? '').trim(),
    categoryId: String(saved?.categoryId ?? '').trim(),
    currentAngleId: String(saved?.currentAngleId ?? '').trim(),
    angleIndex: Math.max(0, Number(saved?.angleIndex) || 0),
    evidenceKeys: uniqueStrings(saved?.evidenceKeys),
    provenance: normalizedProvenance(saved?.provenance),
    queuedEvidenceKeys: uniqueStrings(saved?.queuedEvidenceKeys),
    retryQueue: normalizedRetryQueue(saved?.retryQueue),
    failedEvidenceKeys: uniqueStrings(saved?.failedEvidenceKeys),
    winnerKeywords: uniqueStrings(saved?.winnerKeywords),
    targetWinnerCount: positiveInteger(saved?.targetWinnerCount, 1),
    resultLanes: normalizedResultLanes(saved?.resultLanes),
    exhaustedAngles: uniqueStrings(saved?.exhaustedAngles),
    startedAt: String(saved?.startedAt ?? '').trim(),
    updatedAt: String(saved?.updatedAt ?? '').trim(),
    completedAt: String(saved?.completedAt ?? '').trim(),
    pauseReason: String(saved?.pauseReason ?? '').trim(),
  }
}

export function startMultiAngleExploration(state = {}, context = {}, now = '') {
  const restored = createMultiAngleExplorationState(state)
  const updatedAt = timestamp(now)
  const targetWinnerCount = positiveInteger(
    context?.targetWinnerCount,
    restored.targetWinnerCount,
  )
  const targetReached = restored.winnerKeywords.length >= targetWinnerCount
  return {
    ...restored,
    status: targetReached ? 'winner-found' : 'running',
    activeEventId: restored.activeEventId
      || String(context?.activeEventId ?? context?.eventId ?? '').trim(),
    categoryId: restored.categoryId || String(context?.categoryId ?? '').trim(),
    targetWinnerCount,
    startedAt: restored.startedAt || updatedAt,
    updatedAt,
    completedAt: targetReached ? restored.completedAt || updatedAt : '',
    pauseReason: '',
  }
}

export function nextMultiAngleBatch({
  state,
  pools = {},
  angleOrder = EXPLORATION_ANGLE_ORDER,
  limit = 8,
  now = '',
} = {}) {
  let current = annotatePools(createMultiAngleExplorationState(state), pools)
  if (TERMINAL_STATUSES.has(current.status)) {
    return { state: current, candidates: [], reason: `status-${current.status}` }
  }

  const batchLimit = Math.max(1, Math.min(30, Number(limit) || 8))
  const nowMs = Date.parse(timestamp(now))
  const dueRetries = current.retryQueue
    .filter((entry) => Date.parse(entry.retryAt) <= nowMs)
    .slice(0, batchLimit)
  if (dueRetries.length > 0) {
    const dueKeys = new Set(dueRetries.map((entry) => entry.evidenceKey))
    return {
      state: {
        ...current,
        status: 'running',
        queuedEvidenceKeys: uniqueStrings([
          ...current.queuedEvidenceKeys,
          ...dueRetries.map((entry) => entry.evidenceKey),
        ]),
        retryQueue: current.retryQueue.map((entry) => (
          dueKeys.has(entry.evidenceKey)
            ? { ...entry, retryAt: '' }
            : entry
        )),
      },
      candidates: dueRetries.map((entry) => ({
        ...entry.candidate,
        retryAttempts: entry.attempts,
      })),
      reason: 'retry-ready',
    }
  }

  const used = new Set([
    ...current.evidenceKeys,
    ...current.queuedEvidenceKeys,
    ...current.retryQueue.map((entry) => entry.evidenceKey),
    ...current.failedEvidenceKeys,
  ])
  const exhausted = new Set(current.exhaustedAngles)
  for (let index = current.angleIndex; index < angleOrder.length; index += 1) {
    const angleId = String(angleOrder[index] ?? '').trim()
    const unseen = []
    for (const rawCandidate of pools[angleId] ?? []) {
      const candidate = hydrateCandidate(rawCandidate, current, angleId)
      if (!candidate || candidate.resultLane === 'seasonal-reference') continue
      const evidenceKey = candidateEvidenceKey(candidate)
      if (used.has(evidenceKey)) continue
      used.add(evidenceKey)
      unseen.push(candidate)
      if (unseen.length >= batchLimit) break
    }
    if (unseen.length === 0) {
      exhausted.add(angleId)
      continue
    }

    return {
      state: {
        ...current,
        status: 'running',
        currentAngleId: angleId,
        angleIndex: index,
        queuedEvidenceKeys: unseen.map(candidateEvidenceKey),
        exhaustedAngles: [...exhausted],
      },
      candidates: unseen,
      reason: 'batch-ready',
    }
  }

  if (current.retryQueue.length > 0) {
    return {
      state: {
        ...current,
        status: 'running',
        exhaustedAngles: [...exhausted],
      },
      candidates: [],
      reason: 'retry-wait',
    }
  }

  current = {
    ...current,
    status: 'exhausted',
    queuedEvidenceKeys: [],
    exhaustedAngles: [...new Set([...exhausted, ...angleOrder])],
    completedAt: current.completedAt || timestamp(now),
    updatedAt: timestamp(now),
  }
  return { state: current, candidates: [], reason: 'all-angles-exhausted' }
}

export function recordMultiAngleBatch(state = {}, rows = [], now = '') {
  let current = createMultiAngleExplorationState(state)
  let provenance = current.provenance
  let resultLanes = current.resultLanes
  const recordedKeys = []
  const winners = []

  for (const row of Array.isArray(rows) ? rows : []) {
    const candidate = hydrateCandidate(row, current, current.currentAngleId)
    if (!candidate) continue
    const evidenceKey = candidateEvidenceKey(candidate)
    recordedKeys.push(evidenceKey)
    provenance = withProvenance(provenance, candidate, current.currentAngleId)
    resultLanes = appendLane(resultLanes, candidate.resultLane, candidate)
    const grade = String(
      row?.opportunityLabel
      ?? row?.everbeeRow?.score?.opportunityLabel
      ?? '',
    ).trim().toUpperCase()
    if (candidate.resultLane !== 'seasonal-reference'
      && row?.evidenceState?.status === 'verified'
      && ['A', 'B'].includes(grade)) {
      winners.push(candidate.keyword)
    }
  }

  const recorded = new Set(recordedKeys)
  const winnerKeywords = uniqueStrings([...current.winnerKeywords, ...winners])
  const targetReached = winnerKeywords.length >= current.targetWinnerCount
  const updatedAt = timestamp(now)
  return {
    ...current,
    status: targetReached ? 'winner-found' : 'running',
    evidenceKeys: uniqueStrings([...current.evidenceKeys, ...recordedKeys]),
    provenance,
    queuedEvidenceKeys: current.queuedEvidenceKeys.filter((key) => !recorded.has(key)),
    retryQueue: current.retryQueue.filter((entry) => !recorded.has(entry.evidenceKey)),
    winnerKeywords,
    resultLanes,
    completedAt: targetReached ? current.completedAt || updatedAt : '',
    pauseReason: '',
    updatedAt,
  }
}

export function recordMultiAngleFailure(
  state = {},
  rawCandidate = {},
  failure = {},
  now = '',
) {
  const current = createMultiAngleExplorationState(state)
  const candidate = hydrateCandidate(rawCandidate, current, current.currentAngleId)
  if (!candidate) return current
  const code = String(failure?.code ?? 'unknown').trim()
  if (GLOBAL_PAUSE_FAILURES.has(code)) {
    return pauseMultiAngleExploration(current, code, now)
  }

  const evidenceKey = candidateEvidenceKey(candidate)
  const previousRetry = current.retryQueue.find((entry) => entry.evidenceKey === evidenceKey)
  const otherRetries = current.retryQueue.filter((entry) => entry.evidenceKey !== evidenceKey)
  const queuedEvidenceKeys = current.queuedEvidenceKeys.filter((key) => key !== evidenceKey)
  if (code === 'page-timeout') {
    const attempts = Math.max(
      previousRetry?.attempts ?? 0,
      Number(rawCandidate?.retryAttempts) || 0,
    ) + 1
    if (attempts < 2) {
      const retryAfterMs = Math.max(0, Number(failure?.retryAfterMs) || 0)
      const retryAt = new Date(Date.parse(timestamp(now)) + retryAfterMs).toISOString()
      return {
        ...current,
        status: 'running',
        queuedEvidenceKeys,
        retryQueue: [...otherRetries, {
          evidenceKey,
          candidate,
          attempts,
          retryAt,
        }],
        updatedAt: timestamp(now),
      }
    }
  }

  return {
    ...current,
    status: 'running',
    queuedEvidenceKeys,
    retryQueue: otherRetries,
    failedEvidenceKeys: uniqueStrings([...current.failedEvidenceKeys, evidenceKey]),
    updatedAt: timestamp(now),
  }
}

export function pauseMultiAngleExploration(state = {}, reason = '', now = '') {
  const current = createMultiAngleExplorationState(state)
  if (current.status === 'winner-found') return current
  return {
    ...current,
    status: 'paused',
    pauseReason: String(reason ?? '').trim() || 'external-service-paused',
    updatedAt: timestamp(now),
  }
}

export function resumeMultiAngleExploration(state = {}, now = '') {
  const current = createMultiAngleExplorationState(state)
  if (current.status === 'idle' || current.status === 'winner-found') return current
  return {
    ...current,
    status: 'running',
    pauseReason: '',
    updatedAt: timestamp(now),
  }
}

export function stopMultiAngleExploration(state = {}, now = '') {
  const current = createMultiAngleExplorationState(state)
  return {
    ...current,
    status: 'stopped',
    pauseReason: '',
    updatedAt: timestamp(now),
  }
}
