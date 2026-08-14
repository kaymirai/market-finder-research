const ETSY_TRANSIENT_BLOCK_PATTERN = /ETSY_MARKETPLACE_RATE_LIMITED|Marketplace Insightsの検索欄が見つかりません/i

const MARKETPLACE_GLOBAL_FAILURE_PATTERN = /ETSY_MARKETPLACE_RATE_LIMITED|rate.?limit|429|Chrome.*(?:接続|応答)|拡張.*(?:接続|応答)|extension.*(?:connection|response|unavailable)|login|required|sign.?in|service.?unavailable|connection.*(?:lost|closed)|timeout|time out/i

export function classifyMarketplaceAutomationError(error) {
  const message = error?.message || String(error ?? '')
  return MARKETPLACE_GLOBAL_FAILURE_PATTERN.test(message) ? 'global' : 'query'
}

function retryDelay(attempt, baseDelayMs, maxDelayMs) {
  const exponent = Math.max(0, attempt - 1)
  return Math.min(maxDelayMs, baseDelayMs * (2 ** exponent))
}

export async function runMarketplaceOperationWithRateLimitRetry(operation, options = {}) {
  const shouldContinue = typeof options.shouldContinue === 'function'
    ? options.shouldContinue
    : () => true
  const wait = typeof options.wait === 'function'
    ? options.wait
    : (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))
  const onRetry = typeof options.onRetry === 'function'
    ? options.onRetry
    : () => {}
  const baseDelayMs = Math.max(1, Number(options.baseDelayMs) || 900_000)
  const maxDelayMs = Math.max(baseDelayMs, Number(options.maxDelayMs) || 3_600_000)
  let attempt = Math.max(0, Math.floor(Number(options.initialAttempt) || 0))

  while (shouldContinue()) {
    try {
      return {
        status: 'completed',
        value: await operation(),
      }
    } catch (error) {
      if (!ETSY_TRANSIENT_BLOCK_PATTERN.test(error?.message || String(error))) throw error
      attempt += 1
      const delayMs = retryDelay(attempt, baseDelayMs, maxDelayMs)
      await onRetry({ attempt, delayMs, error })
      await wait(delayMs)
    }
  }

  return {
    status: 'stopped',
    value: undefined,
  }
}
