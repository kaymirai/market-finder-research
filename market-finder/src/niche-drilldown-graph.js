import {
  compareCrossNicheRows,
  normalizePhrase,
} from '../../shared/market-keyword-engine/index.js'

function optionalNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const number = Number(String(value).replace(/[$,%\s,]/g, ''))
  return Number.isFinite(number) ? number : null
}

function newestTimestamp(values) {
  return values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .sort()
    .at(-1) ?? ''
}

function stopReasonForVerdict(verdict) {
  return {
    'weak-demand': 'demand-collapsed',
    'weak-competition': 'competition-reduction-insufficient',
    'weak-sales': 'sales-collapsed',
    rejected: 'risk-or-structure-rejected',
  }[verdict] ?? ''
}

function metricsForRow(row = {}) {
  return {
    etsy: {
      searches30d: optionalNumber(row.etsySearches30d),
      listings: optionalNumber(row.etsyListings),
    },
    erank: {
      searches: optionalNumber(row.erankSearchVolume),
      clicks: optionalNumber(row.erankClicks),
      competition: optionalNumber(row.erankCompetition),
      kd: optionalNumber(row.erankKeywordDifficulty),
    },
    everbee: {
      competition: optionalNumber(row.listingsAnalyzed),
      sellingListings: optionalNumber(row.sellingListingCount),
      recentSellingListings: optionalNumber(row.recentSellingListingCount),
      medianMonthlySales: optionalNumber(row.medianMonthlySales),
    },
  }
}

function inferSpecificityAxis(keyword, parentKeyword) {
  const parentTokens = new Set(normalizePhrase(parentKeyword).split(' ').filter(Boolean))
  if (parentTokens.size === 0) return ''
  return normalizePhrase(keyword)
    .split(' ')
    .filter((token) => token && !parentTokens.has(token))
    .join(' ')
}

function mergeObjects(previous, incoming) {
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) return incoming
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return incoming ?? previous
  return Object.fromEntries(new Set([...Object.keys(previous), ...Object.keys(incoming)]).values().map((key) => {
    const nextValue = incoming[key]
    const previousValue = previous[key]
    if (nextValue && typeof nextValue === 'object' && !Array.isArray(nextValue)) {
      return [key, mergeObjects(previousValue, nextValue)]
    }
    return [key, nextValue === null || nextValue === undefined || nextValue === '' ? previousValue : nextValue]
  }))
}

export function mergeNicheDrilldownNodes(previousNodes = [], incomingNodes = []) {
  const byKeyword = new Map()
  for (const node of [...previousNodes, ...incomingNodes]) {
    const keyword = normalizePhrase(node?.keyword)
    if (!keyword) continue
    const previous = byKeyword.get(keyword)
    const merged = previous ? mergeObjects(previous, { ...node, keyword }) : { ...node, keyword }
    if (previous?.createdAt) merged.createdAt = previous.createdAt
    byKeyword.set(keyword, merged)
  }
  return [...byKeyword.values()].sort((left, right) => (
    (Number(left.depth) || 0) - (Number(right.depth) || 0)
    || left.keyword.localeCompare(right.keyword, 'en')
  ))
}

export function buildNicheDrilldownGraph(options = {}) {
  const rows = Array.isArray(options.rows) ? options.rows : []
  const candidates = Array.isArray(options.candidates) ? options.candidates : []
  const rowByKeyword = new Map(rows.map((row) => [normalizePhrase(row?.keyword ?? row?.query), row]))
  const candidateByKeyword = new Map(candidates.map((candidate) => [normalizePhrase(candidate?.keyword), candidate]))
  const relevantKeywords = new Set()

  for (const candidate of candidates) {
    const keyword = normalizePhrase(candidate?.keyword)
    const parentKeyword = normalizePhrase(candidate?.parentKeyword ?? candidate?.crossNicheParent)
    const rootKeyword = normalizePhrase(candidate?.rootKeyword ?? candidate?.crossNicheRoot)
    if (keyword) relevantKeywords.add(keyword)
    if (parentKeyword && rowByKeyword.has(parentKeyword)) relevantKeywords.add(parentKeyword)
    if (rootKeyword && rowByKeyword.has(rootKeyword)) relevantKeywords.add(rootKeyword)
  }
  for (const row of rows) {
    const keyword = normalizePhrase(row?.keyword ?? row?.query)
    if (keyword && (row?.crossNicheParent || row?.crossNicheRoot || Number(row?.crossNicheDepth) > 0)) {
      relevantKeywords.add(keyword)
    }
  }

  const nodes = [...relevantKeywords].map((keyword) => {
    const row = rowByKeyword.get(keyword) ?? {}
    const candidate = candidateByKeyword.get(keyword) ?? {}
    const parentKeyword = normalizePhrase(
      candidate.parentKeyword
      ?? candidate.crossNicheParent
      ?? row.crossNicheParent
    )
    const rootKeyword = normalizePhrase(
      candidate.rootKeyword
      ?? candidate.crossNicheRoot
      ?? row.crossNicheRoot
      ?? parentKeyword
      ?? keyword
    ) || keyword
    const parentRow = rowByKeyword.get(parentKeyword)
    const comparison = candidate.comparison
      ?? candidate.crossNicheComparison
      ?? row.crossNicheComparison
      ?? (parentRow ? compareCrossNicheRows(parentRow, row) : null)
    const verdict = String(
      candidate.verdict
      ?? candidate.crossNicheVerdict
      ?? row.crossNicheVerdict
      ?? comparison?.verdict
      ?? (candidates.some((item) => normalizePhrase(item?.parentKeyword) === keyword) ? 'parent-market' : 'needs-research')
    )
    const depth = Math.max(0, Math.min(3, Number(
      candidate.depth
      ?? candidate.crossNicheDepth
      ?? row.crossNicheDepth
      ?? 0
    ) || 0))

    return {
      keyword,
      rootKeyword,
      parentKeyword,
      depth,
      specificityAxis: normalizePhrase(
        candidate.specificityAxis
        ?? candidate.crossNicheAxis
        ?? candidate.modifier
        ?? row.specificityAxis
        ?? row.crossNicheAxis
      ) || inferSpecificityAxis(keyword, parentKeyword),
      source: [...new Set(
        [].concat(candidate.sources ?? candidate.crossNicheSources ?? candidate.source ?? row.crossNicheSources ?? [])
          .flatMap((value) => String(value ?? '').split(','))
          .map((value) => value.trim())
          .filter(Boolean)
      )],
      categoryId: String(row.researchCategoryId ?? candidate.categoryId ?? options.categoryId ?? ''),
      eventId: String(row.researchEventId ?? candidate.eventId ?? options.eventId ?? ''),
      createdAt: String(candidate.createdAt ?? row.createdAt ?? options.createdAt ?? ''),
      checkedAt: newestTimestamp([
        row.erankCheckedAt,
        row.etsyCheckedAt,
        row.everbeeCheckedAt,
        row.checkedAt,
      ]),
      metrics: metricsForRow(row),
      comparison,
      verdict,
      stopReason: String(
        candidate.stopReason
        ?? candidate.crossNicheStopReason
        ?? row.crossNicheStopReason
        ?? stopReasonForVerdict(verdict)
      ),
    }
  })

  return mergeNicheDrilldownNodes(options.previousNodes, nodes)
}
