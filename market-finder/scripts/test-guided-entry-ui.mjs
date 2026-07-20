import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

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

test('uses one set of five numbered workflow steps', () => {
  assert.doesNotMatch(html, /class="workflow-strip"/)
  for (let step = 1; step <= 5; step += 1) {
    assert.match(html, new RegExp(`class="section-kicker">${step} \\/ 5<`))
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

test('explains when a safe eRank hold candidate is being rechecked on Etsy', () => {
  assert.match(app, /eRank保留から再確認/)
  assert.match(app, /officialProbe/)
})

test('persists extension results and restores completed results explicitly', () => {
  assert.match(app, /extensionResultsImportMode/)
  assert.match(app, /const importMode = extensionResultsImportMode/)
  assert.match(app, /addResearchRows\(importedRows\)/)
  assert.match(app, /persistMarketFinderState\(\)/)
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
