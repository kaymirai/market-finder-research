function normalizedMode(mode) {
  return String(mode ?? '').trim().toLowerCase()
}

export function extensionStateMatchesResearchMode(extensionState = {}, mode = '') {
  if (!extensionState?.active) return false
  const actualMode = normalizedMode(extensionState.mode)
  const expectedMode = normalizedMode(mode)
  if (expectedMode === 'everbee') {
    return !actualMode.includes('etsy') && !actualMode.includes('erank')
  }
  return actualMode.includes(expectedMode)
}

export function shouldAdoptExtensionRun({ error, extensionState, mode } = {}) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /すでに実行中|already\s+(?:be\s+)?running/i.test(message)
    && extensionStateMatchesResearchMode(extensionState, mode)
}

export function shouldRecoverMultiAngleQueue({
  extensionState,
  explorationStatus,
  pendingActive,
  marketplaceActive,
} = {}) {
  return !extensionState?.active
    && explorationStatus === 'running'
    && !pendingActive
    && !marketplaceActive
}

export function shouldContinueExtensionPolling({
  extensionState,
  explorationStatus,
  pendingActive,
  marketplaceActive,
} = {}) {
  return Boolean(
    extensionState?.active
    || explorationStatus === 'running'
    || pendingActive
    || marketplaceActive
  )
}

function signaturePart(value) {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return String(value.length)
  return String(value).replace(/[\u001e\u001f]/g, ' ')
}

export function extensionResultsSignature(extensionState = {}) {
  const results = Array.isArray(extensionState?.results) ? extensionState.results : []
  return results.map((row) => [
    row?.keyword,
    row?.query,
    row?.checkedAt,
    row?.erankCheckedAt,
    row?.etsyCheckedAt,
    row?.everbeeCheckedAt,
    row?.status,
    row?.error,
    row?.erankSearchVolume,
    row?.erankClicks,
    row?.erankCtr,
    row?.erankCompetition,
    row?.etsySearches30d,
    row?.etsyListings,
    row?.visibleListingCount,
    row?.sellingListingCount,
    row?.recentSellingListingCount,
    row?.medianMonthlySales,
    row?.medianMonthlyRevenue,
    row?.totalVisibleMonthlySales,
    row?.topSalesShare,
    row?.medianListingAgeMonths,
    row?.productRows,
    row?.relatedKeywords,
  ].map(signaturePart).join('\u001f')).join('\u001e')
}
