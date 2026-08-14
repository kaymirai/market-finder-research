import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createMarketplaceRetryState,
  marketplaceRetryDelay,
  normalizePendingEvidenceAutomation,
  restorePendingEvidenceAutomation,
  restoreInterruptedMarketplaceInsightPlan,
  shouldAutoResumeEvidenceAutomation,
  shouldAutoResumeReloadCheckpoint,
} from '../src/persistent-evidence-automation.js'

test('restores an active evidence batch but never restores a stale page timer', () => {
  const restored = normalizePendingEvidenceAutomation({
    active: true,
    scheduled: true,
    initialCount: 8,
    completedBatches: 2,
    currentStage: 'pending-etsy',
    targetKeywords: ['Halloween Nurse Shirt', ' halloween nurse shirt ', 'Ghost Book Club'],
  })

  assert.deepEqual(restored, {
    active: true,
    scheduled: false,
    initialCount: 8,
    completedBatches: 2,
    currentStage: 'pending-etsy',
    targetKeywords: ['halloween nurse shirt', 'ghost book club'],
  })
})

test('does not resume an incomplete or inactive saved batch', () => {
  assert.equal(normalizePendingEvidenceAutomation({
    active: true,
    targetKeywords: [],
  }).active, false)
  assert.equal(normalizePendingEvidenceAutomation({
    active: false,
    targetKeywords: ['ghost book club'],
  }).active, false)
})

test('recovers the unfinished batch written by the older app version', () => {
  const restored = restorePendingEvidenceAutomation({
    saved: null,
    winningNicheAutomation: {
      status: 'running',
      queuedKeywords: ['ghost book club', 'halloween nurse shirt'],
    },
    marketplaceInsightPlan: {
      items: [
        { query: 'ghost book club', status: 'opened' },
        { query: 'halloween nurse shirt', status: 'planned' },
        { query: 'witch nurse shirt', status: 'completed' },
      ],
    },
  })

  assert.equal(restored.active, true)
  assert.equal(restored.currentStage, 'pending-etsy')
  assert.deepEqual(restored.targetKeywords, [
    'ghost book club',
    'halloween nurse shirt',
  ])
})

test('interrupted Marketplace Insights items become retryable after reload', () => {
  const restored = restoreInterruptedMarketplaceInsightPlan({
    items: [
      { query: 'ghost book club', status: 'opened', error: '' },
      { query: 'halloween nurse shirt', status: 'completed', error: '' },
    ],
  })

  assert.equal(restored.items[0].status, 'error')
  assert.match(restored.items[0].error, /中断/)
  assert.equal(restored.items[1].status, 'completed')
})

test('persists the retry deadline and resumes with only the remaining wait', () => {
  const retry = createMarketplaceRetryState({
    query: 'ghost book club',
    attempt: 2,
    delayMs: 30 * 60_000,
    nowMs: Date.parse('2026-07-28T00:00:00.000Z'),
  })

  assert.deepEqual(retry, {
    active: true,
    query: 'ghost book club',
    attempt: 2,
    retryAt: '2026-07-28T00:30:00.000Z',
  })
  assert.equal(
    marketplaceRetryDelay(retry, Date.parse('2026-07-28T00:12:00.000Z')),
    18 * 60_000,
  )
  assert.equal(
    marketplaceRetryDelay(retry, Date.parse('2026-07-28T00:31:00.000Z')),
    0,
  )
})

test('only auto-resumes a running winning-niche search with a real pending batch', () => {
  const pending = normalizePendingEvidenceAutomation({
    active: true,
    targetKeywords: ['ghost book club'],
  })

  assert.equal(shouldAutoResumeEvidenceAutomation({
    winningNicheAutomation: { status: 'running' },
    pendingEvidenceAutomation: pending,
  }), true)
  assert.equal(shouldAutoResumeEvidenceAutomation({
    winningNicheAutomation: { status: 'paused' },
    pendingEvidenceAutomation: pending,
  }), false)
  assert.equal(shouldAutoResumeEvidenceAutomation({
    winningNicheAutomation: { status: 'running' },
    pendingEvidenceAutomation: normalizePendingEvidenceAutomation(),
  }), false)
})

test('auto-resumes a reload checkpoint only for the preserved reload batch', () => {
  const pending = normalizePendingEvidenceAutomation({
    active: true,
    targetKeywords: ['ghost book club'],
  })
  assert.equal(shouldAutoResumeReloadCheckpoint({
    exploration: { status: 'paused', pauseReason: 'reload-required' },
    pendingEvidenceAutomation: pending,
  }), true)
  assert.equal(shouldAutoResumeReloadCheckpoint({
    exploration: { status: 'paused', pauseReason: 'login-required' },
    pendingEvidenceAutomation: pending,
  }), false)
  assert.equal(shouldAutoResumeReloadCheckpoint({
    exploration: { status: 'paused', pauseReason: 'reload-required' },
    pendingEvidenceAutomation: normalizePendingEvidenceAutomation(),
  }), false)
})
