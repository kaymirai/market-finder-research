import test from 'node:test'
import assert from 'node:assert/strict'

import {
  classifyMarketplaceAutomationError,
  runMarketplaceOperationWithRateLimitRetry,
} from '../src/marketplace-rate-limit-retry.js'

test('keeps one broken keyword from stopping the whole Marketplace Insights queue', () => {
  assert.equal(
    classifyMarketplaceAutomationError(new Error('Cannot convert undefined or null to object')),
    'query',
  )
  assert.equal(
    classifyMarketplaceAutomationError(new Error('Marketplace Insightsの数値を読み取れませんでした')),
    'query',
  )
  assert.equal(
    classifyMarketplaceAutomationError(new Error('ETSY_MARKETPLACE_RATE_LIMITED: Slow down, buddy.')),
    'global',
  )
  assert.equal(
    classifyMarketplaceAutomationError(new Error('Chrome拡張との接続が切れました')),
    'global',
  )
  assert.equal(
    classifyMarketplaceAutomationError(new Error('Etsy login required')),
    'global',
  )
})

test('keeps retrying Etsy rate limits until the same operation succeeds', async () => {
  let attempts = 0
  const waits = []
  const retries = []

  const result = await runMarketplaceOperationWithRateLimitRetry(async () => {
    attempts += 1
    if (attempts < 4) {
      throw new Error('ETSY_MARKETPLACE_RATE_LIMITED: 一時的な連続アクセス抑制')
    }
    return 'captured'
  }, {
    baseDelayMs: 10,
    maxDelayMs: 25,
    wait: async (delayMs) => {
      waits.push(delayMs)
    },
    onRetry: (retry) => {
      retries.push({ attempt: retry.attempt, delayMs: retry.delayMs })
    },
  })

  assert.deepEqual(result, { status: 'completed', value: 'captured' })
  assert.equal(attempts, 4)
  assert.deepEqual(waits, [10, 20, 25])
  assert.deepEqual(retries, [
    { attempt: 1, delayMs: 10 },
    { attempt: 2, delayMs: 20 },
    { attempt: 3, delayMs: 25 },
  ])
})

test('does not retry non-rate-limit Etsy errors', async () => {
  let attempts = 0

  await assert.rejects(
    runMarketplaceOperationWithRateLimitRetry(async () => {
      attempts += 1
      throw new Error('Marketplace Insightsの数値を取得できませんでした')
    }, {
      wait: async () => {
        throw new Error('unexpected wait')
      },
    }),
    /数値を取得できませんでした/,
  )

  assert.equal(attempts, 1)
})

test('stops cleanly after a rate-limit wait when the user stops automation', async () => {
  let running = true
  let attempts = 0

  const result = await runMarketplaceOperationWithRateLimitRetry(async () => {
    attempts += 1
    throw new Error('ETSY_MARKETPLACE_RATE_LIMITED: Slow down, buddy.')
  }, {
    shouldContinue: () => running,
    baseDelayMs: 10,
    wait: async () => {
      running = false
    },
  })

  assert.deepEqual(result, { status: 'stopped', value: undefined })
  assert.equal(attempts, 1)
})

test('retries when a localized Etsy block page hides the Marketplace Insights search field', async () => {
  let attempts = 0
  const waits = []

  const result = await runMarketplaceOperationWithRateLimitRetry(async () => {
    attempts += 1
    if (attempts === 1) {
      throw new Error('Marketplace Insightsの検索欄が見つかりません。Etsyへのログイン状態を確認してください。')
    }
    return 'captured'
  }, {
    baseDelayMs: 10,
    wait: async (delayMs) => {
      waits.push(delayMs)
    },
  })

  assert.deepEqual(result, { status: 'completed', value: 'captured' })
  assert.equal(attempts, 2)
  assert.deepEqual(waits, [10])
})

test('uses the production 15, 30, then 60 minute retry schedule', async () => {
  const waits = []
  let running = true

  const result = await runMarketplaceOperationWithRateLimitRetry(async () => {
    throw new Error('ETSY_MARKETPLACE_RATE_LIMITED: 一時的な連続アクセス抑制')
  }, {
    shouldContinue: () => running,
    wait: async (delayMs) => {
      waits.push(delayMs)
      if (waits.length === 3) running = false
    },
  })

  assert.deepEqual(result, { status: 'stopped', value: undefined })
  assert.deepEqual(waits, [
    15 * 60_000,
    30 * 60_000,
    60 * 60_000,
  ])
})

test('continues the retry schedule from a persisted attempt after reload', async () => {
  const waits = []
  let running = true

  await runMarketplaceOperationWithRateLimitRetry(async () => {
    throw new Error('ETSY_MARKETPLACE_RATE_LIMITED: 一時的な連続アクセス抑制')
  }, {
    initialAttempt: 1,
    shouldContinue: () => running,
    wait: async (delayMs) => {
      waits.push(delayMs)
      running = false
    },
  })

  assert.deepEqual(waits, [30 * 60_000])
})
