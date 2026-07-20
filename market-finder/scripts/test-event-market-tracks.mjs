import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildResearchMarketHistory,
  classifyEventMarketTrack,
  prioritizeEventCandidates,
  splitResearchRowsByEventTrack,
} from '../src/event-market-tracks.js'

const HALLOWEEN_OPTIONS = { eventId: 'halloween', categoryId: 'shirt' }
const CHRISTMAS_OPTIONS = { eventId: 'christmas', categoryId: 'shirt' }

test('separates event-specific signals from evergreen audience markets', () => {
  assert.equal(classifyEventMarketTrack('halloween teacher shirt', HALLOWEEN_OPTIONS), 'event-specific')
  assert.equal(classifyEventMarketTrack('vintage ghost shirt', HALLOWEEN_OPTIONS), 'event-specific')
  assert.equal(classifyEventMarketTrack('teacher shirt', HALLOWEEN_OPTIONS), 'evergreen-adjacent')
  assert.equal(classifyEventMarketTrack('candy cane shirt', CHRISTMAS_OPTIONS), 'event-specific')
  assert.equal(classifyEventMarketTrack('book lover shirt', CHRISTMAS_OPTIONS), 'evergreen-adjacent')
  assert.equal(classifyEventMarketTrack('book lover shirt', { eventId: 'auto-discovery', categoryId: 'shirt' }), 'evergreen-adjacent')
})

test('stores checked markets by event and cluster without duplicating the same event', () => {
  const rows = [
    { keyword: 'teacher shirt', erankCheckedAt: '2026-07-20T10:00:00.000Z' },
    { keyword: 'ghost shirt', everbeeCheckedAt: '2026-07-20T11:00:00.000Z' },
    { keyword: 'unchecked shirt' },
  ]
  const history = buildResearchMarketHistory([], rows, HALLOWEEN_OPTIONS)
  const repeated = buildResearchMarketHistory(history, rows, HALLOWEEN_OPTIONS)

  assert.equal(history.length, 2)
  assert.equal(repeated.length, 2)
  assert.deepEqual(history.map((entry) => entry.intentTrack).sort(), ['event-specific', 'evergreen-adjacent'])
  assert.equal(history.find((entry) => entry.keyword === 'teacher shirt')?.clusterKey, 'teacher')
  assert.equal(history.find((entry) => entry.keyword === 'teacher shirt')?.eventId, 'halloween')
})

test('moves evergreen clusters researched in another event behind new candidates', () => {
  const history = buildResearchMarketHistory([], [
    { keyword: 'teacher shirt', everbeeCheckedAt: '2026-07-20T10:00:00.000Z' },
  ], HALLOWEEN_OPTIONS)
  const prioritized = prioritizeEventCandidates([
    { keyword: 'teacher shirt', score: 90, discoveryLane: 'audience' },
    { keyword: 'candy cane shirt', score: 70, discoveryLane: 'motif' },
    { keyword: 'nurse shirt', score: 60, discoveryLane: 'audience' },
  ], history, CHRISTMAS_OPTIONS)

  assert.deepEqual(prioritized.map((candidate) => candidate.keyword), [
    'candy cane shirt',
    'nurse shirt',
    'teacher shirt',
  ])
  assert.equal(prioritized[2].previouslyResearchedElsewhere, true)
  assert.deepEqual(prioritized[2].priorEventIds, ['halloween'])
})

test('does not penalize a cluster researched only in the current event', () => {
  const history = buildResearchMarketHistory([], [
    { keyword: 'teacher shirt', everbeeCheckedAt: '2026-07-20T10:00:00.000Z' },
  ], CHRISTMAS_OPTIONS)
  const prioritized = prioritizeEventCandidates([
    { keyword: 'teacher shirt', score: 90 },
    { keyword: 'nurse shirt', score: 60 },
  ], history, CHRISTMAS_OPTIONS)

  assert.equal(prioritized[0].keyword, 'teacher shirt')
  assert.equal(prioritized[0].previouslyResearchedElsewhere, false)
})

test('splits final rows into event-specific and evergreen groups without changing score order', () => {
  const groups = splitResearchRowsByEventTrack([
    { keyword: 'teacher shirt', score: { score: 90, normalized: { keyword: 'teacher shirt' } } },
    { keyword: 'ghost shirt', score: { score: 80, normalized: { keyword: 'ghost shirt' } } },
    { keyword: 'trick or treat shirt', score: { score: 70, normalized: { keyword: 'trick or treat shirt' } } },
  ], HALLOWEEN_OPTIONS)

  assert.deepEqual(groups.eventSpecific.map((row) => row.keyword), ['ghost shirt', 'trick or treat shirt'])
  assert.deepEqual(groups.evergreenAdjacent.map((row) => row.keyword), ['teacher shirt'])
})
