import { normalizePhrase } from '../../shared/market-keyword-engine/index.js'

export const EXPLORATION_ANGLE_ORDER = Object.freeze([
  'demand-neighborhood',
  'attribute-combination',
  'recent-sales',
  'adjacent-product',
  'market-gap',
  'evergreen',
])

function normalizedList(value) {
  const values = Array.isArray(value) ? value : [value]
  return [...new Set(values.map(normalizePhrase).filter(Boolean))]
}

function normalizedSources(value) {
  const values = Array.isArray(value) ? value : [value]
  return [...new Set(values
    .map((source) => String(source ?? '').trim().toLowerCase())
    .filter(Boolean))]
}

function categoryMatchTerms(category = {}) {
  const terms = normalizedList([category.searchTerm, ...(category.tags ?? [])])
  if (String(category.id ?? '').trim() === 'shirt' || terms.includes('shirt')) {
    terms.push('shirts', 'tshirt', 'tshirts', 't shirt', 't shirts', 'tee', 'tees')
  }
  return [...new Set(terms)]
}

function matchesCategory(keyword, category) {
  const phrase = ` ${normalizePhrase(keyword)} `
  return categoryMatchTerms(category).some((term) => phrase.includes(` ${term} `))
}

function hasEverbeeTitleSource(candidate = {}) {
  if (candidate.source === 'everbee-title') return true
  return Array.isArray(candidate.sources) && candidate.sources.some(
    (source) => String(source ?? '').trim().toLowerCase() === 'everbee-title',
  )
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function candidateContext(candidate = {}) {
  return {
    eventId: String(
      candidate.eventId
      ?? candidate.researchEventId
      ?? candidate.raw?.researchEventId
      ?? '',
    ).trim(),
    categoryId: String(
      candidate.categoryId
      ?? candidate.researchCategoryId
      ?? candidate.raw?.researchCategoryId
      ?? '',
    ).trim(),
  }
}

function eventSnapshotIdentity(snapshot = {}) {
  return [
    String(snapshot?.id ?? '').trim(),
    normalizePhrase(snapshot?.searchTerm),
    String(snapshot?.label ?? '').trim(),
    String(snapshot?.displayTerm ?? '').trim(),
  ].join('|')
}

export function eventSnapshotsMatch(left, right) {
  const leftIdentity = eventSnapshotIdentity(left)
  return leftIdentity !== '|||'
    && leftIdentity === eventSnapshotIdentity(right)
}

export function marketplaceInsightPlanForContext(plan, context = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return null
  const planContext = candidateContext(plan)
  const activeEventId = String(context.eventId ?? context.activeEventId ?? '').trim()
  const activeCategoryId = String(context.categoryId ?? '').trim()
  if (
    !planContext.eventId
    || !planContext.categoryId
    || planContext.eventId !== activeEventId
    || planContext.categoryId !== activeCategoryId
  ) return null
  if (activeEventId !== 'custom-event') return plan
  return eventSnapshotsMatch(plan.eventSnapshot, context.eventSnapshot)
    ? plan
    : null
}

export function candidateMatchesResearchContext(candidate = {}, context = {}, {
  allowEventless = false,
  requireContext = false,
} = {}) {
  const candidateContextValue = candidateContext(candidate)
  const activeEventId = String(context.eventId ?? context.activeEventId ?? '').trim()
  const activeCategoryId = String(context.categoryId ?? '').trim()
  const hasContext = Boolean(
    candidateContextValue.eventId
    || candidateContextValue.categoryId
    || Object.hasOwn(candidate, 'eventId')
    || Object.hasOwn(candidate, 'categoryId')
    || Object.hasOwn(candidate, 'researchEventId')
    || Object.hasOwn(candidate, 'researchCategoryId')
    || Object.hasOwn(candidate.raw ?? {}, 'researchEventId')
    || Object.hasOwn(candidate.raw ?? {}, 'researchCategoryId')
  )
  if (!hasContext) return !requireContext
  if (candidateContextValue.categoryId !== activeCategoryId) return false
  return allowEventless
    ? !candidateContextValue.eventId
    : candidateContextValue.eventId === activeEventId
}

export function marketplaceRelatedTermCandidates(plan = {}, context = {}) {
  const compatiblePlan = marketplaceInsightPlanForContext(plan, context)
  if (!compatiblePlan) return []
  const activeEventId = String(context.eventId ?? context.activeEventId ?? '').trim()
  const activeCategoryId = String(context.categoryId ?? '').trim()
  const keywords = normalizedList([
    ...(compatiblePlan.relatedKeywordMetrics ?? []).map((row) => row?.keyword),
    ...(compatiblePlan.items ?? [])
      .filter((item) => item?.status === 'completed')
      .flatMap((item) => [
        ...(item?.result?.etsyRelatedTerms ?? []),
        ...(item?.result?.etsyRelatedKeywordMetrics ?? []).map((row) => row?.keyword),
      ]),
  ])
  return keywords.map((keyword) => ({
    keyword,
    eventId: activeEventId,
    categoryId: activeCategoryId,
    source: 'marketplace-insights',
  }))
}

export function normalizeArchivedSupplyListings(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      title: String(row?.title ?? '').trim(),
      monthlySales: optionalNumber(row?.monthlySales ?? row?.sales),
      listingAgeMonths: optionalNumber(row?.listingAgeMonths),
    }))
    .filter((row) => normalizePhrase(row.title))
}

