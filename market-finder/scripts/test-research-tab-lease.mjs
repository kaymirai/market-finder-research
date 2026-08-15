import test from 'node:test'
import assert from 'node:assert/strict'

import {
  acquireResearchTabLease,
  ownsResearchTabLease,
  releaseResearchTabLease,
} from '../src/research-tab-lease.js'

test('one live Market Finder tab owns automation at a time', () => {
  const first = acquireResearchTabLease(null, { tabId: 'tab-a', now: 1_000, ttlMs: 15_000 })
  const second = acquireResearchTabLease(first.lease, { tabId: 'tab-b', now: 2_000, ttlMs: 15_000 })

  assert.equal(first.acquired, true)
  assert.equal(second.acquired, false)
  assert.equal(second.lease.tabId, 'tab-a')
})

test('an explicitly idle handoff can replace a live but inactive tab owner', () => {
  const first = acquireResearchTabLease(null, { tabId: 'tab-a', now: 1_000, ttlMs: 15_000 })
  const handoff = acquireResearchTabLease(first.lease, {
    tabId: 'tab-b',
    now: 2_000,
    ttlMs: 15_000,
    force: true,
  })

  assert.equal(handoff.acquired, true)
  assert.equal(handoff.lease.tabId, 'tab-b')
})

test('a stale owner can be replaced and the current owner can renew', () => {
  const stale = { tabId: 'tab-a', expiresAt: 5_000 }
  const replaced = acquireResearchTabLease(stale, { tabId: 'tab-b', now: 5_001, ttlMs: 15_000 })
  const renewed = acquireResearchTabLease(replaced.lease, { tabId: 'tab-b', now: 6_000, ttlMs: 15_000 })

  assert.equal(replaced.acquired, true)
  assert.equal(replaced.lease.tabId, 'tab-b')
  assert.equal(renewed.acquired, true)
  assert.equal(renewed.lease.expiresAt, 21_000)
})

test('only the owner can release the automation lease', () => {
  const lease = { tabId: 'tab-a', expiresAt: 20_000 }

  assert.equal(ownsResearchTabLease(lease, { tabId: 'tab-a', now: 10_000 }), true)
  assert.equal(ownsResearchTabLease(lease, { tabId: 'tab-b', now: 10_000 }), false)
  assert.deepEqual(releaseResearchTabLease(lease, 'tab-b'), lease)
  assert.equal(releaseResearchTabLease(lease, 'tab-a'), null)
})
