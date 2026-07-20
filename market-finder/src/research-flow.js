function normalizeKeyword(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function hasValues(values) {
  return values.some((value) => value !== null && value !== undefined && value !== '')
}

function uniqueKeywords(values) {
  const seen = new Set()
  return values.filter((value) => {
    const keyword = normalizeKeyword(value)
    if (!keyword || seen.has(keyword)) return false
    seen.add(keyword)
    return true
  })
}

function finiteMetric(value, { positive = false } = {}) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number) || (positive && number <= 0)) return null
  return number
}

function percentileRank(value, population, { lowerIsBetter = false } = {}) {
  if (value === null || population.length < 2) return null
  const lowerCount = population.filter((candidate) => candidate < value).length
  const equalCount = population.filter((candidate) => candidate === value).length
  const rank = ((lowerCount + Math.max(0, equalCount - 1) / 2) / (population.length - 1)) * 100
  return lowerIsBetter ? 100 - rank : rank
}

function averageAvailable(values) {
  const available = values.filter((value) => Number.isFinite(value))
  if (available.length === 0) return null
  return available.reduce((sum, value) => sum + value, 0) / available.length
}

function cohortMetrics(row = {}) {
  const normalized = row.erankOpportunity?.normalized ?? {}
  return {
    search: finiteMetric(normalized.erankSearchVolume),
    clicks: finiteMetric(normalized.erankClicks),
    competition: finiteMetric(normalized.erankCompetition, { positive: true }),
    difficulty: finiteMetric(normalized.erankKeywordDifficulty),
  }
}

export function extensionResultsImportMode(extensionState, localRows = [], acceptInactiveResults = false) {
  if (!Array.isArray(extensionState?.results) || extensionState.results.length === 0) return 'ignore'
  if (extensionState.active || acceptInactiveResults) return 'current'
  return Array.isArray(localRows) && localRows.length === 0 ? 'restore' : 'ignore'
}

export function buildEtsyCandidatesFromErank(erankRows = [], candidates = []) {
  const candidatesByKeyword = new Map(candidates.map((candidate) => [
    normalizeKeyword(candidate.keyword ?? candidate.query),
    candidate,
  ]))
  const qualifiedByKeyword = new Map()

  erankRows.forEach((row) => {
    const keyword = normalizeKeyword(row.keyword)
    const action = row.erankOpportunity?.action
    const riskTerms = Array.isArray(row.score?.riskTerms) ? row.score.riskTerms : []
    const metrics = cohortMetrics(row)
    const officialProbe = action === 'hold' && ((metrics.search ?? 0) > 0 || (metrics.clicks ?? 0) > 0)
    if (!keyword || (!['everbee', 'expand'].includes(action) && !officialProbe) || riskTerms.length > 0) return

    const opportunityIndex = Number(row.erankOpportunity?.score) || 0
    const previous = qualifiedByKeyword.get(keyword)
    if (previous && previous.candidate.opportunityIndex >= opportunityIndex) return

    const source = candidatesByKeyword.get(keyword) ?? {}
    const candidate = {
      keyword,
      query: keyword,
      discoveryLane: source.discoveryLane ?? 'baseline',
      queryStrategy: source.queryStrategy ?? 'direct',
      opportunityIndex,
    }
    if (Array.isArray(source.axisTerms) && source.axisTerms.length > 0) candidate.axisTerms = [...source.axisTerms]
    if (source.sourceQuery) candidate.sourceQuery = source.sourceQuery
    if (source.intentTrack) candidate.intentTrack = source.intentTrack
    if (source.historyClusterKey) candidate.historyClusterKey = source.historyClusterKey
    if (Object.prototype.hasOwnProperty.call(source, 'previouslyResearchedElsewhere')) {
      candidate.previouslyResearchedElsewhere = Boolean(source.previouslyResearchedElsewhere)
    }
    if (Array.isArray(source.priorEventIds) && source.priorEventIds.length > 0) {
      candidate.priorEventIds = [...source.priorEventIds]
    }
    if (officialProbe) candidate.officialProbe = true
    qualifiedByKeyword.set(keyword, { candidate, metrics })
  })

  const qualified = [...qualifiedByKeyword.values()]
  const populations = {
    search: qualified.map((entry) => entry.metrics.search).filter((value) => value !== null),
    clicks: qualified.map((entry) => entry.metrics.clicks).filter((value) => value !== null),
    competition: qualified.map((entry) => entry.metrics.competition).filter((value) => value !== null),
    difficulty: qualified.map((entry) => entry.metrics.difficulty).filter((value) => value !== null),
  }

  return qualified
    .map(({ candidate, metrics }) => {
      const relativeDemand = averageAvailable([
        percentileRank(metrics.search, populations.search),
        percentileRank(metrics.clicks, populations.clicks),
      ])
      const relativeCompetition = averageAvailable([
        percentileRank(metrics.competition, populations.competition, { lowerIsBetter: true }),
        percentileRank(metrics.difficulty, populations.difficulty, { lowerIsBetter: true }),
      ])
      const cohortIndex = averageAvailable([relativeDemand, relativeCompetition])
      if (cohortIndex === null) return candidate

      return {
        ...candidate,
        cohortIndex: Math.round(cohortIndex),
        priorityIndex: Math.round((candidate.opportunityIndex * 0.75) + (cohortIndex * 0.25)),
      }
    })
    .sort((left, right) => (
      Number(left.previouslyResearchedElsewhere) - Number(right.previouslyResearchedElsewhere)
      || (right.priorityIndex ?? right.opportunityIndex) - (left.priorityIndex ?? left.opportunityIndex)
      || right.opportunityIndex - left.opportunityIndex
      || left.keyword.localeCompare(right.keyword, 'en')
    ))
}

export function marketplaceCompletedKeywords(plan) {
  const completed = Array.isArray(plan?.items)
    ? plan.items.filter((item) => item.status === 'completed' && hasValues([
      item.result?.etsySearches30d,
      item.result?.etsyListings,
    ]))
    : []
  const direct = completed.map((item) => normalizeKeyword(item.query)).filter(Boolean)
  const related = completed
    .flatMap((item) => Array.isArray(item.result?.etsyRelatedKeywordMetrics)
      ? item.result.etsyRelatedKeywordMetrics
      : [])
    .filter((metric) => hasValues([metric.etsySearches30d, metric.etsyListings]))
    .map((metric) => ({
      keyword: normalizeKeyword(metric.keyword),
      searches: Number(metric.etsySearches30d) || 0,
      listings: Number(metric.etsyListings) || Number.MAX_SAFE_INTEGER,
    }))
    .filter((metric) => metric.keyword)
    .sort((left, right) => right.searches - left.searches || left.listings - right.listings || left.keyword.localeCompare(right.keyword, 'en'))
    .map((metric) => metric.keyword)

  return uniqueKeywords([...direct, ...related])
}

export function shouldDiscardMarketplacePlan(plan, erankRows = []) {
  const items = Array.isArray(plan?.items) ? plan.items : []
  if (items.length === 0 || erankRows.length > 0) return false
  if (items.some((item) => item.status === 'opened')) return false
  return marketplaceCompletedKeywords(plan).length === 0
}
