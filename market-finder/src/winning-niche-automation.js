import {
  detectRiskTerms,
  normalizePhrase,
} from '../../shared/market-keyword-engine/index.js'
import {
  NICHE_AXIS_ORDER,
  NICHE_TAXONOMY,
  taxonomyTerms,
} from './niche-taxonomy.js'

const VALID_STATUSES = new Set([
  'idle',
  'running',
  'paused',
  'winner-found',
  'stopped',
  'exhausted',
])

function timestamp(value = '') {
  const supplied = String(value ?? '').trim()
  return supplied || new Date().toISOString()
}

function normalizedList(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(normalizePhrase).filter(Boolean))]
}

function normalizedAxisOrder(value) {
  const source = Array.isArray(value) && value.length > 0 ? value : NICHE_AXIS_ORDER
  return [...new Set(source.map((item) => String(item ?? '').trim()).filter(Boolean))]
}

function positiveInteger(value, fallback = 1) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : fallback
}

function axisTerms(axisId, termsByAxis) {
  if (termsByAxis && Object.hasOwn(termsByAxis, axisId)) {
    return normalizedList(termsByAxis[axisId])
  }
  return taxonomyTerms(axisId)
}

function axisLabel(axisId) {
  return NICHE_TAXONOMY[axisId]?.label ?? axisId
}

function nextAxisInOrder(currentAxis, axisOrder) {
  const index = axisOrder.indexOf(currentAxis)
  if (index < 0) return axisOrder[0] ?? ''
  return axisOrder[(index + 1) % axisOrder.length] ?? ''
}

function buyerContextPhrase(term) {
  if (term === 'gift for') return 'gift for mom'
  if (term === 'gift from') return 'gift from daughter'
  return term
}

function candidateKeyword(automation, axisId, term) {
  const axisPhrase = axisId === 'buyer-context' ? buyerContextPhrase(term) : term
  return normalizePhrase(`${automation.eventTerm} ${axisPhrase} ${automation.productTerm}`)
}

export function createWinningNicheAutomation(saved = {}) {
  const status = VALID_STATUSES.has(saved?.status) ? saved.status : 'idle'
  return {
    status,
    eventId: String(saved?.eventId ?? '').trim(),
    eventTerm: normalizePhrase(saved?.eventTerm),
    categoryId: String(saved?.categoryId ?? '').trim(),
    productTerm: normalizePhrase(saved?.productTerm),
    round: Math.max(0, Number(saved?.round) || 0),
    currentAxis: String(saved?.currentAxis ?? '').trim(),
    nextAxis: String(saved?.nextAxis ?? '').trim(),
    researchedKeywords: normalizedList(saved?.researchedKeywords),
    queuedKeywords: normalizedList(saved?.queuedKeywords),
    excludedKeywords: normalizedList(saved?.excludedKeywords),
    winnerKeywords: normalizedList(saved?.winnerKeywords),
    cycleId: String(saved?.cycleId ?? '').trim(),
    targetWinnerCount: positiveInteger(saved?.targetWinnerCount, 1),
    completedAt: String(saved?.completedAt ?? '').trim(),
    pauseReason: String(saved?.pauseReason ?? '').trim(),
    startedAt: String(saved?.startedAt ?? '').trim(),
    updatedAt: String(saved?.updatedAt ?? '').trim(),
  }
}

export function startWinningNicheAutomation(state = {}, context = {}, now = '') {
  const restored = createWinningNicheAutomation(state)
  const eventId = String(context?.eventId ?? '').trim()
  const eventTerm = normalizePhrase(context?.eventTerm)
  const categoryId = String(context?.categoryId ?? '').trim()
  const productTerm = normalizePhrase(context?.productTerm)
  const contextChanged = Boolean(
    (restored.eventId && eventId && restored.eventId !== eventId)
    || (restored.categoryId && categoryId && restored.categoryId !== categoryId)
    || (restored.productTerm && productTerm && restored.productTerm !== productTerm)
  )
  const base = contextChanged ? createWinningNicheAutomation() : restored
  const updatedAt = timestamp(now)
  const targetWinnerCount = positiveInteger(
    context?.targetWinnerCount,
    base.targetWinnerCount,
  )
  const targetReached = base.winnerKeywords.length >= targetWinnerCount

  return {
    ...base,
    status: targetReached ? 'winner-found' : 'running',
    eventId: eventId || base.eventId,
    eventTerm: eventTerm || base.eventTerm,
    categoryId: categoryId || base.categoryId,
    productTerm: productTerm || base.productTerm,
    cycleId: base.cycleId || `cycle-${updatedAt}`,
    targetWinnerCount,
    completedAt: targetReached ? base.completedAt || updatedAt : '',
    pauseReason: '',
    startedAt: base.startedAt || updatedAt,
    updatedAt,
  }
}

