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
  } else {
    const giftFor = matchingPhrase.match(/(?:^|\s)gift\s+for\s+(.+)$/)
    if (giftFor) {
      const tail = trimIdentity(giftFor[1], normalize)
      const recipient = findKnownPhrase(tail, personIdentities, normalize, { startOnly: true })
      if (recipient) addKnownAt(recipient, AUDIENCE_ROLES.recipient, '', matchingPhrase.indexOf(recipient))
    }

    // `<identity> <product>` is the common recipient grammar. Restrict this to
    // known identity vocabulary so style and format words cannot become people.
    const recipient = findKnownPhrase(matchingPhrase, personIdentities, normalize, { startOnly: true })
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

export { CATEGORY_PROFILES }
