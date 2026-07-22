import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bindResearchStageTabs,
  createResearchConsoleUi,
  deriveErankCaptureUiState,
  deriveResearchHeaderState,
  deriveResearchStageStates,
  filterResearchQueueRows,
  renderHtmlIfChanged,
  renderResearchStageView,
  restoreResearchConsoleUiFromStorage,
  selectResearchQueueFilter,
  selectResearchStage,
} from '../src/research-console-ui.js'

class FakeButton {
  constructor(stage) {
    this.dataset = { researchStage: stage }
    this.attributes = new Map()
    this.status = { textContent: '' }
  }

  querySelector(selector) {
    return selector === 'small' ? this.status : null
  }

  setAttribute(name, value) {
    this.attributes.set(name, value)
  }

  closest(selector) {
    return selector === '[data-research-stage]' ? this : null
  }
}

class FakeTabs {
  constructor(stages) {
    this.buttons = stages.map((stage) => new FakeButton(stage))
    this.clickHandler = null
  }

  querySelectorAll(selector) {
    return selector === '[data-research-stage]' ? this.buttons : []
  }

  addEventListener(type, handler) {
    if (type === 'click') this.clickHandler = handler
  }

  click(stage) {
    this.clickHandler({ target: this.buttons.find((button) => button.dataset.researchStage === stage) })
  }
}

function createResearchConsoleDom() {
  const stages = ['conditions', 'candidates', 'erank', 'etsy', 'results']
  return {
    consoleElement: { dataset: {} },
    tabContainer: new FakeTabs(stages),
    panels: stages.map((stage) => ({ dataset: { researchPanel: stage }, hidden: false })),
  }
}

test('restores only known stage and queue values', () => {
  assert.deepEqual(createResearchConsoleUi({ activeStage: 'etsy', queueFilter: 'failed' }), {
    activeStage: 'etsy',
    queueFilter: 'failed',
    selectedKeyword: '',
  })
  assert.equal(createResearchConsoleUi({ activeStage: 'unknown' }).activeStage, 'conditions')
  assert.equal(createResearchConsoleUi({ queueFilter: 'unknown' }).queueFilter, 'all')
})

test('ignores an invalid research stage selection', () => {
  const initial = createResearchConsoleUi({ activeStage: 'erank', queueFilter: 'pending' })
  assert.deepEqual(selectResearchStage(initial, 'unknown'), initial)
})

test('ignores an invalid queue filter selection', () => {
  const initial = createResearchConsoleUi({ activeStage: 'etsy', queueFilter: 'failed' })
  assert.deepEqual(selectResearchQueueFilter(initial, 'unknown'), initial)
})

test('selects stage and queue filter without mutating input', () => {
  const initial = createResearchConsoleUi()
  const selected = selectResearchQueueFilter(selectResearchStage(initial, 'erank'), 'completed')
  assert.equal(initial.activeStage, 'conditions')
  assert.deepEqual(selected, { activeStage: 'erank', queueFilter: 'completed', selectedKeyword: '' })
})

test('filters queue rows by normalized status', () => {
  const rows = [
    { keyword: 'a', status: 'unsearched' },
    { keyword: 'b', status: 'completed' },
    { keyword: 'c', status: 'failed' },
    { keyword: 'd', status: 'partial' },
  ]

  assert.deepEqual(filterResearchQueueRows(rows, 'failed').map((row) => row.keyword), ['c'])
  assert.deepEqual(filterResearchQueueRows(rows, 'pending').map((row) => row.keyword), ['a', 'd'])
  assert.equal(filterResearchQueueRows(rows, 'all').length, 4)
})

test('derives complete eRank UI status only when every expected metric is present', () => {
  const complete = deriveErankCaptureUiState({
    erankSearchVolume: 0,
    erankClicks: 0,
    erankCompetition: 0,
    erankKeywordDifficulty: 0,
    erankCheckedAt: '2026-07-22T10:00:00.000Z',
  })
  const partial = deriveErankCaptureUiState({
    erankSearchVolume: 320,
    erankCheckedAt: '2026-07-22T10:00:00.000Z',
  })

  assert.deepEqual(complete, {
    status: 'completed',
    missingColumns: [],
    nextDestination: 'Etsy Marketplace Insights',
  })
  assert.equal(partial.status, 'partial')
  assert.deepEqual(partial.missingColumns, ['Clicks', 'Competition', 'KD'])
  assert.equal(partial.nextDestination, 'eRank Keyword Tool')
})

test('distinguishes unsearched, active, and failed eRank capture states', () => {
  assert.equal(deriveErankCaptureUiState({}).status, 'unsearched')
  assert.equal(deriveErankCaptureUiState({}, { active: true }).status, 'active')
  assert.equal(deriveErankCaptureUiState({ erankAttemptedAt: '2026-07-22T10:00:00.000Z' }).status, 'failed')
  assert.deepEqual(
    deriveErankCaptureUiState({ erankAttemptedAt: '2026-07-22T10:00:00.000Z' }).missingColumns,
    ['Search', 'Clicks', 'Competition', 'KD'],
  )
})

