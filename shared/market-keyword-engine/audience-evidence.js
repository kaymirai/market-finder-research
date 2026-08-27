// Audience role parsing is deliberately kept independent from the Market Finder UI and
// storage layers. The index module supplies the existing normalizer and market vocabulary.

export const AUDIENCE_ROLES = Object.freeze({
  recipient: 'recipient',
  giver: 'giver',
  subject: 'subject',
})

const CATEGORY_PROFILES = Object.freeze({
  shirt: Object.freeze({ primaryRoles: Object.freeze(['recipient']), secondaryRoles: Object.freeze(['giver', 'subject']) }),
  sweatshirt: Object.freeze({ primaryRoles: Object.freeze(['recipient']), secondaryRoles: Object.freeze(['giver', 'subject']) }),
  mug: Object.freeze({ primaryRoles: Object.freeze(['recipient']), secondaryRoles: Object.freeze(['giver', 'subject']) }),
  ornament: Object.freeze({ primaryRoles: Object.freeze(['subject']), secondaryRoles: Object.freeze(['recipient', 'giver']) }),
  'wall-art': Object.freeze({ primaryRoles: Object.freeze(['subject']), secondaryRoles: Object.freeze(['recipient', 'giver']) }),
  tote: Object.freeze({ primaryRoles: Object.freeze(['recipient']), secondaryRoles: Object.freeze(['giver', 'subject']) }),
  sticker: Object.freeze({ primaryRoles: Object.freeze(['recipient', 'subject']), secondaryRoles: Object.freeze(['giver']) }),
})

const CATEGORY_ALIASES = Object.freeze({
  'wall art': 'wall-art',
  'wallart': 'wall-art',
  'tote bag': 'tote',
  'tote bags': 'tote',
})

const MEMORIAL_PATTERN = /\b(?:memorial|remembrance|in memory of|loss of|sympathy)\b/
const STYLE_WORDS = new Set([
  'custom', 'personalized', 'vintage', 'retro', 'funny', 'cute', 'minimalist', 'boho',
  'western', 'embroidered', 'graphic', 'classic', 'modern', 'rustic', 'aesthetic',
])
const CONNECTOR_WORDS = new Set(['for', 'of', 'from', 'and', 'the', 'my', 'our', 'a', 'an'])

const DEFAULT_PERSON_IDENTITIES = new Set([
  'mom', 'mum', 'mama', 'mother', 'ma', 'dad', 'papa', 'father', 'pa',
  'grandma', 'grandmother', 'grandpa', 'grandfather', 'granny', 'nana', 'mimi', 'gigi',
  'teacher', 'teachers', 'student', 'students', 'class', 'parents', 'parent',
  'nurse', 'nurses', 'coworker', 'coworkers', 'colleague', 'colleagues',
  'friend', 'best friend', 'bride', 'groom', 'daughter', 'son', 'kids', 'children',
  'wife', 'husband', 'sister', 'brother', 'aunt', 'auntie', 'uncle',
  'librarian', 'principal', 'coach', 'firefighter', 'veteran', 'survivor',
  'caregiver', 'doctor', 'barista', 'accountant', 'mechanic', 'realtor',
])

const DEFAULT_GIVER_IDENTITIES = new Set([
  'student', 'students', 'class', 'the class', 'parents', 'parent', 'kids', 'the kids',
  'children', 'family', 'friends', 'friend', 'coworkers', 'coworker', 'colleagues',
  'the team', 'team', 'patients', 'patient', 'families', 'family', 'club', 'crew',
  'daughter', 'son', 'grandkids', 'the grandkids',
])

const DEFAULT_PET_SUBJECTS = new Set([
  'pet', 'pets', 'dog', 'dogs', 'cat', 'cats', 'puppy', 'puppies', 'kitten', 'kittens',
  'horse', 'horses', 'bird', 'birds', 'rabbit', 'rabbits', 'hamster', 'hamsters',
])

