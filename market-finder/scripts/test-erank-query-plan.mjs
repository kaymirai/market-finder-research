import assert from 'node:assert/strict'
import test from 'node:test'

import {
  attachErankQueryProvenance,
  buildErankQueryPlan,
  summarizeErankQueryPlan,
} from '../src/erank-query-plan.js'

test('queues the full event phrase before its normalized base phrase', () => {
  const plan = buildErankQueryPlan([
    { keyword: 'halloween ghost shirt', status: 'ready' },
  ], {
    eventTerm: 'halloween',
    baseQueryFor: () => 'ghost shirt',
  })

  assert.deepEqual(plan, [
    {
      query: 'halloween ghost shirt',
      queryKind: 'direct',
      sourceKeyword: 'halloween ghost shirt',
      sourceKeywords: ['halloween ghost shirt'],
      origins: [{ sourceKeyword: 'halloween ghost shirt', queryKind: 'direct' }],
    },
    {
      query: 'ghost shirt',
      queryKind: 'base',
      sourceKeyword: 'halloween ghost shirt',
      sourceKeywords: ['halloween ghost shirt'],
      origins: [{ sourceKeyword: 'halloween ghost shirt', queryKind: 'base' }],
    },
  ])
})

test('deduplicates a shared base query and retains every source candidate', () => {
  const plan = buildErankQueryPlan([
    { keyword: 'halloween ghost shirt', status: 'ready' },
    { keyword: 'halloween cute ghost shirt', status: 'ready' },
  ], {
    eventTerm: 'halloween',
    baseQueryFor: () => 'ghost shirt',
  })

  assert.equal(plan.filter((item) => item.query === 'ghost shirt').length, 1)
  assert.deepEqual(plan.find((item) => item.query === 'ghost shirt'), {
    query: 'ghost shirt',
    queryKind: 'base',
    sourceKeyword: 'halloween ghost shirt',
    sourceKeywords: ['halloween ghost shirt', 'halloween cute ghost shirt'],
    origins: [
      { sourceKeyword: 'halloween ghost shirt', queryKind: 'base' },
      { sourceKeyword: 'halloween cute ghost shirt', queryKind: 'base' },
    ],
  })
})

test('does not add a duplicate base query when it equals the direct phrase', () => {
  const plan = buildErankQueryPlan([
    { keyword: 'teacher shirt', status: 'ready' },
  ], {
    eventTerm: 'halloween',
    baseQueryFor: () => 'teacher shirt',
  })

  assert.deepEqual(plan.map((item) => item.query), ['teacher shirt'])
})

test('counts candidate phrases separately from actual direct and base searches', () => {
  const plan = buildErankQueryPlan([
    { keyword: 'halloween ghost shirt', status: 'ready' },
    { keyword: 'teacher shirt', status: 'ready' },
  ], {
    eventTerm: 'halloween',
    baseQueryFor: (keyword) => keyword.replace(/^halloween /, ''),
  })

  assert.deepEqual(summarizeErankQueryPlan(plan), {
    candidateCount: 2,
    queryCount: 3,
    directCount: 2,
    baseCount: 1,
  })
})

test('adds query provenance and distinguishes failed captures from unsearched phrases', () => {
  const plan = buildErankQueryPlan([
    { keyword: 'halloween ghost shirt', status: 'ready' },
  ], {
    eventTerm: 'halloween',
    baseQueryFor: () => 'ghost shirt',
  })
  const attemptedAt = '2026-07-22T10:00:00.000Z'

  assert.deepEqual(attachErankQueryProvenance({
    keyword: 'halloween ghost shirt',
    error: 'Could not read metrics',
    erankAttemptedAt: attemptedAt,
  }, plan), {
    keyword: 'halloween ghost shirt',
    error: 'Could not read metrics',
    erankAttemptedAt: attemptedAt,
    sourceKeyword: 'halloween ghost shirt',
    sourceKeywords: ['halloween ghost shirt'],
    query: 'halloween ghost shirt',
    queryKind: 'direct',
    erankCaptureStatus: 'failed',
  })

  assert.equal(attachErankQueryProvenance({ keyword: 'ghost shirt' }, plan).erankCaptureStatus, 'unsearched')

  assert.equal(attachErankQueryProvenance({
    keyword: 'halloween ghost shirt',
    erankCaptureStatus: 'no-data',
    erankCheckedAt: attemptedAt,
  }, plan).erankCaptureStatus, 'no-data')
})
