import {
  classifyMarketplaceBuyerQuery,
} from '../../shared/market-keyword-engine/index.js?v=20260814-4'

const EVIDENCE_STAGES = new Set(['pending-etsy', 'pending-everbee', 'pending-erank'])
const RETRYABLE_MARKETPLACE_STATUSES = new Set(['planned', 'opened', 'error'])

function normalizeKeyword(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function uniqueKeywords(values) {
  const seen = new Set()
  return (Array.isArray(values) ? values : []).reduce((keywords, value) => {
    const keyword = normalizeKeyword(value)
    if (!keyword || seen.has(keyword)) return keywords
    seen.add(keyword)
    keywords.push(keyword)
    return keywords
  }, [])
}

export function normalizePendingEvidenceAutomation(value = {}) {
  const targetKeywords = uniqueKeywords(value?.targetKeywords)
  const active = value?.active === true && targetKeywords.length > 0
  return {
    active,
    // A browser timer cannot survive a reload. A fresh timer is scheduled after
    // the extension bridge announces that it is ready.
    scheduled: false,
    initialCount: Math.max(targetKeywords.length, Number(value?.initialCount) || 0),
    completedBatches: Math.max(0, Number(value?.completedBatches) || 0),
    refreshedCompletedCount: Math.max(0, Number(value?.refreshedCompletedCount) || 0),
    currentStage: EVIDENCE_STAGES.has(value?.currentStage) ? value.currentStage : '',
    targetKeywords,
  }
}

export function evidenceRefreshCheckpoint({
  active = false,
  initialCount = 0,
  remainingCount = 0,
  refreshedCompletedCount = 0,
  externalWorkActive = false,
  threshold = 50,
} = {}) {
  const initial = Math.max(0, Math.floor(Number(initialCount) || 0))
  const remaining = Math.max(0, Math.floor(Number(remainingCount) || 0))
  const completedCount = Math.max(0, initial - remaining)
  const refreshedCount = Math.min(
    completedCount,
    Math.max(0, Math.floor(Number(refreshedCompletedCount) || 0)),
  )
  const refreshThreshold = Math.max(1, Math.floor(Number(threshold) || 50))
  const shouldRefresh = active === true
    && externalWorkActive !== true
    && remaining > 0
    && completedCount - refreshedCount >= refreshThreshold
  return {
    shouldRefresh,
    completedCount,
    refreshedCompletedCount: shouldRefresh ? completedCount : refreshedCount,
  }
}

export function restorePendingEvidenceAutomation({
  saved,
  winningNicheAutomation,
  marketplaceInsightPlan,
} = {}) {
  const restored = normalizePendingEvidenceAutomation(saved)
  if (restored.active || winningNicheAutomation?.status !== 'running') return restored

  const retryableQueries = uniqueKeywords(
    marketplaceInsightPlan?.items
      ?.filter((item) => RETRYABLE_MARKETPLACE_STATUSES.has(item?.status))
      .map((item) => item.query),
  )
  const queuedKeywords = uniqueKeywords(winningNicheAutomation?.queuedKeywords)
  const targetKeywords = retryableQueries.length > 0 ? retryableQueries : queuedKeywords
  if (targetKeywords.length === 0) return restored

  return normalizePendingEvidenceAutomation({
    active: true,
    initialCount: targetKeywords.length,
    currentStage: retryableQueries.length > 0 ? 'pending-etsy' : '',
    targetKeywords,
  })
}

export function restoreInterruptedMarketplaceInsightPlan(plan) {
  if (!plan || !Array.isArray(plan.items)) return plan ?? null
  return {
    ...plan,
    items: plan.items.map((item) => item?.status === 'opened'
      ? {
          ...item,
          status: 'error',
          error: 'ブラウザ終了により前回の取得が中断されました。自動再試行します。',
        }
      : item),
  }
}

export function gateMarketplaceInsightPlanForDispatch(plan, options = {}) {
  if (!plan || !Array.isArray(plan.items)) return plan ?? null
  const eventId = String(plan.eventId ?? options.eventId ?? '').trim()
  const categoryId = String(plan.categoryId ?? options.categoryId ?? '').trim()

  return {
    ...plan,
    items: plan.items.map((item) => {
      const queryEligibility = classifyMarketplaceBuyerQuery(item?.query, {
        eventId: String(item?.eventId ?? eventId).trim(),
        categoryId: String(item?.categoryId ?? categoryId).trim(),
        excludedRiskTerms: options.excludedRiskTerms,
      })
      const dispatchable = item?.status === 'planned'
        || item?.status === 'opened'
        || (item?.status === 'error' && !item?.terminalError)
      if (queryEligibility.eligible || !dispatchable) {
        return { ...item, queryEligibility }
      }
      return {
        ...item,
        status: 'skipped',
        terminalError: true,
        error: '',
        exclusionReason: queryEligibility.reason,
        queryEligibility,
      }
    }),
  }
}

export function createMarketplaceRetryState({
  query,
  attempt,
  delayMs,
  nowMs = Date.now(),
} = {}) {
  const normalizedQuery = normalizeKeyword(query)
  const normalizedAttempt = Math.max(1, Math.floor(Number(attempt) || 1))
  const normalizedDelay = Math.max(0, Number(delayMs) || 0)
  if (!normalizedQuery) return { active: false, query: '', attempt: 0, retryAt: '' }
  return {
    active: true,
    query: normalizedQuery,
    attempt: normalizedAttempt,
    retryAt: new Date(nowMs + normalizedDelay).toISOString(),
  }
}

export function normalizeMarketplaceRetryState(value = {}) {
  const query = normalizeKeyword(value?.query)
  const retryTimestamp = Date.parse(value?.retryAt)
  const active = value?.active === true
    && Boolean(query)
    && Number.isFinite(retryTimestamp)
    && Number(value?.attempt) > 0
  return {
    active,
    query: active ? query : '',
    attempt: active ? Math.max(1, Math.floor(Number(value.attempt))) : 0,
    retryAt: active ? new Date(retryTimestamp).toISOString() : '',
  }
}

export function marketplaceRetryDelay(value, nowMs = Date.now()) {
  const retry = normalizeMarketplaceRetryState(value)
  if (!retry.active) return 0
  return Math.max(0, Date.parse(retry.retryAt) - nowMs)
}

export function shouldAutoResumeEvidenceAutomation({
  winningNicheAutomation,
  pendingEvidenceAutomation,
} = {}) {
  return winningNicheAutomation?.status === 'running'
    && pendingEvidenceAutomation?.active === true
    && Array.isArray(pendingEvidenceAutomation.targetKeywords)
    && pendingEvidenceAutomation.targetKeywords.length > 0
}

export function shouldAutoResumeReloadCheckpoint({
  exploration,
  pendingEvidenceAutomation,
} = {}) {
  return exploration?.status === 'paused'
    && exploration?.pauseReason === 'reload-required'
    && pendingEvidenceAutomation?.active === true
    && Array.isArray(pendingEvidenceAutomation.targetKeywords)
    && pendingEvidenceAutomation.targetKeywords.length > 0
}
