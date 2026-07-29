const PROFIT_COMPONENT_LIMITS = {
  demandSupply: 25,
  buyerIntent: 15,
  newcomerAccess: 20,
  differentiation: 15,
  salesEvidence: 13,
  economics: 7,
  trendFit: 5,
}

const FUNNEL_TARGETS = {
  generatedFromAxes: { min: 200, max: 200 },
  marketplaceInsights: { min: 200, max: 200 },
  erankRelated: { min: 50, max: 100 },
  everbeeVisual: { min: 15, max: 20 },
  clusters: { min: 4, max: 6 },
  listings: { min: 25, max: 40 },
}

function clampScore(value, maximum) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(maximum, numeric))
}

function copyValue(value) {
  if (Array.isArray(value)) return value.map(copyValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyValue(item)]))
  }
  return value
}

function isUnknown(value) {
  return value == null || value === '' || String(value).trim().toLowerCase() === 'unknown'
}

function countOf(value) {
  if (Array.isArray(value)) return value.length
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0
}

function normalizeMode(selectedMode, month) {
  const mode = String(selectedMode ?? '').trim().toUpperCase()
  if (/^M[1-6]$/.test(mode)) return mode
  const numericMonth = Number(month)
  const boundedMonth = Number.isFinite(numericMonth)
    ? Math.max(1, Math.min(6, Math.floor(numericMonth)))
    : 1
  return `M${boundedMonth}`
}

