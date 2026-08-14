import {
  candidateEvidenceKey,
  EXPLORATION_ANGLE_ORDER,
  isEfficientMarketplaceProbe,
  marketplaceInsightPlanForContext,
  normalizeExplorationCandidate,
} from './multi-angle-candidates.js?v=20260814-5'
import { mergeRowsByKey } from './research-performance.js?v=20260720-1'

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
const FIXED_CONTEXT_STATUSES = new Set([
  'running',
  'paused',
  'winner-found',
  'stopped',
  'exhausted',
])

function timestamp(value = '') {
  const supplied = String(value ?? '').trim()
  return supplied || new Date().toISOString()
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))]
}
function normalizedKeywordKey(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function positiveInteger(value, fallback = 1) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.ceil(number) : fallback
}

function normalizedEventSnapshot(value, fallbackId = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = String(value.id ?? fallbackId).trim()
  if (!id) return null
  const defaultYear = value.defaultYear === null || value.defaultYear === ''
    ? Number.NaN
    : Number(value.defaultYear)
  const month = Number(value.month)
  const peakDaysUntil = value.peakDaysUntil === null || value.peakDaysUntil === ''
    ? Number.NaN
    : Number(value.peakDaysUntil)
  return {
    id,
    label: String(value.label ?? '').trim(),
    jpLabel: String(value.jpLabel ?? value.label ?? '').trim(),
    searchTerm: String(value.searchTerm ?? '').trim(),
    displayTerm: String(value.displayTerm ?? value.label ?? '').trim(),
    month: Number.isFinite(month) ? month : 0,
    defaultYear: Number.isFinite(defaultYear) ? defaultYear : null,
    targets: uniqueStrings(value.targets),
    intents: uniqueStrings(value.intents),
    designAngles: uniqueStrings(value.designAngles),
    peakDate: String(value.peakDate ?? '').trim(),
    peakStatus: String(value.peakStatus ?? '').trim(),
    peakDaysUntil: Number.isFinite(peakDaysUntil) ? peakDaysUntil : null,
  }
}

function normalizedCategorySnapshot(value, fallbackId = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = String(value.id ?? fallbackId).trim()
  if (!id) return null
  return {
    id,
    label: String(value.label ?? '').trim(),
    searchTerm: String(value.searchTerm ?? '').trim(),
    tags: uniqueStrings(value.tags),
  }
}

function eventSnapshotKey(value) {
  const snapshot = normalizedEventSnapshot(value)
  return snapshot
    ? [snapshot.id, snapshot.searchTerm, snapshot.label, snapshot.displayTerm].join('|')
    : ''
}

function normalizedProvenance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .map(([key, angleIds]) => [String(key).trim(), uniqueStrings(angleIds)])
    .filter(([key]) => key))
}

function normalizedResultLanes(value) {
  const lanes = value && typeof value === 'object' ? value : {}
  const compactLane = (items, resultLane) => (Array.isArray(items) ? items : [])
    .map((item) => compactResultLaneCandidate({
      ...item,
      resultLane: String(item?.resultLane ?? '').trim() || resultLane,
    }))
    .filter(Boolean)
  return {
    event: compactLane(lanes.event, 'event'),
    evergreen: compactLane(lanes.evergreen, 'evergreen'),
    seasonalReference: compactLane(
      lanes.seasonalReference,
      'seasonal-reference',
    ),
  }
}

