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
  const number = Number(value)
  return Number.isFinite(number) ? number : null
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
  if (!listing || optionalNumber(listing.sales) < 1 || optionalNumber(listing.listingAgeMonths) > 12) return null
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
  addCandidates(byEvidence, normalizedList(input.relatedTerms)
    .filter((keyword) => matchesCategory(keyword, category))
    .map((keyword) => ({ keyword, source: 'marketplace-insights' })), {
    ...common,
    angleId: 'demand-neighborhood',
  })
  addCandidates(byEvidence, input.taxonomyCandidates ?? [], {
    ...common,
    angleId: 'attribute-combination',
  })
  addCandidates(byEvidence, (input.drilldownCandidates ?? [])
    .filter(hasEverbeeTitleSource), {
    ...common,
    angleId: 'recent-sales',
  })
  addCandidates(byEvidence, (input.adjacentProductListings ?? [])
    .map((listing) => ({
      keyword: listingCandidate(listing, category),
      source: 'adjacent-product-title',
      sourceKeywords: [listing.title],
    }))
    .filter((candidate) => candidate.keyword), {
    ...common,
    angleId: 'adjacent-product',
  })
  addCandidates(byEvidence, (input.marketGapCandidates ?? []).filter(isMarketGap), {
    ...common,
    angleId: 'market-gap',
  })
  addCandidates(byEvidence, input.evergreenCandidates ?? [], {
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