const DEFAULT_ROOM_SUBJECTS = new Set([
  'nursery', 'kitchen', 'bathroom', 'bedroom', 'living room', 'dining room', 'playroom',
  'classroom', 'office', 'dorm room', 'entryway', 'gallery wall', 'home',
])

const DEFAULT_PLACE_SUBJECTS = new Set([
  'beach', 'ocean', 'lake', 'mountain', 'mountains', 'forest', 'desert', 'garden',
  'farmhouse', 'country', 'city', 'coast', 'cabin', 'campground',
])

const DEFAULT_INTEREST_SUBJECTS = new Set([
  'landscape', 'nature', 'floral', 'flowers', 'flower', 'plants', 'plant', 'gardening',
  'books', 'book', 'reading', 'coffee', 'camping', 'fishing', 'hunting', 'pickleball',
  'yoga', 'music', 'travel', 'sports', 'baseball', 'football', 'soccer', 'cats', 'dogs',
])

function normalizedSet(values, normalize) {
  return new Set((Array.isArray(values) ? values : [...(values ?? [])])
    .map((value) => normalize(value))
    .filter(Boolean))
}

function canonicalCategoryId(categoryId, normalize) {
  const normalized = normalize(categoryId)
  return CATEGORY_ALIASES[normalized] ?? normalized
}

function phrasePattern(phrase) {
  return String(phrase).trim().split(/\s+/).filter(Boolean).map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
}

function removeProductAliases(phrase, aliases, normalize) {
  let result = ` ${normalize(phrase)} `
  const sortedAliases = [...aliases]
    .map((alias) => normalize(alias))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
  for (const alias of sortedAliases) {
    result = result.replace(new RegExp(`\\s${phrasePattern(alias)}\\s`, 'g'), ' ')
  }
  return normalize(result)
}

function tokenPhrases(value, normalize) {
  return normalize(value).split(' ').filter(Boolean)
}

function findKnownPhrase(text, vocabulary, normalize, options = {}) {
  const normalized = normalize(text)
  const candidates = [...vocabulary]
    .map((value) => normalize(value))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
  for (const candidate of candidates) {
    if (options.startOnly && !new RegExp(`^${phrasePattern(candidate)}(?:\\s|$)`).test(normalized)) continue
    if (options.endOnly && !new RegExp(`(?:^|\\s)${phrasePattern(candidate)}$`).test(normalized)) continue
    if (new RegExp(`(?:^|\\s)${phrasePattern(candidate)}(?:\\s|$)`).test(normalized)) return candidate
  }
  return ''
}

function trimIdentity(value, normalize) {
  return normalize(value).replace(/^(?:the|my|our|a|an)\s+/, '').trim()
}

function subjectTypeFor(phrase, dependencies) {
  const normalize = dependencies.normalizePhrase
  const normalized = normalize(phrase)
  const pets = normalizedSet(dependencies.petSubjects ?? DEFAULT_PET_SUBJECTS, normalize)
  const rooms = normalizedSet(dependencies.roomSubjects ?? DEFAULT_ROOM_SUBJECTS, normalize)
  const places = normalizedSet(dependencies.placeSubjects ?? DEFAULT_PLACE_SUBJECTS, normalize)
  const interests = normalizedSet(dependencies.interestSubjects ?? DEFAULT_INTEREST_SUBJECTS, normalize)
  if (pets.has(normalized)) return 'pet'
  if (rooms.has(normalized)) return 'room'
  if (places.has(normalized)) return 'place'
  if (interests.has(normalized)) return 'interest'
  const personIdentities = normalizedSet(dependencies.personIdentities ?? DEFAULT_PERSON_IDENTITIES, normalize)
  if (personIdentities.has(normalized)) return 'person'
  return ''
}

function addSignal(signals, phrase, role, subjectType, position, normalize) {
  const normalized = normalize(phrase)
  if (!normalized || !role) return
  if (signals.some((signal) => signal.phrase === normalized && signal.role === role)) return
  signals.push({ phrase: normalized, role, subjectType: subjectType ?? '', position })
}

