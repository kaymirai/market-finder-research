#!/usr/bin/env node
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as strategy from '../src/profit-strategy.js'
import {
  decideProductAction,
  resolveExplorationMode,
  scoreProfitStrategy,
  shouldRequestErank,
  summarizeResearchFunnel,
} from '../src/profit-strategy.js'

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8')

const PERFECT_PROFIT_INPUT = {
  demandSupply: 25,
  buyerIntent: 15,
  newcomerAccess: 20,
  differentiation: 15,
  salesEvidence: 13,
  economics: 7,
  trendFit: 5,
}

test('keeps the seven profit components separate and totals 100', () => {
  const result = scoreProfitStrategy(PERFECT_PROFIT_INPUT)

  assert.equal(result.total, 100)
  assert.deepEqual(result.weights, PERFECT_PROFIT_INPUT)
})

test('clamps each profit component to its declared range without mutating input evidence', () => {
  const input = {
    ...PERFECT_PROFIT_INPUT,
    demandSupply: 99,
    buyerIntent: -1,
    evidence: { buyerIntent: ['community self-name'] },
  }

  const result = scoreProfitStrategy(input)

  assert.equal(result.weights.demandSupply, 25)
  assert.equal(result.weights.buyerIntent, 0)
  assert.deepEqual(result.evidence, { buyerIntent: ['community self-name'] })
  assert.notEqual(result.evidence, input.evidence)
  assert.deepEqual(input, {
    ...PERFECT_PROFIT_INPUT,
    demandSupply: 99,
    buyerIntent: -1,
    evidence: { buyerIntent: ['community self-name'] },
  })
})

test('preserves the buyer-intent rubric values', () => {
  for (const { score, reason } of [
    { score: 0, reason: 'phrase combination only' },
    { score: 5, reason: 'attribute without a clear reason to wear or give' },
    { score: 10, reason: 'buyer context is clear without self-name evidence' },
    { score: 15, reason: 'buyer context and self-name evidence are clear' },
  ]) {
    const result = scoreProfitStrategy({ ...PERFECT_PROFIT_INPUT, buyerIntent: score })
    assert.equal(result.weights.buyerIntent, score, reason)
  }
})

test('never lets a profit score overwrite an unsafe or D market result', () => {
  assert.equal(decideProductAction({ marketGrade: 'D', profitScore: 100, ipRisk: false }).action, 'reject')
  assert.equal(decideProductAction({ marketGrade: 'A', profitScore: 100, ipRisk: true }).action, 'reject')
})

test('allows A/B with at least 70 points to launch small', () => {
  assert.equal(decideProductAction({ marketGrade: 'B', profitScore: 70, ipRisk: false }).action, 'launch-small')
})

test('holds A/B scores from 55 through 69 and explores C markets', () => {
  for (const { marketGrade, profitScore, action } of [
    { marketGrade: 'A', profitScore: 55, action: 'hold' },
    { marketGrade: 'B', profitScore: 69, action: 'hold' },
    { marketGrade: 'C', profitScore: 100, action: 'explore' },
  ]) {
    assert.equal(decideProductAction({ marketGrade, profitScore, ipRisk: false }).action, action)
  }
})

const COMPLETE_ERANK_ROW = {
  etsySearches: 500,
  etsyListings: 1200,
  relatedTerms: ['gift for librarian', 'retired librarian', 'book club shirt'],
}

test('requests eRank only for the approved research gaps', () => {
  const scenarios = [
    { row: COMPLETE_ERANK_ROW, want: false, reason: 'complete Etsy evidence has no approved gap' },
    { row: { ...COMPLETE_ERANK_ROW, etsySearches: 'unknown' }, want: true, reason: 'Etsy core demand is unknown' },
    { row: { ...COMPLETE_ERANK_ROW, needsSeasonCountryComparison: true }, want: true, reason: 'season or country comparison is needed' },
    { row: { ...COMPLETE_ERANK_ROW, marketBoundary: 'A/B' }, want: true, reason: 'A/B market boundary needs comparison' },
    { row: { ...COMPLETE_ERANK_ROW, marketBoundary: 'B/C' }, want: true, reason: 'B/C market boundary needs comparison' },
    { row: { ...COMPLETE_ERANK_ROW, relatedTerms: ['retired librarian'] }, want: true, reason: 'related terms are insufficient' },
    { row: { ...COMPLETE_ERANK_ROW, etsyEverbeeConflict: true }, want: true, reason: 'Etsy and EverBee evidence conflicts' },
  ]

  for (const scenario of scenarios) {
    assert.equal(shouldRequestErank(scenario.row), scenario.want, scenario.reason)
  }
})

test('uses the M1 through M6 exploration ratios', () => {
  const expectedModes = [
    ['M1', 'distribution', 100, 0],
    ['M2', 'distribution', 100, 0],
    ['M3', 'hybrid', 60, 40],
    ['M4', 'hybrid', 60, 40],
    ['M5', 'winner-deepening', 30, 70],
    ['M6', 'winner-deepening', 30, 70],
  ]

  for (const [selectedMode, strategy, explorationPercent, winnerDeepeningPercent] of expectedModes) {
    const result = resolveExplorationMode({ selectedMode, month: 1, outcomes: [] })
    assert.deepEqual(
      { mode: result.mode, strategy: result.strategy, explorationPercent: result.explorationPercent, winnerDeepeningPercent: result.winnerDeepeningPercent },
      { mode: selectedMode, strategy, explorationPercent, winnerDeepeningPercent },
    )
  }
})

