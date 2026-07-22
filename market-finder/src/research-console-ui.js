export const RESEARCH_STAGE_IDS = Object.freeze([
  'conditions',
  'candidates',
  'erank',
  'etsy',
  'results',
])

const QUEUE_FILTERS = new Set(['all', 'pending', 'active', 'completed', 'failed', 'hold'])
const ERANK_EXPECTED_METRICS = Object.freeze([
  ['erankSearchVolume', 'Search'],
  ['erankClicks', 'Clicks'],
  ['erankCompetition', 'Competition'],
  ['erankKeywordDifficulty', 'KD'],
])
const renderedHtmlByElement = new WeakMap()

function normalizeRenderSignatureValue(value) {
  if (value instanceof Set) {
    return [...value]
      .map(normalizeRenderSignatureValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  }
  if (Array.isArray(value)) return value.map(normalizeRenderSignatureValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeRenderSignatureValue(value[key])]),
    )
  }
  return value
}

export function stableRenderSignature(value) {
  return JSON.stringify(normalizeRenderSignatureValue(value)) ?? ''
}

export function createRenderSignatureTracker() {
  let previousSignature
  return (signature, options = {}) => {
    const nextSignature = String(signature ?? '')
    if (!options.force && nextSignature === previousSignature) return false
    previousSignature = nextSignature
    return true
  }
}

function hasMetricValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

export function deriveErankCaptureUiState(row = {}, capture = {}) {
  const missingColumns = ERANK_EXPECTED_METRICS
    .filter(([key]) => !hasMetricValue(row[key]))
    .map(([, label]) => label)
  const presentCount = ERANK_EXPECTED_METRICS.length - missingColumns.length
  const attempted = Boolean(row.erankAttemptedAt || row.erankCheckedAt || row.error)
  const declaredStatus = String(row.erankCaptureStatus ?? '').trim()
  const status = capture.active
    ? 'active'
    : declaredStatus === 'no-data'
      ? 'no-data'
    : presentCount === ERANK_EXPECTED_METRICS.length
      ? 'completed'
      : presentCount > 0
        ? 'partial'
        : attempted
          ? 'failed'
          : 'unsearched'

  return {
    status,
    missingColumns,
    nextDestination: status === 'completed'
      ? 'Etsy Marketplace Insights'
      : status === 'no-data'
        ? '別の語句を探索'
        : 'eRank Keyword Tool',
  }
}

export function renderHtmlIfChanged(element, html) {
  if (!element) return false
  const nextHtml = String(html ?? '')
  if (renderedHtmlByElement.get(element) === nextHtml) return false
  element.innerHTML = nextHtml
  renderedHtmlByElement.set(element, nextHtml)
  return true
}

export function deriveResearchHeaderState(input = {}) {
  const connected = Boolean(input.connected)
  const extensionActive = Boolean(input.extensionState?.active)
  const marketplaceActive = Boolean(input.marketplaceActive)
  const extensionMode = String(input.extensionState?.mode ?? '').toLowerCase()
  const extensionService = extensionMode.includes('erank') ? 'eRank' : 'EverBee'
  const service = marketplaceActive ? 'Etsy公式' : extensionActive ? extensionService : ''
  const keyword = marketplaceActive
    ? String(input.marketplaceKeyword ?? '').trim()
    : String(input.extensionState?.currentKeyword ?? '').trim()
  const canStop = marketplaceActive || extensionActive
  const stopKind = marketplaceActive ? 'marketplace' : extensionActive ? 'extension' : ''

  return {
    condition: String(input.condition ?? '').trim() || '条件未設定',
    connection: connected ? '接続済み' : '未接続',
    activity: service ? `${service} / ${keyword || '次のキーワードを準備中'}` : '待機中',
    canStop,
    stopKind,
    stopReason: marketplaceActive
      ? 'Etsy公式の自動確認を停止します'
      : extensionActive
        ? `${extensionService}調査を停止します`
        : '停止できる調査はありません',
  }
}

export function createResearchConsoleUi(saved = {}) {
  return {
    activeStage: RESEARCH_STAGE_IDS.includes(saved.activeStage) ? saved.activeStage : 'conditions',
    queueFilter: QUEUE_FILTERS.has(saved.queueFilter) ? saved.queueFilter : 'all',
    selectedKeyword: String(saved.selectedKeyword ?? ''),
  }
}

export function restoreResearchConsoleUiFromPayload(savedState = {}) {
  return createResearchConsoleUi(savedState?.consoleUi)
}

export function restoreResearchConsoleUiFromStorage(storage, persistenceKey, persistenceVersion, rawValue) {
  if (!storage?.getItem) return createResearchConsoleUi()

  try {
    const raw = rawValue ?? storage.getItem(persistenceKey)
    if (!raw) return createResearchConsoleUi()
    const parsed = JSON.parse(raw)
    if (parsed?.version !== persistenceVersion) return createResearchConsoleUi()
    return restoreResearchConsoleUiFromPayload(parsed.marketState)
  } catch {
    return createResearchConsoleUi()
  }
}

