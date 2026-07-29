import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTimelySeasonalSuggestions,
  classifyProductionWindow,
  resolveEventPeakDate,
} from '../../shared/market-keyword-engine/market-timing.js'

test('resolves fixed and movable 2026 event dates', () => {
  assert.equal(
    resolveEventPeakDate({ id: 'halloween', month: 10 }, 2026).toISOString().slice(0, 10),
    '2026-10-31',
  )
  assert.equal(
    resolveEventPeakDate({ id: 'thanksgiving', month: 11 }, 2026).toISOString().slice(0, 10),
    '2026-11-26',
  )
  assert.equal(
    resolveEventPeakDate({ id: 'mothers-day', month: 5 }, 2026).toISOString().slice(0, 10),
    '2026-05-10',
  )
})

test('treats 45 through 75 days as the production window', () => {
  const event = { id: 'halloween', month: 10 }
  assert.equal(classifyProductionWindow(event, new Date('2026-08-17T00:00:00Z')).status, 'timely')
  assert.equal(classifyProductionWindow(event, new Date('2026-09-20T00:00:00Z')).status, 'late')
  assert.equal(classifyProductionWindow(event, new Date('2026-07-01T00:00:00Z')).status, 'early')
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