test('falls back to the current month when no exploration mode is selected', () => {
  const result = resolveExplorationMode({ selectedMode: '', month: 6, outcomes: [{ action: 'launch-small' }] })

  assert.equal(result.mode, 'M6')
  assert.equal(result.winnerCount, 1)
})

test('allocates exploration candidates with floor quotas for M1, M3, and M5', () => {
  assert.equal(
    typeof strategy.allocateExplorationCandidates,
    'function',
    'allocateExplorationCandidates must implement the real selection policy',
  )
  const explorationCandidates = Array.from({ length: 10 }, (_, index) => ({ keyword: `new-${index + 1}` }))
  const winnerCandidates = Array.from({ length: 10 }, (_, index) => ({ keyword: `winner-${index + 1}` }))

  for (const [selectedMode, limit, expectedKeywords] of [
    ['M1', 5, ['new-1', 'new-2', 'new-3', 'new-4', 'new-5']],
    ['M3', 5, ['new-1', 'new-2', 'new-3', 'winner-1', 'winner-2']],
    ['M5', 5, ['new-1', 'winner-1', 'winner-2', 'winner-3', 'winner-4']],
  ]) {
    const selected = strategy.allocateExplorationCandidates({
      explorationCandidates,
      winnerCandidates,
      selectedMode,
      limit,
    })
    assert.deepEqual(selected.map((candidate) => candidate.keyword), expectedKeywords, selectedMode)
  }
})

test('fills a short side from the other side and removes duplicate keywords', () => {
  const selected = strategy.allocateExplorationCandidates({
    explorationCandidates: [
      { keyword: 'shared keyword' },
      { keyword: 'new market' },
    ],
    winnerCandidates: [
      { keyword: 'Shared   Keyword' },
      { keyword: 'winner one' },
      { keyword: 'winner two' },
      { keyword: 'winner three' },
    ],
    selectedMode: 'M3',
    limit: 5,
  })

  assert.deepEqual(
    selected.map((candidate) => candidate.keyword),
    ['shared keyword', 'new market', 'winner one', 'winner two', 'winner three'],
  )
})

test('never backfills M1 exploration with winner candidates', () => {
  const selected = strategy.allocateExplorationCandidates({
    explorationCandidates: [{ keyword: 'new market only' }],
    winnerCandidates: [{ keyword: 'winner one' }, { keyword: 'winner two' }],
    selectedMode: 'M1',
    limit: 3,
  })

  assert.deepEqual(selected.map((candidate) => candidate.keyword), ['new market only'])
})

test('finds winner candidates from latest listing outcome cluster or keyword evidence', () => {
  assert.equal(
    typeof strategy.winningOutcomeCandidates,
    'function',
    'winningOutcomeCandidates must classify the real saved-outcome evidence',
  )
  const selected = strategy.winningOutcomeCandidates({
    candidates: [
      { keyword: 'nurse retirement shirt', clusterKey: 'nurse' },
      { keyword: 'book club shirt', clusterKey: 'reader' },
      { keyword: 'teacher gift shirt', clusterKey: 'teacher' },
    ],
    outcomes: [
      { listingId: '1', keyword: 'unrelated listing', clusterId: 'nurse', visits: 100, orders: 3, status: 'early-go' },
      { listingId: '2', keyword: 'book club shirt', clusterId: 'other', visits: 140, orders: 4 },
      { listingId: '3', keyword: 'teacher gift shirt', clusterId: 'teacher', visits: 200, orders: 0, status: 'stop' },
    ],
  })

  assert.deepEqual(selected.map((candidate) => candidate.keyword), [
    'nurse retirement shirt',
    'book club shirt',
  ])
})

test('wires exploration allocation into the real generateCandidates route', () => {
  assert.match(appSource, /winningOutcomeCandidates\(\{[\s\S]*state\.listingOutcomesView\.latestRows/)
  assert.match(appSource, /allocateExplorationCandidates\(\{[\s\S]*selectedMode:\s*state\.selectedExplorationMode/)
})

test('keeps the strategic research funnel counts', () => {
  const scenarios = [
    {
      input: { generatedFromAxes: 200, marketplaceInsights: 200, erankRelated: 50, everbeeVisual: 15, clusters: 4, listings: 25 },
      want: { generatedFromAxes: 200, marketplaceInsights: 200, erankRelated: 50, everbeeVisual: 15, clusters: 4, listings: 25 },
    },
    {
      input: { generatedFromAxes: 200, marketplaceInsights: 200, erankRelated: 100, everbeeVisual: 20, clusters: 6, listings: 40 },
      want: { generatedFromAxes: 200, marketplaceInsights: 200, erankRelated: 100, everbeeVisual: 20, clusters: 6, listings: 40 },
    },
  ]

  for (const { input, want } of scenarios) {
    assert.deepEqual(summarizeResearchFunnel(input).counts, want)
  }
})
