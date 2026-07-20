const VALID_STATUSES = new Set([
  'idle',
  'pending-erank',
  'pending-etsy',
  'pending-everbee',
  'complete',
])

const PENDING_STATUSES = new Set([
  'pending-erank',
  'pending-etsy',
  'pending-everbee',
])

const STATUS_PRIORITY = [
  'pending-erank',
  'pending-etsy',
  'pending-everbee',
]

function normalizeKeyword(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function uniqueKeywords(values = []) {
  const seen = new Set()
  return values
    .map(normalizeKeyword)
    .filter((keyword) => {
      if (!keyword || seen.has(keyword)) return false
      seen.add(keyword)
      return true
    })
}

function normalizeCandidate(candidate = {}) {
  const keyword = normalizeKeyword(candidate.keyword)
  if (!keyword) return null
  return {
    ...candidate,
    keyword,
    parentKeyword: normalizeKeyword(candidate.parentKeyword),
    modifier: normalizeKeyword(candidate.modifier),
    depth: Math.max(1, Math.min(2, Math.floor(Number(candidate.depth) || 1))),
    priorityScore: Math.max(0, Math.min(100, Math.round(Number(candidate.priorityScore) || 0))),
  }
}

function normalizeCandidates(candidates = []) {
  const seen = new Set()
  return candidates
    .map(normalizeCandidate)
    .filter((candidate) => {
      if (!candidate || seen.has(candidate.keyword)) return false
      seen.add(candidate.keyword)
      return true
    })
}

export function createCrossNicheWorkflowState(savedState = {}) {
  const status = VALID_STATUSES.has(savedState?.status) ? savedState.status : 'idle'
  return {
    status,
    round: Math.max(0, Math.min(2, Math.floor(Number(savedState?.round) || 0))),
    batch: normalizeCandidates(Array.isArray(savedState?.batch) ? savedState.batch : []),
    consideredKeywords: uniqueKeywords(savedState?.consideredKeywords),
    queuedKeywords: uniqueKeywords(savedState?.queuedKeywords),
    startedAt: String(savedState?.startedAt ?? ''),
    completedAt: String(savedState?.completedAt ?? ''),
  }
}

export function isCrossNicheWorkflowPending(workflow = {}) {
  return PENDING_STATUSES.has(workflow?.status)
}

function pendingBatchStatus(batch, stageForKeyword) {
  const stages = new Set(batch.map((candidate) => stageForKeyword(candidate.keyword, candidate)))
  return STATUS_PRIORITY.find((status) => stages.has(status)) ?? null
}

export function advanceCrossNicheWorkflow({
  workflow,
  candidates = [],
  stageForKeyword = () => 'pending-erank',
  hasParents = false,
  limit = 12,
  now = new Date().toISOString(),
} = {}) {
  const current = createCrossNicheWorkflowState(workflow)
  const activeStatus = pendingBatchStatus(current.batch, stageForKeyword)
  if (activeStatus) {
    return {
      workflow: {
        ...current,
        status: activeStatus,
        completedAt: '',
      },
      queuedCandidates: [],
      didQueue: false,
    }
  }

  const considered = new Set(current.consideredKeywords)
  const unseenPool = normalizeCandidates(candidates)
    .filter((candidate) => !String(candidate.verdict ?? '').startsWith('weak-'))
    .filter((candidate) => !considered.has(candidate.keyword))
  const eligible = unseenPool
    .filter((candidate) => candidate.depth === current.round + 1)
    .filter((candidate) => stageForKeyword(candidate.keyword, candidate) !== 'done')
  const maxBatch = Math.max(1, Math.min(30, Math.floor(Number(limit) || 12)))

  if (eligible.length > 0 && current.round < 2) {
    const queuedCandidates = eligible.slice(0, maxBatch)
    const consideredKeywords = uniqueKeywords([
      ...current.consideredKeywords,
      ...unseenPool.map((candidate) => candidate.keyword),
    ])
    const queuedKeywords = uniqueKeywords([
      ...current.queuedKeywords,
      ...queuedCandidates.map((candidate) => candidate.keyword),
    ])
    return {
      workflow: {
        ...current,
        status: pendingBatchStatus(queuedCandidates, stageForKeyword) ?? 'pending-erank',
        round: current.round + 1,
        batch: queuedCandidates,
        consideredKeywords,
        queuedKeywords,
        startedAt: current.startedAt || now,
        completedAt: '',
      },
      queuedCandidates,
      didQueue: true,
    }
  }

  if (!hasParents && current.round === 0) {
    return {
      workflow: createCrossNicheWorkflowState(),
      queuedCandidates: [],
      didQueue: false,
    }
  }

  return {
    workflow: {
      ...current,
      status: 'complete',
      batch: [],
      completedAt: current.completedAt || now,
    },
    queuedCandidates: [],
    didQueue: false,
  }
}
