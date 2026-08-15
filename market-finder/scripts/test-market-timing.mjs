import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTimelySeasonalSuggestions,
  classifyProductionWindow,
  nextEventPeakDate,
  resolveEventPeakDate,
} from '../../shared/market-keyword-engine/market-timing.js'
import { MARKET_EVENTS } from '../../shared/market-keyword-engine/index.js'

test('resolves every seasonal MARKET_EVENTS entry to a valid 2026 peak', () => {
  for (const event of MARKET_EVENTS) {
    const peakDate = resolveEventPeakDate(event, 2026)
    if (event.id === 'auto-discovery') {
      assert.equal(peakDate, null)
      continue
    }
    assert.ok(peakDate instanceof Date, `${event.id} must resolve to a Date`)
    assert.equal(Number.isFinite(peakDate.getTime()), true, `${event.id} must resolve to a valid Date`)
    assert.equal(peakDate.getUTCFullYear(), 2026, `${event.id} must resolve in the requested year`)
  }
})

test('resolves fixed and movable 2026 event dates exactly', () => {
  const expectedDates = {
    halloween: '2026-10-31',
    'mlk-day': '2026-01-19',
    'lunar-new-year': '2026-02-17',
    'big-game-party': '2026-02-08',
    'mardi-gras': '2026-02-17',
    easter: '2026-04-05',
    'administrative-professionals-day': '2026-04-22',
    'mothers-day': '2026-05-10',
    'teacher-appreciation-week': '2026-05-04',
    'memorial-day': '2026-05-25',
    'fathers-day': '2026-06-21',
    'labor-day': '2026-09-07',
    'grandparents-day': '2026-09-13',
    'canadian-thanksgiving': '2026-10-12',
    thanksgiving: '2026-11-26',
    'black-friday': '2026-11-27',
    hanukkah: '2026-12-04',
  }

  for (const [id, expectedDate] of Object.entries(expectedDates)) {
    const event = MARKET_EVENTS.find((item) => item.id === id)
    assert.equal(resolveEventPeakDate(event, 2026).toISOString().slice(0, 10), expectedDate, id)
  }
})

test('resolves lunisolar events from the requested year instead of a fixed date', () => {
  const lunarNewYear = MARKET_EVENTS.find((event) => event.id === 'lunar-new-year')
  const hanukkah = MARKET_EVENTS.find((event) => event.id === 'hanukkah')

  assert.equal(resolveEventPeakDate(lunarNewYear, 2025).toISOString().slice(0, 10), '2025-01-29')
  assert.equal(resolveEventPeakDate(lunarNewYear, 2027).toISOString().slice(0, 10), '2027-02-06')
  assert.equal(resolveEventPeakDate(hanukkah, 2025).toISOString().slice(0, 10), '2025-12-14')
  assert.equal(resolveEventPeakDate(hanukkah, 2027).toISOString().slice(0, 10), '2027-12-24')
})

test('uses the first day as the peak for month-long and generic monthly events', () => {
  assert.equal(
    resolveEventPeakDate({ id: 'black-history-month', month: 2 }, 2026).toISOString().slice(0, 10),
    '2026-02-01',
  )
  assert.equal(
    resolveEventPeakDate({ id: 'fall-season', month: 9 }, 2026).toISOString().slice(0, 10),
    '2026-09-01',
  )
})

test('treats 45 through 75 days as the production window and 44 days as late', () => {
  const event = { id: 'halloween', month: 10 }
  assert.equal(classifyProductionWindow(event, new Date('2026-08-17T00:00:00Z')).status, 'timely')
  assert.equal(classifyProductionWindow(event, new Date('2026-09-16T00:00:00Z')).status, 'timely')
  assert.equal(classifyProductionWindow(event, new Date('2026-09-17T00:00:00Z')).status, 'late')
  assert.equal(classifyProductionWindow(event, new Date('2026-09-20T00:00:00Z')).status, 'late')
  assert.equal(classifyProductionWindow(event, new Date('2026-07-01T00:00:00Z')).status, 'early')
})

test('keeps 45 and 75 day boundaries stable for every time on the same JST date', () => {
  const event = { id: 'halloween', month: 10 }
  const seventyFiveDayTimes = [
    '2026-08-16T15:00:00.000Z',
    '2026-08-17T03:00:00.000Z',
    '2026-08-17T14:59:59.999Z',
  ]
  const fortyFiveDayTimes = [
    '2026-09-15T15:00:00.000Z',
    '2026-09-16T03:00:00.000Z',
    '2026-09-16T14:59:59.999Z',
  ]

  for (const now of seventyFiveDayTimes) {
    const timing = classifyProductionWindow(event, new Date(now))
    assert.equal(timing.daysUntil, 75, now)
    assert.equal(timing.status, 'timely', now)
  }
  for (const now of fortyFiveDayTimes) {
    const timing = classifyProductionWindow(event, new Date(now))
    assert.equal(timing.daysUntil, 45, now)
    assert.equal(timing.status, 'timely', now)
  }
})

test('uses the JST calendar date when crossing production-window boundaries', () => {
  const event = { id: 'halloween', month: 10 }
  assert.equal(classifyProductionWindow(event, new Date('2026-08-16T14:59:59.999Z')).status, 'early')
  assert.equal(classifyProductionWindow(event, new Date('2026-08-16T15:00:00.000Z')).status, 'timely')
  assert.equal(classifyProductionWindow(event, new Date('2026-09-16T14:59:59.999Z')).status, 'timely')
  assert.equal(classifyProductionWindow(event, new Date('2026-09-16T15:00:00.000Z')).status, 'late')
})

test('keeps the current event peak for the full event date in JST', () => {
  assert.equal(
    nextEventPeakDate(
      { id: 'halloween', month: 10 },
      new Date('2026-10-31T14:59:59.999Z'),
    ).toISOString().slice(0, 10),
    '2026-10-31',
  )
})

test('never includes the active event in seasonal reference suggestions', () => {
  const suggestions = buildTimelySeasonalSuggestions([
    { id: 'halloween', month: 10 },
    { id: 'thanksgiving', month: 11 },
    { id: 'valentines-day', month: 2 },
  ], {
    selectedEventId: 'halloween',
    now: new Date('2026-09-20T00:00:00Z'),
  })
  assert.deepEqual(suggestions.map((item) => item.event.id), ['thanksgiving'])
})
