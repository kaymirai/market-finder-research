const PENDING_STAGE_LABELS = Object.freeze({
  'pending-erank': 'eRankを確認',
  'pending-etsy': 'Etsy公式を確認',
  'pending-everbee': 'EverBeeを確認',
})

function normalizedStage(value) {
  const stage = String(value ?? '').trim()
  return Object.hasOwn(PENDING_STAGE_LABELS, stage) ? stage : ''
}

function finiteNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function isEtsyEvidenceChecked(row = {}, planItem = {}) {
  const rowHasMetric = [row.etsySearches30d, row.etsyListings]
    .some((value) => finiteNumber(value) !== null)
  const planHasMetric = [planItem?.result?.etsySearches30d, planItem?.result?.etsyListings]
    .some((value) => finiteNumber(value) !== null)
  return Boolean(row.etsyCheckedAt && rowHasMetric)
    || Boolean(planItem?.status === 'completed' && planHasMetric)
}

export function sanitizeLegacyMarketplaceInsightRow(row = {}) {
  const searches = finiteNumber(row.etsySearches30d)
  const listings = finiteNumber(row.etsyListings)
  const captureVersion = finiteNumber(row.etsyMetricCaptureVersion)
  if (
    captureVersion >= 2
    || searches !== 30
    || (listings !== null && listings !== 30)
  ) return { ...row }

  return {
    ...row,
    etsySearches30d: null,
    etsyListings: null,
    etsyCheckedAt: '',
  }
}

function etsyConfirmationPriority(row = {}) {
  const selling = finiteNumber(row.sellingListingCount) ?? 0
  const recent = finiteNumber(row.recentSellingListingCount) ?? 0
  const listings = Math.max(1, finiteNumber(row.listingsAnalyzed) ?? Number.MAX_SAFE_INTEGER)
  const median = finiteNumber(row.medianMonthlySales) ?? 0
  return (selling / listings) * 1_000 + recent * 0.1 + median * 0.01
}

export function selectEtsyConfirmationKeywords(rows = [], limit = 8) {
  const seen = new Set()
  const max = Math.max(1, Math.min(8, Math.floor(Number(limit) || 8)))
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      const keyword = String(row.keyword ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
      const selling = finiteNumber(row.sellingListingCount) ?? 0
      const recent = finiteNumber(row.recentSellingListingCount) ?? 0
      const listings = finiteNumber(row.listingsAnalyzed)
      const topShare = finiteNumber(row.topSalesShare)
      if (!keyword || seen.has(keyword)) return false
      if (selling < 2 || recent < 1) return false
      if (listings === null || listings <= 0 || listings >= 50_000) return false
      if (topShare !== null && topShare >= 0.8) return false
      seen.add(keyword)
      return true
    })
    .sort((left, right) => (
      etsyConfirmationPriority(right) - etsyConfirmationPriority(left)
      || (finiteNumber(right.sellingListingCount) ?? 0) - (finiteNumber(left.sellingListingCount) ?? 0)
      || String(left.keyword).localeCompare(String(right.keyword), 'en')
    ))
    .slice(0, max)
    .map((row) => String(row.keyword).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '))
}

export function verificationStageForRow(input = {}) {
  if (input.hasEtsyData && !input.hasEverbeeData) return 'pending-everbee'

  if (String(input.queryStrategy ?? '').trim() === 'cross-niche') {
    if (!input.hasEverbeeData) return 'pending-everbee'
    if (!input.hasEtsyData && !input.etsyChecked && input.selectedForEtsyConfirmation) {
      return 'pending-etsy'
    }
    return 'done'
  }

  if (!input.hasEverbeeData && !input.etsyChecked && input.eligibleForEtsy) return 'pending-etsy'
  return 'done'
}

function normalizedKeywordList(values = []) {
  const seen = new Set()
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '))
    .filter((keyword) => {
      if (!keyword || seen.has(keyword)) return false
      seen.add(keyword)
      return true
    })
}

export function hasCollectedEvidence(row = {}) {
  const captureStatus = String(row.erankCaptureStatus ?? '').trim().toLowerCase()
  const hasCaptureStatus = Boolean(captureStatus) && captureStatus !== 'unsearched'
  const hasProductRows = Array.isArray(row.productRows) && row.productRows.length > 0
  return [
    row.erankSearchVolume,
    row.erankClicks,
    row.erankCtr,
    row.erankCompetition,
    row.erankKeywordDifficulty,
    row.erankTrend,
    row.etsySearches30d,
    row.etsyListings,
    Array.isArray(row.etsyRelatedTerms) && row.etsyRelatedTerms.length > 0 ? 'related' : '',
    row.listingsAnalyzed,
    row.topMonthlySales,
    row.topRevenue,
    row.averagePrice,
    row.listingAge,
    row.visibleListingCount,
    row.sellingListingCount,
    row.recentSellingListingCount,
    row.medianMonthlySales,
    row.medianMonthlyRevenue,
    row.totalVisibleMonthlySales,
    row.topSalesShare,
    row.erankCheckedAt,
    row.etsyCheckedAt,
    row.everbeeCheckedAt,
    row.error,
    hasCaptureStatus ? captureStatus : '',
    hasProductRows ? 'productRows' : '',
  ].some((value) => String(value ?? '').trim() !== '')
}

