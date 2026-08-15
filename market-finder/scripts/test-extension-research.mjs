import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extensionStateMatchesResearchMode,
  extensionResultsSignature,
  shouldAdoptExtensionRun,
  shouldContinueExtensionPolling,
  shouldRecoverMultiAngleQueue,
} from '../src/extension-research.js'

test('adopts an already-running EverBee batch after a tab handoff', () => {
  const extensionState = {
    active: true,
    mode: 'everbee',
    currentKeyword: 'halloween teacher shirt',
  }

  assert.equal(extensionStateMatchesResearchMode(extensionState, 'everbee'), true)
  assert.equal(shouldAdoptExtensionRun({
    error: 'Market Finder調査はすでに実行中です。',
    extensionState,
    mode: 'everbee',
  }), true)
})

test('does not adopt another provider or an idle stale error', () => {
  assert.equal(extensionStateMatchesResearchMode({ active: true, mode: 'etsy' }, 'everbee'), false)
  assert.equal(shouldAdoptExtensionRun({
    error: 'Market Finder調査はすでに実行中です。',
    extensionState: { active: false, mode: 'everbee' },
    mode: 'everbee',
  }), false)
  assert.equal(shouldAdoptExtensionRun({
    error: 'ログインが必要です。',
    extensionState: { active: true, mode: 'everbee' },
    mode: 'everbee',
  }), false)
})

test('recovers the next multi-angle batch after an idle heartbeat loses its scheduler edge', () => {
  assert.equal(shouldRecoverMultiAngleQueue({
    extensionState: { active: false },
    explorationStatus: 'running',
    pendingActive: false,
    marketplaceActive: false,
  }), true)
  assert.equal(shouldRecoverMultiAngleQueue({
    extensionState: { active: true },
    explorationStatus: 'running',
    pendingActive: false,
    marketplaceActive: false,
  }), false)
  assert.equal(shouldRecoverMultiAngleQueue({
    extensionState: { active: false },
    explorationStatus: 'winner-found',
    pendingActive: false,
    marketplaceActive: false,
  }), false)
})

test('keeps polling while the extension or multi-angle orchestration still has work', () => {
  assert.equal(shouldContinueExtensionPolling({
    extensionState: { active: true },
    explorationStatus: 'idle',
    pendingActive: false,
    marketplaceActive: false,
  }), true)
  assert.equal(shouldContinueExtensionPolling({
    extensionState: { active: false },
    explorationStatus: 'running',
    pendingActive: false,
    marketplaceActive: false,
  }), true)
  assert.equal(shouldContinueExtensionPolling({
    extensionState: { active: false },
    explorationStatus: 'winner-found',
    pendingActive: false,
    marketplaceActive: false,
  }), false)
})

test('extension result signature changes only when imported evidence changes', () => {
  const baseState = {
    active: true,
    mode: 'everbee',
    currentKeyword: 'currently searching',
    results: [{
      keyword: 'halloween dentist shirt',
      checkedAt: '2026-08-12T00:00:00.000Z',
      medianMonthlySales: 1,
      productRows: [{ title: 'Dentist shirt' }],
    }],
  }
  const sameEvidence = {
    ...baseState,
    currentKeyword: 'next search',
    remaining: 7,
  }
  const updatedEvidence = {
    ...sameEvidence,
    results: [{
      ...sameEvidence.results[0],
      medianMonthlySales: 2,
    }],
  }

  assert.equal(extensionResultsSignature(baseState), extensionResultsSignature(sameEvidence))
  assert.notEqual(extensionResultsSignature(baseState), extensionResultsSignature(updatedEvidence))
})
