export const DESIGN_SHORTLIST_SIZE = 20

function normalizeKeyword(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function opportunityLabel(row) {
  return String(row?.score?.opportunityLabel ?? '').trim().slice(0, 1).toUpperCase()
}

function opportunityScore(row) {
  const value = Number(row?.score?.score)
  return Number.isFinite(value) ? value : 0
}

function clusterKey(row) {
  const key = normalizeKeyword(row?.historyClusterKey)
  return key || normalizeKeyword(row?.score?.normalized?.keyword ?? row?.keyword)
}

export function isDesignShortlistEligible(row) {
  if (!['A', 'B'].includes(opportunityLabel(row))) return false
  if (String(row?.productRoute?.decision ?? '').trim().toLowerCase() === 'do not use') return false
  return (row?.score?.riskTerms?.length ?? 0) === 0
}

// Designs come from distinct themes, not from twenty rewordings of one theme, so rows are
// interleaved across history clusters. Nothing is dropped: later pages continue the order.
export function buildDesignShortlistOrder(rows = []) {
  const eligible = (Array.isArray(rows) ? rows : [])
    .filter(isDesignShortlistEligible)
    .slice()
    .sort((left, right) => (
      opportunityScore(right) - opportunityScore(left)
      || normalizeKeyword(left.keyword).localeCompare(normalizeKeyword(right.keyword), 'en')
    ))

  const byCluster = new Map()
  for (const row of eligible) {
    const key = clusterKey(row)
    if (!byCluster.has(key)) byCluster.set(key, [])
    byCluster.get(key).push(row)
  }

  const clusters = [...byCluster.values()]
    .sort((left, right) => (
      opportunityScore(right[0]) - opportunityScore(left[0])
      || normalizeKeyword(left[0].keyword).localeCompare(normalizeKeyword(right[0].keyword), 'en')
    ))

  const deepest = clusters.reduce((max, cluster) => Math.max(max, cluster.length), 0)
  const ordered = []
  for (let depth = 0; depth < deepest; depth += 1) {
    for (const cluster of clusters) {
      if (cluster[depth]) ordered.push(cluster[depth])
    }
  }

  return ordered
}

export function selectDesignShortlist(rows = [], options = {}) {
  const size = Math.max(1, Math.floor(Number(options.size) || DESIGN_SHORTLIST_SIZE))
  const ordered = buildDesignShortlistOrder(rows)
  const maxOffset = Math.max(0, Math.floor(Number(options.offset) || 0))
  const offset = maxOffset >= ordered.length ? 0 : maxOffset
  const items = ordered.slice(offset, offset + size)

  return {
    items,
    total: ordered.length,
    offset,
    size,
    hasMore: offset + items.length < ordered.length,
    clusterCount: new Set(ordered.map(clusterKey)).size,
    page: Math.floor(offset / size) + 1,
    pageCount: Math.max(1, Math.ceil(ordered.length / size)),
  }
}
