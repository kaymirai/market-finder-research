export const RESEARCH_STAGE_IDS = Object.freeze([
  'conditions',
  'candidates',
  'erank',
  'etsy',
  'results',
])

const QUEUE_FILTERS = new Set(['all', 'pending', 'active', 'completed', 'failed', 'hold'])

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