function candidateKeywordKey(candidate) {
  return String(candidate?.keyword ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function uniqueCandidates(candidates) {
  const seen = new Set()
  return (Array.isArray(candidates) ? candidates : []).filter((candidate) => {
    const key = candidateKeywordKey(candidate)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isWinningOutcome(outcome) {
  if (outcome?.status === 'early-go') return true
  const visits = Number(outcome?.visits)
  const orders = Number(outcome?.orders)
  return Number.isFinite(visits) && visits >= 100
    && Number.isFinite(orders) && orders >= 3
}

export function winningOutcomeCandidates({ candidates, outcomes } = {}) {
  const winners = (Array.isArray(outcomes) ? outcomes : []).filter(isWinningOutcome)
  const winnerKeywords = new Set(winners.map((outcome) => candidateKeywordKey({
    keyword: outcome?.keyword ?? outcome?.listingKeyword,
  })).filter(Boolean))
  const winnerClusters = new Set(winners.map((outcome) => String(
    outcome?.clusterId ?? outcome?.clusterKey ?? '',
  ).trim().toLowerCase()).filter(Boolean))

  return uniqueCandidates(candidates).filter((candidate) => {
    const keyword = candidateKeywordKey(candidate)
    const cluster = String(
      candidate?.clusterKey ?? candidate?.clusterId ?? candidate?.cluster ?? '',
    ).trim().toLowerCase()
    return winnerKeywords.has(keyword) || (cluster && winnerClusters.has(cluster))
  })
}

export function allocateExplorationCandidates({
  explorationCandidates,
  winnerCandidates,
  selectedMode,
  limit,
} = {}) {
  const boundedLimit = Math.max(0, Math.floor(Number(limit) || 0))
  if (boundedLimit === 0) return []

  const mode = normalizeMode(selectedMode, 1)
  const explorationRatio = mode === 'M1' || mode === 'M2'
    ? 1
    : mode === 'M3' || mode === 'M4'
      ? 0.6
      : 0.3
  const explorationQuota = Math.floor(boundedLimit * explorationRatio)
  const winnerQuota = boundedLimit - explorationQuota
  const exploration = uniqueCandidates(explorationCandidates)
  const winners = uniqueCandidates(winnerCandidates)
  const selected = []
  const selectedKeys = new Set()
  const positions = { exploration: 0, winners: 0 }

  function take(poolName, pool, count) {
    let added = 0
    while (positions[poolName] < pool.length && selected.length < boundedLimit && added < count) {
      const candidate = pool[positions[poolName]]
      positions[poolName] += 1
      const key = candidateKeywordKey(candidate)
      if (selectedKeys.has(key)) continue
      selectedKeys.add(key)
      selected.push(candidate)
      added += 1
    }
  }

  take('exploration', exploration, explorationQuota)
  take('winners', winners, winnerQuota)
  take('exploration', exploration, boundedLimit - selected.length)
  if (mode !== 'M1' && mode !== 'M2') {
    take('winners', winners, boundedLimit - selected.length)
  }
  return selected
}

export function scoreProfitStrategy(input = {}) {
  const source = input && typeof input === 'object' ? input : {}
  const sourceEvidence = source.evidence && typeof source.evidence === 'object' ? source.evidence : {}
  const weights = Object.fromEntries(
    Object.entries(PROFIT_COMPONENT_LIMITS).map(([component, maximum]) => [component, clampScore(source[component], maximum)]),
  )
  const evidence = copyValue(sourceEvidence)
  const components = Object.fromEntries(
    Object.entries(PROFIT_COMPONENT_LIMITS).map(([component, maximum]) => [component, {
      score: weights[component],
      maximum,
      evidence: copyValue(sourceEvidence[component]),
    }]),
  )

  return {
    total: Object.values(weights).reduce((sum, value) => sum + value, 0),
    weights,
    evidence,
    components,
  }
}

export function decideProductAction({ marketGrade, profitScore, ipRisk } = {}) {
  const grade = String(marketGrade ?? '').trim().toUpperCase()
  const score = clampScore(profitScore, 100)

  if (ipRisk || grade === 'D') return { action: 'reject' }
  if (grade === 'C') return { action: 'explore' }
  if ((grade === 'A' || grade === 'B') && score >= 70) return { action: 'launch-small' }
  if ((grade === 'A' || grade === 'B') && score >= 55) return { action: 'hold' }
  return { action: 'reject' }
}

export function shouldRequestErank(row = {}) {
  const source = row && typeof row === 'object' ? row : {}
  const etsyCoreUnknown = source.etsyCoreDataUnknown === true
    || isUnknown(source.etsySearches)
    || isUnknown(source.etsyListings)
  const needsSeasonCountryComparison = source.needsSeasonCountryComparison === true
  const isMarketBoundary = source.marketBoundary === 'A/B' || source.marketBoundary === 'B/C'
  const relatedTermsCount = Array.isArray(source.relatedTerms)
    ? source.relatedTerms.length
    : countOf(source.relatedTermsCount)
  const hasInsufficientRelatedTerms = relatedTermsCount < 3
  const hasEtsyEverbeeConflict = source.etsyEverbeeConflict === true || source.etsyEverBeeConflict === true

  return etsyCoreUnknown
    || needsSeasonCountryComparison
    || isMarketBoundary
    || hasInsufficientRelatedTerms
    || hasEtsyEverbeeConflict
}

export function resolveExplorationMode({ selectedMode, month, outcomes } = {}) {
  const mode = normalizeMode(selectedMode, month)
  const winnerCount = (Array.isArray(outcomes) ? outcomes : [])
    .filter((outcome) => outcome?.action === 'launch-small').length

  if (mode === 'M1' || mode === 'M2') {
    return { mode, strategy: 'distribution', explorationPercent: 100, winnerDeepeningPercent: 0, winnerCount }
  }
  if (mode === 'M3' || mode === 'M4') {
    return { mode, strategy: 'hybrid', explorationPercent: 60, winnerDeepeningPercent: 40, winnerCount }
  }
  return { mode, strategy: 'winner-deepening', explorationPercent: 30, winnerDeepeningPercent: 70, winnerCount }
}

export function summarizeResearchFunnel(input = {}) {
  const source = input && typeof input === 'object' ? input : {}
  const counts = Object.fromEntries(
    Object.keys(FUNNEL_TARGETS).map((stage) => [stage, countOf(source[stage])]),
  )
  const withinTarget = Object.fromEntries(
    Object.entries(FUNNEL_TARGETS).map(([stage, target]) => [stage,
      counts[stage] >= target.min && counts[stage] <= target.max]),
  )

  return { counts, targets: copyValue(FUNNEL_TARGETS), withinTarget }
}
