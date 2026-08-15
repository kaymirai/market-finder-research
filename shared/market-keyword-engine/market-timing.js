export const PRODUCTION_WINDOW_MIN_DAYS = 45
export const PRODUCTION_WINDOW_MAX_DAYS = 75

const DAY_MS = 86400000
const MARKET_TIME_ZONE = 'Asia/Tokyo'
const MARKET_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: MARKET_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})
const CHINESE_CALENDAR_FORMATTER = new Intl.DateTimeFormat('en-US-u-ca-chinese', {
  timeZone: 'UTC',
  month: 'numeric',
  day: 'numeric',
})
const HEBREW_CALENDAR_FORMATTER = new Intl.DateTimeFormat('en-US-u-ca-hebrew', {
  timeZone: 'UTC',
  month: 'long',
  day: 'numeric',
})
const LUNAR_NEW_YEAR_DATES = Object.freeze({
  2024: [2, 10],
  2025: [1, 29],
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
  2031: [1, 23],
  2032: [2, 11],
  2033: [1, 31],
  2034: [2, 19],
  2035: [2, 8],
})

const FIXED_DATES = Object.freeze({
  'new-years-day': [1, 1],
  'valentines-day': [2, 14],
  'galentines-day': [2, 13],
  'st-patricks-day': [3, 17],
  'earth-day': [4, 22],
  'national-pet-day': [4, 11],
  'cinco-de-mayo': [5, 5],
  'nurses-week': [5, 6],
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

function firstWeekdayOnOrAfter(year, month, day, weekday) {
  const date = new Date(Date.UTC(year, month - 1, day))
  const offset = (weekday - date.getUTCDay() + 7) % 7
  date.setUTCDate(date.getUTCDate() + offset)
  return date
}

function lastMondayOfMay(year) {
  const date = new Date(Date.UTC(year, 5, 0))
  const offset = (date.getUTCDay() - 1 + 7) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return date
}

function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = ((19 * a) + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + (2 * e) + (2 * i) - h - k) % 7
  const m = Math.floor((a + (11 * h) + (22 * l)) / 451)
  const month = Math.floor((h + l - (7 * m) + 114) / 31)
  const day = ((h + l - (7 * m) + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function addCalendarDays(date, days) {
  return new Date(date.getTime() + (days * DAY_MS))
}

function calendarParts(formatter, date) {
  return Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
}

function findCalendarDate(year, startMonth, endMonth, formatter, predicate) {
  const endTime = Date.UTC(year, endMonth, 1)
  for (
    let date = new Date(Date.UTC(year, startMonth - 1, 1));
    date.getTime() < endTime;
    date = addCalendarDays(date, 1)
  ) {
    if (predicate(calendarParts(formatter, date))) return date
  }
  return null
}

function lunarNewYear(year) {
  const knownDate = LUNAR_NEW_YEAR_DATES[year]
  if (knownDate) return new Date(Date.UTC(year, knownDate[0] - 1, knownDate[1]))

  return findCalendarDate(
    year,
    1,
    2,
    CHINESE_CALENDAR_FORMATTER,
    (parts) => parts.month === '1' && parts.day === '1',
  )
}

function hanukkahStart(year) {
  return findCalendarDate(
    year,
    11,
    12,
    HEBREW_CALENDAR_FORMATTER,
    (parts) => parts.month === 'Kislev' && parts.day === '24',
  )
}

function marketCalendarParts(date) {
  const parts = calendarParts(MARKET_DATE_FORMATTER, date)
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  }
}

function calendarDayNumber({ year, month, day }) {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}

function peakCalendarDayNumber(date) {
  return calendarDayNumber({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  })
}

export function resolveEventPeakDate(event = {}, year) {
  if (!Number.isInteger(year) || event?.id === 'auto-discovery' || Number(event?.month) === 0) return null

  const fixedDate = FIXED_DATES[event?.id]
  if (fixedDate) return new Date(Date.UTC(year, fixedDate[0] - 1, fixedDate[1]))

  const weekdayRule = NTH_WEEKDAY_RULES[event?.id]
  if (weekdayRule) return nthWeekdayOfMonth(year, weekdayRule)

  if (event?.id === 'lunar-new-year') return lunarNewYear(year)
  if (event?.id === 'big-game-party') {
    return nthWeekdayOfMonth(year, { month: 2, weekday: 0, occurrence: 2 })
  }
  if (event?.id === 'easter') return easterSunday(year)
  if (event?.id === 'mardi-gras') return addCalendarDays(easterSunday(year), -47)
  if (event?.id === 'administrative-professionals-day') {
    return firstWeekdayOnOrAfter(year, 4, 21, 3)
  }
  if (event?.id === 'teacher-appreciation-week') {
    return firstWeekdayOnOrAfter(year, 5, 1, 1)
  }
  if (event?.id === 'memorial-day') return lastMondayOfMay(year)
  if (event?.id === 'grandparents-day') {
    const laborDay = nthWeekdayOfMonth(year, NTH_WEEKDAY_RULES['labor-day'])
    return addCalendarDays(laborDay, 6)
  }
  if (event?.id === 'black-friday') {
    const thanksgiving = nthWeekdayOfMonth(year, NTH_WEEKDAY_RULES.thanksgiving)
    return addCalendarDays(thanksgiving, 1)
  }
  if (event?.id === 'hanukkah') return hanukkahStart(year)

  const month = Number(event?.month)
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month - 1, 1))
    : null
}

export function nextEventPeakDate(event = {}, now = new Date()) {
  const nowDate = parseDate(now)
  if (!nowDate) return null

  const nowCalendar = marketCalendarParts(nowDate)
  const nowDayNumber = calendarDayNumber(nowCalendar)
  let peakDate = resolveEventPeakDate(event, nowCalendar.year)
  if (peakDate && peakCalendarDayNumber(peakDate) < nowDayNumber) {
    peakDate = resolveEventPeakDate(event, nowCalendar.year + 1)
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

  const daysUntil = Math.max(
    0,
    peakCalendarDayNumber(peakDate) - calendarDayNumber(marketCalendarParts(nowDate)),
  )
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
