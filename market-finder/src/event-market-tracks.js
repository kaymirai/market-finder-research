import {
  buildKeywordClusterKey,
  getBroadEventDiscoveryProfile,
  normalizePhrase,
  resolveMarketEvent,
} from '../../shared/market-keyword-engine/index.js?v=20260720-12'

export const EVENT_MARKET_TRACKS = {
  eventSpecific: 'event-specific',
  evergreenAdjacent: 'evergreen-adjacent',
}

const VALID_TRACKS = new Set(Object.values(EVENT_MARKET_TRACKS))
const HISTORY_LIMIT = 500

function unique(values = []) {
  return [...new Set(values.filter(Boolean))]
}

function phraseHasTerm(phrase, term) {
  const phraseTokens = normalizePhrase(phrase).split(' ').filter(Boolean)
  const termTokens = normalizePhrase(term).split(' ').filter(Boolean)
  if (termTokens.length === 0 || termTokens.length > phraseTokens.length) return false
  return phraseTokens.some((_, index) => (
    termTokens.every((token, offset) => phraseTokens[index + offset] === token)
  ))
}

function eventSignalTerms(options = {}) {
  const event = resolveMarketEvent(options)
  const profile = getBroadEventDiscoveryProfile(options)
  return unique([
    event.searchTerm,
    ...(event.seasonalSignals ?? []),
    ...(profile.lanes?.motif ?? []),
    ...(profile.lanes?.moment ?? []),
    ...(profile.lanes?.adjacent ?? []),
  ].map(normalizePhrase))
}

export function classifyEventMarketTrack(keyword, options = {}, metadata = {}) {
  if (VALID_TRACKS.has(metadata.intentTrack)) return metadata.intentTrack
  if (VALID_TRACKS.has(metadata.parentTrack)) return metadata.parentTrack

  const event = resolveMarketEvent(options)
  if (event.id === 'auto-discovery' || !normalizePhrase(event.searchTerm)) {
    return EVENT_MARKET_TRACKS.evergreenAdjacent
  }

  const normalized = normalizePhrase(keyword)
  const isEventSpecific = eventSignalTerms(options).some((term) => phraseHasTerm(normalized, term))
  return isEventSpecific
    ? EVENT_MARKET_TRACKS.eventSpecific
    : EVENT_MARKET_TRACKS.evergreenAdjacent
}

function hasResearchEvidence(row = {}) {
  return [
    row.erankCheckedAt,
    row.etsyCheckedAt,
    row.everbeeCheckedAt,
    row.erankSearchVolume,
    row.erankClicks,
    row.erankCompetition,
    row.etsySearches30d,
    row.etsyListings,
    row.listingsAnalyzed,
    row.sellingListingCount,
  ].some((value) => value !== null && value !== undefined && String(value).trim() !== '')
}

function latestCheckedAt(row = {}) {
  return [row.everbeeCheckedAt, row.etsyCheckedAt, row.erankCheckedAt]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .sort()
    .at(-1) ?? ''
}

function normalizeHistoryEntry(entry = {}) {
  const keyword = normalizePhrase(entry.keyword)
  const clusterKey = normalizePhrase(entry.clusterKey)
  const eventId = normalizePhrase(entry.eventId)
  const intentTrack = VALID_TRACKS.has(entry.intentTrack)
    ? entry.intentTrack
    : EVENT_MARKET_TRACKS.evergreenAdjacent
  if (!keyword || !clusterKey || !eventId) return null
  return {
    keyword,
    clusterKey,
    eventId,
    eventLabel: String(entry.eventLabel ?? '').trim(),
    intentTrack,
    checkedAt: String(entry.checkedAt ?? '').trim(),
  }
}

export function normalizeResearchMarketHistory(history = []) {
  const byKey = new Map()
  for (const value of Array.isArray(history) ? history : []) {
    const entry = normalizeHistoryEntry(value)
    if (!entry) continue
    const key = `${entry.eventId}|${entry.clusterKey}`
    const existing = byKey.get(key)
    if (!existing || entry.checkedAt >= existing.checkedAt) byKey.set(key, entry)
  }
  return [...byKey.values()]
    .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt) || left.clusterKey.localeCompare(right.clusterKey, 'en'))
    .slice(0, HISTORY_LIMIT)
}

export function buildResearchMarketHistory(history = [], rows = [], options = {}) {
  const next = [...normalizeResearchMarketHistory(history)]
  for (const row of rows) {
    if (!hasResearchEvidence(row)) continue
    const keyword = normalizePhrase(row.score?.normalized?.keyword ?? row.keyword)
    if (!keyword) continue
    const rowOptions = {
      ...options,
      eventId: row.researchEventId || options.eventId,
      categoryId: row.researchCategoryId || options.categoryId,
    }
    const event = resolveMarketEvent(rowOptions)
    const intentTrack = classifyEventMarketTrack(keyword, rowOptions, { intentTrack: row.intentTrack })
    next.push({
      keyword,
      clusterKey: normalizePhrase(row.historyClusterKey) || buildKeywordClusterKey(keyword, rowOptions),
      eventId: event.id,
      eventLabel: event.jpLabel,
      intentTrack,
      checkedAt: latestCheckedAt(row),
    })
  }
  return normalizeResearchMarketHistory(next)
}

export function prioritizeEventCandidates(candidates = [], history = [], options = {}) {
  const event = resolveMarketEvent(options)
  const normalizedHistory = normalizeResearchMarketHistory(history)
  const decorated = candidates.map((candidate, index) => {
    const keyword = normalizePhrase(candidate.keyword ?? candidate.query)
    const intentTrack = classifyEventMarketTrack(keyword, options, candidate)
    const historyClusterKey = buildKeywordClusterKey(keyword, options)
    const priorEventIds = intentTrack === EVENT_MARKET_TRACKS.evergreenAdjacent
      ? unique(normalizedHistory
        .filter((entry) => entry.intentTrack === EVENT_MARKET_TRACKS.evergreenAdjacent)
        .filter((entry) => entry.clusterKey === historyClusterKey && entry.eventId !== event.id)
        .map((entry) => entry.eventId))
      : []
    return {
      ...candidate,
      intentTrack,
      historyClusterKey,
      previouslyResearchedElsewhere: priorEventIds.length > 0,
      priorEventIds,
      _originalIndex: index,
    }
  })

  return decorated
    .sort((left, right) => Number(left.previouslyResearchedElsewhere) - Number(right.previouslyResearchedElsewhere)
      || left._originalIndex - right._originalIndex)
    .map(({ _originalIndex, ...candidate }) => candidate)
}

export function splitResearchRowsByEventTrack(rows = [], options = {}) {
  const groups = {
    eventSpecific: [],
    evergreenAdjacent: [],
  }
  for (const row of rows) {
    const keyword = normalizePhrase(row.score?.normalized?.keyword ?? row.keyword)
    const rowOptions = {
      ...options,
      eventId: row.researchEventId || options.eventId,
      categoryId: row.researchCategoryId || options.categoryId,
    }
    const track = classifyEventMarketTrack(keyword, rowOptions, { intentTrack: row.intentTrack })
    if (track === EVENT_MARKET_TRACKS.eventSpecific) groups.eventSpecific.push(row)
    else groups.evergreenAdjacent.push(row)
  }
  return groups
}