export function adjacentProductListingsFromLearningRecords(records = [], context = {}) {
  const activeCategoryId = String(context.categoryId ?? '').trim()
  const activeEventId = String(context.eventId ?? context.activeEventId ?? '').trim()
  const activeEventSnapshot = context.eventSnapshot
  return (Array.isArray(records) ? records : []).flatMap((record) => {
    const categoryId = String(record?.categoryId ?? record?.context?.categoryId ?? '').trim()
    if (!categoryId || categoryId === activeCategoryId) return []
    const eventId = String(record?.eventId ?? record?.context?.eventId ?? '').trim()
    const eventSnapshot = record?.eventSnapshot ?? record?.context?.eventSnapshot
    if (
      activeEventId === 'custom-event'
      && eventId === 'custom-event'
      && !eventSnapshotsMatch(eventSnapshot, activeEventSnapshot)
    ) return []
    return normalizeArchivedSupplyListings(record?.supplyListings).map((listing) => ({
      ...listing,
      categoryId,
      eventId,
      ...(eventSnapshot ? { eventSnapshot } : {}),
      timingStatus: String(record?.timingStatus ?? record?.context?.timingStatus ?? '').trim(),
      sales: listing.monthlySales,
    }))
  })
}

function resultLaneFor(candidate, activeEventId) {
  if (candidate.angleId === 'evergreen') return 'evergreen'
  if (candidate.eventId && candidate.eventId !== activeEventId) return 'seasonal-reference'
  if (candidate.angleId === 'seasonal-reference') return 'seasonal-reference'
  return 'event'
}

export function normalizeExplorationCandidate(candidate = {}) {
  const keyword = normalizePhrase(candidate.keyword ?? candidate.query)
  if (!keyword) return null

  const source = String(candidate.source ?? '').trim()
  const sources = normalizedSources([source, ...(candidate.sources ?? [])])
  const angleId = String(candidate.angleId ?? '').trim()
  const angleIds = [...new Set([
    angleId,
    ...(Array.isArray(candidate.angleIds) ? candidate.angleIds : []),
  ].map((value) => String(value ?? '').trim()).filter(Boolean))]

  return {
    ...candidate,
    keyword,
    categoryId: String(candidate.categoryId ?? '').trim(),
    eventId: String(candidate.eventId ?? '').trim(),
    angleId,
    angleIds,
    source: source || sources[0] || '',
    sources,
    sourceKeywords: normalizedList(candidate.sourceKeywords ?? keyword),
    resultLane: String(candidate.resultLane ?? '').trim(),
    priorityScore: optionalNumber(candidate.priorityScore),
    timingStatus: String(candidate.timingStatus ?? '').trim(),
  }
}

export function candidateEvidenceKey(candidate = {}) {
  return [
    normalizePhrase(candidate.keyword),
    String(candidate.categoryId ?? ''),
    String(candidate.eventId ?? ''),
  ].join('|')
}

export function candidateProvenanceKey(candidate = {}) {
  return `${candidateEvidenceKey(candidate)}|${String(candidate.angleId ?? '')}`
}

function savedSeasonalReference(candidate = {}) {
  const keyword = normalizePhrase(candidate.keyword)
  const eventId = String(candidate.eventId ?? '').trim()
  const categoryId = String(candidate.categoryId ?? '').trim()
  if (!keyword || !eventId || !categoryId) return null
  return {
    keyword,
    categoryId,
    eventId,
    ...(String(candidate.originEventId ?? '').trim()
      ? { originEventId: String(candidate.originEventId).trim() }
      : {}),
    ...(String(candidate.originCategoryId ?? '').trim()
      ? { originCategoryId: String(candidate.originCategoryId).trim() }
      : {}),
    timingStatus: String(candidate.timingStatus ?? '').trim(),
    source: String(candidate.source ?? 'seasonal-result-lane').trim()
      || 'seasonal-result-lane',
  }
}

