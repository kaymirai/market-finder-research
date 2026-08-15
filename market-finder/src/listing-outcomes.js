function textValue(value) {
  return String(value ?? '').trim()
}

function numberValue(value, { minimum } = {}) {
  const number = Number(value)
  const finite = Number.isFinite(number) ? number : 0
  return minimum === undefined ? finite : Math.max(minimum, finite)
}

function requiredMetricValue(value, field) {
  if (!hasValue(value)) throw new Error(`${field} must be a finite non-negative number`)
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${field} must be a finite non-negative number`)
  }
  return number
}

function legacyMetricValue(value) {
  if (!hasValue(value)) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function isValidCalendarDate(yearText, monthText, dayText) {
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const monthDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month >= 1 && month <= 12 && day >= 1 && day <= monthDays[month - 1]
}

function canonicalSnapshotAt(value) {
  const input = textValue(value)
  const dateOnly = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const isoTimestamp = input.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/)
  const matched = dateOnly ?? isoTimestamp
  if (!matched || !isValidCalendarDate(matched[1], matched[2], matched[3])) {
    throw new Error('snapshotAt must be YYYY-MM-DD or a valid ISO 8601 timestamp')
  }

  const date = new Date(dateOnly ? `${input}T00:00:00.000Z` : input)
  if (Number.isNaN(date.getTime())) {
    throw new Error('snapshotAt must be YYYY-MM-DD or a valid ISO 8601 timestamp')
  }
  return date.toISOString()
}

export function normalizeListingOutcome(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new TypeError('Listing outcome must be an object')
  }

  const normalized = {
    ...row,
    listingId: textValue(row.listingId ?? row.listing_id),
    snapshotAt: canonicalSnapshotAt(row.snapshotAt ?? row.snapshot_at ?? row.researchedAt),
    clusterId: textValue(row.clusterId ?? row.clusterKey),
    visits: requiredMetricValue(row.visits ?? row.visits30d, 'visits'),
    orders: requiredMetricValue(row.orders ?? row.orders30d, 'orders'),
    revenue: numberValue(row.revenue ?? row.revenue30d, { minimum: 0 }),
    netProfit: numberValue(row.netProfit ?? row.netProfit30d ?? row.profit ?? row.profit30d),
  }

  for (const field of ['impressions', 'clicks', 'favorites']) {
    const source = row[field] ?? row[`${field}30d`]
    if (hasValue(source)) normalized[field] = numberValue(source, { minimum: 0 })
  }
  if (hasValue(row.trafficSource)) normalized.trafficSource = textValue(row.trafficSource)

  return normalized
}

export function normalizeLegacyListingOutcome(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new TypeError('Listing outcome must be an object')
  }
  const visits = legacyMetricValue(row.visits ?? row.visits30d)
  const orders = legacyMetricValue(row.orders ?? row.orders30d)
  return {
    ...row,
    listingId: textValue(row.listingId ?? row.listing_id),
    snapshotAt: canonicalSnapshotAt(row.snapshotAt ?? row.snapshot_at ?? row.researchedAt),
    clusterId: textValue(row.clusterId ?? row.clusterKey),
    visits,
    orders,
    revenue: numberValue(row.revenue ?? row.revenue30d, { minimum: 0 }),
    netProfit: numberValue(row.netProfit ?? row.netProfit30d ?? row.profit ?? row.profit30d),
    legacyMetricsIncomplete: visits === null || orders === null,
  }
}

function requireSnapshotKey(row, normalizer = normalizeListingOutcome) {
  const normalized = normalizer(row)
  if (!normalized.listingId) throw new Error('listingId is required')
  if (!normalized.snapshotAt) throw new Error('snapshotAt is required')
  return normalized
}

export function mergeListingOutcomeSnapshots(existing, incoming, options = {}) {
  if (!Array.isArray(existing) || !Array.isArray(incoming)) {
    throw new TypeError('Listing outcomes must be arrays')
  }

  const merged = []
  const positions = new Map()
  const sources = [
    ...existing.map((source) => ({
      source,
      normalizer: options.allowLegacyExisting ? normalizeLegacyListingOutcome : normalizeListingOutcome,
    })),
    ...incoming.map((source) => ({
      source,
      normalizer: options.allowLegacyIncoming ? normalizeLegacyListingOutcome : normalizeListingOutcome,
    })),
  ]
  for (const { source, normalizer } of sources) {
    const row = requireSnapshotKey(source, normalizer)
    const key = `${row.listingId}\u0000${row.snapshotAt}`
    const position = positions.get(key)
    if (position === undefined) {
      positions.set(key, merged.length)
      merged.push(row)
    } else {
      merged[position] = row
    }
  }
  return merged
}

const LISTING_OUTCOME_CSV_HEADER_ALIASES = new Map([
  ['listingId', 'listingId'],
  ['listing_id', 'listingId'],
  ['snapshotAt', 'snapshotAt'],
  ['snapshot_at', 'snapshotAt'],
  ['researchedAt', 'snapshotAt'],
  ['clusterId', 'clusterId'],
  ['clusterKey', 'clusterId'],
  ['visits', 'visits'],
  ['visits30d', 'visits'],
  ['orders', 'orders'],
  ['orders30d', 'orders'],
  ['revenue', 'revenue'],
  ['revenue30d', 'revenue'],
  ['netProfit', 'netProfit'],
  ['netProfit30d', 'netProfit'],
  ['profit', 'netProfit'],
  ['profit30d', 'netProfit'],
  ['impressions', 'impressions'],
  ['impressions30d', 'impressions'],
  ['clicks', 'clicks'],
  ['clicks30d', 'clicks'],
  ['favorites', 'favorites'],
  ['favorites30d', 'favorites'],
  ['trafficSource', 'trafficSource'],
])

export function resolveListingOutcomeCsvHeader(header) {
  const source = textValue(header)
  return LISTING_OUTCOME_CSV_HEADER_ALIASES.get(source) ?? source
}

function parseCsvRecords(text) {
  const records = []
  let record = []
  let field = ''
  let quoted = false
  const input = String(text ?? '').replace(/^\uFEFF/, '')

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\n') {
      record.push(field.replace(/\r$/, ''))
      records.push(record)
      record = []
      field = ''
    } else {
      field += char
    }
  }

  if (quoted) throw new Error('Unclosed quoted CSV field')
  if (field || record.length) {
    record.push(field.replace(/\r$/, ''))
    records.push(record)
  }
  return records
}

export function parseListingOutcomeCsvRecords(text) {
  const [headerRecord, ...records] = parseCsvRecords(text)
  return {
    headers: (headerRecord ?? []).map(resolveListingOutcomeCsvHeader),
    records,
  }
}

export function parseListingOutcomesCsv(text) {
  const { headers, records } = parseListingOutcomeCsvRecords(text)
  if (headers.length === 0) return []
  if (!headers.some(Boolean)) return []

  return records
    .filter((record) => record.some((value) => textValue(value)))
    .map((record) => normalizeListingOutcome(
      Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])),
    ))
}

function latestListingSnapshots(rows) {
  const latest = new Map()
  rows.forEach((source, index) => {
    const row = normalizeListingOutcome(source)
    if (!row.listingId) throw new Error('listingId is required')
    const current = latest.get(row.listingId)
    if (!current || row.snapshotAt > current.row.snapshotAt || (row.snapshotAt === current.row.snapshotAt && index > current.index)) {
      latest.set(row.listingId, { row, index })
    }
  })
  return [...latest.values()].map(({ row }) => row)
}

function m3Learning(winnerCount) {
  if (winnerCount <= 1) {
    return { winnerCount, band: '0-1', action: 'diagnose-before-scaling' }
  }
  if (winnerCount <= 4) {
    return { winnerCount, band: '2-4', action: 'continue-to-m6' }
  }
  return { winnerCount, band: '5+', action: 'continue-plan' }
}

function m6Learning(listings, winnerCount) {
  const listingCount = listings.length
  const totalOrders = listings.reduce((sum, row) => sum + row.orders, 0)
  const totalVisits = listings.reduce((sum, row) => sum + row.visits, 0)
  const totalNetProfit = listings.reduce((sum, row) => sum + row.netProfit, 0)
  const winnerRate = listingCount ? winnerCount / listingCount : 0

  return {
    winnerRate,
    averageNetProfitPerOrder: totalOrders ? totalNetProfit / totalOrders : 0,
    conversionRate: totalVisits ? totalOrders / totalVisits : 0,
    action: winnerRate >= 0.08
      ? 'maintain-25-30'
      : winnerRate >= 0.04
        ? 'maintain-30-40'
        : 'consider-scale-or-margin',
  }
}

export function summarizeListingLearning(rows, { month } = {}) {
  if (!Array.isArray(rows)) throw new TypeError('Listing outcomes must be an array')
  const snapshots = latestListingSnapshots(rows)
  const clusterTotals = new Map()

  for (const row of snapshots) {
    if (!row.clusterId) continue
    const totals = clusterTotals.get(row.clusterId) ?? { visits: 0, orders: 0 }
    totals.visits += row.visits
    totals.orders += row.orders
    clusterTotals.set(row.clusterId, totals)
  }

  const listings = snapshots.map((row) => {
    const cluster = row.clusterId ? clusterTotals.get(row.clusterId) : null
    let status = 'continue'
    if (cluster && cluster.visits >= 300 && cluster.orders === 0) {
      status = 'cluster-stop'
    } else if (row.visits >= 100 && row.orders >= 3) {
      status = 'early-go'
    } else if (row.visits >= 150 && row.orders === 0) {
      status = 'stop'
    } else if (row.orders === 0) {
      status = 'watch'
    }
    return { ...row, status }
  })

  const winnerCount = listings.filter((row) => row.visits >= 100 && row.orders >= 3).length
  const summary = {
    month: numberValue(month, { minimum: 0 }),
    listings,
    m3: m3Learning(winnerCount),
  }
  if (summary.month >= 6) summary.m6 = m6Learning(listings, winnerCount)
  return summary
}

export function recommendNextExplorationMode(summary) {
  const winnerRate = Number(summary?.m6?.winnerRate)
  if (Number.isFinite(winnerRate)) {
    if (winnerRate >= 0.04) return 'winner-deepening'
    if (winnerRate > 0) return 'hybrid'
    return 'distribution'
  }

  const winnerCount = numberValue(summary?.m3?.winnerCount, { minimum: 0 })
  return winnerCount >= 2 ? 'hybrid' : 'distribution'
}
