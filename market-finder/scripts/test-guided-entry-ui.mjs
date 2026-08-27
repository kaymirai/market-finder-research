import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { extensionResultsImportMode } from '../src/research-flow.js'
import { deriveErankCaptureUiState } from '../src/research-console-ui.js'
import { deriveAudienceUiStatus } from '../src/audience-selection-state.js'

const root = new URL('../', import.meta.url)
const [html, app, styles, extensionManifestText, readme] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/app.js', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8'),
  readFile(new URL('../etsy-chrome-extension/manifest.json', root), 'utf8'),
  readFile(new URL('README.md', root), 'utf8'),
])
const extensionManifest = JSON.parse(extensionManifestText)
const appLf = app.replace(/\r\n/g, '\n')

function position(id) {
  const index = html.indexOf(`id="${id}"`)
  assert.notEqual(index, -1, `${id} must exist`)
  return index
}

function attributePositions(attribute, value) {
  return [...html.matchAll(new RegExp(`${attribute}="${value}"`, 'g'))].map((match) => match.index)
}

function panelOpeningTag(stage) {
  const match = html.match(new RegExp(`<[^>]*data-research-panel="${stage}"[^>]*>`))
  assert.ok(match, `${stage} panel must exist`)
  return match[0]
}

test('provides one mission bar for setup running and result phases', () => {
  assert.match(html, /id="researchMissionBar"/)
  assert.match(html, /id="researchMissionTarget"/)
  assert.match(html, /id="researchMissionState"/)
  assert.match(html, /id="researchExperiencePrimaryAction"/)
  assert.match(html, /id="researchProgressView"/)
  assert.match(html, /id="researchProgressSteps"/)
  assert.match(app, /function renderResearchExperience\(/)
  assert.match(app, /document\.body\.dataset\.researchPhase/)
  assert.match(app, /deriveResearchExperienceUi/)
  assert.match(app, /bindResearchStageTabs\(elements\.researchStageTabs/)
})

test('explains beside the main action why it cannot run', () => {
  assert.match(html, /id="researchMissionActionReason"/)
  assert.match(app, /researchMissionActionReason: document\.querySelector\('#researchMissionActionReason'\)/)
  assert.match(app, /reason: blockedReason/)
  assert.match(app, /elements\.researchMissionActionReason\.textContent = renderedAction\.reason \|\| ''/)
  assert.match(app, /elements\.researchMissionActionReason\.hidden = !renderedAction\.reason/)
})
test('keeps the manually selected stage while research is incomplete', () => {
  assert.match(html, /class="research-progress-copy">\s*<small>現在の工程<\/small>/)
  const renderBody = app.match(/function renderResearchExperience\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(renderBody, /activeStage: state\.consoleUi\.activeStage/)
  assert.doesNotMatch(renderBody, /state\.consoleUi = selectResearchStage\(state\.consoleUi, ui\.stage\)/)
})
test('uses one set of five numbered workflow steps', () => {
  assert.doesNotMatch(html, /class="workflow-strip"/)
  for (let step = 1; step <= 5; step += 1) {
    assert.match(html, new RegExp(`class="section-kicker">${step} \\/ 5<`))
  }
})

test('renders the five-stage research console', () => {
  assert.match(html, /id="researchStageTabs"/)
  const stages = ['conditions', 'candidates', 'etsy', 'everbee', 'results']
  let previousStagePosition = -1
  let previousPanelPosition = -1

  for (const stage of stages) {
    const stagePositions = attributePositions('data-research-stage', stage)
    const panelPositions = attributePositions('data-research-panel', stage)

    assert.equal(stagePositions.length, 1, `${stage} stage tab must be unique`)
    assert.equal(panelPositions.length, 1, `${stage} panel must be unique`)
    assert.ok(stagePositions[0] > previousStagePosition, 'stage tabs must preserve workflow order')
    assert.ok(panelPositions[0] > previousPanelPosition, 'research panels must preserve workflow order')

    previousStagePosition = stagePositions[0]
    previousPanelPosition = panelPositions[0]
  }
  assert.match(html, /id="researchQueue"/)
  assert.match(html, /id="researchWorkspace"/)
  assert.match(html, /id="researchInspector"/)

  const consoleHtml = html.match(/<section id="researchConsole"[^>]*>([\s\S]*)<\/section>\s*<\/main>/)?.[1]
  assert.ok(consoleHtml, 'research console must contain the console structure')
  const workspaceHtml = consoleHtml.match(/<div id="researchWorkspace"[^>]*>([\s\S]*)<\/div>\s*<\/section>/)?.[1]
  assert.ok(workspaceHtml, 'research workspace must be inside the research console')
  for (const stage of stages) {
    assert.match(workspaceHtml, new RegExp(`data-research-panel="${stage}"`))
  }

  const quickStartPosition = html.indexOf('class="quick-start"')
  const simpleRunnerPosition = html.indexOf('class="simple-runner"')
  assert.notEqual(quickStartPosition, -1, 'quick-start must exist')
  assert.notEqual(simpleRunnerPosition, -1, 'simple-runner must exist')
  assert.ok(quickStartPosition < position('researchConsole'))
  assert.ok(simpleRunnerPosition < position('researchConsole'))
  assert.doesNotMatch(consoleHtml, /class="quick-start"/)
  assert.doesNotMatch(consoleHtml, /class="simple-runner"/)

  assert.match(
    html,
    /<aside id="researchInspector"[^>]*>[\s\S]*?<details class="advanced-research-input advanced-only">[\s\S]*?<aside class="panel research-panel">[\s\S]*?<\/aside>\s*<\/div>\s*<\/details>\s*<\/aside>/,
  )

  assert.doesNotMatch(panelOpeningTag('conditions'), /\shidden(?:\s|>|=)/)
  for (const stage of stages.slice(1)) {
    assert.match(panelOpeningTag(stage), /\shidden(?:\s|>|=)/)
  }

  for (const label of ['条件', '候補', 'Etsy公式', 'EverBee', '最終結果']) {
    assert.match(html, new RegExp(`<strong>${label}</strong>`))
  }
  assert.match(
    html,
    /data-research-panel="results"[\s\S]*?data-result-view="erank"[\s\S]*?id="candidateErankBtn"/,
  )
})

test('renders one global research status bar above quick start', () => {
  assert.ok(position('researchStatusBar') < position('researchConsole'))
  assert.ok(position('researchStatusBar') < html.indexOf('class="quick-start"'))
  for (const id of [
    'researchGlobalCondition',
    'researchGlobalConnection',
    'researchGlobalActivity',
    'researchGlobalStopBtn',
    'researchGlobalStopReason',
  ]) {
    assert.equal(html.match(new RegExp(`id="${id}"`, 'g'))?.length, 1)
  }
  assert.match(html, /id="researchGlobalStopBtn"[^>]*disabled[^>]*aria-describedby="researchGlobalStopReason"/)
})

test('renders queue rows and inspector details without starting research', () => {
  assert.match(app, /function researchQueueRows\(stageId = state\.consoleUi\.activeStage\)/)
  assert.match(app, /function renderResearchQueue\(\)/)
  assert.match(app, /function renderResearchInspector\(\)/)
  assert.match(app, /data-console-keyword=/)
  assert.match(app, /elements\.researchQueueList\.addEventListener\('click', \(event\) => \{[\s\S]{0,500}state\.consoleUi = \{ \.\.\.state\.consoleUi, selectedKeyword:/)
  assert.doesNotMatch(app, /elements\.researchQueueList\.addEventListener\('click', \(event\) => \{[\s\S]{0,800}(startMarketplaceInsight|runMarketplaceInsightAutomation|simpleStartErankResearch|simpleStartResearch)\(/)
})

test('keeps the EverBee queue populated and transitions planned keywords through runtime states', () => {
  const body = app.match(/function researchQueueRows\(stageId = state\.consoleUi\.activeStage\) \{([\s\S]*?)\r?\n\}\r?\n\r?\nfunction researchInspectorDisplay/)?.[1]
  assert.ok(body, 'researchQueueRows must be extractable')

  const createQueueRows = new Function(
    'state',
    'normalizePhrase',
    'salesCheckKeywords',
    'cleanKeywordList',
    'everbeeResultRows',
    'rowHasEverbeeInput',
    'findResearchRow',
    'isCurrentResearchRow',
    `return function researchQueueRows(stageId = state.consoleUi.activeStage) {${body}\n}`,
  )
  const state = {
    consoleUi: { activeStage: 'everbee' },
    extensionState: null,
  }
  const planned = ['ghost teacher shirt', 'retro librarian tee']
  let completed = []
  const normalize = (value) => String(value ?? '').trim().toLowerCase()
  const rows = createQueueRows(
    state,
    normalize,
    () => planned,
    (values) => [...new Set(values.map(normalize).filter(Boolean))],
    () => completed,
    (row) => Number(row?.topMonthlySales) > 0,
    () => null,
    () => true,
  )

  assert.deepEqual(
    rows('everbee').map(({ keyword, status }) => ({ keyword, status })),
    [
      { keyword: 'ghost teacher shirt', status: 'pending' },
      { keyword: 'retro librarian tee', status: 'pending' },
    ],
  )

  state.extensionState = {
    active: true,
    mode: 'everbee',
    currentKeyword: 'retro librarian tee',
    results: [],
    error: '',
  }
  assert.deepEqual(
    rows('everbee').map(({ keyword, status }) => ({ keyword, status })),
    [
      { keyword: 'ghost teacher shirt', status: 'pending' },
      { keyword: 'retro librarian tee', status: 'active' },
    ],
  )

  completed = [
    { score: { normalized: { keyword: 'ghost teacher shirt' }, score: 82 } },
    { score: { normalized: { keyword: 'book club sweatshirt' }, score: 74 } },
  ]
  state.extensionState = {
    active: false,
    mode: 'everbee',
    currentKeyword: '',
    results: [
      { keyword: 'ghost teacher shirt', topMonthlySales: 12, error: '' },
      { keyword: 'retro librarian tee', topMonthlySales: '', error: 'EverBee timeout' },
    ],
    error: 'EverBee timeout',
  }
  assert.deepEqual(
    rows('everbee').map(({ keyword, status }) => ({ keyword, status })),
    [
      { keyword: 'ghost teacher shirt', status: 'completed' },
      { keyword: 'retro librarian tee', status: 'failed' },
      { keyword: 'book club sweatshirt', status: 'completed' },
    ],
  )
})

test('normalizes eRank queue rows so completed results suppress duplicate capture states', () => {
  assert.match(app, /const completedKeys = new Set\(completed\.map\(\(row\) => normalizePhrase\(row\.keyword\)\)\)/)
  assert.match(app, /!completedKeys\.has\(normalizePhrase\(row\.keyword\)\)/)
})

test('executes eRank capture UI states from extension progress without changing research rows', () => {
  const body = app.match(/function erankCaptureStateRows\(\) \{([\s\S]*?)\r?\n\}\r?\n\r?\nfunction friendlyErankCaptureError/)?.[1]
  assert.ok(body, 'eRank capture state function must be extractable')
  const createCaptureRows = new Function(
    'state',
    'normalizePhrase',
    'deriveErankCaptureUiState',
    'findResearchRow',
    `return function erankCaptureStateRows() {${body}\n}`,
  )
  const plan = [{ query: 'ghost shirt', queryKind: 'direct', sourceKeywords: ['ghost shirt'] }]
  const statusFor = ({ researchRow, extensionState }) => {
    const appState = {
      erankQueryPlan: plan,
      researchRows: researchRow ? [researchRow] : [],
      extensionState,
    }
    return createCaptureRows(
      appState,
      (value) => String(value ?? '').trim().toLowerCase(),
      deriveErankCaptureUiState,
      (keyword) => appState.researchRows.find(
        (row) => row.keyword === String(keyword ?? '').trim().toLowerCase(),
      ),
    )()[0]?.status ?? 'completed'
  }

  assert.equal(statusFor({}), 'unsearched')
  assert.equal(statusFor({ extensionState: { active: true, mode: 'erank', currentKeyword: 'ghost shirt' } }), 'active')
  assert.equal(statusFor({ researchRow: { keyword: 'ghost shirt', erankSearchVolume: 120 } }), 'partial')
  assert.equal(statusFor({ researchRow: { keyword: 'ghost shirt', erankAttemptedAt: '2026-07-22T10:00:00Z' } }), 'failed')
  assert.equal(statusFor({
    researchRow: {
      keyword: 'ghost shirt',
      erankSearchVolume: 0,
      erankClicks: 0,
      erankCompetition: 0,
      erankKeywordDifficulty: 0,
    },
  }), 'completed')
})

test('retries partial and failed eRank captures and clears stale errors after a checked result', () => {
  assert.match(app, /data-retry-erank-failures/)
  assert.match(app, /async function retryFailedErankResearch\(\)/)
  assert.match(app, /erankCaptureStateRows\(\)\.filter\(\(row\) => \['partial', 'failed'\]\.includes\(row\.status\)\)/)
  assert.match(app, /一部取得・失敗を再確認/)
  assert.match(app, /START_ERANK_RESEARCH[\s\S]{0,300}keywords/)
  assert.match(app, /elements\.erankResultsList\.addEventListener\('click'[\s\S]{0,300}retryFailedErankResearch\(\)/)
  assert.match(app, /error: incomingErankChecked \? String\(row\.error \?\? ''\)/)
})

test('keeps stage visibility ownership and rail render caching centralized', () => {
  assert.doesNotMatch(app, /marketplaceInsightPanel\.hidden/)
  assert.match(app, /renderHtmlIfChanged\(elements\.researchQueueFilters, filtersHtml\)/)
  assert.match(app, /renderHtmlIfChanged\(elements\.researchQueueList, listHtml\)/)
  assert.match(app, /renderHtmlIfChanged\(display,/)
})

test('keeps extension and action DOM contracts unique', () => {
  const allIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
  assert.equal(new Set(allIds).size, allIds.length, 'all DOM IDs must be unique')

  for (const id of [
    'trendAutoBtn', 'candidateErankBtn', 'marketplaceStartBtn',
    'erankToEverbeeBtn', 'resultsList', 'downloadStep4CsvBtn',
  ]) {
    assert.equal(html.match(new RegExp(`id="${id}"`, 'g'))?.length, 1)
  }
})

test('gives final results a dedicated export toolbar', () => {
  assert.match(html, /id="finalResultToolbar"/)
  assert.match(html, /id="copyFinalKeywordsBtn"[^>]*>キーワードをコピー<\/button>/)
  assert.match(html, /id="downloadStep4CsvBtn"[^>]*>未来デザイナー用CSV<\/button>/)
  assert.match(html, /id="downloadErankCsvBtn"[^>]*>参考用eRank CSV<\/button>/)
  assert.equal(html.match(/id="downloadStep4CsvBtn"/g)?.length, 1)
  assert.equal(html.match(/id="downloadErankCsvBtn"/g)?.length, 1)
})

test('uses one primary design handoff and keeps full exports secondary', () => {
  assert.match(app, /action: 'export-design',[\s\S]{0,220}A\/B全\$\{designPlan\.totalClusters\}テーマを未来デザイナー用CSV保存/)
  assert.match(app, /if \(action === 'export-design'\) \{\s*exportDesignShortlistCsv\(\)/)
  assert.match(html, /id="downloadStep4CsvBtn"[^>]*class="ghost-btn advanced-only"/)
  assert.match(html, /id="downloadErankCsvBtn"[^>]*class="ghost-btn advanced-only"/)
  assert.match(html, /id="downloadDesignShortlistBtn"[^>]*class="ghost-btn"/)
})

test('keeps the primary design handoff label in sync with shortlist pagination', () => {
  assert.match(app, /designShortlistMoreBtn\.addEventListener\('click',[\s\S]{0,220}renderDesignShortlist\(\)\s*renderResearchExperience\(\)/)
  assert.match(app, /designShortlistResetBtn\.addEventListener\('click',[\s\S]{0,220}renderDesignShortlist\(\)\s*renderResearchExperience\(\)/)
})

test('copies only A and B final keywords in their result order', () => {
  assert.match(app, /async function copyFinalKeywords\(\)/)
  assert.match(app, /deriveFinalKeywordDecision\(finalEvidenceRows\(\)\)\.recommendedKeywords/)
  assert.match(app, /\.map\(\(row\) => row\.keyword\)\s*\.join\('\\n'\)/)
  assert.match(app, /elements\.copyFinalKeywordsBtn\.addEventListener\('click', copyFinalKeywords\)/)
})

test('sets the results console state and hides non-result rails', () => {
  assert.match(app, /researchQueue:\s*document\.querySelector\('#researchQueue'\)/)
  assert.match(app, /elements\.researchConsole\.append\(elements\.researchInspector\)/)
  assert.match(app, /elements\.researchConsole\.dataset\.activeStage = state\.consoleUi\.activeStage/)
  assert.match(app, /elements\.researchQueue\.hidden = state\.consoleUi\.activeStage === 'results'/)
  assert.match(app, /elements\.researchInspector\.hidden = state\.consoleUi\.activeStage === 'results'/)
})

test('renders only the active research stage details', () => {
  assert.match(app, /function renderActiveResearchStage\(options = \{\}\)/)
  assert.match(app, /switch \(state\.consoleUi\.activeStage\)/)
  assert.match(app, /case 'conditions':[\s\S]{0,300}renderTrendScoutStatus\(\)[\s\S]{0,300}renderBroadHints\(\)[\s\S]{0,300}renderSearchSeedRows\(\)/)
  assert.match(app, /case 'candidates':[\s\S]{0,160}renderCandidates\(\)/)
  assert.match(app, /case 'everbee':[\s\S]{0,200}renderMarketplaceInsightPlan\(\)[\s\S]{0,200}renderResultsTable\(\)/)
  assert.match(app, /case 'etsy':[\s\S]{0,160}renderMarketplaceInsightPlan\(\)/)
  assert.match(app, /case 'results':[\s\S]{0,360}renderResultsTable\(\)[\s\S]{0,360}renderErankResults\(\)[\s\S]{0,360}renderCrossNicheDrilldown\(\)[\s\S]{0,360}renderSeoPlan\(\)/)
  assert.match(app, /function renderActiveResearchStage\(options = \{\}\)[\s\S]{0,2200}renderResearchQueue\(\)[\s\S]{0,300}renderResearchInspector\(\)/)
  assert.match(app, /function renderAll\(\) \{\s*renderGlobalResearchStatus\(\)\s*renderWinningNicheAutomation\(\)\s*renderNextResearchAction\(\)\s*renderResearchExperience\(\)\s*renderResearchStageTabs\(\)\s*renderActiveResearchStage\(\)\s*if \(shouldPersistWorkspaceRender\(/)
})

test('always states the next action and why a control cannot be pressed', () => {
  assert.match(html, /id="researchNextAction"/)
  assert.match(html, /id="researchNextActionText"/)
  assert.match(html, /id="verifyPendingEvidenceReason"/)
  assert.ok(position('researchNextAction') < position('researchStageTabs'))
  assert.match(app, /function nextResearchAction\(\)/)
  assert.match(app, /function extensionBlockReason\(\)/)
  // The reason must reach the control, not only the status line at the top of the page.
  assert.match(app, /elements\.verifyPendingEvidenceReason\.textContent = blocked/)
  // A version checked before the bridge has spoken is unknown, not wrong.
  assert.match(app, /if \(!state\.extensionVersion\) \{[\s\S]{0,240}await new Promise/)
  assert.match(styles, /\.action-block-reason/)
})

test('requires and documents the exact installed extension manifest version', () => {
  const requiredVersion = app.match(/const REQUIRED_EXTENSION_VERSION = '([^']+)'/)?.[1]

  assert.equal(extensionManifest.version, '1.44')
  assert.equal(requiredVersion, extensionManifest.version)
  assert.match(readme, /バージョンが `1\.44`/)
  assert.match(html, /拡張バージョン 1\.44/)
})

test('dispatches only the selected stage detail renderers', () => {
  const body = app.match(/function renderActiveResearchStage\([^)]*\) \{([\s\S]*?)\r?\n\}\r?\n\r?\nfunction renderAll\(\)/)?.[1]
  assert.ok(body, 'active stage renderer must be extractable')

  const createDispatcher = new Function(
    'state',
    'shouldRenderActiveWorkspace',
    'renderTrendScoutStatus',
    'renderBroadHints',
    'renderSearchSeedRows',
    'renderCandidates',
    'renderModifierEvidence',
    'renderMarketplaceStartAction',
    'renderErankResults',
    'renderMarketplaceInsightPlan',
    'renderResultsTable',
    'renderCrossNicheDrilldown',
    'renderSeoPlan',
    'renderResearchQueue',
    'renderResearchInspector',
    `return function renderActiveResearchStage(options = {}) {${body}\n}`,
  )
  const expected = {
    conditions: ['trend', 'broad', 'seeds', 'queue', 'inspector'],
    candidates: ['candidates', 'modifiers', 'etsy-start', 'queue', 'inspector'],
    everbee: ['etsy', 'results', 'queue', 'inspector'],
    etsy: ['etsy', 'queue', 'inspector'],
    results: ['results', 'erank', 'cross-niche', 'seo'],
  }

  for (const [stage, calls] of Object.entries(expected)) {
    const rendered = []
    const render = (name) => () => rendered.push(name)
    const dispatch = createDispatcher(
      { consoleUi: { activeStage: stage } },
      () => true,
      render('trend'),
      render('broad'),
      render('seeds'),
      render('candidates'),
      render('modifiers'),
      render('etsy-start'),
      render('erank'),
      render('etsy'),
      render('results'),
      render('cross-niche'),
      render('seo'),
      render('queue'),
      render('inspector'),
    )
    dispatch()
    assert.deepEqual(rendered, calls, `${stage} must not render another stage's detail view`)
  }
})

test('BRIDGE_READY refresh cannot reveal Etsy while another stage is active', () => {
  const body = app.match(/function handleExtensionMessage\(event\) \{([\s\S]*?)\r?\n\}\r?\n\r?\nfunction updateExtensionBadge/)?.[1]
  assert.ok(body, 'extension message handler must be extractable')
  const createHandler = new Function(
    'state',
    'window',
    'EXTENSION_SOURCE',
    'REQUIRED_EXTENSION_VERSION',
    'updateExtensionBadge',
    'renderMarketplaceInsightPlan',
    'scheduleExtensionStatePoll',
    'pendingExtensionRequests',
    'importExtensionResults',
    'renderExtensionStateUpdate',
    'friendlyExtensionError',
    `return function handleExtensionMessage(event) {${body}\n}`,
  )
  const windowObject = { clearTimeout() {} }
  const state = { consoleUi: { activeStage: 'candidates' }, extensionConnected: false }
  const panels = {
    candidates: { hidden: false },
    etsy: { hidden: true },
  }
  let refreshes = 0
  const handler = createHandler(
    state,
    windowObject,
    'market-finder-extension',
    '1.35',
    () => {},
    () => { panels.etsy.hidden = false },
    () => {},
    new Map(),
    () => {},
    () => {
      refreshes += 1
      panels.candidates.hidden = false
      panels.etsy.hidden = true
    },
    (error) => String(error),
  )

  handler({
    source: windowObject,
    data: { source: 'market-finder-extension', action: 'BRIDGE_READY', version: '1.35' },
  })

  assert.equal(state.extensionConnected, true)
  assert.equal(refreshes, 1)
  assert.equal(panels.etsy.hidden, true)
  assert.equal(panels.candidates.hidden, false)
})

test('routes extension state notifications through the active stage renderer', () => {
  const marketStateStart = app.indexOf("if (data.action === 'MARKET_STATE')")
  const marketStateEnd = app.indexOf('  if (!pending) return', marketStateStart)
  const pollStart = app.indexOf('async function pollExtensionState()')
  const pollSuccessStart = app.indexOf('  try {', pollStart)
  const pollSuccessEnd = app.indexOf('  } catch (error) {', pollSuccessStart)
  const importStart = app.indexOf('function importExtensionResults(extensionState)')
  const importEnd = app.indexOf('async function copyText', importStart)
  const marketStateHandler = app.slice(marketStateStart, marketStateEnd)
  const pollSuccessHandler = app.slice(pollSuccessStart, pollSuccessEnd)
  const importHandler = app.slice(importStart, importEnd)

  assert.notEqual(marketStateStart, -1, 'MARKET_STATE notification handler must exist')
  assert.notEqual(marketStateEnd, -1, 'MARKET_STATE notification handler must end before pending handling')
  assert.notEqual(pollSuccessStart, -1, 'extension polling success handler must exist')
  assert.notEqual(pollSuccessEnd, -1, 'extension polling success handler must end before error handling')
  assert.notEqual(importStart, -1, 'extension import handler must exist')
  assert.notEqual(importEnd, -1, 'extension import handler must end before copy helpers')
  assert.match(marketStateHandler, /importExtensionResults\(data\.state\)[\s\S]{0,200}renderExtensionStateUpdate\(\)/)
  assert.doesNotMatch(pollSuccessHandler, /importExtensionResults\(response\.state\)|renderExtensionStateUpdate\(\)/)
  assert.match(pollSuccessHandler, /shouldContinueExtensionPolling\([\s\S]{0,300}scheduleExtensionStatePoll\(response\.state\?\.active \? 2000 : 3000\)/)
  assert.doesNotMatch(importHandler, /renderAll\(\)/)
  assert.doesNotMatch(marketStateHandler, /renderMarketplaceInsightPlan\(\)/)
  assert.doesNotMatch(pollSuccessHandler, /renderMarketplaceInsightPlan\(\)/)
  assert.match(app, /case 'etsy':[\s\S]{0,160}renderMarketplaceInsightPlan\(\)/)
})

test('keeps active research running through a transient extension poll timeout', async () => {
  const pollBody = app.match(/async function pollExtensionState\(\) \{([\s\S]*?)\r?\n\}\r?\n\r?\nasync function startExtensionResearch/)?.[1]
  assert.ok(pollBody, 'extension poll caller must be extractable')

  const createPoll = new Function(
    'state',
    'requestExtension',
    'window',
    'friendlyExtensionError',
    'releaseRunningControls',
    'renderExtensionStateUpdate',
    'elements',
    'failProgress',
    'isExtensionResponseTimeout',
    'shouldContinueExtensionPolling',
    'scheduleExtensionStatePoll',
    'extensionPollInFlight',
    `return async function pollExtensionState() {${pollBody}\n}`,
  )
  const state = {
    extensionConnected: true,
    extensionState: {
      active: true,
      mode: 'erank',
      currentKeyword: 'dad birthday card',
      remaining: 19,
      results: [],
    },
    extensionPollFailureCount: 0,
    extensionWorkspaceActive: false,
    progress: { visible: true },
  }
  const scheduled = []
  let failed = 0
  const pollExtensionState = createPoll(
    state,
    async () => {
      throw new Error('Chrome拡張から応答がありません。拡張機能を再読み込みしてください。')
    },
    {
      setTimeout(callback, delay) {
        scheduled.push({ callback, delay })
      },
    },
    (error) => String(error?.message ?? error),
    () => {},
    () => {},
    { extensionStatus: { textContent: '' } },
    () => { failed += 1 },
    (error) => /Chrome拡張から応答がありません/.test(String(error?.message ?? error)),
    () => true,
    (delay) => scheduled.push({ delay }),
    false,
  )

  await pollExtensionState()

  assert.equal(state.extensionConnected, true)
  assert.equal(state.extensionPollFailureCount, 1)
  assert.equal(failed, 0)
  assert.equal(scheduled.length, 1)
  assert.equal(scheduled[0].delay, 3000)
})

test('active MARKET_STATE polls defer Workspace writes until the research batch finishes', async () => {
  const activeBody = app.match(/function renderActiveResearchStage\([^)]*\) \{([\s\S]*?)\r?\n\}\r?\n\r?\nfunction renderAll\(\)/)?.[1]
  const refreshBody = app.match(/function renderExtensionStateUpdate\(\) \{([\s\S]*?)\n\}/)?.[1]
  const handlerBody = app.match(/function handleExtensionMessage\(event\) \{([\s\S]*?)\r?\n\}\r?\n\r?\nfunction updateExtensionBadge/)?.[1]
  const pollBody = app.match(/async function pollExtensionState\(\) \{([\s\S]*?)\r?\n\}\r?\n\r?\nasync function startExtensionResearch/)?.[1]
  assert.ok(activeBody, 'active Workspace renderer must be extractable')
  assert.ok(refreshBody, 'extension refresh function must be extractable')
  assert.ok(handlerBody, 'extension response handler must be extractable')
  assert.ok(pollBody, 'extension poll caller must be extractable')

  const createActiveRenderer = new Function(
    'state',
    'shouldRenderActiveWorkspace',
    'renderTrendScoutStatus',
    'renderBroadHints',
    'renderSearchSeedRows',
    'renderCandidates',
    'renderErankResults',
    'renderMarketplaceInsightPlan',
    'renderResultsTable',
    'renderCrossNicheDrilldown',
    'renderSeoPlan',
    'renderResearchQueue',
    'renderResearchInspector',
    `return function renderActiveResearchStage(options) {${activeBody}\n}`,
  )
  const createRefresh = new Function(
    'state',
    'multiAngleSearchIsRunning',
    'renderExtensionState',
    'renderGlobalResearchStatus',
    'renderNextResearchAction',
    'renderResearchStageTabs',
    'renderActiveResearchStage',
    `return function renderExtensionStateUpdate() {${refreshBody}\n}`,
  )
  const createHandler = new Function(
    'state',
    'window',
    'EXTENSION_SOURCE',
    'updateExtensionBadge',
    'renderMarketplaceInsightPlan',
    'pollExtensionState',
    'pendingExtensionRequests',
    'importExtensionResults',
    'renderExtensionStateUpdate',
    'friendlyExtensionError',
    'isErankDailyLimitError',
    'resumePersistedEvidenceAutomationIfReady',
    'shouldRecoverMultiAngleQueue',
    'pauseMultiAngleSearch',
    'queueNextMultiAngleBatch',
    'scheduleExtensionStatePoll',
    `return function handleExtensionMessage(event) {${handlerBody}\n}`,
  )
  const createPoll = new Function(
    'state',
    'requestExtension',
    'importExtensionResults',
    'renderExtensionStateUpdate',
    'window',
    'friendlyExtensionError',
    'releaseRunningControls',
    'elements',
    'failProgress',
    'isExtensionResponseTimeout',
    'shouldContinueExtensionPolling',
    'scheduleExtensionStatePoll',
    'extensionPollInFlight',
    `return async function pollExtensionState() {${pollBody}\n}`,
  )

  const appState = {
    extensionConnected: true,
    extensionState: null,
    extensionWorkspaceActive: false,
    multiAngleRunning: true,
    extensionPollFailureCount: 0,
    progress: { failed: false, message: '' },
    consoleUi: { activeStage: 'results' },
    researchRows: [],
  }
  const pendingRequests = new Map()
  const workspaceWrites = []
  const chromeRenders = []
  let previousWorkspaceSignature = ''
  let activeRequestId = ''
  let requestSequence = 0
  const windowObject = {
    clearTimeout() {},
    setTimeout() {},
  }
  const shouldRenderActiveWorkspace = ({ force = false } = {}) => {
    const nextSignature = JSON.stringify({
      stage: appState.consoleUi.activeStage,
      extensionState: appState.extensionState,
      researchRows: appState.researchRows,
    })
    if (!force && nextSignature === previousWorkspaceSignature) return false
    previousWorkspaceSignature = nextSignature
    return true
  }
  const noRender = () => {}
  const renderActiveResearchStage = createActiveRenderer(
    appState,
    shouldRenderActiveWorkspace,
    noRender,
    noRender,
    noRender,
    noRender,
    () => workspaceWrites.push('erank'),
    noRender,
    noRender,
    noRender,
    noRender,
    noRender,
    noRender,
  )
  const renderExtensionStateUpdate = createRefresh(
    appState,
    () => appState.multiAngleRunning,
    () => chromeRenders.push('extension'),
    () => chromeRenders.push('header'),
    () => chromeRenders.push('next'),
    () => chromeRenders.push('tabs'),
    renderActiveResearchStage,
  )
  const importExtensionResults = (extensionState) => {
    appState.researchRows = extensionState.results.map((row) => ({ ...row }))
  }
  const requestExtension = (action) => {
    assert.equal(action, 'GET_MARKET_STATE')
    activeRequestId = `poll-${++requestSequence}`
    return new Promise((resolve, reject) => {
      pendingRequests.set(activeRequestId, { resolve, reject, timeoutId: activeRequestId })
    })
  }
  let pollExtensionState
  const handler = createHandler(
    appState,
    windowObject,
    'market-finder-extension',
    noRender,
    noRender,
    () => pollExtensionState(),
    pendingRequests,
    importExtensionResults,
    renderExtensionStateUpdate,
    (error) => String(error),
    (error) => /ERANK_DAILY_LOOKUP_LIMIT_REACHED/.test(String(error ?? '')),
    noRender,
    ({ extensionState, explorationStatus, pendingActive, marketplaceActive }) => (
      !extensionState?.active
      && explorationStatus === 'running'
      && !pendingActive
      && !marketplaceActive
    ),
    noRender,
    noRender,
    noRender,
  )
  pollExtensionState = createPoll(
    appState,
    requestExtension,
    importExtensionResults,
    renderExtensionStateUpdate,
    windowObject,
    (error) => String(error),
    noRender,
    { extensionStatus: { textContent: '' } },
    noRender,
    (error) => /Chrome拡張から応答がありません/.test(String(error?.message ?? error)),
    ({ extensionState }) => Boolean(extensionState?.active || appState.multiAngleRunning),
    noRender,
    false,
  )

  const deliverPoll = async (extensionState) => {
    const writesBefore = workspaceWrites.length
    const pendingPoll = pollExtensionState()
    await Promise.resolve()
    handler({
      source: windowObject,
      data: {
        source: 'market-finder-extension',
        action: 'MARKET_STATE',
        requestId: activeRequestId,
        ok: true,
        state: extensionState,
      },
    })
    await pendingPoll
    return workspaceWrites.length - writesBefore
  }

  const changedState = {
    active: true,
    mode: 'erank',
    currentKeyword: 'ghost shirt',
    remaining: 1,
    results: [{ keyword: 'ghost shirt', erankSearchVolume: 120 }],
  }
  assert.equal(await deliverPoll(changedState), 0, 'active progress must not rebuild the large Workspace')
  assert.equal(
    await deliverPoll(JSON.parse(JSON.stringify(changedState))),
    0,
    'an unchanged active response must not rebuild the Workspace',
  )
  assert.equal(
    await deliverPoll({ ...changedState, active: false, remaining: 0 }),
    0,
    'a completed automation batch must defer the heavy Workspace while the next batch is prepared',
  )
  assert.equal(
    await deliverPoll({ ...changedState, active: false, remaining: 0 }),
    0,
    'later idle heartbeats must not rebuild the completed Workspace again',
  )
  assert.equal(await deliverPoll(changedState), 0)
  appState.multiAngleRunning = false
  assert.equal(
    await deliverPoll({ ...changedState, active: false, remaining: 0 }),
    0,
    'a standalone completed batch must keep the heavy Workspace deferred until the user opens it',
  )
  assert.deepEqual(chromeRenders, [
    'extension', 'header', 'next', 'tabs',
    'extension', 'header',
    'extension', 'header', 'next', 'tabs',
    'extension', 'header', 'next', 'tabs',
    'extension', 'header', 'next', 'tabs',
    'extension', 'header', 'next', 'tabs',
  ])
})

test('keeps extension import notifications lightweight while a batch is active', () => {
  const importStart = app.indexOf('function importExtensionResults(extensionState)')
  const refreshStart = app.indexOf('function renderExtensionStateUpdate()')
  const copyStart = app.indexOf('async function copyText')
  const importOpen = app.indexOf('{', importStart)
  const importClose = app.lastIndexOf('}', refreshStart)
  const refreshOpen = app.indexOf('{', refreshStart)
  const refreshClose = app.lastIndexOf('}', copyStart)
  const importBody = app.slice(importOpen + 1, importClose)
  const refreshBody = app.slice(refreshOpen + 1, refreshClose)
  assert.notEqual(importStart, -1, 'extension import must be separated from notification rendering')
  assert.notEqual(refreshStart, -1, 'extension notifications must refresh the active stage')
  assert.notEqual(copyStart, -1, 'copy helper must follow the notification refresh helper')

  const createImport = new Function(
    'extensionResultsImportMode',
    'state',
    'extensionResearchRows',
    'sanitizeErankMetricLeak',
    'latestResearchCheckedAt',
    'addResearchRows',
    'ingestBroadSnippetsFromExtensionState',
    'salesCheckKeywords',
    'elements',
    'erankWinnerRows',
    'erankExploreRows',
    'setSimpleStatus',
    'syncCrossNicheWorkflow',
    'persistMarketFinderState',
    `return function importExtensionResults(extensionState) {${importBody}\n}`,
  )
  const createRefresh = new Function(
    'state',
    'renderExtensionState',
    'renderGlobalResearchStatus',
    'renderNextResearchAction',
    'renderResearchStageTabs',
    'renderActiveResearchStage',
    'multiAngleSearchIsRunning',
    `return function renderExtensionStateUpdate() {${refreshBody}\n}`,
  )
  const appState = {
    researchRows: [],
    acceptExtensionResults: false,
    restoredResearchSavedAt: '',
    restoredResultsAccepted: false,
    progress: { mode: 'idle' },
    extensionState: { active: true, results: [] },
    extensionWorkspaceActive: false,
  }
  let persistCount = 0
  const importResults = createImport(
    extensionResultsImportMode,
    appState,
    (extensionState) => extensionState.results,
    (row) => row,
    () => '',
    (rows) => appState.researchRows.push(...rows),
    () => {},
    () => [],
    { researchJobInput: { value: '' } },
    () => [],
    () => [],
    () => {},
    () => {},
    () => { persistCount += 1 },
  )
  const rendered = []
  const refresh = createRefresh(
    appState,
    () => rendered.push('extension'),
    () => rendered.push('header'),
    () => rendered.push('next'),
    () => rendered.push('tabs'),
    () => rendered.push('active'),
    () => false,
  )

  assert.equal(importResults(appState.extensionState), false)
  refresh()
  assert.deepEqual(rendered, ['extension', 'header', 'next', 'tabs'])

  rendered.length = 0
  appState.extensionState = {
    active: true,
    currentKeyword: 'ghost shirt',
    results: [{ keyword: 'ghost shirt' }],
  }
  assert.equal(importResults(appState.extensionState), false)
  refresh()
  assert.deepEqual(
    rendered,
    ['extension', 'header'],
    'subsequent active progress events must not rescore all results or rebuild stage tabs',
  )
  assert.equal(persistCount, 0)
})

test('closes a stale provider result modal before the next Etsy batch starts', () => {
  const runStart = app.indexOf('async function runMarketplaceInsightAutomation()')
  const runEnd = app.indexOf('\nfunction stopMarketplaceInsightAutomation', runStart)
  const runBody = app.slice(runStart, runEnd)

  assert.notEqual(runStart, -1)
  assert.notEqual(runEnd, -1)
  assert.match(runBody, /state\.progress\.visible[\s\S]{0,180}state\.progress\.(?:failed|stopped|completed)[\s\S]{0,180}closeProgressModal\(\)/)
})

test('an idle extension restarts unfinished evidence automation even when the active edge was missed', () => {
  const handlerBody = app.match(/function handleExtensionMessage\(event\) \{([\s\S]*?)\r?\n\}\r?\n\r?\nfunction updateExtensionBadge/)?.[1] ?? ''
  assert.match(
    handlerBody,
    /state\.pendingEvidenceAutomation\?\.active\s*&&\s*!data\.state\?\.active[\s\S]{0,420}schedulePendingEvidenceAutomation\(\)/,
  )
  assert.doesNotMatch(handlerBody, /state\.pendingEvidenceAutomation\?\.active\s*&&\s*wasActive/)
})

test('renders the two entry routes as one radio group', () => {
  assert.match(html, /<fieldset class="flow-choice-grid"/)
  assert.match(html, /id="flowAutoBtn"[^>]*type="radio"[^>]*name="flowChoice"[^>]*value="auto"/)
  assert.match(html, /id="flowCsvBtn"[^>]*type="radio"[^>]*name="flowChoice"[^>]*value="csv"/)
})

test('uses one exact label for automatic candidate discovery', () => {
  assert.match(html, /id="trendAutoBtn"[^>]*>候補を自動で探す<\/button>/)
  assert.doesNotMatch(html, /おすすめ自動探索をはじめる/)
  assert.doesNotMatch(app, /おすすめ自動探索をはじめる/)
})

test('lets the user edit and save the monthly listing research target', () => {
  const panel = html.match(/<section id="winningNicheAutomationPanel"[\s\S]*?<\/section>/)?.[0]
  assert.ok(panel, 'winning niche automation panel must exist')
  assert.match(panel, /月の出品目標[\s\S]*?id="monthlyListingTargetInput"[^>]*type="number"[^>]*min="1"[^>]*max="1000"[^>]*value="100"/)
  assert.match(panel, /月のリサーチ回数[\s\S]*?id="researchRunsPerMonthInput"[^>]*type="number"[^>]*min="1"[^>]*max="31"[^>]*value="4"/)
  assert.match(panel, /A\/B候補1件から作る商品数[\s\S]*?id="listingsPerWinnerInput"[^>]*type="number"[^>]*min="1"[^>]*max="50"[^>]*value="5"/)
  assert.match(panel, /id="listingResearchTargetSaveBtn"[^>]*>設定を保存して再計算<\/button>/)
  assert.match(panel, /id="listingResearchTargetErrors"/)
  assert.match(panel, /id="listingResearchTargetSummary"/)
  assert.match(panel, /id="listingResearchTargetProgress"/)
})

test('groups evidence-backed audience roles without fixed starter people', () => {
  assert.match(html, /誰向け・何向けの商品ですか/)
  assert.match(html, /id="audienceStatus"/)
  assert.match(html, /id="audienceRecipientSuggestions"/)
  assert.match(html, /id="audienceGiverSuggestions"/)
  assert.match(html, /id="audienceSubjectSuggestions"/)
  assert.match(html, /id="audienceReferenceSuggestions"/)
  assert.match(html, /id="audienceRefreshBtn"[^>]*>実績候補を更新<\/button>/)
  assert.doesNotMatch(html, /id="buyerIdentityShuffleBtn"/)
})

test('passes selected audience roles into candidate generation', () => {
  assert.match(app, /generateAudienceIntentCandidates\(\{[\s\S]*audienceSelections:\s*currentAudienceSelections\(\)/)
  assert.match(app, /analyzeAudienceEvidence\(marketplaceLearningRecords\(\),\s*currentAudienceContext\(\)/)
})

test('keeps a selected audience candidate in its exact active event and root context at runtime', () => {
  const candidateBody = appLf.match(/function candidateFromKeyword\(keyword, generatedMap, trendMetaByKeyword = new Map\(\)\) \{([\s\S]*?)\n\}\n\nfunction generateCandidates/)?.[1] ?? ''
  const selectedBody = appLf.match(/function selectedAudienceCandidate\(\) \{([\s\S]*?)\n\}\n\nfunction selectedAudienceRootKeyword/)?.[1] ?? ''
  assert.ok(candidateBody, 'candidate conversion must be executable')
  assert.ok(selectedBody, 'audience selection must be executable')

  const candidateFromKeyword = new Function(
    'normalizePhrase',
    'classifyMarketplaceBuyerQuery',
    'keywordClassificationOptions',
    'elements',
    'keywordClass',
    'detectRiskTerms',
    'activeResearchContext',
    'candidateProvenance',
    `return function candidateFromKeyword(keyword, generatedMap, trendMetaByKeyword = new Map()) {${candidateBody}\n}`,
  )(
    (value) => String(value ?? '').trim().toLowerCase(),
    () => ({ eligible: true }),
    () => ({}),
    { riskInput: { value: '' } },
    () => ({ action: 'candidate' }),
    () => [],
    () => ({
      eventId: 'mothers-day',
      categoryId: 'mug',
      event: { jpLabel: '母の日' },
      category: { label: 'Mug' },
    }),
    () => ({}),
  )
  const selectedAudienceCandidate = new Function(
    'state',
    'activeResearchContext',
    'normalizePhrase',
    `return function selectedAudienceCandidate() {${selectedBody}\n}`,
  )

  const generated = new Map([['teacher mug', {
    keyword: 'teacher mug',
    eventId: '',
    categoryId: 'mug',
    audienceContextKey: 'mug::mothers day::teacher',
  }]])
  const candidate = candidateFromKeyword('teacher mug', generated)
  const state = { candidates: [candidate], consoleUi: { selectedKeyword: 'teacher mug' } }
  const selected = selectedAudienceCandidate(
    state,
    () => ({ eventId: 'mothers-day', categoryId: 'mug' }),
    (value) => String(value ?? '').trim().toLowerCase(),
  )()

  assert.ok(selected, 'the selected audience candidate must stay in the active context')
  assert.equal(selected.eventId, 'mothers-day')
  assert.equal(selected.categoryId, 'mug')
  assert.equal(selected.rootKeyword, 'teacher')
  assert.equal(`${selected.categoryId}::mothers day::${selected.rootKeyword}`, selected.audienceContextKey)
})

test('renders a terminal current-context Etsy or EverBee failure as unverified and resets after capture', () => {
  const providerBody = appLf.match(/function currentAudienceProviderFailed\(\) \{([\s\S]*?)\n\}\n\nfunction currentAudienceAnalysis/)?.[1] ?? ''
  assert.ok(providerBody, 'current-context audience provider status must be executable')

  const providerFailed = new Function(
    'state',
    'activeResearchContext',
    'candidateMatchesResearchContext',
    'rowHasEtsyMarketplaceInput',
    'rowHasEverbeeInput',
    'normalizePhrase',
    `return function currentAudienceProviderFailed() {${providerBody}\n}`,
  )
  const context = { eventId: 'mothers-day', categoryId: 'mug' }
  const matchesContext = (row, active) => row.eventId === active.eventId && row.categoryId === active.categoryId
  const hasEtsy = (row) => row.etsySearches30d !== undefined || row.etsyListings !== undefined
  const hasEverbee = (row) => row.topMonthlySales !== undefined || row.productRows?.length > 0
  const makeProviderFailed = (state) => providerFailed(
    state,
    () => context,
    matchesContext,
    hasEtsy,
    hasEverbee,
    (value) => String(value ?? '').trim().toLowerCase(),
  )

  const etsyFailedState = {
    marketplaceInsightPlan: {
      eventId: 'mothers-day',
      categoryId: 'mug',
      items: [{ query: 'teacher mug', status: 'error', terminalError: true }],
    },
    researchRows: [],
    candidates: [{ keyword: 'teacher mug', eventId: 'mothers-day', categoryId: 'mug' }],
    extensionState: null,
  }
  assert.equal(makeProviderFailed(etsyFailedState)(), true)
  assert.equal(deriveAudienceUiStatus({ signals: [], providerFailed: makeProviderFailed(etsyFailedState)() }).label, '取得失敗のため未判定')

  etsyFailedState.marketplaceInsightPlan.items[0] = {
    query: 'teacher mug',
    status: 'completed',
    result: { etsySearches30d: 120, etsyListings: 800 },
  }
  assert.equal(makeProviderFailed(etsyFailedState)(), false)

  const everbeeFailedState = {
    marketplaceInsightPlan: null,
    researchRows: [],
    candidates: [{ keyword: 'teacher mug', eventId: 'mothers-day', categoryId: 'mug' }],
    extensionState: {
      active: false,
      mode: 'everbee',
      error: 'EverBee capture failed',
      results: [{ keyword: 'teacher mug', error: 'EverBee capture failed' }],
    },
  }
  assert.equal(makeProviderFailed(everbeeFailedState)(), true)
  everbeeFailedState.extensionState.results = [{ keyword: 'teacher mug', topMonthlySales: 12, error: '' }]
  assert.equal(makeProviderFailed(everbeeFailedState)(), false)
})

test('fresh candidate discovery clears audience state while continuation keeps it', async () => {
  const freshBody = appLf.match(/async function prepareForNewCandidateDiscovery\(\) \{([\s\S]*?)\n\}\n\nfunction appendTrendScoutCandidates/)?.[1] ?? ''
  const continuationBody = appLf.match(/async function startContinuedMultiAngleCycle\(\) \{([\s\S]*?)\n\}\n\nasync function startNewMultiAngleCycle/)?.[1] ?? ''
  assert.ok(freshBody, 'fresh candidate discovery must be executable')
  assert.ok(continuationBody, 'continuation path must stay distinct')

  const prepareForNewCandidateDiscovery = new Function(
    'state',
    'confirmExportBeforeClearingResults',
    'preserveTerminalMultiAngleEvidenceForNewDiscovery',
    'clearResearchResults',
    'selectedEvent',
    'selectedCategory',
    'calculateListingResearchTarget',
    'prepareNewMultiAngleCycle',
    'researchEventSnapshot',
    'createCrossNicheWorkflowState',
    'clearAudienceSelectionsForFreshStart',
    'persistMarketFinderState',
    `return async function prepareForNewCandidateDiscovery() {${freshBody}\n}`,
  )
  const state = {
    researchRows: [],
    acceptExtensionResults: true,
    multiAngleExploration: {},
    pendingEvidenceAutomation: {},
    savedSeasonalReferenceKeys: [],
    savedSeasonalReferences: [],
    evidenceArchives: [{ runId: 'kept' }],
    marketplaceInsightPlan: { items: [] },
    marketplaceInsightMessage: 'old',
    candidates: [{ keyword: 'teacher mug' }],
    candidateCatalog: [{ keyword: 'teacher mug' }],
    crossNicheProposal: null,
    audienceSelectionsByContext: {
      'mug::mothers day::teacher': { selections: [{ phrase: 'teacher', role: 'recipient', status: 'manual', selected: true }] },
    },
    activeAudienceContextKey: 'mug::mothers day::teacher',
  }
  let persisted = 0
  const prepared = await prepareForNewCandidateDiscovery(
    state,
    () => true,
    async () => true,
    () => {},
    () => ({ id: 'mothers-day' }),
    () => ({ id: 'mug' }),
    () => ({ targetWinnerCount: 1 }),
    (snapshot) => ({
      ...snapshot,
      exploration: {},
      pendingEvidenceAutomation: {},
      marketplaceInsightPlan: null,
      marketplaceInsightMessage: '',
      candidates: [],
      candidateCatalog: [],
      crossNicheProposal: null,
    }),
    (event) => event,
    () => ({}),
    () => {
      state.activeAudienceContextKey = ''
      state.audienceSelectionsByContext = {}
    },
    () => { persisted += 1 },
  )()

  assert.equal(prepared, true)
  assert.deepEqual(state.audienceSelectionsByContext, {})
  assert.equal(state.activeAudienceContextKey, '')
  assert.deepEqual(state.evidenceArchives, [{ runId: 'kept' }])
  assert.equal(persisted, 1)
  assert.match(continuationBody, /preserveAccumulatedEvidenceForNextCycle = true/)
})

test('shows which candidates carry the personalization lever and the gift intent', () => {
  assert.match(app, /candidate\.personalizable \? '<span class="pill lever"/)
  assert.match(app, /candidate\.giftIntent \? '<span class="pill lever"/)
  // The badge has to say why it matters, not just that it applies.
  assert.match(app, /価格を比較されにくく/)
  assert.match(app, /買う人と着る人が違う語句/)
  assert.match(styles, /\.pill\.lever \{/)
})

test('shows learned marketplace vocabulary by buyer role and reuses it in generation', () => {
  assert.match(html, /購入者語彙の学習/)
  assert.match(app, /signalTypeLabel/)
  assert.match(app, /人・相手/)
  assert.match(app, /理由/)
  assert.match(app, /場面/)
  assert.match(app, /修飾/)
  assert.match(app, /observationRuns/)
  assert.match(app, /learnedSignalsForGeneration/)
})

test('renders restored candidates even when source freshness was never stored', () => {
  assert.match(app, /candidate\.sourceFreshness\?\.freshnessDays != null/)
})

test('puts every next action after the result or inputs it uses', () => {
  assert.ok(position('yearInput') < position('trendAutoBtn'))
  assert.ok(position('candidateList') < position('marketplaceStartBtn'))
  assert.ok(position('marketplaceResultsList') < position('erankToEverbeeBtn'))
  assert.ok(position('erankToEverbeeBtn') < position('resultsList'))
  assert.ok(position('resultsList') < position('candidateErankBtn'))
  assert.ok(position('candidateErankBtn') < position('erankResultsList'))
})

test('does not render duplicate automatic research buttons above the steps', () => {
  assert.doesNotMatch(html, /id="simpleImportErankBtn"/)
  assert.doesNotMatch(html, /id="simpleStartBtn"/)
})

test('runs Etsy official before EverBee and keeps eRank optional', () => {
  const stages = ['conditions', 'candidates', 'etsy', 'everbee', 'results']
  assert.deepEqual([...html.matchAll(/data-research-stage="([a-z]+)"/g)].map((match) => match[1]), stages)
  assert.match(app, /function etsyValidationCandidates\(\) \{[\s\S]{0,200}return buildEtsyCandidatesFromPool\(state\.candidates\)/)
  assert.doesNotMatch(app, /function etsyValidationCandidates\(\) \{[\s\S]{0,300}buildEtsyCandidatesFromErank/)
  assert.match(app, /const stageOrder = \['pending-etsy', 'pending-everbee', 'pending-erank'\]/)
  assert.doesNotMatch(app, /if \(!failed && !erankAttempted\) nextStage = 'pending-erank'/)
  assert.match(app, /'2「候補」を確認し、「Etsy公式確認を自動実行」を押してください。'/)
  assert.match(app, /'3「Etsy公式」を確認し、4「EverBee」の「EverBeeで売上を確認する」を押してください。'/)
  assert.doesNotMatch(html.match(/id="researchStageTabs"[\s\S]*?<\/nav>/)?.[0] ?? '', />eRank</)
  assert.doesNotMatch(app, /候補を作り、eRankから順に確認してください/)
  assert.match(app, /次は3段目の「Etsy公式確認を自動実行」を押してください。/)
  assert.doesNotMatch(app, /次は4段目の「Etsy公式確認を自動実行」を押してください。/)
  assert.match(html, /複数商品が売れている高競合市場から交差キーワードを作り、通常のEtsy公式・EverBee確認へ自動で戻します。eRankは最終結果で任意の補助確認です。/)
})

test('starts Etsy and renders official results before EverBee', () => {
  assert.match(app, /async function startMarketplaceInsight\(\)/)
  assert.match(app, /function renderMarketplaceInsightResults\(\)/)
  assert.match(app, /marketplaceCompletedKeywords\(state\.marketplaceInsightPlan\)/)
  assert.match(app, /elements\.marketplaceNextBtn\.hidden = !canUsePlan/)
  assert.match(app, /Etsy公式データを取得していません/)
})

test('names the initial and repeated Etsy actions by what they do', () => {
  assert.match(html, /id="marketplaceStartBtn"[^>]*>Etsy公式確認を自動実行<\/button>/)
  assert.match(html, /id="marketplaceNextBtn"[^>]*>Etsy公式確認を自動再開<\/button>/)
  assert.match(html, /id="marketplaceAutoStopBtn"[^>]*>自動確認を停止<\/button>/)
})

test('automatically opens, waits for, captures, and advances Etsy candidates', () => {
  assert.match(app, /RUN_AND_CAPTURE_ETSY_MARKETPLACE_INSIGHT/)
  assert.match(app, /async function runMarketplaceInsightAutomation\(\)/)
  assert.match(app, /while \(state\.marketplaceInsightAutoRunning\)/)
  assert.match(app, /await waitForMarketplaceQueryCooldown\(\)/)
  assert.match(app, /elements\.marketplaceStartBtn\.addEventListener\('click', startMarketplaceInsight\)/)
  assert.match(app, /elements\.marketplaceNextBtn\.addEventListener\('click', runMarketplaceInsightAutomation\)/)
  assert.match(app, /elements\.marketplaceAutoStopBtn\.addEventListener\('click', stopMarketplaceInsightAutomation\)/)
  assert.doesNotMatch(app, /結果が見えたら「表示中の結果を取り込む」を押してください/)
})

test('keeps the Etsy action clickable when candidates are ready but the extension is disconnected', () => {
  assert.match(app, /const hasErankResults = erankResultRows\(\)\.length > 0/)
  assert.match(app, /elements\.marketplaceStartBtn\.disabled = state\.marketplaceInsightBusy \|\| state\.marketplaceInsightAutoRunning \|\| eligibleCandidates\.length === 0/)
  assert.doesNotMatch(app, /elements\.marketplaceStartBtn\.disabled = [^\n]*!state\.extensionConnected/)
  assert.match(app, /候補を作るとEtsy公式で確認できます。/)
  assert.match(app, /候補は準備できています。実Chromeで開き、Chrome拡張/)
})

test('labels completed eRank results and the next Etsy action clearly', () => {
  assert.match(html, /id="erankCount">0<\/strong><small>eRank結果<\/small>/)
  assert.match(app, /opportunity\.action === 'everbee' \? 'Etsyで確認' : opportunity\.label/)
})

test('shows the within-research comparison score in the Etsy verification queue', () => {
  assert.match(app, /調査内比較/)
  assert.match(app, /item\.cohortIndex/)
})

test('shows EverBee competition in the final comparison and detail views', () => {
  assert.match(app, /data-label="EverBee競合"/)
  assert.match(app, /<span>EverBee競合<\/span>/)
  assert.match(app, /<span>EverBee Listings Analyzed<\/span>/)
  assert.match(app, /normalized\.everbeeCompetitionBand/)
})

test('shows evidence-backed personalization guidance in final results and CSV', () => {
  assert.match(app, /recommendPersonalization,/)
  assert.match(app, /personalizationRecommendation: recommendPersonalization\(row, row\.score, options\)/)
  assert.match(app, /function renderPersonalizationRecommendation\(recommendation\)/)
  assert.match(app, /パーソナライズ（カスタム）/)
  assert.match(app, /'Personalization Decision'/)
  assert.match(app, /'Personalization Etsy Evidence Count'/)
  assert.match(app, /'Personalization EverBee Evidence Count'/)
  assert.match(app, /personalization\.etsyEvidenceCount/)
  assert.match(app, /personalization\.everbeeEvidenceCount/)
})

test('shows product-level EverBee sales in monthly-sales order with recent winners marked', () => {
  assert.match(app, /function renderEverbeeProductRows\(row\)/)
  assert.match(app, /EverBee売れ筋商品/)
  assert.match(app, /月間販売数順 \/ 緑は公開12か月以内/)
  assert.match(app, /b\.monthlySales/)
  assert.match(app, /is-new-winner/)
  assert.match(app, /everbeeResultsToBroadListings\(results\)/)
  assert.doesNotMatch(app, /sales: result\.topMonthlySales/)
})

test('confirms the cross-niche round before swapping the candidate list', () => {
  assert.match(html, /id="crossNicheSection"/)
  assert.match(html, /id="crossNicheList"/)
  assert.match(html, /id="crossNicheStatus"/)
  assert.match(html, /id="crossNicheProposal"/)
  assert.ok(position('finalEvidenceTable') < position('crossNicheSection'))
  assert.ok(position('crossNicheProposal') < position('crossNicheList'))
  assert.match(app, /function renderCrossNicheProposal\(\)/)
  assert.match(app, /function applyCrossNicheProposal\(\)/)
  assert.match(app, /function dismissCrossNicheProposal\(\)/)
  assert.match(app, /data-cross-niche-apply/)
  assert.match(app, /data-cross-niche-dismiss/)
  // The candidate list may only be replaced from the explicit confirmation path.
  assert.doesNotMatch(app, /if \(result\.didQueue\) \{[\s\S]{0,400}state\.candidates = queuedCandidates/)
  assert.doesNotMatch(html, /id="buildNextRoundBtn"/)
  assert.doesNotMatch(html, /上位候補を次の調査へ追加/)
  assert.match(app, /buildCrossNicheDrilldown/)
  assert.match(app, /function renderCrossNicheDrilldown\(\)/)
  assert.match(app, /function syncCrossNicheWorkflow\(/)
  assert.match(app, /advanceCrossNicheWorkflow/)
  assert.match(app, /isCrossNicheWorkflowPending/)
  assert.match(app, /state\.crossNicheWorkflow/)
  assert.match(app, /const needsAdaptiveMigration = !restoredPreview\s*&&\s*!isCrossNicheWorkflowPending\(state\.crossNicheWorkflow\)/)
  assert.doesNotMatch(app, /再調査が終わるまで最終おすすめを確定しません/)
  assert.match(app, /初回結果は下に残しています/)
  assert.match(html, /id="researchRoundTabs"/)
  assert.match(html, /id="researchRoundSummary"/)
  assert.match(app, /state\.researchRounds\.selectedRoundId = 'all'/)
  assert.match(app, /preserveCrossNicheResearch/)
  assert.match(app, /if \(!isCrossNicheWorkflowPending\(state\.crossNicheWorkflow\)\) \{\s*if \(shouldRegenerateMarketplaceCandidates\(\{/)
  assert.match(app, /autoRunning: state\.marketplaceInsightAutoRunning/)
  assert.match(app, /buildErankQueryPlan/)
  assert.match(app, /setFlowMode\('auto'\)/)
  assert.match(app, /crossNicheParent/)
  assert.match(app, /'Cross Niche Parent'/)
  assert.match(app, /'Cross Niche Depth'/)
  assert.match(app, /'Niche Root'/)
  assert.match(app, /'Specificity Axis'/)
  assert.match(app, /'Drilldown Verdict'/)
  assert.match(app, /'Stop Reason'/)
  assert.match(app, /row\.crossNicheParent \?\? ''/)
  assert.match(app, /row\.crossNicheDepth \?\? ''/)
  assert.match(app, /function limitNextResearchCandidates\(candidates, limit = 8\)/)
  assert.match(html, /id="nicheExplorationHistory"/)
  assert.match(html, /id="nicheExplorationHistoryList"/)
  assert.match(app, /function renderNicheExplorationHistory\(\)/)
  assert.match(app, /競合減少率/)
  assert.match(app, /需要維持率/)
  assert.match(app, /効率改善/)
  assert.match(styles, /\.cross-niche-section/)
})

test('explains when a safe eRank hold candidate is being rechecked on Etsy', () => {
  assert.match(app, /eRank保留から再確認/)
  assert.match(app, /officialProbe/)
})

test('keeps event track metadata and shows cross-event history', () => {
  assert.match(app, /researchedMarketHistory/)
  assert.match(app, /classifyEventMarketTrack/)
  assert.match(app, /prioritizeEventCandidates/)
  assert.match(app, /market-track-pill/)
  assert.match(app, /別イベントで調査済み/)
  assert.match(app, /'Market Track'/)
  assert.match(app, /'Research Event'/)
  assert.match(app, /'History Cluster'/)
  assert.match(styles, /\.result-track-group/)
})

test('shows direct and base eRank provenance including failed captures', () => {
  assert.match(html, /id="erankQueryPlanSummary"/)
  assert.match(html, /id="candidateRoundTabs"/)
  assert.match(app, /if \(!preserveMarketplacePlan\) \{[\s\S]*beginInitialResearchRound\(\)/)
  assert.match(app, /完全語句/)
  assert.match(app, /基底語/)
  assert.match(app, /検索済み・数値取得失敗/)
  assert.match(app, /erankCaptureStateRows/)
})

test('explains the active eRank query and the exact capture failure stage', () => {
  assert.match(app, /function formatErankProgressKeyword\(/)
  assert.match(app, /元候補/)
  assert.match(app, /失敗箇所/)
  assert.match(app, /競合・KD/)
})

test('separates recommendations, pending verification, holds, failures, and exclusions', () => {
  assert.match(html, /調査結果と商品化候補/)
  assert.match(html, /data-final-evidence-filter="recommended"/)
  assert.match(html, /data-final-evidence-filter="pending"/)
  assert.match(html, /data-final-evidence-filter="hold"/)
  assert.match(html, /data-final-evidence-filter="failed"/)
  assert.match(html, /data-final-evidence-filter="excluded"/)
  assert.match(app, /finalEvidenceFilterMatches/)
  assert.match(app, /選抜済みを自動検証/)
  assert.doesNotMatch(html, /<h2>おすすめキーワード<\/h2>/)
})

test('persists extension results and restores completed results explicitly', () => {
  assert.match(app, /extensionResultsImportMode/)
  assert.match(app, /const importMode = extensionResultsImportMode/)
  assert.match(app, /addResearchRows\(importedRows\)/)
  assert.match(app, /persistMarketFinderState\(\)/)
  assert.match(app, /function migrateLegacyResearchRounds\(\)/)
  assert.match(app, /旧形式の保存結果から初回ラウンドを復元/)
})

test('persists and restores research console UI state', () => {
  assert.match(app, /createResearchConsoleUi/)
  assert.match(app, /consoleUi: state\.consoleUi/)
  assert.match(app, /state\.consoleUi = restoreResearchConsoleUiFromPayload\(savedState\)/)
})

test('lets the user open completed workflow stages and the final result', () => {
  assert.match(app, /function setActiveResearchStage\(/)
  assert.match(app, /bindResearchStageTabs\(elements\.researchStageTabs/)
  assert.match(app, /const isLocked = button\.dataset\.status === 'locked'/)
  assert.match(app, /button\.tabIndex = isLocked \? -1 : 0/)
  assert.match(app, /button\.removeAttribute\('aria-disabled'\)/)
  assert.match(app, /elements\.finalKeywordDecision\?\.scrollIntoView/)
  assert.doesNotMatch(app, /function setActiveResearchStage[\s\S]{0,500}state\.researchRows = \[\]/)
})

test('separates restored results from the current research run', () => {
  assert.match(app, /restoredResearchSavedAt: ''/)
  assert.match(app, /acceptExtensionResults: false/)
  assert.match(app, /latestResearchCheckedAt\(state\.researchRows\)/)
  assert.match(app, /保存済み結果を表示中です。Chrome拡張のReloadで再調査した結果ではありません/)
  assert.match(app, /if \(importMode === 'restore'\)/)
  assert.match(app, /label: '前回のeRank・Etsy・EverBee結果'/)
  assert.match(app, /state\.acceptExtensionResults = true/)
  assert.match(app, /restoredResultsAccepted: false/)
  assert.match(app, /data-use-restored-results/)
  assert.match(app, /保存した結果で調査を再開/)
  assert.match(app, /if \(restoredResultsAwaitingConfirmation\(\)\) return \[\]/)
  assert.match(app, /const canUsePlan = hasPlan && !restoredAwaiting/)
})

test('puts the restored-result continuation button beside the persistent next action', () => {
  const nextActionStart = html.indexOf('id="researchNextAction"')
  const nextActionEnd = html.indexOf('</div>', nextActionStart)
  const nextActionMarkup = html.slice(nextActionStart, nextActionEnd)

  assert.match(nextActionMarkup, /id="acceptRestoredResultsBtn"/)
  assert.match(nextActionMarkup, />保存した結果で調査を再開<\/button>/)
  assert.match(app, /acceptRestoredResultsBtn:\s*document\.querySelector\('#acceptRestoredResultsBtn'\)/)
  assert.match(app, /acceptRestoredResultsBtn\.hidden\s*=\s*next\.action\s*!==\s*'restored-results'/)
  assert.match(app, /acceptRestoredResultsBtn\.addEventListener\('click',\s*acceptRestoredResearchResults\)/)
})

test('puts cross-niche accept and dismiss choices beside the persistent next action', () => {
  const nextActionStart = html.indexOf('id="researchNextAction"')
  const nextActionEnd = html.indexOf('</div>', nextActionStart)
  const nextActionMarkup = html.slice(nextActionStart, nextActionEnd)

  assert.match(nextActionMarkup, /id="crossNicheNextApplyBtn"/)
  assert.match(nextActionMarkup, /id="crossNicheNextDismissBtn"/)
  assert.match(nextActionMarkup, />今回は見送る<\/button>/)
  assert.match(app, /crossNicheNextApplyBtn\.textContent\s*=\s*`この\$\{proposalCount\}件を調査する`/)
  assert.match(app, /crossNicheNextApplyBtn\.hidden\s*=\s*!showCrossNicheActions/)
  assert.match(app, /crossNicheNextDismissBtn\.hidden\s*=\s*!showCrossNicheActions/)
  assert.match(app, /crossNicheNextApplyBtn\.addEventListener\('click',\s*applyCrossNicheProposal\)/)
  assert.match(app, /crossNicheNextDismissBtn\.addEventListener\('click',\s*dismissCrossNicheProposal\)/)
})

test('stacks next-action copy above its decision buttons without squeezing Japanese text', () => {
  assert.match(html, /class="research-next-action-buttons"/)
  assert.match(
    styles,
    /\.research-next-action\s*\{[^}]*display:\s*grid/
  )
  assert.match(
    styles,
    /\.research-next-action\s*\{[^}]*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)/
  )
  assert.match(
    styles,
    /\.research-next-action-buttons\s*\{[^}]*grid-column:\s*2/
  )
  assert.match(
    styles,
    /\.research-next-action strong\s*\{[^}]*min-width:\s*0/
  )
})

test('synchronizes radio checked state in setFlowMode', () => {
  assert.match(app, /choice\.checked = choice\.dataset\.flowChoice === activeMode/)
  assert.match(app, /choice\.closest\('\.flow-choice'\)/)
})

test('persists and restores every selected flow mode', () => {
  const selectedFlowModeBody = app.match(/function selectedFlowMode\(\) \{([\s\S]*?)\n\}/)?.[1]
  const setFlowModeBody = app.match(/function setFlowMode\(mode, options = \{\}\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(selectedFlowModeBody, 'selectedFlowMode must be extractable')
  assert.ok(setFlowModeBody, 'setFlowMode must be extractable')
  const createSelectedFlowMode = new Function('document', `return function selectedFlowMode() {${selectedFlowModeBody}\n}`)
  const createSetFlowMode = new Function(
    'document',
    'elements',
    'setSimpleStatus',
    'persistMarketFinderState',
    `return function setFlowMode(mode, options = {}) {${setFlowModeBody}\n}`,
  )
  const createDocument = () => {
    const classes = new Set()
    return {
      body: {
        classList: {
          add: (...names) => names.forEach((name) => classes.add(name)),
          remove: (...names) => names.forEach((name) => classes.delete(name)),
          contains: (name) => classes.has(name),
        },
      },
    }
  }
  const createElements = () => {
    const choice = (flowChoice) => ({
      checked: false,
      dataset: { flowChoice },
      closest: () => ({ classList: { toggle: () => {} } }),
    })
    return {
      flowAutoBtn: choice('auto'),
      flowCsvBtn: choice('csv'),
      flowSeoBtn: choice('seo'),
      simpleSeoStepNumber: { textContent: '' },
    }
  }

  for (const flowMode of ['auto', 'csv', 'seo']) {
    const firstDocument = createDocument()
    const selectBeforeReload = createSelectedFlowMode(firstDocument)
    const firstElements = createElements()
    let savedFlowMode = ''
    const setBeforeReload = createSetFlowMode(
      firstDocument,
      firstElements,
      () => {},
      () => { savedFlowMode = selectBeforeReload() },
    )

    setBeforeReload(flowMode)
    assert.equal(savedFlowMode, flowMode, `${flowMode} selection must persist its own value`)

    const reloadedDocument = createDocument()
    const reloadedElements = createElements()
    const setAfterReload = createSetFlowMode(reloadedDocument, reloadedElements, () => {}, () => {})
    setAfterReload(savedFlowMode, { persist: false })

    assert.equal(reloadedDocument.body.classList.contains(`flow-${flowMode}`), true, `${flowMode} must be restored after reload`)
    assert.equal(reloadedElements[`flow${flowMode[0].toUpperCase()}${flowMode.slice(1)}Btn`].checked, true)
  }
})

test('keeps research stage tabs auto-route-only and ignores CSV stage selection', () => {
  assert.match(html, /<div id="researchAppLayout" class="research-app-layout flow-auto-only"/)
  assert.match(html, /<nav id="researchStageTabs" class="research-stage-tabs"/)

  const body = app.match(/function setActiveResearchStage\(stageId, \{ persist = true \} = \{\}\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(body, 'setActiveResearchStage must be extractable')
  const createSetter = new Function(
    'state',
    'selectResearchStage',
    'renderResearchStageTabs',
    'renderActiveResearchStage',
    'persistMarketFinderState',
    'document',
    `return function setActiveResearchStage(stageId, { persist = true } = {}) {${body}\n}`,
  )
  for (const flowMode of ['csv', 'seo']) {
    const state = { consoleUi: { activeStage: 'conditions' } }
    const rendered = []
    const setActiveResearchStage = createSetter(
      state,
      (ui, stageId) => ({ ...ui, activeStage: stageId }),
      () => rendered.push('tabs'),
      () => rendered.push('stage'),
      () => rendered.push('persist'),
      { body: { classList: { contains: (className) => className === `flow-${flowMode}` } } },
    )

    setActiveResearchStage('results')

    assert.equal(state.consoleUi.activeStage, 'conditions', `${flowMode} must not change the active stage`)
    assert.deepEqual(rendered, [], `${flowMode} must not render a stage change`)
  }
})

test('routes the global stop action through multi-angle orchestration before active service stops', () => {
  const body = app.match(/function stopActiveResearch\(\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(body, 'global stop router must be extractable')
  const createStop = new Function(
    'multiAngleWorkHasCurrentBatch',
    'stopMultiAngleOrchestration',
    'researchHeaderState',
    'stopMarketplaceInsightAutomation',
    'stopExtensionResearch',
    `return function stopActiveResearch() {${body}\n}`,
  )
  const calls = []

  createStop(
    () => true,
    (source) => calls.push(`multi:${source}`),
    () => ({ stopKind: 'marketplace' }),
    () => calls.push('marketplace'),
    () => calls.push('extension'),
  )()
  createStop(
    () => false,
    (source) => calls.push(`multi:${source}`),
    () => ({ stopKind: 'marketplace' }),
    () => calls.push('marketplace'),
    () => calls.push('extension'),
  )()
  createStop(
    () => false,
    (source) => calls.push(`multi:${source}`),
    () => ({ stopKind: 'extension' }),
    () => calls.push('marketplace'),
    () => calls.push('extension'),
  )()
  createStop(
    () => false,
    (source) => calls.push(`multi:${source}`),
    () => ({ stopKind: '' }),
    () => calls.push('marketplace'),
    () => calls.push('extension'),
  )()

  assert.deepEqual(calls, ['multi:global', 'marketplace', 'extension'])
})

test('derives every final-result toolbar action from one state function', () => {
  const body = app.match(/function finalResultToolbarState\(\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(body, 'finalResultToolbarState must be extractable')
  const createState = new Function(
    'everbeeResultRows',
    'finalEvidenceRows',
    'deriveFinalKeywordDecision',
    'erankResultRows',
    'erankCaptureStateRows',
    'latestResearchCheckedAt',
    'formatDateTime',
    `return function finalResultToolbarState() {${body}\n}`,
  )
  const rows = {
    everbee: [],
    evidence: [],
    erank: [],
    captures: [],
  }
  const finalResultToolbarState = createState(
    () => rows.everbee,
    () => rows.evidence,
    (evidenceRows) => ({
      recommendedCount: evidenceRows.filter((row) => (
        row.queryEligibility?.eligible !== false
        && row.evidenceState?.status === 'verified'
        && ['A', 'B'].includes(row.opportunityLabel)
      )).length,
    }),
    () => rows.erank,
    () => rows.captures,
    () => '2026-07-22T12:34:00.000Z',
    () => '2026/07/22 12:34',
  )

  const empty = finalResultToolbarState()
  assert.equal(empty.canCopyFinalKeywords, false)
  assert.equal(empty.canDownloadStep4Csv, false)
  assert.equal(empty.canDownloadErankCsv, false)
  assert.match(empty.statusMessage, /A\/B/)
  assert.match(empty.statusMessage, /最終結果/)
  assert.match(empty.statusMessage, /eRank/)

  rows.erank = [{ keyword: 'erank only' }]
  const erankOnly = finalResultToolbarState()
  assert.equal(erankOnly.canCopyFinalKeywords, false)
  assert.equal(erankOnly.canDownloadStep4Csv, false)
  assert.equal(erankOnly.canDownloadErankCsv, true)

  rows.everbee = [{ score: { opportunityLabel: 'A' } }]
  rows.evidence = [{
    opportunityLabel: 'A',
    evidenceState: { status: 'verified' },
    queryEligibility: { eligible: false, status: 'title-like' },
    everbeeRow: rows.everbee[0],
  }]
  const titleLikeOnly = finalResultToolbarState()
  assert.equal(titleLikeOnly.canCopyFinalKeywords, false)
  assert.equal(titleLikeOnly.canDownloadStep4Csv, false)

  rows.evidence = [{
    opportunityLabel: 'A',
    evidenceState: { status: 'verified' },
    queryEligibility: { eligible: true },
    everbeeRow: rows.everbee[0],
  }]
  const ready = finalResultToolbarState()
  assert.equal(ready.canCopyFinalKeywords, true)
  assert.equal(ready.canDownloadStep4Csv, true)
  assert.equal(ready.canDownloadErankCsv, true)

  assert.match(app, /function renderFinalResultToolbar\(\)[\s\S]{0,600}elements\.copyFinalKeywordsBtn\.disabled = !toolbarState\.canCopyFinalKeywords/)
  assert.match(app, /function renderResultsTable\(\) \{\s*renderFinalResultToolbar\(\)/)
  assert.match(html, /id="copyFinalKeywordsBtn"[^>]*aria-describedby="finalResultFreshness"/)
  assert.match(html, /id="downloadErankCsvBtn"[^>]*aria-describedby="finalResultFreshness"/)
  assert.match(html, /id="downloadStep4CsvBtn"[^>]*aria-describedby="finalResultFreshness"/)
})

test('styles native radio controls and no longer styles the removed workflow strip', () => {
  assert.match(styles, /\.flow-choice input\[type="radio"\]/)
  assert.doesNotMatch(styles, /\.workflow-strip/)
})

test('uses action names instead of legacy Step labels in user-facing copy', () => {
  assert.doesNotMatch(html, /Step [1-5]/)
  assert.doesNotMatch(app, /Step [1-5]/)
  assert.doesNotMatch(html, /<button[^>]*>\s*[1-5]\s/)
})

test('keeps accepted results when the guided flow sends Etsy-confirmed words to EverBee', () => {
  assert.match(
    app,
    /async function simpleStartResearch\(\)[\s\S]{0,1600}await startExtensionResearch\(\{\s*preserveExisting:\s*true\s*\}\)/,
  )
})

test('does not show a hard-coded EverBee handoff count', () => {
  assert.match(html, /Etsy公式確認済みの候補をEverBeeへ送ります/)
  assert.doesNotMatch(html, /Etsy公式確認済みの20件をEverBeeへ送ります/)
})

test('does not call saved data previous results while the same research is already running', () => {
  const restoredBody = app.match(/function restoredResultsAwaitingConfirmation\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(restoredBody, /state\.multiAngleExploration\?\.status !== 'running'/)
  assert.doesNotMatch(html, /この前回結果から続ける/)
  assert.match(app, /保存した\$\{restoredCount\}件で調査を再開/)
})

test('keeps Etsy queue guidance and EverBee availability in sync', () => {
  assert.match(html, /id="marketplaceHandoffNote"/)
  assert.match(html, /id="marketplaceHandoffTitle"/)
  assert.match(html, /id="marketplaceHandoffText"/)
  assert.match(app, /function marketplaceQueueRemainingCount\(/)
  assert.match(app, /const hasRemainingEtsyQueue = remaining > 0/)
  assert.match(app, /const everbeeHandoff = everbeeHandoffState\([\s\S]{0,260}remainingEtsyCount: remaining/)
  assert.match(app, /elements\.erankToEverbeeBtn\.disabled = everbeeHandoff\.disabled/)
  assert.match(app, /Etsy公式があと\$\{remaining\}件残っています/)
  assert.match(app, /Etsy公式確認を自動再開/)
  assert.match(app, /elements\.marketplaceHandoffTitle\.textContent/)
})

test('uses a fixed desktop sidebar for stages and result destinations', () => {
  assert.match(html, /id="researchAppLayout"/)
  assert.match(html, /id="researchSidebar"/)
  assert.match(html, /id="researchMainColumn"/)
  assert.match(html, /id="resultSubviewNav"/)
  assert.equal((html.match(/data-research-stage=/g) ?? []).length, 5)
  assert.equal((html.match(/data-result-subview=/g) ?? []).length, 7)
  assert.match(styles, /\.research-app-layout\s*\{[^}]*grid-template-columns:\s*240px minmax\(0,\s*1fr\)/s)
  assert.match(styles, /\.research-sidebar\s*\{[^}]*position:\s*sticky/s)
})

test('refreshes extension activity before restarting saved evidence validation', () => {
  const start = app.indexOf('async function confirmExtensionConnection()')
  const end = app.indexOf('\nfunction handleExtensionMessage', start)
  const connectionCheck = app.slice(start, end)

  assert.ok(start >= 0 && end > start, 'connection check function must exist')
  assert.doesNotMatch(
    connectionCheck,
    /if \(state\.extensionConnected && state\.extensionVersion === REQUIRED_EXTENSION_VERSION\) return true/,
  )
  assert.match(connectionCheck, /requestExtension\('GET_MARKET_STATE'/)
  assert.match(connectionCheck, /const extensionState = response\.state/)
  assert.match(connectionCheck, /state\.extensionState = extensionState/)
})

test('hands an idle extension to the current tab without stealing an active run', () => {
  assert.match(app, /from '\.\/research-tab-lease\.js\?v=/)
  assert.match(app, /function initResearchTabLease\(\)/)
  const start = app.indexOf('async function confirmExtensionConnection()')
  const end = app.indexOf('\nfunction handleExtensionMessage', start)
  const connectionCheck = app.slice(start, end)

  assert.ok(start >= 0 && end > start, 'connection check function must exist')
  assert.ok(
    connectionCheck.indexOf("requestExtension('GET_MARKET_STATE'")
      < connectionCheck.indexOf('claimResearchTabLease({ force:'),
    'extension activity must be checked before the current tab takes ownership',
  )
  assert.match(connectionCheck, /if \(extensionState\.active && !ownsCurrentLease\)/)
  assert.match(connectionCheck, /claimResearchTabLease\(\{ force: !extensionState\.active \}\)/)
  assert.match(app, /function schedulePendingEvidenceAutomation\([^)]*\) \{\s*if \(!researchTabLeaseOwned\)/)
  assert.match(app, /window\.addEventListener\('pagehide', releaseCurrentResearchTabLease\)/)
})

test('uses the same automatable pending rows for the button and the manual run', () => {
  assert.match(
    app,
    /const buttonPendingRows = pendingEvidenceRows\(rows, pendingRows\.map\(\(row\) => row\.keyword\)\)/,
  )
  assert.match(app, /const initialPendingRows = pendingEvidenceRows\(\s*finalEvidenceRows\(\),\s*allPendingKeywords/)
  assert.match(app, /allowedKeywordSet\.size > 0\s*\|\| batchCandidates\.length === 0/)
})

test('uses one desktop page scrollbar for the active research workspace', () => {
  assert.match(styles, /body\s*\{[^}]*min-width:\s*1280px/)
  assert.match(styles, /\.research-console\s*\{[^}]*display:\s*block[^}]*min-width:\s*0[^}]*height:\s*auto[^}]*min-height:\s*0[^}]*overflow:\s*visible/s)
  assert.match(styles, /\.research-console-queue,\s*\.research-console-inspector\s*\{[^}]*display:\s*none/s)
  assert.match(styles, /\.research-console-workspace\s*\{[^}]*overflow:\s*visible/s)
  assert.doesNotMatch(styles, /\.research-console\s*\{[^}]*height:\s*calc\(/s)
  assert.match(styles, /\.final-evidence-table-shell\s*\{[^}]*overflow:\s*visible/s)
  assert.match(styles, /\.research-stage-tabs/)
  assert.match(styles, /\.research-mission-bar\s*\{/)
  assert.match(styles, /body\[data-research-phase="running"\]/)
  assert.match(styles, /body\[data-research-phase="result"\]/)
  assert.doesNotMatch(styles, /font-size:\s*[^;]*(?:vw|vh|vmin|vmax)/)
})
test('preserves desktop console layouts after the 780px mobile cascade', () => {
  const mobileCascade = styles.slice(styles.indexOf('@media (max-width: 780px)'))
  assert.notEqual(mobileCascade, styles, 'the 780px media query must exist')
  const mobileStackingIndex = mobileCascade.indexOf('.two-col,')
  const consoleOverrideIndex = mobileCascade.indexOf('.research-console .two-col')

  assert.ok(consoleOverrideIndex > mobileStackingIndex, 'console override must follow the mobile stacking rule')
  assert.match(mobileCascade, /\.research-console \.two-col\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(mobileCascade, /\.research-console \.results-heading\s*\{[^}]*flex-direction:\s*row/)
  assert.match(mobileCascade, /\.research-console \.research-table-head\s*\{[^}]*display:\s*grid/)
  assert.match(mobileCascade, /\.research-console \.erank-table\s*\{[^}]*min-width:\s*800px/)
  assert.match(mobileCascade, /\.research-console \.everbee-table\s*\{[^}]*min-width:\s*780px/)
  assert.match(mobileCascade, /\.research-console \.erank-table-head,[\s\S]{0,220}\.research-console \.erank-table-row\s*\{[^}]*grid-template-columns:\s*74px/)
  assert.match(mobileCascade, /\.research-console \.everbee-table-head,[\s\S]{0,220}\.research-console \.everbee-table-row\s*\{[^}]*grid-template-columns:\s*82px/)
  assert.match(mobileCascade, /\.research-console \.table-cell::before\s*\{[^}]*display:\s*none/)
})

test('uses one current cache version for the console stylesheet and module', () => {
  const stylesheetVersion = html.match(/styles\.css\?v=([^"']+)/)?.[1]
  const moduleVersion = html.match(/src\/app\.js\?v=([^"']+)/)?.[1]

  assert.ok(stylesheetVersion, 'stylesheet cache version must exist')
  assert.equal(moduleVersion, stylesheetVersion, 'stylesheet and module cache versions must match')
})

test('allows an idle extension to replace a stale tab lease from the primary action', () => {
  const start = app.indexOf('function extensionBlockReason()')
  const end = app.indexOf('\nfunction ', start + 1)
  const body = app.slice(start, end)
  assert.match(body, /!researchTabLeaseOwned\s*&&\s*state\.extensionState\?\.active/)
})
test('offers the main resume action when exploration is unfinished but no provider is active', () => {
  const start = app.indexOf('function researchExperienceAction(')
  const end = app.indexOf('\nfunction ', start + 1)
  const body = app.slice(start, end)
  assert.match(body, /\['running',\s*'paused',\s*'stopped',\s*'exhausted'\]\.includes\(state\.multiAngleExploration\.status\)[\s\S]*action:\s*'automation'/)
  const resumeIndex = body.indexOf("['paused', 'stopped', 'exhausted'].includes(state.multiAngleExploration.status)")
  const readyIndex = body.indexOf("if (decision.status === 'ready'")
  assert.ok(resumeIndex >= 0 && resumeIndex < readyIndex, 'paused work must expose Resume before the final-result branches')
})
test('keeps searching from a ready result until the configured winner target is reached', () => {
  const start = app.indexOf('function researchExperienceAction(')
  const end = app.indexOf('\nfunction ', start + 1)
  const body = app.slice(start, end)
  assert.match(body, /remainingWinnerCount\s*=\s*Math\.max\(0,\s*targetWinnerCount\s*-\s*decision\.recommendedCount\)/)
  assert.match(body, /decision\.status === 'ready'\s*&&\s*remainingWinnerCount > 0[\s\S]*action:\s*'automation'[\s\S]*A\/Bをあと\$\{remainingWinnerCount\}件探す/)
})

test('the visible primary action invokes automation directly instead of clicking a hidden control', () => {
  const primaryHandler = app.match(/elements\.researchExperiencePrimaryAction\?\.addEventListener\('click', async \(event\) => \{([\s\S]*?)\n  \}\)/)?.[1] ?? ''
  assert.match(primaryHandler, /await handleWinningNicheAutomationAction\(/)
  assert.doesNotMatch(primaryHandler, /winningNicheAutomationToggle\?\.click\(\)/)
})
