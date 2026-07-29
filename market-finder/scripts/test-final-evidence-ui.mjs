import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [rawHtml, rawApp, rawCss] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
])
const html = rawHtml.replace(/\r\n/g, '\n')
const app = rawApp.replace(/\r\n/g, '\n')
const css = rawCss.replace(/\r\n/g, '\n')

test('provides a single final evidence matrix with filters and bulk verification', () => {
  assert.match(html, /id="finalEvidenceFilters"/)
  assert.match(html, /id="finalEvidenceScopeStatus"/)
  assert.match(html, /id="verifyPendingEvidenceBtn"/)
  assert.match(html, /id="finalEvidenceTable"/)
  assert.match(app, /function finalEvidenceRows\(/)
  assert.match(app, /function renderFinalEvidenceMatrix\(/)
  assert.match(app, /async function verifyPendingEvidence\(/)
})

test('keeps eRank as an optional advanced panel inside the final stage', () => {
  const finalStage = html.match(/data-research-panel="results"[\s\S]*?(?=<section class="seo-section)/)?.[0] ?? ''

  assert.match(finalStage, /<details[^>]*class="[^"]*erank-advanced-panel[^"]*"/)
  assert.match(finalStage, /<summary>eRankで追加確認<\/summary>/)
  assert.match(finalStage, /id="candidateErankBtn"/)
  assert.match(finalStage, /id="erankResultsList"/)
  assert.match(app, /elements\.candidateErankBtn\.addEventListener\('click', simpleStartErankResearch\)/)
  assert.match(app, /elements\.erankResultsList\.addEventListener\('click'/)
})

test('edits profit evidence for the selected final row without replacing its market score', () => {
  assert.match(html, /id="profitStrategyPanel"/)
  assert.match(html, /市場機会スコア/)
  assert.match(html, /商品化・利益スコア/)
  assert.match(app, /function renderProfitStrategyAssessment\(/)
  assert.match(app, /function deriveProfitStrategyInput\(/)
  assert.match(app, /state\.profitInputsByKeyword/)
  assert.match(app, /data-profit-input/)
  assert.match(app, /deriveProfitStrategyAssessment/)
  assert.match(app, /selectVisibleProfitRow/)
})

test('labels bulk verification as a selected shortlist instead of every generated idea', () => {
  assert.match(app, /buildFinalEvidenceKeywordPool/)
  assert.match(app, /analysis\.scoredRows\.filter\(hasCollectedEvidence\)/)
  assert.match(app, /selectedResearchRoundKeywords\(state\.researchRounds\.rounds/)
  assert.match(app, /選抜済みを自動検証/)
  assert.match(app, /候補アイデア[\s\S]*選抜外/)
  assert.doesNotMatch(app, /未検証をすべて自動検証/)
})

test('starts a fresh selected round when a new candidate search replaces the current plan', () => {
  assert.match(
    app,
    /if \(!preserveMarketplacePlan\) \{\s*state\.researchRounds = createResearchRoundsState\(\)\s*beginInitialResearchRound\(\)\s*\}/,
  )
})

test('continues fifty-row verification batches automatically until stopped or complete', () => {
  assert.match(app, /FINAL_EVIDENCE_BATCH_SIZE\s*=\s*50/)
  assert.match(app, /pendingEvidenceAutomation:\s*\{[\s\S]*?active:\s*false/)
  assert.match(app, /function schedulePendingEvidenceAutomation\(/)
  assert.match(app, /function stopPendingEvidenceAutomation\(/)
  assert.match(app, /candidateLimit:\s*batchLimit/)
  assert.match(app, /wasActive\s*&&\s*!data\.state\?\.active[\s\S]*schedulePendingEvidenceAutomation/)
  assert.match(app, /選抜済みを自動検証/)
  assert.match(app, /自動検証を停止/)
})

test('continues with a new taxonomy batch after a completed no-winner verification', () => {
  assert.match(app, /from '\.\/winning-niche-automation\.js\?v=/)
  assert.match(app, /winningNicheAutomation:\s*createWinningNicheAutomation\(\)/)
  assert.match(app, /function queueNextWinningNicheBatch\(/)
  assert.match(app, /function startWinningNicheSearch\(/)
  assert.match(app, /function pauseWinningNicheSearch\(/)
  assert.match(app, /function stopWinningNicheSearch\(/)
  assert.match(app, /function resumeWinningNicheSearch\(/)
  assert.match(app, /evaluateWinningNicheRows\(/)
  assert.match(app, /queueNextWinningNicheBatch\(\)/)
})

test('confirms saved EverBee sellers on Etsy before generating another taxonomy batch', () => {
  const completeBody = app.match(/function completeWinningNicheBatch\(\) \{([\s\S]*?)\n\}\n\nfunction renderPendingEvidenceAutomationButton/)?.[1] ?? ''
  assert.match(completeBody, /pendingEvidenceBatch\(\s*finalEvidenceRows\(\),\s*'pending-etsy',\s*8,\s*\)/)
  assert.match(completeBody, /targetKeywords:\s*etsyConfirmationRows\.map\(\(row\) => row\.keyword\)/)
  assert.ok(
    completeBody.indexOf("pendingEvidenceBatch(\n    finalEvidenceRows(),\n    'pending-etsy',\n    8,") < completeBody.lastIndexOf('queueNextWinningNicheBatch()'),
  )
})

test('prefilters continuous taxonomy batches with EverBee before limited Etsy confirmation', () => {
  assert.match(app, /sanitizeLegacyMarketplaceInsightRow/)
  assert.match(app, /isEtsyEvidenceChecked/)
  assert.match(app, /selectEtsyConfirmationKeywords/)
  assert.match(app, /verificationStageForRow/)
  assert.match(app, /etsyMetricCaptureVersion:\s*2/)
  assert.match(
    app,
    /type:\s*'continuous-niche'[\s\S]*status:\s*'pending-everbee'/,
  )
  assert.match(
    app,
    /state\.researchRows = Array\.isArray\(savedState\.researchRows\)[\s\S]*sanitizeLegacyMarketplaceInsightRow/,
  )
})

test('persists continuous-search progress and restores running work as paused', () => {
  assert.match(app, /winningNicheAutomation:\s*state\.winningNicheAutomation/)
  assert.match(
    app,
    /createWinningNicheAutomation\(\{[\s\S]*savedState\.winningNicheAutomation[\s\S]*targetWinnerCount:\s*restoredWinnerTarget/,
  )
  assert.match(app, /前回の連続探索を復元しました/)
})

test('keeps manual cross-niche confirmation but auto-applies it during continuous search', () => {
  assert.match(app, /winningNicheSearchIsRunning\(\)[\s\S]*applyCrossNicheProposal\(\)/)
  assert.match(app, /data-cross-niche-apply/)
  assert.match(app, /data-cross-niche-dismiss/)
})

test('shows a desktop exploration rail with one stop or resume control', () => {
  assert.match(html, /id="winningNicheAutomationPanel"/)
  assert.match(html, /id="winningNicheAutomationRail"/)
  assert.match(html, /id="winningNicheAutomationStatus"/)
  assert.match(html, /id="winningNicheAutomationToggle"/)
  assert.match(app, /function renderWinningNicheAutomation\(/)
  assert.match(app, /data-winning-niche-axis/)
  assert.match(app, /stopWinningNicheSearch/)
  assert.match(app, /resumeWinningNicheSearch/)
  assert.match(css, /\.winning-niche-automation-panel/)
  assert.match(css, /\.winning-niche-rail/)
})

test('keeps continuous exploration visible outside every stage-specific panel', () => {
  const automationPanelIndex = html.indexOf('id="winningNicheAutomationPanel"')
  const researchConsoleIndex = html.indexOf('id="researchConsole"')

  assert.ok(automationPanelIndex >= 0)
  assert.ok(researchConsoleIndex >= 0)
  assert.ok(
    automationPanelIndex < researchConsoleIndex,
    'continuous exploration must remain visible while Conditions, Etsy, or EverBee is active',
  )
  assert.match(app, /function renderAll\(\)\s*\{\s*renderGlobalResearchStatus\(\)\s*renderWinningNicheAutomation\(\)/)
})

test('turns the completed no-winner state into continuous-search guidance', () => {
  assert.match(app, /勝ち候補を探索中/)
  assert.match(app, /次の未調査カテゴリ/)
  assert.doesNotMatch(app, /<h3>今回は採用できるキーワードなし<\/h3>/)
})

test('updates the automation button without rebuilding the final evidence table', () => {
  const toggleBody = app.match(/async function togglePendingEvidenceAutomation\(\) \{([\s\S]*?)\n\}\n\nasync function verifyPendingEvidence/)?.[1] ?? ''
  const stopBody = app.match(/function stopPendingEvidenceAutomation\(message = ''\) \{([\s\S]*?)\n\}\n\nfunction schedulePendingEvidenceAutomation/)?.[1] ?? ''

  assert.match(app, /function renderPendingEvidenceAutomationButton\(/)
  assert.match(toggleBody, /renderPendingEvidenceAutomationButton\(/)
  assert.match(stopBody, /renderPendingEvidenceAutomationButton\(/)
  assert.doesNotMatch(toggleBody, /renderResultsTable\(/)
  assert.doesNotMatch(stopBody, /renderResultsTable\(/)
})

test('reschedules automatic verification while another external task is still active', () => {
  assert.match(
    app,
    /if \(state\.extensionState\?\.active \|\| state\.marketplaceInsightAutoRunning \|\| state\.marketplaceInsightBusy\) \{\s*schedulePendingEvidenceAutomation\(2000\)\s*return\s*\}/,
  )
})

test('freezes the selected verification scope when automation starts', () => {
  assert.match(app, /targetKeywords:\s*initialPendingRows\.map\(\(row\) => row\.keyword\)/)
  assert.match(app, /allowedKeywords:\s*state\.pendingEvidenceAutomation\.targetKeywords/)
  assert.match(app, /const allowedKeywordSet = new Set/)
})

test('checks the extension background before starting selected verification', () => {
  const confirmBody = app.match(/async function confirmExtensionConnection\(\) \{([\s\S]*?)\n\}\n\nfunction handleExtensionMessage/)?.[1] ?? ''

  assert.match(app, /async function confirmExtensionConnection\(/)
  assert.match(app, /requestExtension\('GET_MARKET_STATE', \{\}, 5000\)/)
  assert.match(
    confirmBody,
    /if \(state\.extensionConnected && state\.extensionVersion === REQUIRED_EXTENSION_VERSION\) return true/,
  )
  assert.match(app, /if \(!await confirmExtensionConnection\(\)\) return/)
  assert.match(app, /data\.action === 'BRIDGE_UNAVAILABLE'/)
  assert.match(app, /if \(String\(data\.version \?\? ''\) !== REQUIRED_EXTENSION_VERSION\)/)
})

test('stops automatic verification without consuming pending rows at the eRank daily limit', () => {
  assert.match(app, /function isErankDailyLimitError\(/)
  assert.match(app, /isErankDailyLimitError\(data\.state\?\.error\)/)
  assert.match(app, /eRankの1日あたりの検索上限/)
  assert.match(app, /stopPendingEvidenceAutomation/)
})

test('uses the pure evidence state module instead of a second scoring model', () => {
  assert.match(app, /from '\.\/final-evidence-matrix\.js\?v=/)
  assert.match(app, /deriveFinalEvidenceState/)
  assert.match(app, /deriveFinalScoreState/)
  assert.match(app, /formatEvidenceMetric/)
  assert.match(app, /pendingEvidenceBatch/)
  assert.doesNotMatch(app, /function scoreFinalEvidence/)
})

test('keeps headers and the first three comparison columns visible on desktop', () => {
  assert.match(css, /\.final-evidence-table-shell\s*\{[^}]*overflow:\s*auto/s)
  assert.match(css, /\.final-evidence-table\s+thead\s+th\s*\{[^}]*position:\s*sticky/s)
  assert.match(css, /\.final-evidence-table\s+\.is-sticky-column\s*\{[^}]*position:\s*sticky/s)
  assert.match(css, /min-width:\s*3500px/)
})

test('shows an explicit keyword decision before the comparison table', () => {
  assert.match(html, /id="finalKeywordDecision"/)
  assert.match(app, /function renderFinalKeywordDecision\(/)
  assert.match(app, /deriveFinalKeywordDecision/)
  assert.match(app, /まず使うキーワード/)
  assert.match(app, /勝ち候補を探索中/)
})

test('provides an always-accessible horizontal scrollbar synchronized with the table', () => {
  assert.match(html, /id="finalEvidenceScrollProxy"/)
  assert.match(html, /id="finalEvidenceScrollProxyTrack"/)
  assert.match(css, /\.final-evidence-scroll-proxy\s*\{[^}]*position:\s*sticky/s)
  assert.match(css, /\.final-evidence-scroll-proxy\s*\{[^}]*overflow-x:\s*auto/s)
  assert.match(app, /function syncFinalEvidenceScrollbars\(/)
  assert.match(app, /finalEvidenceScrollProxy\.scrollLeft/)
  assert.match(app, /finalEvidenceTable\.scrollLeft/)
})

test('shows every designed evidence field in the comparison table', () => {
  for (const header of ['Trend', 'Etsy Conversion', '関連語', 'Median Revenue', '判定理由']) {
    assert.match(app, new RegExp(`<th>${header}</th>`))
  }
  assert.match(app, /normalized\.etsyRelatedTerms/)
  assert.match(app, /data\.medianMonthlyRevenue/)
  assert.match(app, /decisionReasons/)
})

test('does not rebuild the large evidence table when its HTML is unchanged', () => {
  assert.match(app, /renderHtmlIfChanged\(elements\.finalEvidenceTable,\s*tableHtml\)/)
  assert.match(app, /renderHtmlIfChanged\(elements\.resultsList,\s*detailHtml\)/)
})

test('limits Etsy bulk verification to the selected evidence batch', () => {
  assert.match(app, /function rebuildMarketplaceInsightPlan\(\{\s*preserveExisting = false,\s*keywords = \[\]/)
  assert.match(app, /rebuildMarketplaceInsightPlan\(\{\s*preserveExisting:\s*true,\s*keywords\s*\}\)/)
  assert.match(app, /requestedKeywordKeys/)
  assert.match(app, /'targeted-batch':\s*'指定した候補の確認完了'/)
})

test('routes EverBee failures to a retryable failed state', () => {
  assert.match(app, /const everbeeFailed =/)
  assert.match(app, /everbeeFailed\s*\?\s*'pending-everbee'/)
})

test('labels eRank provider no-data as Unknown for users', () => {
  assert.match(app, /'no-data':\s*'Unknown'/)
  assert.doesNotMatch(app, /'no-data':\s*'eRankデータなし'/)
})

test('exports verification metadata with both result CSVs', () => {
  for (const header of ['Verification Status', 'Missing Stages', 'Score Type', 'eRank Capture Status']) {
    assert.ok(app.split(header).length >= 3, `${header} must exist in both CSV exports`)
  }
  assert.match(app, /Unknown/)
  assert.match(app, /const unknownMetric = row\.status === 'no-data' \? 'Unknown' : ''/)
})

test('hands the design step a few themes as series, not a flat keyword list', () => {
  assert.match(html, /id="designShortlistPanel"/)
  assert.match(html, /id="downloadDesignShortlistBtn"/)
  assert.match(html, /id="designShortlistMoreBtn"/)
  assert.match(html, /id="designShortlistResetBtn"/)
  assert.match(html, /次に作る4テーマ/)
  assert.match(html, /1テーマ＝1シリーズとして5〜8商品/)
  assert.ok(html.indexOf('id="designShortlistPanel"') > html.indexOf('id="finalKeywordDecision"'))
  assert.match(app, /function renderDesignShortlist\(\)/)
  assert.match(app, /function currentDesignClusterPlan\(\)/)
  assert.match(app, /function exportDesignShortlistCsv\(\)/)
  assert.match(app, /selectDesignClusters/)
  assert.match(app, /class="design-cluster"/)
  // One listing serves one buyer intent, so the handoff must not flatten the clusters away.
  assert.doesNotMatch(app, /selectDesignShortlist/)
  // Only verified rows may reach the design handoff.
  assert.match(app, /row\.evidenceState\.status === 'verified'\)\s*\n\s*\.map\(\(row\) => row\.everbeeRow\)/)
  // The full export must stay available so the shortlist is a view, not a filter on the data.
  assert.match(app, /function exportStep4Csv\(\)\s*\{\s*exportResultRowsCsv\(everbeeResultRows\(\)/)
})
