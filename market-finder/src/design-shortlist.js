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

export const DESIGN_CLUSTER_COUNT = 5
export const DESIGN_PER_CLUSTER_MIN = 5
export const DESIGN_PER_CLUSTER_MAX = 8

function groupByCluster(rows) {
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

  // A cluster is ranked by its best row, then by how many keywords stand behind it: on a
  // tie the deeper theme is the one that can actually become a series.
  return [...byCluster.entries()]
    .map(([key, clusterRows]) => ({ key, rows: clusterRows }))
    .sort((left, right) => (
      opportunityScore(right.rows[0]) - opportunityScore(left.rows[0])
      || right.rows.length - left.rows.length
      || normalizeKeyword(left.rows[0].keyword).localeCompare(normalizeKeyword(right.rows[0].keyword), 'en')
    ))
}

// One listing serves one buyer intent, and a theme only becomes a series when it has
// several keywords behind it, so the handoff is a few deep clusters rather than a flat
// list of unrelated keywords.
export function selectDesignClusters(rows = [], options = {}) {
  const allClusters = groupByCluster(rows)
  const requestedClusterCount = Number(options.clusterCount)
  const clusterCount = Number.isFinite(requestedClusterCount) && requestedClusterCount > 0
    ? Math.max(1, Math.floor(requestedClusterCount))
    : Math.max(DESIGN_CLUSTER_COUNT, allClusters.length)
  const requestedPerCluster = Number(options.perCluster)
  const perCluster = Number.isFinite(requestedPerCluster) && requestedPerCluster > 0
    ? Math.max(1, Math.floor(requestedPerCluster))
    : Math.max(DESIGN_PER_CLUSTER_MAX, ...allClusters.map((cluster) => cluster.rows.length), 0)
  const minPerCluster = Math.max(1, Math.floor(Number(options.minPerCluster) || DESIGN_PER_CLUSTER_MIN))
  const offset = (() => {
    const raw = Math.max(0, Math.floor(Number(options.offset) || 0))
    return raw >= allClusters.length ? 0 : raw
  })()

  const selected = allClusters.slice(offset, offset + clusterCount).map((cluster) => ({
    key: cluster.key,
    label: cluster.rows[0]?.score?.normalized?.keyword ?? cluster.rows[0]?.keyword ?? cluster.key,
    items: cluster.rows.slice(0, perCluster),
    available: cluster.rows.length,
    // Below the minimum a theme cannot carry a series, so it is flagged rather than hidden.
    thin: cluster.rows.length < minPerCluster,
  }))

  return {
    clusters: selected,
    items: selected.flatMap((cluster) => cluster.items),
    totalClusters: allClusters.length,
    totalItems: allClusters.reduce((sum, cluster) => sum + cluster.rows.length, 0),
    offset,
    clusterCount,
    perCluster,
    minPerCluster,
    hasMore: offset + selected.length < allClusters.length,
    thinClusters: selected.filter((cluster) => cluster.thin).length,
    page: Math.floor(offset / clusterCount) + 1,
    pageCount: Math.max(1, Math.ceil(allClusters.length / clusterCount)),
  }
}
