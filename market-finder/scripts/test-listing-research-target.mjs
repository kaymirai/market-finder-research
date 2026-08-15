import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateListingResearchTarget,
  normalizeListingResearchTarget,
  validateListingResearchTargetDraft,
} from '../src/listing-research-target.js'

test('turns one hundred monthly listings into five winners per weekly research run', () => {
  assert.deepEqual(calculateListingResearchTarget({
    monthlyListingTarget: 100,
    researchRunsPerMonth: 4,
    listingsPerWinner: 5,
  }), {
    monthlyListingTarget: 100,
    researchRunsPerMonth: 4,
    listingsPerWinner: 5,
    listingsPerRun: 25,
    targetWinnerCount: 5,
  })
})

test('rounds up both listings per run and the winner target', () => {
  const result = calculateListingResearchTarget({
    monthlyListingTarget: 101,
    researchRunsPerMonth: 4,
    listingsPerWinner: 5,
  })

  assert.equal(result.listingsPerRun, 26)
  assert.equal(result.targetWinnerCount, 6)
})

test('normalizes restored values to safe integer defaults and limits', () => {
  assert.deepEqual(normalizeListingResearchTarget({
    monthlyListingTarget: 1000.2,
    researchRunsPerMonth: 0,
    listingsPerWinner: '7.2',
  }), {
    monthlyListingTarget: 1000,
    researchRunsPerMonth: 4,
    listingsPerWinner: 8,
  })
})

test('keeps the last saved settings when a draft contains an invalid value', () => {
  const fallback = {
    monthlyListingTarget: 100,
    researchRunsPerMonth: 4,
    listingsPerWinner: 5,
  }
  const result = validateListingResearchTargetDraft({
    monthlyListingTarget: '',
    researchRunsPerMonth: 4,
    listingsPerWinner: 5,
  }, fallback)

  assert.equal(result.valid, false)
  assert.deepEqual(result.settings, fallback)
  assert.deepEqual(result.errors, {
    monthlyListingTarget: '1〜1,000の数値を入力してください。',
  })
})

test('rejects out-of-range drafts without starting from partially changed settings', () => {
  const fallback = {
    monthlyListingTarget: 100,
    researchRunsPerMonth: 4,
    listingsPerWinner: 5,
  }
  const result = validateListingResearchTargetDraft({
    monthlyListingTarget: 120,
    researchRunsPerMonth: 32,
    listingsPerWinner: 0,
  }, fallback)

  assert.equal(result.valid, false)
  assert.deepEqual(result.settings, fallback)
  assert.deepEqual(result.errors, {
    researchRunsPerMonth: '1〜31の数値を入力してください。',
    listingsPerWinner: '1〜50の数値を入力してください。',
  })
})