export function selectResearchStage(ui, activeStage) {
  if (!RESEARCH_STAGE_IDS.includes(activeStage)) return { ...ui }
  return { ...ui, activeStage, queueFilter: 'all' }
}

export function selectResearchQueueFilter(ui, queueFilter) {
  if (!QUEUE_FILTERS.has(queueFilter)) return { ...ui }
  return { ...ui, queueFilter }
}

export function filterResearchQueueRows(rows = [], filter = 'all') {
  const normalizedFilter = String(filter ?? 'all').trim().toLowerCase()
  if (normalizedFilter === 'all') return [...rows]
  if (normalizedFilter === 'pending') {
    return rows.filter((row) => ['pending', 'unsearched', 'partial'].includes(String(row?.status ?? '').trim().toLowerCase()))
  }
  return rows.filter((row) => String(row?.status ?? '').trim().toLowerCase() === normalizedFilter)
}

export function bindResearchStageTabs(tabContainer, onStageSelect) {
  if (!tabContainer?.addEventListener) return
  tabContainer.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-research-stage]')
    const stageId = button?.dataset?.researchStage
    if (stageId) onStageSelect(stageId)
  })
}

export function renderResearchStageView({ consoleElement, tabContainer, panels = [], stages = [], activeStage }) {
  if (!consoleElement || !tabContainer) return

  const stageById = new Map(stages.map((stage) => [stage.id, stage]))
  consoleElement.dataset.activeStage = activeStage
  tabContainer.querySelectorAll('[data-research-stage]').forEach((button) => {
    const stage = stageById.get(button.dataset.researchStage)
    const active = stage?.id === activeStage
    button.setAttribute('aria-selected', String(active))
    button.dataset.status = stage?.status ?? 'locked'
    const status = button.querySelector('small')
    if (status) status.textContent = stage?.count ? `${stage.count}件` : stage?.message ?? '未開始'
  })
  panels.forEach((panel) => {
    panel.hidden = panel.dataset.researchPanel !== activeStage
  })
}

function stage(id, label, status, count, message) {
  return { id, label, status, count: Number(count) || 0, message }
}

export function deriveResearchStageStates(metrics = {}) {
  const candidateCount = Number(metrics.candidateCount) || 0
  const readyCandidateCount = Number(metrics.readyCandidateCount) || 0
  const erankResultCount = Number(metrics.erankResultCount) || 0
  const erankFailureCount = Number(metrics.erankFailureCount) || 0
  const erankPendingCount = Number(metrics.erankPendingCount) || 0
  const etsyEligibleCount = Number(metrics.etsyEligibleCount) || 0
  const etsyCompletedCount = Number(metrics.etsyCompletedCount) || 0
  const etsyPendingCount = Number(metrics.etsyPendingCount) || 0
  const everbeeResultCount = Number(metrics.everbeeResultCount) || 0
  const activeService = String(metrics.activeService ?? '')

  return [
    stage('conditions', '条件', candidateCount > 0 ? 'complete' : 'available', candidateCount, candidateCount > 0 ? '候補作成済み' : '条件を入力'),
    stage('candidates', '候補', readyCandidateCount > 0 ? 'complete' : candidateCount > 0 ? 'review' : 'locked', readyCandidateCount, readyCandidateCount > 0 ? 'eRankへ送信可能' : '候補を確認'),
    stage('erank', 'eRank', activeService === 'erank' ? 'progress' : erankFailureCount > 0 || erankPendingCount > 0 ? 'review' : erankResultCount > 0 ? 'complete' : readyCandidateCount > 0 ? 'available' : 'locked', erankResultCount, erankFailureCount > 0 ? `${erankFailureCount}件の数値を要確認` : erankPendingCount > 0 ? `${erankPendingCount}件が未検索` : '需要を確認'),
    stage('etsy', 'Etsy公式', activeService === 'etsy' ? 'progress' : etsyCompletedCount > 0 && etsyPendingCount === 0 ? 'complete' : etsyCompletedCount > 0 ? 'review' : etsyEligibleCount > 0 ? 'available' : 'locked', etsyCompletedCount, etsyPendingCount > 0 ? `${etsyPendingCount}件が未完了` : etsyEligibleCount > 0 ? `${etsyEligibleCount}件を確認可能` : 'eRank候補待ち'),
    stage('results', '最終結果', activeService === 'everbee' ? 'progress' : everbeeResultCount > 0 ? 'complete' : ['erank', 'etsy'].includes(activeService) ? 'locked' : etsyCompletedCount > 0 || erankResultCount > 0 ? 'available' : 'locked', everbeeResultCount, everbeeResultCount > 0 ? '商品化候補を確認' : '売上確認待ち'),
  ]
}