export function getAudienceCategoryProfileCore(categoryId, dependencies) {
  const normalize = dependencies.normalizePhrase
  const id = canonicalCategoryId(categoryId, normalize)
  const profile = CATEGORY_PROFILES[id] ?? CATEGORY_PROFILES.shirt
  return {
    categoryId: id,
    primaryRoles: [...profile.primaryRoles],
    secondaryRoles: [...profile.secondaryRoles],
    allowsNoAudience: true,
  }
}

export function extractAudienceRoleSignalsCore(value, options = {}, dependencies) {
  const normalize = dependencies.normalizePhrase
  const original = normalize(value)
  if (!original) return []

  const aliases = dependencies.productAliases ?? []
  const matchingPhrase = removeProductAliases(original, aliases, normalize)
  const tokens = tokenPhrases(matchingPhrase, normalize)
  const personIdentities = normalizedSet(dependencies.personIdentities ?? DEFAULT_PERSON_IDENTITIES, normalize)
  const giverIdentities = normalizedSet(dependencies.giverIdentities ?? DEFAULT_GIVER_IDENTITIES, normalize)
  const petSubjects = normalizedSet(dependencies.petSubjects ?? DEFAULT_PET_SUBJECTS, normalize)
  const roomSubjects = normalizedSet(dependencies.roomSubjects ?? DEFAULT_ROOM_SUBJECTS, normalize)
  const placeSubjects = normalizedSet(dependencies.placeSubjects ?? DEFAULT_PLACE_SUBJECTS, normalize)
  const interestSubjects = normalizedSet(dependencies.interestSubjects ?? DEFAULT_INTEREST_SUBJECTS, normalize)
  const signals = []
  const memorial = MEMORIAL_PATTERN.test(original)

  const addKnownAt = (candidate, role, subjectType, beforePosition = 0) => {
    const normalizedCandidate = normalize(candidate)
    if (!normalizedCandidate) return
    const index = matchingPhrase.indexOf(normalizedCandidate)
    addSignal(signals, normalizedCandidate, role, subjectType, index < 0 ? beforePosition : index, normalize)
  }

  // The complete phrase determines the role: a `from` clause is a giver even if
  // the same vocabulary can be a recipient elsewhere.
  const fromMatch = matchingPhrase.match(/(?:^|\s)from\s+(.+)$/)
  if (fromMatch) {
    const giverTail = trimIdentity(fromMatch[1], normalize)
    const giver = findKnownPhrase(giverTail, giverIdentities, normalize, { endOnly: true })
      || findKnownPhrase(giverTail, personIdentities, normalize, { endOnly: true })
    if (giver) addKnownAt(giver, AUDIENCE_ROLES.giver, '', matchingPhrase.indexOf('from'))
  }

  if (memorial) {
    // Memorial relationships take precedence over the ordinary `gift for` grammar.
    const relationship = matchingPhrase.match(/(?:^|\s)(?:for|of)\s+(.+?)(?:\s+(?:from)\s+|$)/)
    if (relationship) {
      const tail = trimIdentity(relationship[1], normalize)
      const subject = findKnownPhrase(tail, petSubjects, normalize, { startOnly: true })
        || findKnownPhrase(tail, personIdentities, normalize, { startOnly: true })
      if (subject) addKnownAt(subject, AUDIENCE_ROLES.subject, subjectTypeFor(subject, dependencies), matchingPhrase.indexOf(subject))
    }

    const memorialIndex = tokens.findIndex((token) => ['memorial', 'remembrance', 'sympathy'].includes(token))
    if (memorialIndex > 0) {
      const before = tokens.slice(0, memorialIndex).filter((token) => !CONNECTOR_WORDS.has(token)).join(' ')
      const subject = findKnownPhrase(before, petSubjects, normalize, { endOnly: true })
        || findKnownPhrase(before, personIdentities, normalize, { endOnly: true })
      if (subject) addKnownAt(subject, AUDIENCE_ROLES.subject, subjectTypeFor(subject, dependencies), matchingPhrase.indexOf(subject))
    }
    if (memorialIndex === 0) {
      const after = tokens.slice(1).filter((token) => !CONNECTOR_WORDS.has(token)).join(' ')
      const subject = findKnownPhrase(after, petSubjects, normalize, { startOnly: true })
        || findKnownPhrase(after, personIdentities, normalize, { startOnly: true })
      if (subject) addKnownAt(subject, AUDIENCE_ROLES.subject, subjectTypeFor(subject, dependencies), matchingPhrase.indexOf(subject))
    }
  } else {
    const giftFor = matchingPhrase.match(/(?:^|\s)gift\s+for\s+(.+)$/)
    if (giftFor) {
      const tail = trimIdentity(giftFor[1], normalize)
      const recipient = findKnownPhrase(tail, personIdentities, normalize, { startOnly: true })
      if (recipient) addKnownAt(recipient, AUDIENCE_ROLES.recipient, '', matchingPhrase.indexOf(recipient))
    }

    // `<identity> <product>` is the common recipient grammar. Restrict this to
    // known identity vocabulary so style and format words cannot become people.
    const recipientPhrase = matchingPhrase
      .split(' ')
      .filter((token, index, tokens) => !(index < tokens.length - 1 && STYLE_WORDS.has(token)))
      .join(' ')
    const recipient = findKnownPhrase(recipientPhrase, personIdentities, normalize, { startOnly: true })
    if (recipient && !signals.some((signal) => signal.phrase === recipient && signal.role === AUDIENCE_ROLES.giver)) {
      addKnownAt(recipient, AUDIENCE_ROLES.recipient, '', matchingPhrase.indexOf(recipient))
    }
  }

  const categoryId = canonicalCategoryId(options.categoryId, normalize)
  if (!memorial && (categoryId === 'wall-art' || categoryId === 'sticker')) {
    const subjectVocab = new Set([...roomSubjects, ...placeSubjects, ...interestSubjects])
    const subject = findKnownPhrase(matchingPhrase, subjectVocab, normalize, { startOnly: true })
    if (subject && !STYLE_WORDS.has(subject)) {
      addKnownAt(subject, AUDIENCE_ROLES.subject, subjectTypeFor(subject, dependencies), matchingPhrase.indexOf(subject))
    }
  }

  return signals
    .sort((left, right) => left.position - right.position || left.role.localeCompare(right.role))
    .map(({ position, ...signal }) => signal)
}