test('does not rebuild unchanged rail HTML but refreshes changed visible content', () => {
  let assignments = 0
  const element = {
    value: '',
    set innerHTML(value) {
      assignments += 1
      this.value = value
    },
    get innerHTML() {
      return this.value
    },
  }

  assert.equal(renderHtmlIfChanged(element, '<button>pending</button>'), true)
  assert.equal(renderHtmlIfChanged(element, '<button>pending</button>'), false)
  assert.equal(assignments, 1, 'an unchanged extension poll must not rebuild the rail')
  assert.equal(renderHtmlIfChanged(element, '<button>active</button>'), true)
  assert.equal(assignments, 2, 'a changed active row must refresh')
})

test('derives bridge-ready and active extension header states', () => {
  const bridgeReady = deriveResearchHeaderState({
    condition: 'Tシャツ / ハロウィン / 2026',
    connected: true,
  })
  assert.equal(bridgeReady.connection, '接続済み')
  assert.equal(bridgeReady.activity, '待機中')
  assert.equal(bridgeReady.canStop, false)
  assert.equal(bridgeReady.stopReason, '停止できる調査はありません')

  const active = deriveResearchHeaderState({
    condition: 'Tシャツ / ハロウィン / 2026',
    connected: true,
    extensionState: { active: true, mode: 'erank', currentKeyword: 'ghost shirt' },
  })
  assert.equal(active.activity, 'eRank / ghost shirt')
  assert.equal(active.canStop, true)
  assert.equal(active.stopKind, 'extension')
  assert.match(active.stopReason, /eRank/)
})

test('uses the Etsy automation as the active global header service', () => {
  const header = deriveResearchHeaderState({
    connected: true,
    extensionState: { active: true, mode: 'everbee', currentKeyword: 'older keyword' },
    marketplaceActive: true,
    marketplaceKeyword: 'current etsy keyword',
  })

  assert.equal(header.activity, 'Etsy公式 / current etsy keyword')
  assert.equal(header.stopKind, 'marketplace')
  assert.equal(header.canStop, true)
})

test('clicking a research stage tab shows only its panel', () => {
  const dom = createResearchConsoleDom()
  const stages = deriveResearchStageStates()
  let ui = createResearchConsoleUi()
  const render = () => renderResearchStageView({
    ...dom,
    stages,
    activeStage: ui.activeStage,
  })

  bindResearchStageTabs(dom.tabContainer, (stageId) => {
    ui = selectResearchStage(ui, stageId)
    render()
  })
  render()
  dom.tabContainer.click('etsy')

  assert.equal(ui.activeStage, 'etsy')
  assert.equal(dom.consoleElement.dataset.activeStage, 'etsy')
  assert.equal(dom.tabContainer.buttons.find((button) => button.dataset.researchStage === 'etsy').attributes.get('aria-selected'), 'true')
  assert.deepEqual(dom.panels.map((panel) => panel.hidden), [true, true, true, false, true])
})

test('content updates cannot reveal a non-active research panel', () => {
  const dom = createResearchConsoleDom()
  renderResearchStageView({
    ...dom,
    stages: deriveResearchStageStates(),
    activeStage: 'candidates',
  })
  const etsyPanel = dom.panels.find((panel) => panel.dataset.researchPanel === 'etsy')

  etsyPanel.innerHTML = '<p>extension update</p>'

  assert.equal(etsyPanel.hidden, true)
  assert.equal(dom.panels.find((panel) => panel.dataset.researchPanel === 'candidates').hidden, false)
})

test('restores saved active stage and applies it to the initial view', () => {
  const dom = createResearchConsoleDom()
  const storage = {
    getItem(key) {
      assert.equal(key, 'etsy-mirai-market-finder-state-v1')
      return JSON.stringify({
        version: 1,
        marketState: { consoleUi: { activeStage: 'results', queueFilter: 'failed' } },
      })
    },
  }
  const ui = restoreResearchConsoleUiFromStorage(storage, 'etsy-mirai-market-finder-state-v1', 1)

  renderResearchStageView({
    ...dom,
    stages: deriveResearchStageStates(),
    activeStage: ui.activeStage,
  })

  assert.equal(ui.activeStage, 'results')
  assert.equal(ui.queueFilter, 'failed')
  assert.deepEqual(dom.panels.map((panel) => panel.hidden), [true, true, true, true, false])
})

test('derives progress, review, complete, and available states', () => {
  const stages = deriveResearchStageStates({
    candidateCount: 20,
    readyCandidateCount: 14,
    erankResultCount: 16,
    erankFailureCount: 3,
    erankPendingCount: 0,
    etsyEligibleCount: 14,
    etsyCompletedCount: 0,
    etsyPendingCount: 14,
    everbeeResultCount: 0,
    activeService: 'etsy',
  })
  assert.equal(stages.find((item) => item.id === 'conditions').status, 'complete')
  assert.equal(stages.find((item) => item.id === 'erank').status, 'review')
  assert.equal(stages.find((item) => item.id === 'etsy').status, 'progress')
  assert.equal(stages.find((item) => item.id === 'results').status, 'locked')
})
