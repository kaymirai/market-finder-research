export const PRODUCTION_WINDOW_MIN_DAYS = 45
export const PRODUCTION_WINDOW_MAX_DAYS = 75

const DAY_MS = 86400000

const FIXED_DATES = Object.freeze({
  'new-years-day': [1, 1],
  'valentines-day': [2, 14],
  'galentines-day': [2, 13],
  'st-patricks-day': [3, 17],
  'earth-day': [4, 22],
  'national-pet-day': [4, 11],
  'cinco-de-mayo': [5, 5],
  juneteenth: [6, 19],
  'canada-day': [7, 1],
  'independence-day': [7, 4],
  halloween: [10, 31],
  'veterans-day': [11, 11],
  christmas: [12, 25],
  'new-years-eve': [12, 31],
})

const NTH_WEEKDAY_RULES = Object.freeze({
  'mlk-day': { month: 1, weekday: 1, occurrence: 3 },
  'mothers-day': { month: 5, weekday: 0, occurrence: 2 },
  'fathers-day': { month: 6, weekday: 0, occurrence: 3 },
  'labor-day': { month: 9, weekday: 1, occurrence: 1 },
  'canadian-thanksgiving': { month: 10, weekday: 1, occurrence: 2 },
  thanksgiving: { month: 11, weekday: 4, occurrence: 4 },
})

function parseDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function nthWeekdayOfMonth(year, { month, weekday, occurrence }) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const offset = (weekday - firstDay.getUTCDay() + 7) % 7
  return new Date(Date.UTC(year, month - 1, 1 + offset + ((occurrence - 1) * 7)))
}

function lastMondayOfMay(year) {
  const date = new Date(Date.UTC(year, 5, 0))
  const offset = (date.getUTCDay() - 1 + 7) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return date
}

export function resolveEventPeakDate(event = {}, year) {
  if (!Number.isInteger(year) || event?.id === 'auto-discovery' || Number(event?.month) === 0) return null

  const fixedDate = FIXED_DATES[event?.id]
  if (fixedDate) return new Date(Date.UTC(year, fixedDate[0] - 1, fixedDate[1]))

  const weekdayRule = NTH_WEEKDAY_RULES[event?.id]
  if (weekdayRule) return nthWeekdayOfMonth(year, weekdayRule)

  if (event?.id === 'memorial-day') return lastMondayOfMay(year)
  if (event?.id === 'black-friday') {
    const thanksgiving = nthWeekdayOfMonth(year, NTH_WEEKDAY_RULES.thanksgiving)
    return new Date(thanksgiving.getTime() + DAY_MS)
  }

  const month = Number(event?.month)
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month - 1, 15))
    : null
}

export function nextEventPeakDate(event = {}, now = new Date()) {
  const nowDate = parseDate(now)
  if (!nowDate) return null

  let peakDate = resolveEventPeakDate(event, nowDate.getUTCFullYear())
  if (peakDate && peakDate.getTime() < nowDate.getTime()) {
    peakDate = resolveEventPeakDate(event, nowDate.getUTCFullYear() + 1)
  }
  return peakDate
}

export function classifyProductionWindow(event = {}, now = new Date()) {
  const nowDate = parseDate(now)
  const peakDate = nextEventPeakDate(event, nowDate ?? now)
  if (!nowDate || !peakDate) {
    return {
      status: 'evergreen',
      daysUntil: null,
      peakDate: null,
      canAutoResearch: true,
    }
  }

  const daysUntil = Math.max(0, Math.ceil((peakDate.getTime() - nowDate.getTime()) / DAY_MS))
  const status = daysUntil < PRODUCTION_WINDOW_MIN_DAYS
    ? 'late'
    : daysUntil <= PRODUCTION_WINDOW_MAX_DAYS
      ? 'timely'
      : 'early'

  return {
    status,
    daysUntil,
    peakDate,
    canAutoResearch: status === 'timely',
  }
}

export function buildTimelySeasonalSuggestions(events = [], options = {}) {
  return events
    .filter((event) => event?.id && event.id !== options.selectedEventId)
    .map((event) => ({ event, ...classifyProductionWindow(event, options.now) }))
    .filter((suggestion) => suggestion.status === 'timely')
    .sort((a, b) => a.daysUntil - b.daysUntil)
}
