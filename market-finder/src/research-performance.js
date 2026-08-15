export function createMemoizedAnalysis(analyze) {
  let previousRows = null
  let previousOptionsKey = ''
  let previousResult = null

  return (rows, options) => {
    const optionsKey = JSON.stringify(options)
    if (rows === previousRows && optionsKey === previousOptionsKey) return previousResult

    previousRows = rows
    previousOptionsKey = optionsKey
    previousResult = analyze(rows, options)
    return previousResult
  }
}

export function createReferenceMemoizedComputation(compute) {
  let previousReferences = []
  let previousSignature = ''
  let previousResult
  let hasResult = false

  return (references = [], signature = '') => {
    const currentReferences = Array.isArray(references) ? references : []
    const unchanged = hasResult
      && signature === previousSignature
      && currentReferences.length === previousReferences.length
      && currentReferences.every((reference, index) => Object.is(reference, previousReferences[index]))
    if (unchanged) return previousResult

    previousReferences = [...currentReferences]
    previousSignature = signature
    previousResult = compute()
    hasResult = true
    return previousResult
  }
}

// A restored preview does not change the saved research data. Rewriting a large
// evidence payload during that first paint blocks the browser for no user benefit.
export function shouldPersistWorkspaceRender({ restoredPreview = false } = {}) {
  return !restoredPreview
}

export function mergeRowsByKey(existingRows, incomingRows, { keyOf, merge }) {
  const mergedRows = [...existingRows]
  const indexByKey = new Map()

  mergedRows.forEach((row, index) => {
    const key = keyOf(row)
    if (key) indexByKey.set(key, index)
  })

  incomingRows.forEach((incomingRow) => {
    const key = keyOf(incomingRow)
    if (!key) return

    const existingIndex = indexByKey.get(key)
    const existingRow = existingIndex === undefined ? null : mergedRows[existingIndex]
    const mergedRow = merge(existingRow, incomingRow, key)
    if (!mergedRow) return

    if (existingIndex === undefined) {
      indexByKey.set(key, mergedRows.length)
      mergedRows.push(mergedRow)
    } else {
      mergedRows[existingIndex] = mergedRow
    }
  })

  return mergedRows
}

export function buildMarketplaceCaptureRows({
  query = '',
  checkedAt = '',
  insight = {},
  relatedMetrics = [],
} = {}) {
  const searchTrend = Number(insight.etsySearchTrendPercent)
  const trendNote = Number.isFinite(searchTrend)
    ? ` / 検索変化 ${searchTrend > 0 ? '+' : ''}${searchTrend}%`
    : ''
  const mainRow = {
    keyword: insight.keyword || insight.query || query,
    etsySearches30d: insight.etsySearches30d,
    etsyListings: insight.etsyListings,
    etsyMetricCaptureVersion: 2,
    etsyRelatedTerms: (Array.isArray(insight.etsyRelatedTerms) ? insight.etsyRelatedTerms : []).join(', '),
    etsyCheckedAt: checkedAt,
    notes: `Etsy Marketplace Insights / 直近30日${trendNote}`,
  }
  const relatedRows = (Array.isArray(relatedMetrics) ? relatedMetrics : []).map((metric) => {
    const conversionNote = metric.conversionLabel ? ` / Conversion: ${metric.conversionLabel}` : ''
    const modeNote = metric.sourceModes?.length ? ` / Views: ${metric.sourceModes.join('+')}` : ''
    return {
      keyword: metric.keyword,
      etsySearches30d: metric.etsySearches30d,
      etsyListings: metric.etsyListings,
      etsyMetricCaptureVersion: 2,
      etsyConversionLabel: metric.conversionLabel,
      etsyCheckedAt: checkedAt,
      notes: `Etsy Marketplace Insights related to ${query}${conversionNote}${modeNote}`,
    }
  })
  return [mainRow, ...relatedRows]
}

export function visibleMarketplaceQueue(items = [], currentId = '', limit = 40) {
  const rows = Array.isArray(items) ? items : []
  const size = Math.max(1, Math.floor(Number(limit) || 40))
  if (rows.length <= size) {
    return { items: rows, hiddenBefore: 0, hiddenAfter: 0 }
  }
  const currentIndex = rows.findIndex((item) => String(item?.id ?? '') === String(currentId ?? ''))
  const anchor = currentIndex >= 0 ? currentIndex : 0
  const beforeCurrent = Math.min(10, Math.floor(size / 3))
  const start = Math.max(0, Math.min(anchor - beforeCurrent, rows.length - size))
  return {
    items: rows.slice(start, start + size),
    hiddenBefore: start,
    hiddenAfter: rows.length - start - size,
  }
}

export function acceptRestoredCheckpoint({
  hasSavedAutomationWork = false,
  savedAccepted = false,
} = {}) {
  return Boolean(hasSavedAutomationWork || savedAccepted)
}

export function deferLatestWork({
  currentTimer = null,
  clearTimer,
  setTimer,
  delayMs = 0,
  work,
} = {}) {
  if (currentTimer !== null && currentTimer !== undefined) clearTimer?.(currentTimer)
  if (typeof setTimer !== 'function' || typeof work !== 'function') return null
  return setTimer(work, Math.max(0, Number(delayMs) || 0))
}