export function restoreSavedSeasonalReferences({
  saved = [],
  legacyKeys = [],
  availableCandidates = [],
} = {}) {
  const availableByKey = new Map()
  ;(Array.isArray(availableCandidates) ? availableCandidates : []).forEach((candidate) => {
    const normalized = savedSeasonalReference(candidate)
    if (!normalized) return
    const keys = [
      `${normalized.eventId}|${normalized.keyword}`,
      ...(Array.isArray(candidate?.legacyKeys) ? candidate.legacyKeys : []),
    ]
    keys.map((key) => String(key ?? '').trim()).filter(Boolean)
      .forEach((key) => availableByKey.set(key, normalized))
  })
  const candidates = [
    ...(Array.isArray(saved) ? saved : []),
    ...(Array.isArray(legacyKeys) ? legacyKeys : [])
      .map((key) => availableByKey.get(String(key ?? '').trim()))
      .filter(Boolean),
  ]
  const byKey = new Map()
  candidates.forEach((candidate) => {
    const normalized = savedSeasonalReference(candidate)
    if (!normalized) return
    const key = candidateEvidenceKey(normalized)
    if (!byKey.has(key)) byKey.set(key, normalized)
  })
  return [...byKey.values()]
}

function mergeCandidate(existing, incoming) {
  const sources = [...new Set([...existing.sources, ...incoming.sources])]
  const angleIds = [...new Set([...existing.angleIds, ...incoming.angleIds])]
  const sourceKeywords = [...new Set([...existing.sourceKeywords, ...incoming.sourceKeywords])]
  return {
    ...existing,
    sources,
    angleIds,
    sourceKeywords,
    source: existing.source || incoming.source,
    priorityScore: Math.max(existing.priorityScore ?? 0, incoming.priorityScore ?? 0) || null,
  }
}

function addCandidates(byEvidence, rawCandidates, defaults) {
  for (const rawCandidate of rawCandidates) {
    const normalized = normalizeExplorationCandidate({ ...defaults, ...rawCandidate })
    if (!normalized) continue
    normalized.resultLane = resultLaneFor(normalized, defaults.activeEventId)
    const key = candidateEvidenceKey(normalized)
    byEvidence.set(key, byEvidence.has(key) ? mergeCandidate(byEvidence.get(key), normalized) : normalized)
  }
}