function normalizedRetryQueue(value) {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const candidate = normalizeExplorationCandidate(entry?.candidate ?? entry)
    if (!candidate || !isEfficientMarketplaceProbe(candidate)) return []
    const suppliedRetryAt = String(entry?.retryAt ?? '').trim()
    const retryAtMs = Date.parse(suppliedRetryAt)
    return [{
      evidenceKey: String(entry?.evidenceKey ?? candidateEvidenceKey(candidate)).trim(),
      candidate,
      attempts: Math.max(0, Number(entry?.attempts) || 0),
      retryAt: Number.isFinite(retryAtMs)
        ? new Date(retryAtMs).toISOString()
        : '1970-01-01T00:00:00.000Z',
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

function compactResultLaneCandidate(candidate = {}) {
  const normalized = normalizeExplorationCandidate(candidate)
  if (!normalized) return null
  const compact = {
    keyword: normalized.keyword,
    categoryId: normalized.categoryId,
    eventId: normalized.eventId,
    angleId: normalized.angleId,
    angleIds: normalized.angleIds,
    source: normalized.source,
    sources: normalized.sources,
    sourceKeywords: normalized.sourceKeywords,
    resultLane: normalized.resultLane,
    priorityScore: normalized.priorityScore,
    timingStatus: normalized.timingStatus,
  }
  for (const field of [
    'originEventId',
    'originCategoryId',
    'opportunityLabel',
    'confidenceLabel',
    'candidateStage',
  ]) {
    const value = String(candidate[field] ?? '').trim()
    if (value) compact[field] = value
  }
  const evidenceStatus = String(candidate.evidenceState?.status ?? '').trim()
  if (evidenceStatus) compact.evidenceState = { status: evidenceStatus }
  const event = normalizedEventSnapshot(
    candidate.event ?? candidate.eventSnapshot,
    normalized.eventId,
  )
  if (event) compact.event = event
  const daysUntil = Number(candidate.daysUntil)
  if (Number.isFinite(daysUntil)) compact.daysUntil = daysUntil
  return compact
}

function appendLane(resultLanes, lane, candidate) {
  const laneKey = lane === 'seasonal-reference'
    ? 'seasonalReference'
    : lane
  const compactCandidate = compactResultLaneCandidate(candidate)
  if (!compactCandidate) return resultLanes
  const evidenceKey = candidateEvidenceKey(compactCandidate)
  const existing = resultLanes[laneKey] ?? []
  const index = existing.findIndex((item) => candidateEvidenceKey(item) === evidenceKey)
  const next = index < 0
    ? [...existing, compactCandidate]
    : existing.map((item, itemIndex) => itemIndex === index
      ? { ...item, ...compactCandidate }
      : item)
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
  const activeEventId = String(saved?.activeEventId ?? '').trim()
  const categoryId = String(saved?.categoryId ?? '').trim()
  const eventSnapshot = normalizedEventSnapshot(saved?.eventSnapshot, activeEventId)
  const categorySnapshot = normalizedCategorySnapshot(saved?.categorySnapshot, categoryId)
  const currentAngleId = String(saved?.currentAngleId ?? '').trim()
  const currentBatchCandidates = (Array.isArray(saved?.currentBatchCandidates)
    ? saved.currentBatchCandidates
    : [])
    .map((candidate) => hydrateCandidate(candidate, {
      activeEventId,
      categoryId,
    }, currentAngleId))
    .filter(Boolean)
    .filter(isEfficientMarketplaceProbe)
  const legacyCompletedAngles = uniqueStrings(saved?.completedAngles)
  const hasAttemptedAngleState = Array.isArray(saved?.attemptedAngles)
  const attemptedAngles = hasAttemptedAngleState
    ? uniqueStrings([...saved.attemptedAngles, ...legacyCompletedAngles])
    : legacyCompletedAngles
  const completedAngles = hasAttemptedAngleState ? legacyCompletedAngles : []
  const emptyAngles = uniqueStrings(
    Array.isArray(saved?.emptyAngles) ? saved.emptyAngles : saved?.exhaustedAngles,
  ).filter((angleId) => !attemptedAngles.includes(angleId))
  return {
    status,
    activeEventId,
    categoryId,
    eventSnapshot,
    categorySnapshot,
    currentAngleId,
    angleIndex: Math.max(0, Number(saved?.angleIndex) || 0),
    evidenceKeys: uniqueStrings(saved?.evidenceKeys),
    provenance: normalizedProvenance(saved?.provenance),
    queuedEvidenceKeys: uniqueStrings(saved?.queuedEvidenceKeys),
    currentBatchCandidates,
    retryQueue: normalizedRetryQueue(saved?.retryQueue),
    failedEvidenceKeys: uniqueStrings(saved?.failedEvidenceKeys),
    winnerKeywords: uniqueStrings(saved?.winnerKeywords),
    targetWinnerCount: positiveInteger(saved?.targetWinnerCount, 1),
    resultLanes: normalizedResultLanes(saved?.resultLanes),
    attemptedAngles,
    completedAngles,
    emptyAngles,
    exhaustedAngles: uniqueStrings([...completedAngles, ...emptyAngles]),
    startedAt: String(saved?.startedAt ?? '').trim(),
    updatedAt: String(saved?.updatedAt ?? '').trim(),
    completedAt: String(saved?.completedAt ?? '').trim(),
    pauseReason: String(saved?.pauseReason ?? '').trim(),
  }
}

export function multiAngleAutomationControl(state = {}, workActive = false) {
  const status = createMultiAngleExplorationState(state).status
  if (workActive) {
    return {
      action: 'stop',
      label: '探索を停止',
    }
  }
  if (status === 'idle') {
    return {
      action: 'start',
      label: '目標まで勝ち候補を探す',
    }
  }
  if (status === 'winner-found') {
    return {
      action: 'new-cycle',
      label: '新しい調査を始める',
    }
  }
  return {
    action: 'resume',
    label: '目標まで探索を再開',
  }
}

export function prepareNewMultiAngleCycle(snapshot = {}, context = {}) {
  const pending = snapshot?.pendingEvidenceAutomation ?? {}
  const exploration = createMultiAngleExplorationState({
    status: 'idle',
    activeEventId: String(context?.activeEventId ?? context?.eventId ?? '').trim(),
    categoryId: String(context?.categoryId ?? '').trim(),
    eventSnapshot: context?.eventSnapshot,
    categorySnapshot: context?.categorySnapshot,
    targetWinnerCount: positiveInteger(context?.targetWinnerCount, 1),
  })
  return {
    ...snapshot,
    researchRows: [],
    researchRounds: {
      rounds: [],
      activeRoundId: '',
      selectedRoundId: 'all',
    },
    candidateRoundId: '',
    marketplaceInsightPlan: null,
    marketplaceInsightMessage: '',
    candidates: [],
    candidateCatalog: [],
    erankQueryPlan: [],
    crossNicheProposal: null,
    restoredResearchSavedAt: '',
    restoredResultsAccepted: false,
    acceptExtensionResults: false,
    selectedResultKey: '',
    seoPlan: null,
    exploration,
    pendingEvidenceAutomation: {
      ...pending,
      active: false,
      scheduled: false,
      initialCount: 0,
      completedBatches: 0,
      currentStage: '',
      targetKeywords: [],
    },
  }
}

export async function persistTerminalMultiAngleEvidenceBeforeReset({
  exploration = {},
  archiveRecord = null,
  hasArchivedRecord = () => false,
  persistArchiveRecord,
} = {}) {
  const current = createMultiAngleExplorationState(exploration)
  if (!['winner-found', 'exhausted', 'stopped'].includes(current.status)) {
    return { ok: true, persisted: false }
  }
  if (hasArchivedRecord(archiveRecord)) {
    return { ok: true, persisted: false }
  }
  if (typeof persistArchiveRecord !== 'function') {
    return {
      ok: false,
      persisted: false,
      error: 'archive-persist-failed',
    }
  }
  try {
    const persisted = await persistArchiveRecord(archiveRecord)
    return persisted === true
      ? { ok: true, persisted: true }
      : {
        ok: false,
        persisted: false,
        error: 'archive-persist-failed',
      }
  } catch {
    return {
      ok: false,
      persisted: false,
      error: 'archive-persist-failed',
    }
  }
}

function explicitResearchContextValue(row = {}, names = []) {
  const raw = row?.raw && typeof row.raw === 'object' ? row.raw : row
  const sources = raw === row ? [row] : [raw, row]
  for (const name of names) {
    const owner = sources.find((source) => Object.hasOwn(source ?? {}, name))
    if (owner) {
      return {
        explicit: true,
        value: String(owner[name] ?? '').trim(),
      }
    }
  }
  return { explicit: false, value: '' }
}

function normalizedResearchLane(value) {
  const lane = String(value ?? '').trim().toLowerCase()
  if (['event', 'event-specific'].includes(lane)) return 'event'
  if (['evergreen', 'evergreen-adjacent'].includes(lane)) return 'evergreen'
  if (['seasonal', 'seasonal-reference'].includes(lane)) return 'seasonal'
  return lane
}

function researchRowContext(row = {}) {
  const raw = row?.raw && typeof row.raw === 'object' ? row.raw : row
  const event = explicitResearchContextValue(row, ['researchEventId', 'eventId'])
  const category = explicitResearchContextValue(row, ['researchCategoryId', 'categoryId'])
  const intentTrack = String(raw?.intentTrack ?? row?.intentTrack ?? '').trim().toLowerCase()
  const resultLane = String(raw?.resultLane ?? row?.resultLane ?? '').trim().toLowerCase()
  const normalizedIntent = normalizedResearchLane(intentTrack)
  const normalizedResultLane = normalizedResearchLane(resultLane)
  const lane = normalizedIntent && normalizedResultLane && normalizedIntent !== normalizedResultLane
    ? `conflict:${normalizedResultLane}:${normalizedIntent}`
    : normalizedResultLane
      || normalizedIntent
      || (event.explicit ? (event.value ? 'event' : 'evergreen') : 'legacy')
  return {
    keyword: normalizeExplorationCandidate({
      keyword: row?.keyword ?? raw?.keyword ?? row?.score?.normalized?.keyword,
    })?.keyword ?? '',
    eventId: event.value,
    categoryId: category.value,
    hasEventContext: event.explicit,
    hasCategoryContext: category.explicit,
    intentTrack,
    resultLane,
    lane,
  }
}

export function researchRowContextKey(row = {}) {
  const context = researchRowContext(row)
  if (!context.keyword) return ''
  const category = context.hasCategoryContext
    ? `category:${context.categoryId}`
    : 'category:legacy'
  const event = context.hasEventContext
    ? `event:${context.eventId}`
    : 'event:legacy'
  return [context.keyword, category, event, `lane:${context.lane}`].join('|')
}

export function mergeResearchRowsByContext(
  existingRows = [],
  incomingRows = [],
  {
    contextualize = (row) => row,
    keyOf = researchRowContextKey,
    merge = (existing, incoming) => ({ ...existing, ...incoming }),
  } = {},
) {
  const contextualRows = (Array.isArray(incomingRows) ? incomingRows : [])
    .map((row) => contextualize(row))
    .filter(Boolean)
  return mergeRowsByKey(
    Array.isArray(existingRows) ? existingRows : [],
    contextualRows,
    { keyOf, merge },
  )
}

export function researchRowForMultiAngleCandidate(rows = [], candidate = {}) {
  const normalizedCandidate = normalizeExplorationCandidate(candidate)
  if (!normalizedCandidate || normalizedCandidate.resultLane === 'seasonal-reference') return null
  const candidateCategoryId = String(candidate.categoryId ?? '').trim()
  if (!candidateCategoryId) return null
  const evergreen = normalizedCandidate.resultLane === 'evergreen'
    || normalizedCandidate.angleId === 'evergreen'
  return (Array.isArray(rows) ? rows : []).find((row) => {
    const context = researchRowContext(row)
    if (
      context.keyword !== normalizedCandidate.keyword
      || !context.hasCategoryContext
      || context.categoryId !== candidateCategoryId
    ) return false
    const rowIsEvergreen = context.intentTrack === 'evergreen'
      || context.resultLane === 'evergreen'
    const rowIsSeasonalReference = context.intentTrack === 'seasonal-reference'
      || context.resultLane === 'seasonal-reference'
    if (evergreen) {
      return context.hasEventContext
        && !context.eventId
        && !rowIsSeasonalReference
    }
    const candidateEventId = String(candidate.eventId ?? '').trim()
    return Boolean(
      candidateEventId
      && context.hasEventContext
      && context.eventId === candidateEventId
      && !rowIsEvergreen
      && !rowIsSeasonalReference
    )
  }) ?? null
}

export function pauseMultiAngleWorkAfterReload(snapshot = {}, now = '') {
  const exploration = createMultiAngleExplorationState(snapshot?.exploration)
  const pending = snapshot?.pendingEvidenceAutomation ?? {}
  if (exploration.status !== 'running') {
    return {
      ...snapshot,
      exploration,
      pendingEvidenceAutomation: {
        ...pending,
        active: false,
        scheduled: false,
        targetKeywords: uniqueStrings(pending?.targetKeywords),
      },
    }
  }
  return {
    ...snapshot,
    exploration: pauseMultiAngleExploration(exploration, 'reload-required', now),
    pendingEvidenceAutomation: {
      ...pending,
      active: uniqueStrings(pending?.targetKeywords).length > 0,
      scheduled: false,
      targetKeywords: uniqueStrings(pending?.targetKeywords),
    },
  }
}

export function restoredMultiAngleTargetKeywords(state = {}, savedTargets = []) {
  const current = createMultiAngleExplorationState(state)
  const workKeywords = uniqueStrings([
    ...current.currentBatchCandidates.map((candidate) => candidate.keyword),
    ...current.retryQueue.map((entry) => entry.candidate?.keyword),
  ])
  const workByNormalizedKeyword = new Map(workKeywords.map((keyword) => [
    normalizeExplorationCandidate({ keyword })?.keyword,
    keyword,
  ]).filter(([keyword]) => keyword))
  const matchingSavedTargets = uniqueStrings(savedTargets).flatMap((keyword) => {
    const normalized = normalizeExplorationCandidate({ keyword })?.keyword
    return workByNormalizedKeyword.has(normalized)
      ? [workByNormalizedKeyword.get(normalized)]
      : []
  })
  return matchingSavedTargets.length > 0 ? matchingSavedTargets : workKeywords
}

export function hasMeaningfulMultiAngleContext(state = {}) {
  const current = createMultiAngleExplorationState(state)
  return FIXED_CONTEXT_STATUSES.has(current.status)
    || Boolean(current.eventSnapshot)
    || Boolean(current.categorySnapshot)
    || current.currentBatchCandidates.length > 0
    || current.retryQueue.length > 0
}

export function restoreMarketplaceInsightPlanForResearchFlow(
  plan,
  {
    exploration = {},
    ordinaryContext = {},
  } = {},
) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return null
  const current = createMultiAngleExplorationState(exploration)
  if (hasMeaningfulMultiAngleContext(current)) {
    return marketplaceInsightPlanForContext(plan, current)
  }
  const hasPlanContextMetadata = Boolean(
    String(plan.eventId ?? plan.researchEventId ?? '').trim()
    || String(plan.categoryId ?? plan.researchCategoryId ?? '').trim()
  )
  if (!hasPlanContextMetadata) return plan
  const planEventId = String(plan.eventId ?? plan.researchEventId ?? '').trim()
  const planCategoryId = String(plan.categoryId ?? plan.researchCategoryId ?? '').trim()
  const ordinaryEventId = String(
    ordinaryContext.eventId ?? ordinaryContext.activeEventId ?? '',
  ).trim()
  const ordinaryCategoryId = String(ordinaryContext.categoryId ?? '').trim()
  const ordinaryCustomSnapshot = ordinaryContext.eventSnapshot
  const hasUsableCustomSnapshot = ordinaryEventId === 'custom-event'
    && String(ordinaryCustomSnapshot?.id ?? '').trim() === 'custom-event'
    && Boolean(String(
      ordinaryCustomSnapshot?.searchTerm
      || ordinaryCustomSnapshot?.label
      || ordinaryCustomSnapshot?.displayTerm
      || '',
    ).trim())
  if (
    planEventId === 'custom-event'
    && !plan.eventSnapshot
    && planEventId === ordinaryEventId
    && planCategoryId === ordinaryCategoryId
    && hasUsableCustomSnapshot
  ) {
    return {
      ...plan,
      eventSnapshot: ordinaryCustomSnapshot,
      ...(ordinaryContext.categorySnapshot
        ? { categorySnapshot: ordinaryContext.categorySnapshot }
        : {}),
    }
  }
  return marketplaceInsightPlanForContext(plan, ordinaryContext)
}

export function resolveMultiAngleResearchContext(state = {}, selected = {}) {
  const current = createMultiAngleExplorationState(state)
  const hasFixedContext = FIXED_CONTEXT_STATUSES.has(current.status)
    && Boolean(current.activeEventId)
    && Boolean(current.categoryId)
  const eventSnapshot = hasFixedContext
    ? current.eventSnapshot
    : normalizedEventSnapshot(selected?.eventSnapshot, selected?.eventId)
  const categorySnapshot = hasFixedContext
    ? current.categorySnapshot
    : normalizedCategorySnapshot(selected?.categorySnapshot, selected?.categoryId)
  return {
    eventId: hasFixedContext
      ? current.activeEventId
      : String(selected?.eventId ?? selected?.activeEventId ?? '').trim(),
    categoryId: hasFixedContext
      ? current.categoryId
      : String(selected?.categoryId ?? '').trim(),
    fixed: hasFixedContext,
    ...(eventSnapshot ? { eventSnapshot } : {}),
    ...(categorySnapshot ? { categorySnapshot } : {}),
  }
}

export function resolveMultiAngleResearchOptions(state = {}, selectedOptions = {}) {
  const context = resolveMultiAngleResearchContext(state, selectedOptions)
  const customEventName = context.eventId === 'custom-event'
    ? String(
      context.eventSnapshot?.label
      || context.eventSnapshot?.displayTerm
      || context.eventSnapshot?.searchTerm
      || selectedOptions?.customEventName
      || '',
    ).trim()
    : ''
  return {
    ...selectedOptions,
    eventId: context.eventId,
    customEventName,
    categoryId: context.categoryId,
    ...(context.eventSnapshot ? { eventSnapshot: context.eventSnapshot } : {}),
    ...(context.categorySnapshot ? { categorySnapshot: context.categorySnapshot } : {}),
  }
}

export function resolveMultiAngleCandidateResearchContext(
  state = {},
  candidate = {},
  selected = {},
) {
  const context = resolveMultiAngleResearchContext(state, selected)
  const candidateEventId = String(candidate?.eventId ?? '').trim()
  const candidateCategoryId = String(candidate?.categoryId ?? '').trim()
  const usesActiveEvent = !candidateEventId || candidateEventId === context.eventId
  const usesActiveCategory = !candidateCategoryId || candidateCategoryId === context.categoryId
  return {
    eventId: usesActiveEvent ? context.eventId : candidateEventId,
    categoryId: usesActiveCategory ? context.categoryId : candidateCategoryId,
    ...(usesActiveEvent && context.eventSnapshot
      ? { eventSnapshot: context.eventSnapshot }
      : {}),
    ...(usesActiveCategory && context.categorySnapshot
      ? { categorySnapshot: context.categorySnapshot }
      : {}),
  }
}

export function resolveMultiAngleImportedResearchContext(
  state = {},
  {
    row = {},
    existingRow = {},
    candidate = {},
    selected = {},
  } = {},
) {
  const context = resolveMultiAngleResearchContext(state, selected)
  const eventSnapshot = context.eventSnapshot ?? {}
  const categorySnapshot = context.categorySnapshot ?? {}
  const hasExplicitEmptyEventId = (
    Object.prototype.hasOwnProperty.call(row, 'researchEventId')
      && !String(row?.researchEventId ?? '').trim()
  ) || (
    !Object.prototype.hasOwnProperty.call(row, 'researchEventId')
      && existingRow != null
      && Object.prototype.hasOwnProperty.call(existingRow, 'researchEventId')
      && !String(existingRow?.researchEventId ?? '').trim()
  )
  const isEvergreen = hasExplicitEmptyEventId
    || row?.intentTrack === 'evergreen'
    || row?.resultLane === 'evergreen'
    || existingRow?.intentTrack === 'evergreen'
    || existingRow?.resultLane === 'evergreen'
    || candidate?.resultLane === 'evergreen'
    || candidate?.intentTrack === 'evergreen'
  if (context.fixed) {
    return {
      eventId: isEvergreen ? '' : String(context.eventId ?? ''),
      eventLabel: isEvergreen
        ? 'Evergreen'
        : String(eventSnapshot.jpLabel ?? eventSnapshot.label ?? ''),
      eventSearchTerm: isEvergreen
        ? ''
        : String(eventSnapshot.searchTerm ?? ''),
      categoryId: String(context.categoryId ?? ''),
      categoryLabel: String(categorySnapshot.label ?? ''),
      categorySearchTerm: String(categorySnapshot.searchTerm ?? ''),
    }
  }
  const fixedEventId = context.fixed && !isEvergreen
    ? context.eventId
    : candidate?.eventId ?? context.eventId
  const fixedEventLabel = context.fixed && !isEvergreen
    ? eventSnapshot.jpLabel || eventSnapshot.label
    : candidate?.eventLabel ?? eventSnapshot.jpLabel ?? eventSnapshot.label
  const fixedEventSearchTerm = context.fixed && !isEvergreen
    ? eventSnapshot.searchTerm
    : candidate?.eventSearchTerm ?? eventSnapshot.searchTerm
  const fixedCategoryId = context.fixed
    ? context.categoryId
    : candidate?.categoryId ?? context.categoryId
  const fixedCategoryLabel = context.fixed
    ? categorySnapshot.label
    : candidate?.categoryLabel ?? categorySnapshot.label
  const fixedCategorySearchTerm = context.fixed
    ? categorySnapshot.searchTerm
    : candidate?.categorySearchTerm ?? categorySnapshot.searchTerm
  return {
    eventId: String(
      row?.researchEventId
      ?? existingRow?.researchEventId
      ?? fixedEventId
      ?? '',
    ),
    eventLabel: String(
      row?.researchEventLabel
      ?? existingRow?.researchEventLabel
      ?? fixedEventLabel
      ?? '',
    ),
    eventSearchTerm: String(
      row?.researchEventSearchTerm
      ?? existingRow?.researchEventSearchTerm
      ?? fixedEventSearchTerm
      ?? '',
    ),
    categoryId: String(
      row?.researchCategoryId
      ?? existingRow?.researchCategoryId
      ?? fixedCategoryId
      ?? '',
    ),
    categoryLabel: String(
      row?.researchCategoryLabel
      ?? existingRow?.researchCategoryLabel
      ?? fixedCategoryLabel
      ?? '',
    ),
    categorySearchTerm: String(
      row?.researchCategorySearchTerm
      ?? existingRow?.researchCategorySearchTerm
      ?? fixedCategorySearchTerm
      ?? '',
    ),
  }
}

export function shouldRegenerateMarketplaceCandidates({ addedCount = 0, autoRunning = false } = {}) {
  return Number(addedCount) > 0 && !autoRunning
}

export function isMarketplaceDateAxisLabel(value = '') {
  const label = String(value ?? '').replace(/\s+/g, ' ').trim()
  return /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?$/i.test(label)
    || /^\d{1,2}月\d{1,2}日$/.test(label)
}

export function resolveMultiAngleExportResearchContext(
  state = {},
  {
    row = {},
    selected = {},
  } = {},
) {
  const context = resolveMultiAngleResearchContext(state, selected)
  const hasRowEventId = Object.hasOwn(row ?? {}, 'researchEventId')
  const hasRowCategoryId = Object.hasOwn(row ?? {}, 'researchCategoryId')
  return {
    eventId: String(hasRowEventId ? row.researchEventId ?? '' : context.eventId ?? '').trim(),
    categoryId: String(
      hasRowCategoryId ? row.researchCategoryId ?? '' : context.categoryId ?? '',
    ).trim(),
  }
}

export function backfillMultiAngleResearchSnapshots(state = {}, context = {}) {
  const current = createMultiAngleExplorationState(state)
  const suppliedEvent = normalizedEventSnapshot(
    context?.eventSnapshot,
    current.activeEventId,
  )
  const suppliedCategory = normalizedCategorySnapshot(
    context?.categorySnapshot,
    current.categoryId,
  )
  return createMultiAngleExplorationState({
    ...current,
    eventSnapshot: current.eventSnapshot
      || (suppliedEvent?.id === current.activeEventId ? suppliedEvent : null),
    categorySnapshot: current.categorySnapshot
      || (suppliedCategory?.id === current.categoryId ? suppliedCategory : null),
  })
}

export function pauseMultiAngleForContextChange(
  state = {},
  selected = {},
  reason = 'input-context-changed',
  now = '',
) {
  const current = createMultiAngleExplorationState(state)
  if (current.status !== 'running') return current
  const fixed = resolveMultiAngleResearchContext(current, selected)
  const selectedEventId = String(selected?.eventId ?? selected?.activeEventId ?? '').trim()
  const selectedCategoryId = String(selected?.categoryId ?? '').trim()
  const changed = (selectedEventId && selectedEventId !== fixed.eventId)
    || (selectedCategoryId && selectedCategoryId !== fixed.categoryId)
    || (
      fixed.eventSnapshot
      && selected?.eventSnapshot
      && eventSnapshotKey(selected.eventSnapshot) !== eventSnapshotKey(fixed.eventSnapshot)
    )
  return changed ? pauseMultiAngleExploration(current, reason, now) : current
}

export function shouldAutoStartMultiAngleExploration(input = {}) {
  const targetWinnerCount = Math.max(1, Number(input.targetWinnerCount) || 5)
  const winnerCount = Math.max(0, Number(input.winnerCount) || 0)
  if (!input.hasResearchRows || winnerCount >= targetWinnerCount) return false
  if (input.decisionStatus === 'pending' || Number(input.pendingCount) > 0) return false
  if (String(input.explorationStatus ?? 'idle') !== 'idle') return false
  if (input.activeWork || input.restoredAwaiting || input.crossNichePending || input.blocked) return false
  return ['ready', 'none', 'retry'].includes(String(input.decisionStatus ?? ''))
}

export function shouldAutoStartFreshCycle(input = {}) {
  const targetWinnerCount = Math.max(1, Number(input.targetWinnerCount) || 5)
  const winnerCount = Math.max(0, Number(input.winnerCount) || 0)
  return String(input.reason ?? '') === 'all-angles-exhausted'
    && winnerCount < targetWinnerCount
    && input.blocked !== true
}

export function startMultiAngleExploration(state = {}, context = {}, now = '') {
  const restored = createMultiAngleExplorationState(state)
  const updatedAt = timestamp(now)
  const startsFresh = restored.status === 'idle'
  const suppliedEventId = String(
    context?.activeEventId ?? context?.eventId ?? '',
  ).trim()
  const suppliedCategoryId = String(context?.categoryId ?? '').trim()
  const suppliedEventSnapshot = normalizedEventSnapshot(
    context?.eventSnapshot,
    suppliedEventId,
  )
  const suppliedCategorySnapshot = normalizedCategorySnapshot(
    context?.categorySnapshot,
    suppliedCategoryId,
  )
  const freshEventId = suppliedEventId || restored.activeEventId
  const freshCategoryId = suppliedCategoryId || restored.categoryId
  const targetWinnerCount = positiveInteger(
    context?.targetWinnerCount,
    restored.targetWinnerCount,
  )
  const targetReached = restored.winnerKeywords.length >= targetWinnerCount
  return {
    ...restored,
    status: targetReached ? 'winner-found' : 'running',
    activeEventId: startsFresh
      ? freshEventId
      : restored.activeEventId || suppliedEventId,
    categoryId: startsFresh
      ? freshCategoryId
      : restored.categoryId || suppliedCategoryId,
    eventSnapshot: startsFresh
      ? suppliedEventSnapshot
        || (restored.eventSnapshot?.id === freshEventId ? restored.eventSnapshot : null)
      : restored.eventSnapshot || suppliedEventSnapshot,
    categorySnapshot: startsFresh
      ? suppliedCategorySnapshot
        || (restored.categorySnapshot?.id === freshCategoryId ? restored.categorySnapshot : null)
      : restored.categorySnapshot || suppliedCategorySnapshot,
    targetWinnerCount,
    startedAt: startsFresh ? updatedAt : restored.startedAt || updatedAt,
    updatedAt,
    completedAt: targetReached ? restored.completedAt || updatedAt : '',
    pauseReason: '',
  }
}

function readyMultiAngleRetryBatch(current, dueRetries) {
  const dueKeys = new Set(dueRetries.map((entry) => entry.evidenceKey))
  const candidates = dueRetries.map((entry) => ({
    ...entry.candidate,
    retryAttempts: entry.attempts,
  }))
  return {
    state: {
      ...current,
      status: 'running',
      queuedEvidenceKeys: uniqueStrings([
        ...current.queuedEvidenceKeys,
        ...dueRetries.map((entry) => entry.evidenceKey),
      ]),
      retryQueue: current.retryQueue.filter((entry) => !dueKeys.has(entry.evidenceKey)),
      currentBatchCandidates: candidates,
    },
    candidates,
    reason: 'retry-ready',
  }
}

export function nextMultiAngleBatch({
  state,
  pools = {},
  angleOrder = EXPLORATION_ANGLE_ORDER,
  limit = 8,
  now = '',
  preferNormalCandidates = false,
  excludedRiskTerms,
} = {}) {
  let current = annotatePools(createMultiAngleExplorationState(state), pools)
  const candidateIsEligible = excludedRiskTerms === undefined
    ? () => true
    : (candidate) => isEfficientMarketplaceProbe(candidate, { excludedRiskTerms })
  current = {
    ...current,
    currentBatchCandidates: current.currentBatchCandidates.filter(candidateIsEligible),
    retryQueue: current.retryQueue.filter((entry) => candidateIsEligible(entry.candidate)),
  }
  if (TERMINAL_STATUSES.has(current.status)) {
    return { state: current, candidates: [], reason: `status-${current.status}` }
  }

  const batchLimit = Math.max(1, Math.min(30, Number(limit) || 8))
  const completedOrFailed = new Set([
    ...current.evidenceKeys,
    ...current.failedEvidenceKeys,
  ])
  const currentBatchCandidates = current.currentBatchCandidates
    .map((candidate) => hydrateCandidate(candidate, current, candidate?.angleId))
    .filter(Boolean)
    .filter(candidateIsEligible)
    .filter((candidate) => !completedOrFailed.has(candidateEvidenceKey(candidate)))
    .slice(0, batchLimit)
  if (currentBatchCandidates.length > 0) {
    return {
      state: {
        ...current,
        status: 'running',
        queuedEvidenceKeys: uniqueStrings([
          ...current.queuedEvidenceKeys,
          ...currentBatchCandidates.map(candidateEvidenceKey),
        ]),
        currentBatchCandidates,
      },
      candidates: currentBatchCandidates,
      reason: 'current-batch',
    }
  }

  const nowMs = Date.parse(timestamp(now))
  const dueRetries = current.retryQueue
    .filter((entry) => Date.parse(entry.retryAt) <= nowMs)
    .slice(0, batchLimit)
  if (dueRetries.length > 0 && !preferNormalCandidates) {
    return readyMultiAngleRetryBatch(current, dueRetries)
  }

  const used = new Set([
    ...current.evidenceKeys,
    ...current.queuedEvidenceKeys,
    ...current.retryQueue.map((entry) => entry.evidenceKey),
    ...current.failedEvidenceKeys,
  ])
  const attempted = new Set(current.attemptedAngles)
  const completed = new Set(current.completedAngles)
  const empty = new Set(current.emptyAngles)
  const pendingRetryAngles = new Set(current.retryQueue.map((entry) => (
    String(entry.candidate?.angleId ?? current.currentAngleId).trim()
  )).filter(Boolean))
  const reopenedEarlierAngles = angleOrder.filter((angleId, index) => (
    index < current.angleIndex
    && (completed.has(angleId) || empty.has(angleId))
    && (pools[angleId] ?? []).some((rawCandidate) => {
      const candidate = hydrateCandidate(rawCandidate, current, angleId)
      return candidate
        && candidateIsEligible(candidate)
        && candidate.resultLane !== 'seasonal-reference'
        && !used.has(candidateEvidenceKey(candidate))
    })
  ))
  reopenedEarlierAngles.forEach((angleId) => {
    completed.delete(angleId)
    empty.delete(angleId)
  })
  const anglesToReview = uniqueStrings([
    ...reopenedEarlierAngles,
    ...angleOrder.filter((angleId, index) => (
      index < current.angleIndex
      && attempted.has(angleId)
      && !completed.has(angleId)
      && !empty.has(angleId)
    )),
    ...angleOrder.slice(current.angleIndex),
  ])
  for (const angleId of anglesToReview) {
    const index = angleOrder.indexOf(angleId)
    if (completed.has(angleId) || empty.has(angleId)) continue
    const unseen = []
    for (const rawCandidate of pools[angleId] ?? []) {
      const candidate = hydrateCandidate(rawCandidate, current, angleId)
      if (!candidate || !candidateIsEligible(candidate) || candidate.resultLane === 'seasonal-reference') continue
      const evidenceKey = candidateEvidenceKey(candidate)
      if (used.has(evidenceKey)) continue
      used.add(evidenceKey)
      unseen.push(candidate)
      if (unseen.length >= batchLimit) break
    }
    if (unseen.length === 0) {
      if (pendingRetryAngles.has(angleId)) continue
      if (attempted.has(angleId)) {
        completed.add(angleId)
      } else {
        empty.add(angleId)
      }
      continue
    }
    empty.delete(angleId)

    return {
      state: {
        ...current,
        status: 'running',
        currentAngleId: angleId,
        angleIndex: index,
        queuedEvidenceKeys: unseen.map(candidateEvidenceKey),
        currentBatchCandidates: unseen,
        attemptedAngles: [...attempted],
        completedAngles: [...completed],
        emptyAngles: [...empty],
        exhaustedAngles: [...new Set([...completed, ...empty])],
      },
      candidates: unseen,
      reason: 'batch-ready',
    }
  }

  if (dueRetries.length > 0) {
    return readyMultiAngleRetryBatch({
      ...current,
      attemptedAngles: [...attempted],
      completedAngles: [...completed],
      emptyAngles: [...empty],
      exhaustedAngles: [...new Set([...completed, ...empty])],
    }, dueRetries)
  }

  if (current.retryQueue.length > 0) {
    return {
      state: {
        ...current,
        status: 'running',
        attemptedAngles: [...attempted],
        completedAngles: [...completed],
        emptyAngles: [...empty],
        exhaustedAngles: [...new Set([...completed, ...empty])],
      },
      candidates: [],
      reason: 'retry-wait',
    }
  }

  current = {
    ...current,
    status: 'exhausted',
    queuedEvidenceKeys: [],
    currentBatchCandidates: [],
    attemptedAngles: [...attempted],
    completedAngles: [...completed],
    emptyAngles: [...empty],
    exhaustedAngles: [...new Set([...completed, ...empty])],
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
  const attemptedAngleIds = []
  const winners = []

  for (const row of Array.isArray(rows) ? rows : []) {
    const candidate = hydrateCandidate(row, current, current.currentAngleId)
    if (!candidate) continue
    const evidenceKey = candidateEvidenceKey(candidate)
    recordedKeys.push(evidenceKey)
    attemptedAngleIds.push(candidate.angleId || current.currentAngleId)
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
  const wasPaused = current.status === 'paused'
  const updatedAt = timestamp(now)
  const attemptedAngles = uniqueStrings([
    ...current.attemptedAngles,
    ...attemptedAngleIds,
  ])
  const completedAngles = current.completedAngles
  const emptyAngles = current.emptyAngles
    .filter((angleId) => !attemptedAngles.includes(angleId))
  return {
    ...current,
    status: wasPaused ? 'paused' : targetReached ? 'winner-found' : 'running',
    evidenceKeys: uniqueStrings([...current.evidenceKeys, ...recordedKeys]),
    provenance,
    queuedEvidenceKeys: current.queuedEvidenceKeys.filter((key) => !recorded.has(key)),
    currentBatchCandidates: current.currentBatchCandidates
      .filter((candidate) => !recorded.has(candidateEvidenceKey(candidate))),
    retryQueue: current.retryQueue.filter((entry) => !recorded.has(entry.evidenceKey)),
    winnerKeywords,
    resultLanes,
    attemptedAngles,
    completedAngles,
    emptyAngles,
    exhaustedAngles: uniqueStrings([...completedAngles, ...emptyAngles]),
    completedAt: targetReached && !wasPaused ? current.completedAt || updatedAt : '',
    pauseReason: wasPaused ? current.pauseReason : '',
    updatedAt,
  }
}

// A restored cycle can already be exhausted while its selected rows are still
// waiting for evidence.  When that evidence finishes later, preserve the
// exhausted route history but reconcile the verified winners into its target.
export function reconcileMultiAngleWinners(state = {}, rows = [], now = '') {
  const current = createMultiAngleExplorationState(state)
  const observedRows = Array.isArray(rows) ? rows : []
  const winners = uniqueStrings(observedRows
    .filter((row) => {
      const grade = String(
        row?.opportunityLabel
        ?? row?.everbeeRow?.score?.opportunityLabel
        ?? '',
      ).trim().toUpperCase()
      const resultLane = String(
        row?.resultLane
        ?? row?.candidate?.resultLane
        ?? '',
      ).trim()
      return row?.evidenceState?.status === 'verified'
        && resultLane !== 'seasonal-reference'
        && row?.queryEligibility?.eligible !== false
        && ['A', 'B'].includes(grade)
    })
    .map((row) => row.keyword))
  const winnerKeywords = uniqueStrings(winners)
  const targetReached = winnerKeywords.length >= current.targetWinnerCount
  const wasIncorrectlyComplete = current.status === 'winner-found' && !targetReached
  const updatedAt = timestamp(now)

  return {
    ...current,
    status: targetReached ? 'winner-found' : wasIncorrectlyComplete ? 'running' : current.status,
    winnerKeywords,
    completedAt: targetReached ? current.completedAt || updatedAt : wasIncorrectlyComplete ? '' : current.completedAt,
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
  const candidateAngleId = candidate.angleId || current.currentAngleId
  const attemptedAngles = candidateAngleId
    ? uniqueStrings([...current.attemptedAngles, candidateAngleId])
    : current.attemptedAngles
  const completedAngles = current.completedAngles
    .filter((angleId) => angleId !== candidateAngleId)
  const emptyAngles = current.emptyAngles
    .filter((angleId) => angleId !== candidateAngleId)
  const previousRetry = current.retryQueue.find((entry) => entry.evidenceKey === evidenceKey)
  const otherRetries = current.retryQueue.filter((entry) => entry.evidenceKey !== evidenceKey)
  const queuedEvidenceKeys = current.queuedEvidenceKeys.filter((key) => key !== evidenceKey)
  const currentBatchCandidates = current.currentBatchCandidates
    .filter((item) => candidateEvidenceKey(item) !== evidenceKey)
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
        currentBatchCandidates,
        attemptedAngles,
        completedAngles,
        emptyAngles,
        exhaustedAngles: uniqueStrings([...completedAngles, ...emptyAngles]),
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
    currentBatchCandidates,
    retryQueue: otherRetries,
    failedEvidenceKeys: uniqueStrings([...current.failedEvidenceKeys, evidenceKey]),
    attemptedAngles,
    completedAngles,
    emptyAngles,
    exhaustedAngles: uniqueStrings([...completedAngles, ...emptyAngles]),
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

export function reopenExhaustedMultiAngleExploration(state = {}, pools = {}, now = '') {
  const current = createMultiAngleExplorationState(state)
  if (current.status !== 'exhausted') return resumeMultiAngleExploration(current, now)
  const used = new Set([
    ...current.evidenceKeys,
    ...current.queuedEvidenceKeys,
    ...current.failedEvidenceKeys,
    ...current.retryQueue.map((entry) => entry.evidenceKey),
  ])
  const reopenedAngles = EXPLORATION_ANGLE_ORDER.filter((angleId) => (
    (pools[angleId] ?? []).some((rawCandidate) => {
      const candidate = hydrateCandidate(rawCandidate, current, angleId)
      return candidate
        && candidate.resultLane !== 'seasonal-reference'
        && !used.has(candidateEvidenceKey(candidate))
    })
  ))
  if (reopenedAngles.length === 0) return current
  const reopened = new Set(reopenedAngles)
  const completedAngles = current.completedAngles.filter((angleId) => !reopened.has(angleId))
  const emptyAngles = current.emptyAngles.filter((angleId) => !reopened.has(angleId))
  const currentAngleId = reopenedAngles[0]
  return {
    ...current,
    status: 'running',
    currentAngleId,
    angleIndex: EXPLORATION_ANGLE_ORDER.indexOf(currentAngleId),
    completedAngles,
    emptyAngles,
    exhaustedAngles: uniqueStrings([...completedAngles, ...emptyAngles]),
    completedAt: '',
    pauseReason: '',
    updatedAt: timestamp(now),
  }
}

export function resumeExhaustedMultiAngleExploration(state = {}, pools = {}, now = '') {
  const resumed = reopenExhaustedMultiAngleExploration(state, pools, now)
  return {
    state: resumed,
    requiresFreshCycle: resumed.status === 'exhausted',
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

export function stopMultiAngleWork(snapshot = {}, source = 'global', now = '') {
  const stopSource = ['marketplace', 'extension', 'global'].includes(source)
    ? source
    : 'global'
  const pending = snapshot?.pendingEvidenceAutomation ?? {}
  return {
    source: stopSource,
    exploration: stopMultiAngleExploration(snapshot?.exploration, now),
    pendingEvidenceAutomation: {
      ...pending,
      active: false,
      scheduled: false,
      currentStage: '',
      targetKeywords: uniqueStrings(pending?.targetKeywords),
    },
  }
}