function normalizeAudienceContext(context = {}, dependencies) {
  const normalize = dependencies.normalizePhrase
  const categoryId = canonicalCategoryId(context.categoryId, normalize)
  const eventId = normalize(context.eventId)
  const rootKeyword = dependencies.buildKeywordClusterKey(
    context.rootKeyword
      ?? context.audienceContext?.rootKeyword
      ?? context.context?.rootKeyword
      ?? context.keyword
      ?? '',
    { categoryId },
  )
  return { categoryId, eventId, rootKeyword }
}

export function buildAudienceContextKeyCore(context = {}, dependencies) {
  const normalized = normalizeAudienceContext(context, dependencies)
  return [normalized.categoryId, normalized.eventId, normalized.rootKeyword].join('::')
}

function numberOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function isSellingListing(listing = {}, normalize) {
  if (numberOrZero(listing.monthlySales ?? listing.sales) > 0) return true
  if (listing.isSelling === true || listing.selling === true) return true
  const state = normalize(listing.sellingState ?? listing.saleState ?? listing.salesState ?? listing.status)
  return new Set(['selling', 'sold', 'has sales', 'sales']).has(state)
}

function createEvidenceBucket() {
  return {
    etsyObservationKeys: new Set(),
    everbeeObservationKeys: new Set(),
    etsyRelatedTermCount: 0,
    etsySearches: 0,
    everbeeListingCount: 0,
    everbeeSellingListingCount: 0,
    everbeeSellingTitleKeys: new Set(),
    everbeeMonthlySales: 0,
    runs: new Set(),
    sources: new Set(),
    latestCapturedAt: null,
  }
}