function listingCandidate(listing, category) {
  const sales = optionalNumber(listing?.sales)
  const listingAgeMonths = optionalNumber(listing?.listingAgeMonths)
  if (!listing || sales === null || sales < 1 || listingAgeMonths === null || listingAgeMonths > 12) return null
  if (String(listing.categoryId ?? '').trim() === String(category.id ?? '').trim()) return null
  const title = normalizePhrase(listing.title)
  const sourceCategory = normalizePhrase(listing.categorySearchTerm ?? listing.categoryId)
  const productTerm = normalizePhrase(category.searchTerm)
  if (!title || !productTerm) return null
  const withoutSourceCategory = sourceCategory
    ? title.replace(new RegExp(`\\b${sourceCategory.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'g'), ' ')
    : title
  return normalizePhrase(`${withoutSourceCategory} ${productTerm}`)
}

function adjacentExplorationCandidate(listing, category, context) {
  const keyword = listingCandidate(listing, category)
  if (!keyword) return null

  const eventId = String(listing?.eventId ?? '').trim()
  const timingStatus = String(listing?.timingStatus ?? '').trim()
  const isOtherEvent = Boolean(eventId && eventId !== context.activeEventId)
  if (isOtherEvent && timingStatus !== 'timely') return null

  const listingSources = Array.isArray(listing?.sources) ? listing.sources : []
  const sourceKeywords = Array.isArray(listing?.sourceKeywords) ? listing.sourceKeywords : []
  return {
    keyword,
    eventId: eventId || context.eventId,
    timingStatus: timingStatus || context.timingStatus,
    angleId: isOtherEvent ? 'seasonal-reference' : 'adjacent-product',
    ...(isOtherEvent ? { angleIds: ['adjacent-product'] } : {}),
    source: 'adjacent-product-title',
    sources: [listing?.source, ...listingSources].filter(Boolean),
    sourceKeywords: [...sourceKeywords, listing?.title].filter(Boolean),
  }
}

function isMarketGap(candidate) {
  const demand = optionalNumber(
    candidate.searchDemand
    ?? candidate.etsySearches30d
    ?? candidate.erankSearchVolume
    ?? candidate.metrics?.etsy?.searches30d
    ?? candidate.metrics?.erank?.searches,
  )
  const reduction = optionalNumber(candidate.competitionReduction ?? candidate.comparison?.competitionReduction)
  const sales = optionalNumber(
    candidate.sellingListingCount
    ?? candidate.recentSellingListingCount
    ?? candidate.metrics?.everbee?.sellingListings
    ?? candidate.metrics?.everbee?.recentSellingListings,
  )
  return demand !== null && demand > 0 && reduction !== null && reduction >= 0.3 && sales !== null && sales >= 2
}

export function currentMeasuredMarketGapCandidates(rows = [], context = {}) {
  const activeEventId = String(context.eventId ?? '').trim()
  const activeCategoryId = String(context.categoryId ?? '').trim()
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => (
      String(row?.raw?.researchEventId ?? row?.researchEventId ?? '').trim() === activeEventId
      && String(row?.raw?.researchCategoryId ?? row?.researchCategoryId ?? '').trim() === activeCategoryId
    ))
    .map((row) => ({
      ...row.raw,
      ...row.normalized,
      keyword: row.keyword,
      comparison: row.drilldownNode?.comparison,
      priorityScore: row.scoreState?.score ?? row.scoreState?.explorationPriority,
      source: 'measured-market-gap',
    }))
}

export function buildMultiAngleCandidatePools(input = {}) {
  const event = input.event ?? {}
  const category = input.category ?? {}
  const activeEventId = String(event.id ?? '').trim()
  const common = {
    categoryId: String(category.id ?? '').trim(),
    eventId: activeEventId,
    timingStatus: String(input.timingStatus ?? '').trim(),
    activeEventId,
  }
  const byEvidence = new Map()

  addCandidates(byEvidence, restoreSavedSeasonalReferences({
    saved: input.savedNextCycleCandidates,
  })
    .filter((candidate) => candidate.eventId === activeEventId)
    .filter((candidate) => candidate.categoryId === common.categoryId)
    .filter((candidate) => (
      !candidate.originEventId
      || candidate.originEventId !== activeEventId
      || candidate.originCategoryId !== common.categoryId
    ))
    .map((candidate) => ({
      ...candidate,
      source: 'saved-next-cycle-seasonal-reference',
      sources: [candidate.source, 'saved-next-cycle-seasonal-reference'],
    })), {
    ...common,
    angleId: 'demand-neighborhood',
  })
  addCandidates(byEvidence, (Array.isArray(input.relatedTerms) ? input.relatedTerms : [input.relatedTerms])
    .map((candidate) => typeof candidate === 'string' ? { keyword: candidate } : candidate)
    .filter(Boolean)
    .filter((candidate) => candidateMatchesResearchContext(candidate, common))
    .filter((candidate) => matchesCategory(candidate.keyword, category))
    .map((candidate) => ({ source: 'marketplace-insights', ...candidate })), {
    ...common,
    angleId: 'demand-neighborhood',
  })
  addCandidates(byEvidence, (input.taxonomyCandidates ?? [])
    .filter((candidate) => candidateMatchesResearchContext(candidate, common)), {
    ...common,
    angleId: 'attribute-combination',
  })
  addCandidates(byEvidence, (input.drilldownCandidates ?? [])
    .filter((candidate) => candidateMatchesResearchContext(candidate, common))
    .filter(hasEverbeeTitleSource), {
    ...common,
    angleId: 'recent-sales',
  })
  addCandidates(byEvidence, (input.adjacentProductListings ?? [])
    .map((listing) => adjacentExplorationCandidate(listing, category, common))
    .filter(Boolean), {
    ...common,
    angleId: 'adjacent-product',
  })
  const measuredMarketGapCandidates = currentMeasuredMarketGapCandidates(
    input.measuredRows,
    {
      eventId: activeEventId,
      categoryId: common.categoryId,
    },
  )
  addCandidates(byEvidence, [
    ...(input.marketGapCandidates ?? []),
    ...measuredMarketGapCandidates,
  ].filter(isMarketGap), {
    ...common,
    angleId: 'market-gap',
  })
  addCandidates(byEvidence, (input.evergreenCandidates ?? [])
    .filter((candidate) => candidateMatchesResearchContext(candidate, common, {
      allowEventless: true,
    })), {
    ...common,
    eventId: '',
    angleId: 'evergreen',
    resultLane: 'evergreen',
  })
  addCandidates(byEvidence, (input.seasonalReferenceCandidates ?? [])
    .filter((candidate) => candidate.eventId && candidate.eventId !== activeEventId && candidate.timingStatus === 'timely'), {
    ...common,
    angleId: 'seasonal-reference',
    resultLane: 'seasonal-reference',
  })

  const pools = Object.fromEntries([...EXPLORATION_ANGLE_ORDER, 'seasonal-reference'].map((angleId) => [angleId, []]))
  for (const candidate of byEvidence.values()) {
    const angleId = candidate.angleIds.find((angle) => Object.hasOwn(pools, angle))
    if (angleId) pools[angleId].push({ ...candidate, angleId })
  }
  return pools
}
