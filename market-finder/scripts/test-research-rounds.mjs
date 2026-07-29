import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createResearchRoundsState,
  researchRowsForRound,
  startResearchRound,
  summarizeOpportunityCounts,
  updateResearchRound,
} from '../src/research-rounds.js'

test('creates and restores initial and cross-niche round references', () => {
  let state = createResearchRoundsState()
  state = startResearchRound(state, {
    type: 'initial',
    depth: 0,
    candidateKeywords: ['Halloween Ghost Shirt', 'teacher shirt'],
    startedAt: '2026-07-22T09:00:00.000Z',
    startReason: 'initial candidate discovery',
  })
  state = startResearchRound(state, {
    type: 'cross-niche',
    depth: 1,
    candidateKeywords: ['math teacher shirt'],
    startedAt: '2026-07-22T10:00:00.000Z',
    startReason: 'high competition parent market',
  })

  assert.deepEqual(state.rounds.map(({ id, type, depth, status }) => ({ id, type, depth, status })), [
    { id: 'initial', type: 'initial', depth: 0, status: 'pending-erank' },
    { id: 'cross-niche-1', type: 'cross-niche', depth: 1, status: 'pending-erank' },
  ])
  assert.equal(state.activeRoundId, 'cross-niche-1')
  assert.deepEqual(createResearchRoundsState(JSON.parse(JSON.stringify(state))), state)
})

test('preserves a third cross-niche research round', () => {
  const state = startResearchRound(createResearchRoundsState(), {
    type: 'cross-niche',
    depth: 3,
    candidateKeywords: ['second grade special education teacher shirt'],
  })

  assert.equal(state.rounds[0].id, 'cross-niche-3')
  assert.equal(state.rounds[0].depth, 3)
  assert.equal(state.activeRoundId, 'cross-niche-3')
})

test('preserves unbounded continuous niche rounds without overwriting earlier batches', () => {
  let state = startResearchRound(createResearchRoundsState(), {
    type: 'continuous-niche',
    depth: 4,
    candidateKeywords: ['halloween teacher shirt'],
  })
  state = startResearchRound(state, {
    type: 'continuous-niche',
    depth: 5,
    candidateKeywords: ['halloween reading shirt'],
  })
  const restored = createResearchRoundsState(JSON.parse(JSON.stringify(state)))

  assert.deepEqual(restored.rounds.map(({ id, type, depth }) => ({ id, type, depth })), [
    { id: 'continuous-niche-4', type: 'continuous-niche', depth: 4 },
    { id: 'continuous-niche-5', type: 'continuous-niche', depth: 5 },
  ])
  assert.equal(restored.activeRoundId, 'continuous-niche-5')
})

test('updates one round without replacing earlier round results', () => {
  let state = startResearchRound(createResearchRoundsState(), {
    type: 'initial',
    depth: 0,
    candidateKeywords: ['ghost shirt'],
  })
  state = startResearchRound(state, {
    type: 'cross-niche',
    depth: 1,
    candidateKeywords: ['retro ghost shirt'],
  })
  state = updateResearchRound(state, 'initial', {
    status: 'complete',
    resultKeywords: ['ghost shirt'],
    opportunityCounts: { A: 1, B: 0, C: 2, D: 3 },
    stopReason: 'initial verification complete',
  })

  assert.equal(state.rounds[0].status, 'complete')
  assert.deepEqual(state.rounds[0].opportunityCounts, { A: 1, B: 0, C: 2, D: 3 })
  assert.equal(state.rounds[1].status, 'pending-erank')
  assert.deepEqual(state.rounds[1].candidateKeywords, ['retro ghost shirt'])
})

test('finds direct and shared-base result rows through source keyword references', () => {
  const round = {
    candidateKeywords: ['halloween ghost shirt'],
    resultKeywords: [],
  }
  const rows = [
    { keyword: 'halloween ghost shirt', queryKind: 'direct' },
    { keyword: 'ghost shirt', queryKind: 'base', sourceKeywords: ['halloween ghost shirt', 'halloween cute ghost shirt'] },
    { keyword: 'teacher shirt', queryKind: 'direct' },
  ]

  assert.deepEqual(researchRowsForRound(rows, round).map((row) => row.keyword), [
    'halloween ghost shirt',
    'ghost shirt',
  ])
})

test('summarizes A B C and D without treating C as a product recommendation', () => {
  const rows = [
    { grade: 'A' },
    { bucket: { grade: 'B' } },
    { score: { grade: 'C' } },
    { grade: 'C' },
    { grade: 'D' },
  ]

  assert.deepEqual(summarizeOpportunityCounts(rows), { A: 1, B: 1, C: 2, D: 1 })
})
