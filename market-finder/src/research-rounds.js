const ROUND_STATUSES = new Set(['pending-erank', 'pending-etsy', 'pending-everbee', 'complete'])
const GRADES = ['A', 'B', 'C', 'D']

function normalizeKeyword(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function uniqueKeywords(values) {
  const seen = new Set()
  return (Array.isArray(values) ? values : [])
    .map(normalizeKeyword)
    .filter(Boolean)
    .filter((keyword) => {
      if (seen.has(keyword)) return false
      seen.add(keyword)
      return true
    })
}

function emptyCounts(value = {}) {
  return Object.fromEntries(GRADES.map((grade) => [grade, Math.max(0, Number(value?.[grade]) || 0)]))
}

function roundId(type, depth) {
  if (type === 'initial') return 'initial'
  if (type === 'continuous-niche') return `continuous-niche-${Math.max(1, Number(depth) || 1)}`
  return `cross-niche-${Math.max(1, Math.min(3, Number(depth) || 1))}`
}

function sanitizeRound(value = {}) {
  const type = ['cross-niche', 'continuous-niche'].includes(value.type) ? value.type : 'initial'
  const depth = type === 'initial'
    ? 0
    : type === 'continuous-niche'
      ? Math.max(1, Number(value.depth) || 1)
      : Math.max(1, Math.min(3, Number(value.depth) || 1))
  return {
    id: roundId(type, depth),
    type,
    depth,
    status: ROUND_STATUSES.has(value.status) ? value.status : 'pending-erank',
    candidateKeywords: uniqueKeywords(value.candidateKeywords),
    resultKeywords: uniqueKeywords(value.resultKeywords),
    opportunityCounts: emptyCounts(value.opportunityCounts),
    startedAt: String(value.startedAt ?? ''),
    completedAt: String(value.completedAt ?? ''),
    startReason: String(value.startReason ?? ''),
    stopReason: String(value.stopReason ?? ''),
  }
}

export function createResearchRoundsState(value = {}) {
  const byId = new Map()
  for (const item of Array.isArray(value?.rounds) ? value.rounds : []) {
    const round = sanitizeRound(item)
    byId.set(round.id, round)
  }
  const rounds = [...byId.values()].sort((a, b) => a.depth - b.depth)
  const requestedActive = String(value?.activeRoundId ?? '')
  const activeRoundId = rounds.some((round) => round.id === requestedActive)
    ? requestedActive
    : rounds.at(-1)?.id ?? ''
  const requestedSelected = String(value?.selectedRoundId ?? '')
  const selectedRoundId = requestedSelected === 'all' || rounds.some((round) => round.id === requestedSelected)
    ? requestedSelected
    : activeRoundId || 'all'
  return { rounds, activeRoundId, selectedRoundId }
}

export function startResearchRound(state, details = {}) {
  const current = createResearchRoundsState(state)
  const nextRound = sanitizeRound({
    ...details,
    status: details.status ?? 'pending-erank',
    startedAt: details.startedAt ?? new Date().toISOString(),
  })
  const existing = current.rounds.find((round) => round.id === nextRound.id)
  const merged = existing
    ? sanitizeRound({
      ...existing,
      ...nextRound,
      candidateKeywords: uniqueKeywords([...existing.candidateKeywords, ...nextRound.candidateKeywords]),
      resultKeywords: uniqueKeywords([...existing.resultKeywords, ...nextRound.resultKeywords]),
    })
    : nextRound
  const rounds = current.rounds.filter((round) => round.id !== merged.id).concat(merged)
    .sort((a, b) => a.depth - b.depth)
  return {
    rounds,
    activeRoundId: merged.id,
    selectedRoundId: merged.id,
  }
}

export function updateResearchRound(state, id, patch = {}) {
  const current = createResearchRoundsState(state)
  const rounds = current.rounds.map((round) => {
    if (round.id !== id) return round
    const status = patch.status ?? round.status
    return sanitizeRound({
      ...round,
      ...patch,
      candidateKeywords: patch.candidateKeywords ?? round.candidateKeywords,
      resultKeywords: patch.resultKeywords ?? round.resultKeywords,
      completedAt: status === 'complete'
        ? (patch.completedAt ?? round.completedAt ?? new Date().toISOString())
        : (patch.completedAt ?? round.completedAt),
    })
  })
  return { ...current, rounds }
}

export function selectResearchRound(state, id = 'all') {
  const current = createResearchRoundsState(state)
  const selectedRoundId = id === 'all' || current.rounds.some((round) => round.id === id)
    ? id
    : current.selectedRoundId
  return { ...current, selectedRoundId }
}

export function researchRowsForRound(rows, round) {
  if (!round) return Array.isArray(rows) ? rows : []
  const keywords = new Set(uniqueKeywords([
    ...(round.candidateKeywords ?? []),
    ...(round.resultKeywords ?? []),
  ]))
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const references = uniqueKeywords([
      row?.keyword,
      row?.query,
      row?.sourceKeyword,
      ...(Array.isArray(row?.sourceKeywords) ? row.sourceKeywords : []),
    ])
    return references.some((keyword) => keywords.has(keyword))
  })
}

export function summarizeOpportunityCounts(rows) {
  const counts = emptyCounts()
  for (const row of Array.isArray(rows) ? rows : []) {
    const grade = String(row?.grade ?? row?.bucket?.grade ?? row?.score?.grade ?? row?.score?.opportunityLabel ?? '').toUpperCase()
    if (grade in counts) counts[grade] += 1
  }
  return counts
}