function updateLatestCapturedAt(bucket, capturedAt) {
  if (!capturedAt) return
  const date = new Date(capturedAt)
  if (!Number.isFinite(date.getTime())) return
  const value = date.toISOString()
  if (!bucket.latestCapturedAt || value > bucket.latestCapturedAt) bucket.latestCapturedAt = value
}

function recordEtsyEvidence(bucket, record, keyword, normalize, runId) {
  const normalizedKeyword = normalize(keyword?.keyword ?? keyword?.query ?? keyword)
  if (!normalizedKeyword) return
  const observationKey = `${runId}::etsy-related::${normalizedKeyword}`
  if (bucket.etsyObservationKeys.has(observationKey)) return
  bucket.etsyObservationKeys.add(observationKey)
  bucket.etsyRelatedTermCount += 1
  bucket.etsySearches += Math.max(0, numberOrZero(keyword?.etsySearches30d ?? keyword?.searches ?? keyword?.searchVolume))
  bucket.runs.add(runId)
  bucket.sources.add('etsy-related')
  updateLatestCapturedAt(bucket, record.capturedAt)
}

function recordEverbeeEvidence(bucket, record, title, normalize, runId) {
  const normalizedTitle = normalize(title?.title ?? title?.name ?? title)
  if (!normalizedTitle || !isSellingListing(title, normalize)) return
  const observationKey = `${runId}::everbee-title::${normalizedTitle}`
  if (bucket.everbeeObservationKeys.has(observationKey)) return
  bucket.everbeeObservationKeys.add(observationKey)
  const monthlySales = Math.max(0, numberOrZero(title?.monthlySales ?? title?.sales))
  bucket.everbeeListingCount += 1
  bucket.everbeeSellingListingCount += 1
  bucket.everbeeSellingTitleKeys.add(normalizedTitle)
  bucket.everbeeMonthlySales += monthlySales
  bucket.runs.add(runId)
  bucket.sources.add('everbee-title')
  updateLatestCapturedAt(bucket, record.capturedAt)
}

function bucketEvidence(bucket) {
  return {
    etsyRelatedTermCount: bucket.etsyRelatedTermCount,
    etsySearches: bucket.etsySearches,
    everbeeListingCount: bucket.everbeeListingCount,
    everbeeSellingListingCount: bucket.everbeeSellingListingCount,
    everbeeDistinctSellingTitleCount: bucket.everbeeSellingTitleKeys.size,
    everbeeMonthlySales: bucket.everbeeMonthlySales,
    observationRuns: bucket.runs.size,
    latestCapturedAt: bucket.latestCapturedAt,
  }
}

function signalKey(signal) {
  return [signal.phrase, signal.role, signal.subjectType ?? ''].join('::')
}

function staticSeedValues(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return value.split(/[\r\n,]+/)
  return []
}

function buildStaticDemandSeedKeys(context, options, categoryId, dependencies) {
  return new Set([
    ...staticSeedValues(context?.staticSeedKeywords),
    ...staticSeedValues(options?.staticSeedKeywords),
  ]
    .map((keyword) => dependencies.buildKeywordClusterKey(keyword, { categoryId }))
    .filter(Boolean))
}

function addEvidenceSignals(groups, kind, value, categoryId, source, record, dependencies, runId) {
  const normalize = dependencies.normalizePhrase
  if (source === 'everbee-title' && !isSellingListing(value, normalize)) return
  const phraseValue = source === 'etsy-related'
    ? (value?.keyword ?? value?.query ?? value)
    : (value?.title ?? value?.name ?? value)
  for (const signal of extractAudienceRoleSignalsCore(phraseValue, { categoryId }, dependencies)) {
    const key = signalKey(signal)
    const entry = groups.get(key) ?? {
      ...signal,
      current: createEvidenceBucket(),
      reference: createEvidenceBucket(),
    }
    groups.set(key, entry)
    const bucket = entry[kind]
    if (source === 'etsy-related') recordEtsyEvidence(bucket, record, value, normalize, runId)
    else recordEverbeeEvidence(bucket, record, value, normalize, runId)
  }
}

function statusRank(status) {
  return { confirmed: 0, verify: 1, reference: 2 }[status] ?? 3
}

