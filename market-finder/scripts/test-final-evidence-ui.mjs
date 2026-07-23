import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [html, app, css] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
])

test('provides a single final evidence matrix with filters and bulk verification', () => {
  assert.match(html, /id="finalEvidenceFilters"/)
  assert.match(html, /id="verifyPendingEvidenceBtn"/)
  assert.match(html, /id="finalEvidenceTable"/)
  assert.match(app, /function finalEvidenceRows\(/)
  assert.match(app, /function renderFinalEvidenceMatrix\(/)
  assert.match(app, /async function verifyPendingEvidence\(/)
})

test('continues fifty-row verification batches automatically until stopped or complete', () => {
  assert.match(app, /FINAL_EVIDENCE_BATCH_SIZE\s*=\s*50/)
  assert.match(app, /pendingEvidenceAutomation:\s*\{[\s\S]*?active:\s*false/)
  assert.match(app, /function schedulePendingEvidenceAutomation\(/)
  assert.match(app, /function stopPendingEvidenceAutomation\(/)
  assert.match(app, /candidateLimit:\s*batchLimit/)
  assert.match(app, /wasActive\s*&&\s*!data\.state\?\.active[\s\S]*schedulePendingEvidenceAutomation/)
  assert.match(app, /未検証をすべて自動検証/)
  assert.match(app, /自動検証を停止/)
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
  assert.match(css, /min-width:\s*2800px/)
})

test('shows an explicit keyword decision before the comparison table', () => {
  assert.match(html, /id="finalKeywordDecision"/)
  assert.match(app, /function renderFinalKeywordDecision\(/)
  assert.match(app, /deriveFinalKeywordDecision/)
  assert.match(app, /まず使うキーワード/)
  assert.match(app, /今回は採用できるキーワードなし/)
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