export function buildNextWinningNicheBatch(options = {}) {
  const automation = createWinningNicheAutomation(options.automation)
  if (automation.status !== 'running') {
    return { automation, candidates: [], reason: `status-${automation.status}` }
  }
  if (!automation.eventTerm || !automation.productTerm) {
    return {
      automation: pauseWinningNicheAutomation(automation, 'イベントと商品種別を選んでください。', options.now),
      candidates: [],
      reason: 'missing-context',
    }
  }

  const order = normalizedAxisOrder(options.axisOrder)
  const batchSize = Math.max(1, Math.min(Number(options.batchSize) || 8, 50))
  const firstAxis = automation.nextAxis
    || (automation.currentAxis ? nextAxisInOrder(automation.currentAxis, order) : order[0])
  const firstIndex = Math.max(0, order.indexOf(firstAxis))
  const used = new Set([
    ...automation.researchedKeywords,
    ...automation.queuedKeywords,
    ...automation.excludedKeywords,
  ])
  const excludedKeywords = [...automation.excludedKeywords]
  const customRiskTerms = Array.isArray(options.customRiskTerms) ? options.customRiskTerms : []

  for (let offset = 0; offset < order.length; offset += 1) {
    const axisId = order[(firstIndex + offset) % order.length]
    const candidates = []

    for (const term of axisTerms(axisId, options.termsByAxis)) {
      const keyword = candidateKeyword(automation, axisId, term)
      if (!keyword || used.has(keyword)) continue
      if (detectRiskTerms(keyword, customRiskTerms).length > 0) {
        used.add(keyword)
        excludedKeywords.push(keyword)
        continue
      }

      used.add(keyword)
      candidates.push({
        keyword,
        axisId,
        axisLabel: axisLabel(axisId),
        axisTerm: term,
        eventId: automation.eventId,
        source: 'curated-taxonomy',
        depth: 2,
      })
      if (candidates.length >= batchSize) break
    }

    if (candidates.length > 0) {
      const updatedAt = timestamp(options.now)
      const nextAxis = nextAxisInOrder(axisId, order)
      return {
        automation: {
          ...automation,
          status: 'running',
          round: automation.round + 1,
          currentAxis: axisId,
          nextAxis,
          queuedKeywords: normalizedList([
            ...automation.queuedKeywords,
            ...candidates.map((candidate) => candidate.keyword),
          ]),
          excludedKeywords: normalizedList(excludedKeywords),
          pauseReason: '',
          updatedAt,
        },
        candidates,
        reason: 'batch-ready',
      }
    }
  }

  return {
    automation: {
      ...automation,
      status: 'exhausted',
      excludedKeywords: normalizedList(excludedKeywords),
      queuedKeywords: [],
      pauseReason: '安全な未調査候補がありません。',
      updatedAt: timestamp(options.now),
    },
    candidates: [],
    reason: 'candidate-pool-exhausted',
  }
}

export function evaluateWinningNicheRows(state = {}, rows = [], now = '') {
  const automation = createWinningNicheAutomation(state)
  const winners = normalizedList(rows
    .filter((row) => {
      const grade = String(
        row?.opportunityLabel
        ?? row?.everbeeRow?.score?.opportunityLabel
        ?? '',
      ).trim().toUpperCase()
      return row?.evidenceState?.status === 'verified' && ['A', 'B'].includes(grade)
    })
    .map((row) => row.keyword))
  const researchedKeywords = normalizedList([
    ...automation.researchedKeywords,
    ...automation.queuedKeywords,
  ])
  const winnerKeywords = normalizedList([...automation.winnerKeywords, ...winners])
  const targetReached = winnerKeywords.length >= automation.targetWinnerCount
  const updatedAt = timestamp(now)

  return {
    ...automation,
    status: targetReached ? 'winner-found' : 'running',
    researchedKeywords,
    queuedKeywords: [],
    winnerKeywords,
    completedAt: targetReached ? automation.completedAt || updatedAt : '',
    pauseReason: '',
    updatedAt,
  }
}

export function resetWinningNicheCycle(state = {}, now = '') {
  const automation = createWinningNicheAutomation(state)
  const updatedAt = timestamp(now)
  return {
    ...automation,
    status: 'idle',
    round: 0,
    currentAxis: '',
    nextAxis: '',
    queuedKeywords: [],
    winnerKeywords: [],
    cycleId: `cycle-${updatedAt}`,
    completedAt: '',
    pauseReason: '',
    startedAt: '',
    updatedAt,
  }
}

export function pauseWinningNicheAutomation(state = {}, reason = '', now = '') {
  const automation = createWinningNicheAutomation(state)
  if (automation.status === 'winner-found') return automation
  return {
    ...automation,
    status: 'paused',
    pauseReason: String(reason ?? '').trim() || '外部確認を再開できる状態になるまで待機します。',
    updatedAt: timestamp(now),
  }
}

export function resumeWinningNicheAutomation(state = {}, now = '') {
  const automation = createWinningNicheAutomation(state)
  if (automation.status === 'idle') return automation
  return {
    ...automation,
    status: 'running',
    pauseReason: '',
    updatedAt: timestamp(now),
  }
}

export function stopWinningNicheAutomation(state = {}, now = '') {
  const automation = createWinningNicheAutomation(state)
  return {
    ...automation,
    status: 'stopped',
    pauseReason: '',
    updatedAt: timestamp(now),
  }
}