export function analyzeAudienceEvidenceCore(records = [], context = {}, options = {}, dependencies) {
  const normalizedContext = normalizeAudienceContext(context, dependencies)
  const contextKey = buildAudienceContextKeyCore(normalizedContext, dependencies)
  const groups = new Map()
  const now = options.now ?? new Date()
  const staticDemandSeedKeys = buildStaticDemandSeedKeys(context, options, normalizedContext.categoryId, dependencies)
  let matchedRecordCount = 0

  for (const [index, record] of (Array.isArray(records) ? records : []).entries()) {
    const recordContext = normalizeAudienceContext(record, dependencies)
    if (!recordContext.categoryId || recordContext.categoryId !== normalizedContext.categoryId) continue
    matchedRecordCount += 1
    const recordContextKey = buildAudienceContextKeyCore(recordContext, dependencies)
    const freshness = dependencies.getSourceFreshness(record?.capturedAt, now)
    const kind = recordContextKey === contextKey && freshness.eligibleForRanking ? 'current' : 'reference'
    const runId = dependencies.normalizePhrase(record?.runId) || `record-${index}`

    for (const keyword of Array.isArray(record?.demandKeywords) ? record.demandKeywords : []) {
      const normalizedKeyword = dependencies.buildKeywordClusterKey(keyword?.keyword ?? keyword?.query ?? keyword, {
        categoryId: recordContext.categoryId,
      })
      if (staticDemandSeedKeys.has(normalizedKeyword)) continue
      addEvidenceSignals(groups, kind, keyword, recordContext.categoryId, 'etsy-related', record, dependencies, runId)
    }
    for (const listing of Array.isArray(record?.supplyListings) ? record.supplyListings : []) {
      addEvidenceSignals(groups, kind, listing, recordContext.categoryId, 'everbee-title', record, dependencies, runId)
    }
  }

  const signals = Array.from(groups.values())
    .map((entry) => {
      const current = bucketEvidence(entry.current)
      const reference = bucketEvidence(entry.reference)
      const hasCurrentEvidence = current.etsyRelatedTermCount > 0 || current.everbeeSellingListingCount > 0
      const evidence = hasCurrentEvidence ? current : reference
      const sources = Array.from((hasCurrentEvidence ? entry.current : entry.reference).sources).sort()
      const status = hasCurrentEvidence
        ? ((current.etsyRelatedTermCount >= 1 && current.everbeeSellingListingCount >= 1)
            || current.everbeeDistinctSellingTitleCount >= 2)
          ? 'confirmed'
          : 'verify'
        : 'reference'
      return {
        phrase: entry.phrase,
        role: entry.role,
        subjectType: entry.subjectType ?? '',
        status,
        autoSelectable: status === 'confirmed',
        context: normalizedContext,
        evidence,
        sources,
      }
    })
    .sort((left, right) => (
      statusRank(left.status) - statusRank(right.status)
      || right.evidence.everbeeSellingListingCount - left.evidence.everbeeSellingListingCount
      || right.sources.length - left.sources.length
      || right.evidence.observationRuns - left.evidence.observationRuns
      || left.phrase.localeCompare(right.phrase)
      || left.role.localeCompare(right.role)
    ))

  const totals = signals.reduce((summary, signal) => {
    summary[signal.status] += 1
    summary.etsyRelatedTermCount += signal.evidence.etsyRelatedTermCount
    summary.everbeeSellingListingCount += signal.evidence.everbeeSellingListingCount
    summary.everbeeDistinctSellingTitleCount += signal.evidence.everbeeDistinctSellingTitleCount
    return summary
  }, {
    records: Array.isArray(records) ? records.length : 0,
    categoryRecords: matchedRecordCount,
    confirmed: 0,
    verify: 0,
    reference: 0,
    etsyRelatedTermCount: 0,
    everbeeSellingListingCount: 0,
    everbeeDistinctSellingTitleCount: 0,
  })

  return { contextKey, signals, totals }
}

export { CATEGORY_PROFILES }