export function selectedResearchRoundKeywords(rounds = [], options = {}) {
  const initialLimit = Math.max(1, Math.floor(Number(options.initialLimit) || 20))
  const crossNicheLimit = Math.max(1, Math.floor(Number(options.crossNicheLimit) || 12))
  const selected = []

  ;(Array.isArray(rounds) ? rounds : []).forEach((round) => {
    const keywords = Array.isArray(round?.candidateKeywords) ? round.candidateKeywords : []
    const limit = round?.type === 'initial' ? initialLimit : crossNicheLimit
    selected.push(...keywords.slice(-limit))
  })

  return normalizedKeywordList(selected)
}

export function buildFinalEvidenceKeywordPool({
  evidenceKeywords = [],
  selectedKeywords = [],
  fallbackKeywords = [],
  hasSelection = false,
  fallbackLimit = 20,
} = {}) {
  const selected = normalizedKeywordList(selectedKeywords)
  const fallback = hasSelection
    ? []
    : normalizedKeywordList(fallbackKeywords).slice(0, Math.max(1, Math.floor(Number(fallbackLimit) || 20)))
  return normalizedKeywordList([...evidenceKeywords, ...selected, ...fallback])
}

export function deriveFinalEvidenceState(input = {}) {
  if (input.excluded) {
    return {
      status: 'excluded',
      label: '除外',
      nextStage: '',
      actionLabel: '',
      terminal: true,
    }
  }

  const erankStatus = String(input.erankStatus ?? '').trim().toLowerCase()
  const failureStage = normalizedStage(input.failureStage)
  if (input.hasEverbeeData && (
    ['no-data', 'unknown'].includes(erankStatus)
    || (input.failed && failureStage === 'pending-erank')
  )) {
    return {
      status: 'verified',
      label: '検証済み',
      nextStage: '',
      actionLabel: '',
      terminal: true,
    }
  }
  if (erankStatus === 'failed' || input.failed) {
    const nextStage = failureStage || 'pending-erank'
    return {
      status: 'failed',
      label: '取得失敗',
      nextStage,
      actionLabel: '再試行',
      terminal: true,
    }
  }

  const nextStage = normalizedStage(input.nextStage)
  if (nextStage) {
    return {
      status: 'pending',
      label: '検証待ち',
      nextStage,
      actionLabel: PENDING_STAGE_LABELS[nextStage],
      terminal: false,
    }
  }

  if (['no-data', 'unknown'].includes(erankStatus)) {
    return {
      status: 'hold',
      label: '需要Unknown・保留',
      nextStage: '',
      actionLabel: '',
      terminal: true,
    }
  }

  if (input.hasEverbeeData || input.verified) {
    return {
      status: 'verified',
      label: '検証済み',
      nextStage: '',
      actionLabel: '',
      terminal: true,
    }
  }

  return {
    status: 'hold',
    label: '要判断・保留',
    nextStage: '',
    actionLabel: '',
    terminal: true,
  }
}

export function deriveFinalScoreState(input = {}) {
  const candidateStage = String(input.candidateStage ?? '').trim()
  const score = finiteNumber(input.score)
  const explorationPriority = finiteNumber(input.explorationPriority)

  if (candidateStage === 'idea' || score === null) {
    return {
      type: 'pending',
      label: '採点前',
      score: null,
      explorationPriority,
    }
  }

  if (candidateStage === 'demand-checked') {
    return {
      type: 'reference',
      label: `参考点 ${Math.round(score)}`,
      score,
      explorationPriority: null,
    }
  }

  return {
    type: 'overall',
    label: String(Math.round(score)),
    score,
    explorationPriority: null,
  }
}

export function formatEvidenceMetric(value, options = {}) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== ''
  if (hasValue) {
    return {
      kind: 'value',
      text: `${String(value).trim()}${String(options.suffix ?? '')}`,
    }
  }
  if (options.checked) return { kind: 'unknown', text: 'Unknown' }
  return { kind: 'pending', text: '未取得' }
}

export function isAutomatableEvidenceRow(row = {}) {
  const candidateAction = String(row.normalized?.candidateClass?.action ?? '').trim().toLowerCase()
  if (candidateAction && !['candidate', 'explore'].includes(candidateAction)) return false
  if (candidateAction === 'explore') {
    const normalized = row.normalized ?? {}
    const hasMeasuredDemand = [
      normalized.erankSearchVolume,
      normalized.erankClicks,
      normalized.erankCtr,
      normalized.etsySearches30d,
      normalized.etsyListings,
    ].some((value) => finiteNumber(value) !== null)
    if (!hasMeasuredDemand) return false
  }
  if (String(row.candidateStage ?? '').trim().toLowerCase() === 'reject') return false
  if (String(row.opportunityLabel ?? '').trim().toUpperCase() === 'D') return false
  return true
}

