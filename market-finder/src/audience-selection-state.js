export const PERSISTENCE_VERSION = 1

const VALID_ROLES = new Set(['recipient', 'giver', 'subject'])
const VALID_STATUSES = new Set(['confirmed', 'verify', 'reference', 'manual', 'legacy'])

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizePhrase(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizedContextKey(value) {
  return String(value ?? '').trim()
}

function isoLikeTimestamp(value, fallback = '') {
  const supplied = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}T/.test(supplied) && Number.isFinite(Date.parse(supplied))) {
    return supplied
  }

  const fallbackValue = String(fallback ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}T/.test(fallbackValue) && Number.isFinite(Date.parse(fallbackValue))) {
    return fallbackValue
  }

  return new Date().toISOString()
}

function normalizeSelection(value) {
  if (!plainObject(value)) return null

  const phrase = normalizePhrase(value.phrase)
  const role = String(value.role ?? '').trim()
  if (!phrase || !VALID_ROLES.has(role)) return null

  const status = VALID_STATUSES.has(String(value.status ?? '').trim())
    ? String(value.status).trim()
    : 'manual'
  const source = normalizePhrase(value.source) || (status === 'legacy' ? 'legacy' : 'manual')

  return {
    phrase,
    role,
    subjectType: role === 'subject' ? normalizePhrase(value.subjectType) : '',
    status,
    source,
    selected: Boolean(value.selected),
  }
}

function normalizeSelections(value) {
  if (!Array.isArray(value)) return []

  const seen = new Set()
  return value.flatMap((selection) => {
    const normalized = normalizeSelection(selection)
    if (!normalized) return []
    const dedupeKey = `${normalized.role}|${normalized.phrase.toLocaleLowerCase()}`
    if (seen.has(dedupeKey)) return []
    seen.add(dedupeKey)
    return [normalized]
  })
}

export function normalizeAudienceSelectionsByContext(value, fallbackUpdatedAt = '') {
  if (!plainObject(value)) return {}

  return Object.fromEntries(Object.entries(value).flatMap(([rawContextKey, entry]) => {
    const contextKey = normalizedContextKey(rawContextKey)
    if (!contextKey || !plainObject(entry)) return []
    return [[contextKey, {
      selections: normalizeSelections(entry.selections),
      updatedAt: isoLikeTimestamp(entry.updatedAt, fallbackUpdatedAt),
    }]]
  }))
}

export function migrateLegacyAudienceState(form = {}, contextKey = '', updatedAt = '') {
  const savedForm = plainObject(form) ? form : {}
  if (Object.prototype.hasOwnProperty.call(savedForm, 'audienceSelectionsByContext')) {
    return normalizeAudienceSelectionsByContext(savedForm.audienceSelectionsByContext, updatedAt)
  }

  const normalizedKey = normalizedContextKey(contextKey)
  if (!normalizedKey) return {}

  const mode = String(savedForm.buyerIdentitySelectionMode ?? '').trim()
  const status = mode === 'manual' ? 'manual' : 'legacy'
  const selected = mode === 'manual'
  const selections = normalizeSelections(String(savedForm.buyerIdentitySeeds ?? '')
    .split(/\r?\n/)
    .map((phrase) => ({
      phrase,
      role: 'recipient',
      status,
      source: 'legacy',
      selected,
    })))

  return {
    [normalizedKey]: {
      selections,
      updatedAt: isoLikeTimestamp(updatedAt),
    },
  }
}

export function audienceSelectionsForContext(state = {}, contextKey = '') {
  const normalized = normalizeAudienceSelectionsByContext(state)
  const selectionState = normalized[normalizedContextKey(contextKey)]
  return selectionState ? selectionState.selections.map((selection) => ({ ...selection })) : []
}

export function setAudienceSelectionsForContext(state = {}, contextKey = '', selections = [], updatedAt = '') {
  const normalized = normalizeAudienceSelectionsByContext(state, updatedAt)
  const normalizedKey = normalizedContextKey(contextKey)
  if (!normalizedKey) return normalized

  return {
    ...normalized,
    [normalizedKey]: {
      selections: normalizeSelections(selections),
      updatedAt: isoLikeTimestamp(updatedAt),
    },
  }
}

export function clearCurrentAudienceSelection(state = {}, contextKey = '') {
  const normalized = normalizeAudienceSelectionsByContext(state)
  const normalizedKey = normalizedContextKey(contextKey)
  if (!normalizedKey || !Object.prototype.hasOwnProperty.call(normalized, normalizedKey)) {
    return normalized
  }

  const { [normalizedKey]: removed, ...remaining } = normalized
  return remaining
}

export function deriveAudienceUiStatus(input = {}) {
  if (input?.providerFailed === true) {
    return { status: 'provider-failed', label: '取得失敗のため未判定', verified: false }
  }

  const signals = Array.isArray(input?.signals) ? input.signals.filter(plainObject) : []
  if (signals.length === 0) {
    return { status: 'empty', label: 'まだ実績がないため未選択', verified: false }
  }
  if (signals.some((signal) => signal.status === 'manual' && signal.selected === true)) {
    return { status: 'manual', label: '手動仮説を使用中', verified: false }
  }
  if (signals.some((signal) => signal.status === 'legacy')) {
    return { status: 'legacy', label: '旧形式・要確認', verified: false }
  }
  if (signals.some((signal) => signal.status === 'confirmed')) {
    return { status: 'confirmed', label: '現在の調査実績から自動選択', verified: true }
  }

  return { status: 'verify', label: 'EtsyまたはEverBeeで確認・自動選択なし', verified: false }
}
