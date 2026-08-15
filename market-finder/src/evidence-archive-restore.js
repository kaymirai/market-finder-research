function archiveContextKey(fileName = '') {
  const name = String(fileName ?? '').trim()
  const match = name.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-(.+)\.json$/)
  return match?.[1] ? `context:${match[1]}` : `file:${name}`
}

// Version-three archives are cumulative snapshots. Keeping the newest snapshot for
// each context preserves the latest learning without analysing the same listings again.
export function selectLatestArchiveFiles(files = [], { limit = 12 } = {}) {
  const maximum = Math.max(1, Math.floor(Number(limit) || 12))
  const ordered = (Array.isArray(files) ? files : [])
    .map((fileName) => String(fileName ?? '').trim())
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right, 'en'))
  const latestByContext = new Map()

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const fileName = ordered[index]
    const key = archiveContextKey(fileName)
    if (latestByContext.has(key)) continue
    latestByContext.set(key, fileName)
    if (latestByContext.size >= maximum) break
  }

  return [...latestByContext.values()].reverse()
}