export function shouldExcludeFinalEvidenceRow(input = {}) {
  if (String(input.candidateStage ?? '').trim().toLowerCase() === 'reject') return true
  if (
    input.hasEverbeeData
    && String(input.opportunityLabel ?? '').trim().toUpperCase() === 'D'
  ) return true
  return Boolean(
    input.erankAttempted
    && !input.erankDemandUnknown
    && !input.failed
    && !input.hasEverbeeData
    && !input.hasEtsyData
    && !input.eligibleForEtsy
  )
}

export function pendingEvidenceBatch(rows = [], stage, limit = 50) {
  const targetStage = normalizedStage(stage)
  if (!targetStage) return []

  const seen = new Set()
  const maxBatch = Math.max(1, Math.min(50, Math.floor(Number(limit) || 50)))
  return rows.filter((row) => {
    if (!isAutomatableEvidenceRow(row)) return false
    if (row?.evidenceState?.status !== 'pending') return false
    if (row.evidenceState.nextStage !== targetStage) return false
    const keyword = String(row.keyword ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
    if (!keyword || seen.has(keyword)) return false
    seen.add(keyword)
    return true
  }).slice(0, maxBatch)
}

export function finalEvidenceFilterMatches(row = {}, filter = 'all') {
  const selected = String(filter ?? 'all').trim().toLowerCase()
  if (selected === 'all') return true
  if (selected === 'recommended') {
    return row.evidenceState?.status === 'verified'
      && ['A', 'B'].includes(String(row.opportunityLabel ?? '').trim())
      && row?.queryEligibility?.eligible !== false
  }
  return row.evidenceState?.status === selected
}

export function limitFinalEvidenceRows(rows = [], limit = 40) {
  const source = Array.isArray(rows) ? rows : []
  const resolvedLimit = Math.max(1, Math.floor(Number(limit) || 40))
  const visibleRows = source.slice(0, resolvedLimit)
  return {
    rows: visibleRows,
    total: source.length,
    shown: visibleRows.length,
    hasMore: visibleRows.length < source.length,
  }
}

export function toggleFinalEvidenceSelection(selectedKey = '', clickedKey = '') {
  const current = String(selectedKey ?? '').trim()
  const clicked = String(clickedKey ?? '').trim()
  if (!clicked) return current
  return current === clicked ? '' : clicked
}

export function deriveFinalKeywordDecision(rows = []) {
  const sourceRows = Array.isArray(rows) ? rows : []
  const rank = { A: 0, B: 1 }
  const recommended = sourceRows
    .filter((row) => (
      row?.evidenceState?.status === 'verified'
      && Object.hasOwn(rank, String(row.opportunityLabel ?? '').trim())
      && row?.queryEligibility?.eligible !== false
      && String(row.keyword ?? '').trim()
    ))
    .sort((left, right) => (
      rank[String(left.opportunityLabel).trim()] - rank[String(right.opportunityLabel).trim()]
      || (finiteNumber(right.scoreState?.score) ?? -1) - (finiteNumber(left.scoreState?.score) ?? -1)
      || String(left.keyword).localeCompare(String(right.keyword), 'en')
    ))

  const gradeCounts = sourceRows.reduce((counts, row) => {
    const label = String(row?.opportunityLabel ?? '').trim()
    if (Object.hasOwn(counts, label)) counts[label] += 1
    return counts
  }, { A: 0, B: 0, C: 0, D: 0 })

  const recommendedKeywords = recommended.map((row) => ({
    key: String(row.key ?? '').trim(),
    keyword: String(row.keyword).trim(),
    label: String(row.opportunityLabel).trim(),
    score: finiteNumber(row.scoreState?.score),
  }))
  const pendingRows = sourceRows.filter((row) => (
    String(row?.evidenceState?.status ?? '').trim() === 'pending'
  ))
  const pendingCount = pendingRows.length
  const actionablePendingCount = pendingRows.filter((row) => isAutomatableEvidenceRow(row)).length
  const failedCount = sourceRows.filter((row) => (
    String(row?.evidenceState?.status ?? '').trim() === 'failed'
  )).length

  if (recommended.length > 0) {
    const primary = recommended[0]
    return {
      status: 'ready',
      primaryKeyword: String(primary.keyword).trim(),
      primaryLabel: String(primary.opportunityLabel).trim(),
      primaryScore: finiteNumber(primary.scoreState?.score),
      alternatives: recommended.slice(1, 3).map((row) => String(row.keyword).trim()),
      recommendedCount: recommendedKeywords.length,
      recommendedKeywords,
      gradeCounts,
      pendingCount,
      actionablePendingCount,
      failedCount,
    }
  }

  return {
    status: pendingCount > 0 ? 'pending' : failedCount > 0 ? 'retry' : 'none',
    primaryKeyword: '',
    primaryLabel: '',
    primaryScore: null,
    alternatives: [],
    recommendedCount: 0,
    recommendedKeywords: [],
    gradeCounts,
    pendingCount,
    actionablePendingCount,
    failedCount,
  }
}
