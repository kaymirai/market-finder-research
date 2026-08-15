const DEFAULT_LISTING_RESEARCH_TARGET = Object.freeze({
  monthlyListingTarget: 100,
  researchRunsPerMonth: 4,
  listingsPerWinner: 5,
})

const FIELD_RULES = Object.freeze({
  monthlyListingTarget: {
    maximum: 1000,
    error: '1〜1,000の数値を入力してください。',
  },
  researchRunsPerMonth: {
    maximum: 31,
    error: '1〜31の数値を入力してください。',
  },
  listingsPerWinner: {
    maximum: 50,
    error: '1〜50の数値を入力してください。',
  },
})

function normalizedInteger(value, fallback, maximum) {
  if (value === null || value === undefined || String(value).trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(maximum, Math.ceil(parsed))
}

export function normalizeListingResearchTarget(saved = {}) {
  return Object.fromEntries(Object.entries(FIELD_RULES).map(([field, rule]) => [
    field,
    normalizedInteger(
      saved?.[field],
      DEFAULT_LISTING_RESEARCH_TARGET[field],
      rule.maximum,
    ),
  ]))
}

export function validateListingResearchTargetDraft(draft = {}, fallback = {}) {
  const settings = normalizeListingResearchTarget(fallback)
  const errors = {}
  const validSettings = {}

  Object.entries(FIELD_RULES).forEach(([field, rule]) => {
    const raw = draft?.[field]
    const parsed = Number(raw)
    if (
      raw === null
      || raw === undefined
      || String(raw).trim() === ''
      || !Number.isFinite(parsed)
      || parsed <= 0
      || parsed > rule.maximum
    ) {
      errors[field] = rule.error
      return
    }
    validSettings[field] = Math.ceil(parsed)
  })

  if (Object.keys(errors).length > 0) {
    return { valid: false, settings, errors }
  }
  return {
    valid: true,
    settings: validSettings,
    errors: {},
  }
}

export function calculateListingResearchTarget(input = {}) {
  const settings = normalizeListingResearchTarget(input)
  const listingsPerRun = Math.ceil(
    settings.monthlyListingTarget / settings.researchRunsPerMonth,
  )
  return {
    ...settings,
    listingsPerRun,
    targetWinnerCount: Math.ceil(listingsPerRun / settings.listingsPerWinner),
  }
}

export { DEFAULT_LISTING_RESEARCH_TARGET }
