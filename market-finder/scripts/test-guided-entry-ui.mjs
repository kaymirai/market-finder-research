import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { extensionResultsImportMode } from '../src/research-flow.js'

const root = new URL('../', import.meta.url)
const [html, app, styles] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/app.js', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8'),
])

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

test('uses one set of five numbered workflow steps', () => {
  assert.doesNotMatch(html, /class="workflow-strip"/)
  for (let step = 1; step <= 5; step += 1) {
    assert.match(html, new RegExp(`class="section-kicker">${step} \\/ 5<`))
  }
})

test('renders the five-stage research console', () => {
  assert.match(html, /id="researchStageTabs"/)
  const stages = ['conditions', 'candidates', 'erank', 'etsy', 'results']
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
})

test('renders queue rows and inspector details without starting research', () => {
  assert.match(app, /function researchQueueRows\(stageId = state\.consoleUi\.activeStage\)/)
  assert.match(app, /function renderResearchQueue\(\)/)
  assert.match(app, /function renderResearchInspector\(\)/)
  assert.match(app, /data-console-keyword=/)
  assert.match(app, /elements\.researchQueueList\.addEventListener\('click', \(event\) => \{[\s\S]{0,500}state\.consoleUi = \{ \.\.\.state\.consoleUi, selectedKeyword:/)
  assert.doesNotMatch(app, /elements\.researchQueueList\.addEventListener\('click', \(event\) => \{[\s\S]{0,800}(startMarketplaceInsight|runMarketplaceInsightAutomation|simpleStartErankResearch|simpleStartResearch)\(/)
})

test('normalizes eRank queue rows so completed results suppress duplicate capture states', () => {
  assert.match(app, /const completedKeys = new Set\(completed\.map\(\(row\) => normalizePhrase\(row\.keyword\)\)\)/)
  assert.match(app, /!completedKeys\.has\(normalizePhrase\(row\.keyword\)\)/)
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

test('copies only A and B final keywords in their result order', () => {
  assert.match(app, /async function copyFinalKeywords\(\)/)
  assert.match(app, /everbeeResultRows\(\)\s*\.filter\(\(row\) => \['A', 'B'\]\.includes\(row\.score\.opportunityLabel\)\)/)
  assert.match(app, /\.map\(\(row\) => row\.score\.normalized\.keyword\)\s*\.join\('\\n'\)/)
  assert.match(app, /elements\.copyFinalKeywordsBtn\.addEventListener\('click', copyFinalKeywords\)/)
})

test('sets the results console state and hides non-result rails', () => {
  assert.match(app, /elements\.researchConsole\.dataset\.activeStage = state\.consoleUi\.activeStage/)
  assert.match(app, /elements\.researchQueue\.hidden = state\.consoleUi\.activeStage === 'results'/)
  assert.match(app, /elements\.researchInspector\.hidden = state\.consoleUi\.activeStage === 'results'/)
})

test('renders only the active research stage details', () => {
  assert.match(app, /function renderActiveResearchStage\(\)/)
  assert.match(app, /switch \(state\.consoleUi\.activeStage\)/)
  assert.match(app, /case 'conditions':[\s\S]{0,300}renderTrendScoutStatus\(\)[\s\S]{0,300}renderBroadHints\(\)[\s\S]{0,300}renderSearchSeedRows\(\)/)
  assert.match(app, /case 'candidates':[\s\S]{0,160}renderCandidates\(\)/)
  assert.match(app, /case 'erank':[\s\S]{0,160}renderErankResults\(\)/)
  assert.match(app, /case 'etsy':[\s\S]{0,160}renderMarketplaceInsightPlan\(\)/)
  assert.match(app, /case 'results':[\s\S]{0,300}renderResultsTable\(\)[\s\S]{0,300}renderCrossNicheDrilldown\(\)[\s\S]{0,300}renderSeoPlan\(\)/)
  assert.match(app, /function renderActiveResearchStage\(\)[\s\S]{0,1800}renderResearchQueue\(\)[\s\S]{0,300}renderResearchInspector\(\)/)
  assert.match(app, /function renderAll\(\) \{\s*renderResearchStageTabs\(\)\s*renderActiveResearchStage\(\)\s*persistMarketFinderState\(\)\s*\}/)
})

test('dispatches only the selected stage detail renderers', () => {
  const body = app.match(/function renderActiveResearchStage\(\) \{([\s\S]*?)\n\}\n\nfunction renderAll\(\)/)?.[1]
  assert.ok(body, 'active stage renderer must be extractable')

  const createDispatcher = new Function(
    'state',
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
    `return function renderActiveResearchStage() {${body}\n}`,
  )
  const expected = {
    conditions: ['trend', 'broad', 'seeds', 'queue', 'inspector'],
    candidates: ['candidates', 'queue', 'inspector'],
    erank: ['erank', 'queue', 'inspector'],
    etsy: ['etsy', 'queue', 'inspector'],
    results: ['results', 'cross-niche', 'seo', 'queue', 'inspector'],
  }

  for (const [stage, calls] of Object.entries(expected)) {
    const rendered = []
    const render = (name) => () => rendered.push(name)
    const dispatch = createDispatcher(
      { consoleUi: { activeStage: stage } },
      render('trend'),
      render('broad'),
      render('seeds'),
      render('candidates'),
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
  assert.match(pollSuccessHandler, /importExtensionResults\(response\.state\)[\s\S]{0,200}renderExtensionStateUpdate\(\)/)
  assert.doesNotMatch(importHandler, /renderAll\(\)/)
  assert.doesNotMatch(marketStateHandler, /renderMarketplaceInsightPlan\(\)/)
  assert.doesNotMatch(pollSuccessHandler, /renderMarketplaceInsightPlan\(\)/)
  assert.match(app, /case 'etsy':[\s\S]{0,160}renderMarketplaceInsightPlan\(\)/)
})

test('refreshes the active stage once for every extension import outcome', () => {
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
    'renderExtensionState',
    'renderResearchStageTabs',
    'renderActiveResearchStage',
    `return function renderExtensionStateUpdate() {${refreshBody}\n}`,
  )
  const scenarios = [
    { label: 'active empty', state: { active: true, results: [] }, expectedImport: false, expectedPersists: 0 },
    { label: 'imported result', state: { active: true, results: [{ keyword: 'ghost shirt' }] }, expectedImport: true, expectedPersists: 1 },
    { label: 'inactive ignore', state: { active: false, results: [] }, expectedImport: false, expectedPersists: 0 },
  ]

  for (const scenario of scenarios) {
    const appState = {
      researchRows: [],
      acceptExtensionResults: false,
      restoredResearchSavedAt: '',
      restoredResultsAccepted: false,
      progress: { mode: 'idle' },
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
      () => rendered.push('extension'),
      () => rendered.push('tabs'),
      () => rendered.push('active'),
    )

    assert.equal(importResults(scenario.state), scenario.expectedImport, scenario.label)
    refresh()
    assert.equal(persistCount, scenario.expectedPersists, scenario.label)
    assert.deepEqual(rendered, ['extension', 'tabs', 'active'], scenario.label)
  }
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

test('puts every next action after the result or inputs it uses', () => {
  assert.ok(position('yearInput') < position('trendAutoBtn'))
  assert.ok(position('candidateList') < position('candidateErankBtn'))
  assert.ok(position('erankResultsList') < position('marketplaceStartBtn'))
  assert.ok(position('marketplaceResultsList') < position('erankToEverbeeBtn'))
  assert.ok(position('erankToEverbeeBtn') < position('resultsList'))
})

test('does not render duplicate automatic research buttons above the steps', () => {
  assert.doesNotMatch(html, /id="simpleImportErankBtn"/)
  assert.doesNotMatch(html, /id="simpleStartBtn"/)
})

test('starts Etsy after eRank and renders official results before EverBee', () => {
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
  assert.match(app, /elements\.marketplaceStartBtn\.addEventListener\('click', startMarketplaceInsight\)/)
  assert.match(app, /elements\.marketplaceNextBtn\.addEventListener\('click', runMarketplaceInsightAutomation\)/)
  assert.match(app, /elements\.marketplaceAutoStopBtn\.addEventListener\('click', stopMarketplaceInsightAutomation\)/)
  assert.doesNotMatch(app, /結果が見えたら「表示中の結果を取り込む」を押してください/)
})

test('keeps the Etsy action clickable when eRank is ready but the extension is disconnected', () => {
  assert.match(app, /const hasErankResults = erankResultRows\(\)\.length > 0/)
  assert.match(app, /elements\.marketplaceStartBtn\.disabled = state\.marketplaceInsightBusy \|\| state\.marketplaceInsightAutoRunning \|\| eligibleCandidates\.length === 0/)
  assert.doesNotMatch(app, /elements\.marketplaceStartBtn\.disabled = [^\n]*!state\.extensionConnected/)
  assert.match(app, /eRank結果はありますが、Etsy公式へ進める基準を通った候補は0件です/)
  assert.match(app, /eRank確認は完了しています。実Chromeで開き、Chrome拡張/)
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

test('shows product-level EverBee sales in monthly-sales order with recent winners marked', () => {
  assert.match(app, /function renderEverbeeProductRows\(row\)/)
  assert.match(app, /EverBee売れ筋商品/)
  assert.match(app, /月間販売数順 \/ 緑は公開12か月以内/)
  assert.match(app, /b\.monthlySales/)
  assert.match(app, /is-new-winner/)
  assert.match(app, /everbeeResultsToBroadListings\(results\)/)
  assert.doesNotMatch(app, /sales: result\.topMonthlySales/)
})

test('automatically routes cross-niche candidates while preserving earlier results', () => {
  assert.match(html, /id="crossNicheSection"/)
  assert.match(html, /id="crossNicheList"/)
  assert.match(html, /id="crossNicheStatus"/)
  assert.ok(position('crossNicheSection') < position('resultsList'))
  assert.match(html, /高競合の売れ筋を自動で掘り下げる/)
  assert.doesNotMatch(html, /id="buildNextRoundBtn"/)
  assert.doesNotMatch(html, /上位候補を次の調査へ追加/)
  assert.match(app, /buildCrossNicheDrilldown/)
  assert.match(app, /function renderCrossNicheDrilldown\(\)/)
  assert.match(app, /function syncCrossNicheWorkflow\(/)
  assert.match(app, /advanceCrossNicheWorkflow/)
  assert.match(app, /isCrossNicheWorkflowPending/)
  assert.match(app, /state\.crossNicheWorkflow/)
  assert.match(app, /const needsAdaptiveMigration = !isCrossNicheWorkflowPending\(state\.crossNicheWorkflow\)/)
  assert.doesNotMatch(app, /再調査が終わるまで最終おすすめを確定しません/)
  assert.match(app, /初回結果は下に残しています/)
  assert.match(html, /id="researchRoundTabs"/)
  assert.match(html, /id="researchRoundSummary"/)
  assert.match(app, /state\.researchRounds\.selectedRoundId = 'all'/)
  assert.match(app, /preserveCrossNicheResearch/)
  assert.match(app, /if \(!isCrossNicheWorkflowPending\(state\.crossNicheWorkflow\)\) \{\s*if \(added > 0\) generateCandidates/)
  assert.match(app, /buildErankQueryPlan/)
  assert.match(app, /setFlowMode\('auto'\)/)
  assert.match(app, /document\.querySelector\('\.candidates-panel'\)\?\.scrollIntoView/)
  assert.match(app, /crossNicheParent/)
  assert.match(app, /'Cross Niche Parent'/)
  assert.match(app, /'Cross Niche Depth'/)
  assert.match(app, /row\.crossNicheParent \?\? ''/)
  assert.match(app, /row\.crossNicheDepth \?\? ''/)
  assert.match(app, /function limitNextResearchCandidates\(candidates, limit = 12\)/)
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
  assert.match(app, /if \(!preserveMarketplacePlan\) beginInitialResearchRound\(\)/)
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

test('separates product tests, exploration candidates, and exclusions', () => {
  assert.match(html, /調査結果と商品化候補/)
  assert.match(app, /title: '商品化テスト候補'/)
  assert.match(app, /title: '追加探索候補'/)
  assert.match(app, /title: '除外候補'/)
  assert.match(app, /collapsible: true/)
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

test('switches stages without clearing research data', () => {
  assert.match(app, /function setActiveResearchStage\(/)
  assert.match(app, /bindResearchStageTabs\(elements\.researchStageTabs, setActiveResearchStage\)/)
  assert.doesNotMatch(app, /function setActiveResearchStage[\s\S]{0,500}state\.researchRows = \[\]/)
})

test('separates restored results from the current research run', () => {
  assert.match(app, /restoredResearchSavedAt: ''/)
  assert.match(app, /acceptExtensionResults: false/)
  assert.match(app, /latestResearchCheckedAt\(state\.researchRows\)/)
  assert.match(app, /前回の保存結果を表示中です。Chrome拡張のReloadで再調査した結果ではありません/)
  assert.match(app, /if \(importMode === 'restore'\)/)
  assert.match(app, /label: '前回のeRank・Etsy・EverBee結果'/)
  assert.match(app, /state\.acceptExtensionResults = true/)
  assert.match(app, /restoredResultsAccepted: false/)
  assert.match(app, /data-use-restored-results/)
  assert.match(app, /この前回結果から続ける/)
  assert.match(app, /if \(restoredResultsAwaitingConfirmation\(\)\) return \[\]/)
  assert.match(app, /const canUsePlan = hasPlan && !restoredAwaiting/)
})

test('synchronizes radio checked state in setFlowMode', () => {
  assert.match(app, /choice\.checked = choice\.dataset\.flowChoice === activeMode/)
  assert.match(app, /choice\.closest\('\.flow-choice'\)/)
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
