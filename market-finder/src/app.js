import {
  MARKET_EVENTS,
  PRODUCT_CATEGORIES,
  generateBroadMarketQueries,
  generateKeywordCandidates,
  generateFollowUpKeywords,
  parseBroadMarketListings,
  extractNicheHintsFromListings,
  parseEverbeeRows,
  rankResearchRows,
  buildProductIdea,
  classifyKeywordBucket,
  buildSeoPlanFromBuckets,
  scoreEverbeeResult,
  scoreErankOpportunity,
  normalizePhrase,
  resolveMarketEvent,
} from '../../shared/market-keyword-engine/index.js'

const PAGE_SOURCE = 'market-finder-page'
const EXTENSION_SOURCE = 'market-finder-extension'

const state = {
  candidates: [],
  researchRows: [],
  broadHints: [],
  broadAutoImport: false,
  broadSnippetKeys: new Set(),
  progress: {
    mode: 'idle',
    total: 0,
    title: 'EverBee調査',
    visible: false,
    started: false,
    wasActive: false,
    stopped: false,
    failed: false,
    message: '',
  },
  extensionConnected: false,
  extensionState: null,
  seoPlan: null,
}

const pendingExtensionRequests = new Map()
const MONTH_LABELS = [
  '月未設定',
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
]

const elements = {
  eventSelect: document.querySelector('#eventSelect'),
  customEventInput: document.querySelector('#customEventInput'),
  categorySelect: document.querySelector('#categorySelect'),
  yearInput: document.querySelector('#yearInput'),
  limitInput: document.querySelector('#limitInput'),
  targetChips: document.querySelector('#targetChips'),
  seedInput: document.querySelector('#seedInput'),
  broadQueryInput: document.querySelector('#broadQueryInput'),
  broadBuildQueriesBtn: document.querySelector('#broadBuildQueriesBtn'),
  broadStartBtn: document.querySelector('#broadStartBtn'),
  broadMarketInput: document.querySelector('#broadMarketInput'),
  broadExtractBtn: document.querySelector('#broadExtractBtn'),
  broadApplyBtn: document.querySelector('#broadApplyBtn'),
  broadSampleBtn: document.querySelector('#broadSampleBtn'),
  broadHintList: document.querySelector('#broadHintList'),
  broadStatus: document.querySelector('#broadStatus'),
  riskInput: document.querySelector('#riskInput'),
  generateBtn: document.querySelector('#generateBtn'),
  candidateList: document.querySelector('#candidateList'),
  candidateCount: document.querySelector('#candidateCount'),
  keywordSelect: document.querySelector('#keywordSelect'),
  listingsInput: document.querySelector('#listingsInput'),
  salesInput: document.querySelector('#salesInput'),
  revenueInput: document.querySelector('#revenueInput'),
  priceInput: document.querySelector('#priceInput'),
  ageInput: document.querySelector('#ageInput'),
  erankSearchInput: document.querySelector('#erankSearchInput'),
  erankClicksInput: document.querySelector('#erankClicksInput'),
  erankCtrInput: document.querySelector('#erankCtrInput'),
  erankCompetitionInput: document.querySelector('#erankCompetitionInput'),
  erankKeywordDifficultyInput: document.querySelector('#erankKeywordDifficultyInput'),
  erankTrendInput: document.querySelector('#erankTrendInput'),
  notesInput: document.querySelector('#notesInput'),
  addResearchBtn: document.querySelector('#addResearchBtn'),
  csvInput: document.querySelector('#csvInput'),
  importCsvBtn: document.querySelector('#importCsvBtn'),
  sampleCsvBtn: document.querySelector('#sampleCsvBtn'),
  erankResultsList: document.querySelector('#erankResultsList'),
  erankSummary: document.querySelector('#erankSummary'),
  erankCount: document.querySelector('#erankCount'),
  resultsList: document.querySelector('#resultsList'),
  copyKeywordsBtn: document.querySelector('#copyKeywordsBtn'),
  copyReadyBtn: document.querySelector('#copyReadyBtn'),
  downloadJobBtn: document.querySelector('#downloadJobBtn'),
  buildNextRoundBtn: document.querySelector('#buildNextRoundBtn'),
  everbeeUrlInput: document.querySelector('#everbeeUrlInput'),
  researchJobInput: document.querySelector('#researchJobInput'),
  fillResearchJobBtn: document.querySelector('#fillResearchJobBtn'),
  clearResearchJobBtn: document.querySelector('#clearResearchJobBtn'),
  delayInput: document.querySelector('#delayInput'),
  startExtensionBtn: document.querySelector('#startExtensionBtn'),
  stopExtensionBtn: document.querySelector('#stopExtensionBtn'),
  extensionBadge: document.querySelector('#extensionBadge'),
  extensionStatus: document.querySelector('#extensionStatus'),
  progressModal: document.querySelector('#progressModal'),
  progressTitle: document.querySelector('#progressTitle'),
  progressBadge: document.querySelector('#progressBadge'),
  progressCurrentKeyword: document.querySelector('#progressCurrentKeyword'),
  progressBar: document.querySelector('#progressBar'),
  progressDone: document.querySelector('#progressDone'),
  progressRemaining: document.querySelector('#progressRemaining'),
  progressTotal: document.querySelector('#progressTotal'),
  progressDetail: document.querySelector('#progressDetail'),
  progressHideBtn: document.querySelector('#progressHideBtn'),
  progressStopBtn: document.querySelector('#progressStopBtn'),
  visibilityBucketInput: document.querySelector('#visibilityBucketInput'),
  reachBucketInput: document.querySelector('#reachBucketInput'),
  bestSellerBucketInput: document.querySelector('#bestSellerBucketInput'),
  autoBucketBtn: document.querySelector('#autoBucketBtn'),
  buildSeoPlanBtn: document.querySelector('#buildSeoPlanBtn'),
  copySeoTitleBtn: document.querySelector('#copySeoTitleBtn'),
  copySeoTagsBtn: document.querySelector('#copySeoTagsBtn'),
  seoTitleOutput: document.querySelector('#seoTitleOutput'),
  seoTitleCount: document.querySelector('#seoTitleCount'),
  seoTagList: document.querySelector('#seoTagList'),
  seoWarnings: document.querySelector('#seoWarnings'),
  seoStatus: document.querySelector('#seoStatus'),
  flowAutoBtn: document.querySelector('#flowAutoBtn'),
  flowCsvBtn: document.querySelector('#flowCsvBtn'),
  flowSeoBtn: document.querySelector('#flowSeoBtn'),
  simpleGenerateBtn: document.querySelector('#simpleGenerateBtn'),
  simpleStartBtn: document.querySelector('#simpleStartBtn'),
  simpleImportErankBtn: document.querySelector('#simpleImportErankBtn'),
  simpleCsvInput: document.querySelector('#simpleCsvInput'),
  simpleImportCsvBtn: document.querySelector('#simpleImportCsvBtn'),
  simpleSeoKeywordsInput: document.querySelector('#simpleSeoKeywordsInput'),
  simpleUseSeoKeywordsBtn: document.querySelector('#simpleUseSeoKeywordsBtn'),
  simpleSeoBtn: document.querySelector('#simpleSeoBtn'),
  simpleSeoStepNumber: document.querySelector('#simpleSeoStepNumber'),
  simpleStatus: document.querySelector('#simpleStatus'),
  openAdvancedModalBtn: document.querySelector('#openAdvancedModalBtn'),
  closeAdvancedModalBtn: document.querySelector('#closeAdvancedModalBtn'),
  advancedModal: document.querySelector('#advancedModal'),
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function customEventName() {
  return String(elements.customEventInput?.value ?? '').trim()
}

function selectedEvent() {
  return resolveMarketEvent({
    eventId: elements.eventSelect.value,
    customEventName: customEventName(),
  })
}

function selectedCategory() {
  return PRODUCT_CATEGORIES.find((category) => category.id === elements.categorySelect.value) ?? PRODUCT_CATEGORIES[0]
}

function selectedTargets() {
  return Array.from(elements.targetChips.querySelectorAll('input:checked')).map((input) => input.value)
}

function selectedYearOption() {
  const value = String(elements.yearInput.value ?? '').trim()
  if (value === '') return ''
  return Number(value) || selectedEvent().defaultYear
}

function currentOptions() {
  return {
    eventId: elements.eventSelect.value,
    customEventName: customEventName(),
    categoryId: elements.categorySelect.value,
    year: selectedYearOption(),
    limit: Number(elements.limitInput.value) || 80,
    targets: selectedTargets(),
    seedKeywords: elements.seedInput.value,
    customRiskTerms: elements.riskInput.value,
  }
}

function fillSelects() {
  const eventsByMonth = MARKET_EVENTS.reduce((groups, event) => {
    const month = Number(event.month) || 0
    if (!groups.has(month)) groups.set(month, [])
    groups.get(month).push(event)
    return groups
  }, new Map())

  elements.eventSelect.innerHTML = Array.from(eventsByMonth.entries())
    .sort(([leftMonth], [rightMonth]) => leftMonth - rightMonth)
    .map(([month, events]) => {
      const groupLabel = month === 0 ? '北米 その他' : `北米 ${MONTH_LABELS[month] ?? `${month}月`}`
      const options = events.map((event) => (
        `<option value="${escapeHtml(event.id)}">${escapeHtml(event.jpLabel)} / ${escapeHtml(event.label)}</option>`
      )).join('')
      return `<optgroup label="${escapeHtml(groupLabel)}">${options}</optgroup>`
    })
    .join('')
  elements.eventSelect.value = MARKET_EVENTS.some((event) => event.id === 'fathers-day')
    ? 'fathers-day'
    : MARKET_EVENTS[0]?.id

  elements.categorySelect.innerHTML = PRODUCT_CATEGORIES.map((category) => (
    `<option value="${category.id}">${escapeHtml(category.label)}</option>`
  )).join('')
}

function renderTargets({ syncYear = true } = {}) {
  const event = selectedEvent()
  if (syncYear && !customEventName()) {
    elements.yearInput.value = event.defaultYear
  }
  elements.targetChips.innerHTML = event.targets.map((target, index) => `
    <label class="chip">
      <input type="checkbox" value="${escapeHtml(target)}" ${index < 7 ? 'checked' : ''}>
      <span>${escapeHtml(target)}</span>
    </label>
  `).join('')
}

function findResearchRow(keyword) {
  const normalized = normalizePhrase(keyword)
  return state.researchRows.find((row) => normalizePhrase(row.keyword) === normalized)
}

function readyKeywords() {
  return state.candidates
    .filter((candidate) => candidate.status === 'ready')
    .map((candidate) => candidate.keyword)
}

function erankShortlistKeywords() {
  const ranked = rankResearchRows(state.researchRows, currentOptions())
    .filter((row) => {
      const validation = row.score.validation
      const normalized = row.score.normalized
      const hasErank = validation.hasErankData
      const hasDemand = (normalized.erankSearchVolume ?? 0) > 0 || (normalized.erankClicks ?? 0) > 0
      return hasErank && hasDemand && row.score.exclusionReasons.length === 0
    })
    .map((row) => row.keyword)

  return cleanKeywordList(ranked).slice(0, 50)
}

function erankWinnerRows() {
  return erankRowsWithOpportunity()
    .filter((row) => row.erankOpportunity.action === 'everbee')
    .slice(0, 12)
}

function erankExploreRows() {
  return erankRowsWithOpportunity()
    .filter((row) => row.erankOpportunity.action === 'expand')
    .slice(0, 12)
}

function erankRowsWithOpportunity() {
  const options = currentOptions()
  return rankResearchRows(state.researchRows, options)
    .filter((row) => row.score.validation.hasErankData && !row.score.validation.hasEverbeeData)
    .map((row) => ({
      ...row,
      erankOpportunity: scoreErankOpportunity(row, options),
    }))
    .sort((a, b) => b.erankOpportunity.score - a.erankOpportunity.score || normalizePhrase(a.keyword).localeCompare(normalizePhrase(b.keyword), 'en'))
}

function erankSpecificTokens(keyword) {
  const eventTokens = selectedEvent().searchTerm.split(/\s+/)
  const categoryTokens = [
    selectedCategory().searchTerm,
    ...(selectedCategory().tags ?? []),
  ].flatMap((value) => normalizePhrase(value).split(/\s+/))
  const stopWords = new Set([
    ...eventTokens,
    ...categoryTokens,
    'for',
    'and',
    'the',
    'with',
    'from',
    'to',
    'by',
    'of',
    'a',
    'an',
  ].map((value) => normalizePhrase(value)).filter(Boolean))

  return normalizePhrase(keyword)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token))
}

function narrowEverbeeKeywordsFromErank() {
  const winners = erankWinnerRows()
  const signalRows = uniqueRowsByKeyword([...winners, ...erankExploreRows()]).slice(0, 12)
  const ready = state.candidates.filter((candidate) => candidate.status === 'ready')
  if (signalRows.length === 0 || ready.length === 0) return readyKeywords()

  const hasSpecificWinner = signalRows.some((row) => erankSpecificTokens(row.keyword).length > 0)
  const scored = ready.map((candidate) => {
    const candidateText = normalizePhrase(candidate.keyword)
    let score = candidate.score

    for (const [index, row] of signalRows.entries()) {
      const tokens = erankSpecificTokens(row.keyword)
      if (tokens.length === 0) {
        score += hasSpecificWinner ? 0 : Math.max(1, 10 - index)
        continue
      }

      const matched = tokens.filter((token) => candidateText.includes(token)).length
      if (matched > 0) {
        score += matched * 30
        score += Math.max(0, 12 - index)
        score += Math.round(row.score.score / 8)
      }
    }

    return { keyword: candidate.keyword, score }
  })
    .filter((item) => !hasSpecificWinner || item.score > ready.find((candidate) => candidate.keyword === item.keyword)?.score)
    .sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword, 'en'))
    .map((item) => item.keyword)

  const expanded = buildEverbeeKeywordsFromErankRows(signalRows)
  return cleanKeywordList([...expanded, ...(scored.length > 0 ? scored : readyKeywords())]).slice(0, 50)
}

function uniqueRowsByKeyword(rows) {
  const seen = new Set()
  return rows.filter((row) => {
    const keyword = normalizePhrase(row.keyword)
    if (!keyword || seen.has(keyword)) return false
    seen.add(keyword)
    return true
  })
}

function buildEverbeeKeywordsFromErankRows(rows) {
  const event = selectedEvent()
  const category = selectedCategory()
  const product = normalizePhrase(category.searchTerm)
  const eventSignals = event.searchTerm
    .split(/\s+/)
    .map((token) => token.replace(/s$/, ''))
    .filter((token) => token.length > 3)
  const year = selectedYearOption()
  const seedKeywords = rows.map((row) => row.keyword).join('\n')
  const generated = generateKeywordCandidates({
    ...currentOptions(),
    seedKeywords,
    limit: Math.max(40, Math.min(Number(elements.limitInput.value) || 80, 120)),
  })
    .filter((candidate) => candidate.status === 'ready')
    .map((candidate) => candidate.keyword)

  const productized = rows.flatMap((row) => {
    const keyword = normalizePhrase(row.keyword)
    if (!keyword) return []
    const hasEventSignal = keyword.includes(event.searchTerm)
      || (eventSignals.length > 0 && eventSignals.every((token) => keyword.includes(token)))
    const withProduct = keyword.includes(product) ? keyword : `${keyword} ${product}`
    const withEvent = hasEventSignal ? withProduct : `${event.searchTerm} ${withProduct}`
    return [withProduct, withEvent, year ? `${withProduct} ${year}` : '']
  })

  return cleanKeywordList([...productized, ...generated]).slice(0, 50)
}

function salesCheckKeywords() {
  const narrowed = narrowEverbeeKeywordsFromErank()
  return narrowed.length > 0 ? narrowed : readyKeywords()
}

function erankResearchKeywords() {
  const manualBroad = cleanKeywordList(elements.broadQueryInput.value.split(/\r?\n|,/))
  if (manualBroad.length > 0) return manualBroad.slice(0, 30)

  return generateBroadMarketQueries({
    ...currentOptions(),
    year: '',
    includeYear: false,
    limit: 24,
  })
}

function parseResearchJob(value) {
  const source = String(value ?? '').trim()
  if (!source) return []

  try {
    const parsed = JSON.parse(source)
    if (Array.isArray(parsed?.keywords)) return cleanKeywordList(parsed.keywords)
    if (Array.isArray(parsed)) return cleanKeywordList(parsed)
  } catch {
    // Plain text is handled below.
  }

  return cleanKeywordList(source.split(/\r?\n|,/))
}

function cleanKeywordList(values) {
  const seen = new Set()
  return values
    .map((value) => normalizePhrase(value))
    .filter(Boolean)
    .filter((keyword) => {
      if (seen.has(keyword)) return false
      seen.add(keyword)
      return true
    })
    .slice(0, 150)
}

function broadStopWords() {
  const event = selectedEvent()
  const category = selectedCategory()
  return [
    category.searchTerm,
  ]
}

function renderBroadHints() {
  if (state.broadHints.length === 0) {
    elements.broadHintList.innerHTML = '<div class="empty-state small">売れ筋の商品名やタグを貼り付けると、ここに種ワードが出ます。</div>'
    return
  }

  elements.broadHintList.innerHTML = state.broadHints.map((hint, index) => `
    <label class="hint-chip">
      <input type="checkbox" value="${escapeHtml(hint.keyword)}" ${index < 24 && isStrongBroadHint(hint.keyword) ? 'checked' : ''}>
      <span>${escapeHtml(hint.keyword)}</span>
      <small>${escapeHtml(hint.count)}</small>
    </label>
  `).join('')
}

function isStrongBroadHint(keyword) {
  const tokens = normalizePhrase(keyword).split(' ').filter(Boolean)
  if (tokens.length < 2) return false
  if (tokens[0] === 'est') return false
  if (tokens.every((token) => ['est', 'new', '2026', '2027'].includes(token))) return false
  return true
}

function buildBroadQueries() {
  const queries = generateBroadMarketQueries({
    ...currentOptions(),
    limit: 14,
  })
  elements.broadQueryInput.value = queries.join('\n')
  elements.broadStatus.textContent = `${queries.length}件の広め検索語を作りました。`
  return queries
}

function broadQueryList() {
  const queries = cleanKeywordList(elements.broadQueryInput.value.split(/\r?\n|,/))
  return queries.length > 0 ? queries : buildBroadQueries()
}

function extractBroadMarketHints() {
  const listings = parseBroadMarketListings(elements.broadMarketInput.value)
  if (listings.length === 0) {
    state.broadHints = []
    renderBroadHints()
    elements.broadStatus.textContent = '商品名やタグを貼り付けてください。'
    return
  }

  state.broadHints = extractNicheHintsFromListings(listings, 36, {
    stopWords: broadStopWords(),
    blockedPhrases: [selectedEvent().searchTerm, selectedCategory().searchTerm],
    blockedTokens: selectedEvent().searchTerm.split(' ').filter((token) => !['day', 'season'].includes(token)),
  })
  renderBroadHints()
  elements.broadStatus.textContent = `${listings.length}件から${state.broadHints.length}個の種ワードを抽出しました。`
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function appendBroadListingRows(rows) {
  const nextLines = []

  for (const row of rows) {
    const title = normalizePhrase(row.title)
    if (!title || state.broadSnippetKeys.has(title)) continue
    state.broadSnippetKeys.add(title)
    nextLines.push([
      csvCell(row.title),
      csvCell(row.tags ?? ''),
      csvCell(row.sales ?? ''),
    ].join(','))
  }

  if (nextLines.length === 0) return 0

  const current = elements.broadMarketInput.value.trim()
  const header = 'Product Name,Tags,Sales'
  elements.broadMarketInput.value = current
    ? `${current}\n${nextLines.join('\n')}`
    : `${header}\n${nextLines.join('\n')}`
  extractBroadMarketHints()
  return nextLines.length
}

function marketResultsToBroadRows(results = []) {
  return results.flatMap((result) => {
    const snippets = Array.isArray(result.listingSnippets) ? result.listingSnippets : []
    return snippets.map((title) => ({
      title,
      tags: result.keyword,
      sales: result.topMonthlySales,
    }))
  })
}

function ingestBroadSnippetsFromExtensionState(extensionState) {
  if (!state.broadAutoImport || !extensionState?.results?.length) return
  const rows = marketResultsToBroadRows(extensionState.results)
  const added = appendBroadListingRows(rows)
  const done = extensionState.results.length
  if (added > 0) {
    elements.broadStatus.textContent = `広め調査 ${done}件完了。商品名${added}件を取り込み、種ワードを更新しました。`
  } else if (!extensionState.active && done > 0) {
    elements.broadStatus.textContent = '広め調査は完了しましたが、EverBee画面から商品名を抽出できませんでした。商品名/タグ欄へ手動貼り付けしてください。'
  }
}

function applyBroadHintsToSeeds() {
  const selected = Array.from(elements.broadHintList.querySelectorAll('input:checked'))
    .map((input) => normalizePhrase(input.value))
    .filter(Boolean)

  if (selected.length === 0) {
    elements.broadStatus.textContent = '追加する種ワードを選んでください。'
    return
  }

  const merged = cleanKeywordList([
    ...elements.seedInput.value.split(/\r?\n|,/),
    ...selected,
  ])

  elements.seedInput.value = merged.join('\n')
  generateCandidates()
  elements.broadStatus.textContent = `${selected.length}個を追加ニッチ語句へ入れて、候補を再生成しました。`
}

function fillBroadSample() {
  elements.broadMarketInput.value = [
    'Product Name,Tags,Sales',
    '"First Fathers Day Shirt Dad Est 2026 Retro Gift","first fathers day,dad est 2026,new dad gift,retro dad shirt",42',
    '"Dog Dad Fathers Day Shirt From The Dog","dog dad,from dog,fathers day gift,dog lover dad",31',
    '"Bonus Dad Fathers Day Gift Shirt From Daughter","bonus dad,from daughter,step dad gift,family gift",18',
    '"Grandpa Est 2026 Shirt New Grandpa Gift","grandpa est 2026,new grandpa,grandpa gift",24',
    '"Girl Dad Fathers Day Shirt From Daughter","girl dad,from daughter,dad gift,matching family",16',
  ].join('\n')
  extractBroadMarketHints()
}

function renderCandidates() {
  elements.candidateCount.textContent = String(state.candidates.length)
  elements.copyKeywordsBtn.disabled = state.candidates.length === 0
  elements.copyReadyBtn.disabled = readyKeywords().length === 0
  elements.downloadJobBtn.disabled = readyKeywords().length === 0
  elements.buildNextRoundBtn.disabled = state.researchRows.length === 0
  elements.keywordSelect.innerHTML = state.candidates.map((candidate) => (
    `<option value="${escapeHtml(candidate.keyword)}">${escapeHtml(candidate.keyword)}</option>`
  )).join('')

  if (state.candidates.length === 0) {
    elements.candidateList.innerHTML = '<div class="empty-state">イベントを選んでキーワードを生成してください。</div>'
    return
  }

  elements.candidateList.innerHTML = state.candidates.map((candidate) => {
    const researched = findResearchRow(candidate.keyword)
    const resultScore = researched ? scoreEverbeeResult(researched, currentOptions()) : null
    const resultPill = resultScore?.validation.hasEverbeeData
      ? `<span class="pill ready">EverBee ${resultScore.score}点</span>`
      : resultScore?.validation.hasErankData
        ? '<span class="pill">eRank確認済み</span>'
      : ''

    return `
      <article class="candidate-row">
        <div>
          <strong>${escapeHtml(candidate.keyword)}</strong>
          <div class="meta-line">
            <span class="pill ${candidate.status === 'ready' ? 'ready' : 'review'}">${candidate.status === 'ready' ? '調査OK' : '要確認'}</span>
            <span class="pill">${candidate.wordCount} words</span>
            <span class="pill">${escapeHtml(candidate.categoryLabel)}</span>
            ${resultPill}
            ${candidate.riskTerms.length ? `<span class="pill danger">${escapeHtml(candidate.riskTerms.join(', '))}</span>` : ''}
          </div>
        </div>
        <div class="score-chip"><span>候補生成<br>優先度</span><strong>${candidate.score}</strong></div>
      </article>
    `
  }).join('')
}

function scoreReasonLabels(score) {
  const normalized = score.normalized
  const reasons = []
  if ((normalized.listingsAnalyzed ?? Infinity) < 3000) reasons.push('EverBee競合少なめ')
  else if ((normalized.listingsAnalyzed ?? Infinity) < 6000) reasons.push('EverBee競合中くらい')
  if ((normalized.topMonthlySales ?? 0) >= 30) reasons.push('月間販売が強い')
  else if ((normalized.topMonthlySales ?? 0) >= 10) reasons.push('月間販売あり')
  if ((normalized.topRevenue ?? 0) >= 1000) reasons.push('売上が強い')
  else if ((normalized.topRevenue ?? 0) >= 300) reasons.push('売上あり')
  if ((normalized.listingAgeMonths ?? Infinity) <= 12 && (normalized.topMonthlySales ?? 0) >= 10) reasons.push('新しめで売れている')
  const hasErankDemand = (normalized.erankSearchVolume ?? 0) > 0 || (normalized.erankClicks ?? 0) > 0
  if ((normalized.erankSearchVolume ?? 0) >= 300 || (normalized.erankClicks ?? 0) >= 100) reasons.push('eRank需要あり')
  if (hasErankDemand && (normalized.erankCompetition ?? Infinity) < 5000) reasons.push('eRank競合低め')
  if (hasErankDemand && (normalized.erankKeywordDifficulty ?? Infinity) <= 25) reasons.push('KD低め')
  if (score.riskTerms.length > 0) reasons.push('要リスク確認')
  return reasons.slice(0, 5)
}

function opportunityScoreClass(score) {
  if (score.label.startsWith('D')) return 'd'
  if (score.score >= 80) return 'a'
  if (score.score >= 62) return 'b'
  if (score.score >= 40) return 'c'
  return 'weak'
}

function erankResultRows() {
  return erankRowsWithOpportunity()
}

function erankOpportunityScoreClass(opportunity) {
  if (opportunity.action === 'reject') return 'd'
  if (opportunity.score >= 80) return 'a'
  if (opportunity.score >= 62) return 'b'
  if (opportunity.score >= 40) return 'c'
  return 'weak'
}

function renderErankSummary(rows) {
  if (!elements.erankSummary) return

  if (rows.length === 0) {
    elements.erankSummary.innerHTML = ''
    return
  }

  const proceedRows = rows.filter((row) => row.erankOpportunity.action === 'everbee')
  const expandRows = rows.filter((row) => row.erankOpportunity.action === 'expand')
  const holdRows = rows.filter((row) => row.erankOpportunity.action === 'hold' || row.erankOpportunity.action === 'reject')
  const nextKeywords = salesCheckKeywords()
  const conclusion = proceedRows.length > 0
    ? `有望そうな語句を${proceedRows.length}件見つけました。関連語も使って、EverBeeで売上確認する候補を${nextKeywords.length}件に絞りました。`
    : expandRows.length > 0
      ? `強い語句はまだ少なめですが、追加探索に使える語句を${expandRows.length}件見つけました。関連語からEverBee候補を${nextKeywords.length}件作っています。`
      : `今回の広い検索は弱めでした。無理に進めず、イベント・商品・手入力イベントを変えてもう一度広く見てください。`

  elements.erankSummary.innerHTML = `
    <div class="summary-main">
      <strong>${escapeHtml(conclusion)}</strong>
      <span>弱い結果が出ても、ここで終わりではありません。eRankの関連キーワードも見て、次に調べる候補を作ります。</span>
    </div>
    <div class="summary-stats">
      <span><strong>${rows.length}</strong><small>確認した語句</small></span>
      <span><strong>${proceedRows.length}</strong><small>売上確認へ</small></span>
      <span><strong>${expandRows.length}</strong><small>追加探索</small></span>
      <span><strong>${holdRows.length}</strong><small>今回は保留</small></span>
    </div>
  `
}

function renderErankCard(row) {
  const normalized = row.score.normalized
  const opportunity = row.erankOpportunity
  const labelClass = erankOpportunityScoreClass(opportunity)
  const scoreReasons = opportunity.reasons
    .slice(0, 6)
    .map((reason) => `<span class="reason-chip">${escapeHtml(reason)}</span>`)
    .join('')

  return `
    <article class="erank-item">
      <div class="result-top">
        <div class="opportunity-score ${labelClass}"><span>需要</span><strong>${opportunity.score}</strong><small>/100</small></div>
        <div>
          <h3>${escapeHtml(normalized.keyword)}</h3>
          <div class="meta-line">
            <span class="pill action-${escapeHtml(opportunity.action)}">${escapeHtml(opportunity.label)}</span>
            <span class="pill">eRankのみ</span>
            ${normalized.erankKeywordDifficulty !== null ? `<span class="pill">KD ${escapeHtml(normalized.erankKeywordDifficulty)}</span>` : ''}
          </div>
          ${scoreReasons ? `<div class="reason-line">${scoreReasons}</div>` : ''}
        </div>
      </div>

      <div class="metric-grid erank-metric-grid">
        <div class="metric"><span>Search</span><strong>${escapeHtml(normalized.erankSearchVolume ?? '-')}</strong></div>
        <div class="metric"><span>Clicks</span><strong>${escapeHtml(normalized.erankClicks ?? '-')}</strong></div>
        <div class="metric"><span>CTR</span><strong>${escapeHtml(normalized.erankCtr ?? '-')}</strong></div>
        <div class="metric"><span>Competition</span><strong>${escapeHtml(normalized.erankCompetition ?? '-')}</strong></div>
        <div class="metric"><span>KD</span><strong>${escapeHtml(normalized.erankKeywordDifficulty ?? '-')}</strong></div>
        <div class="metric"><span>Trend</span><strong>${escapeHtml(normalized.erankTrend ?? '-')}</strong></div>
      </div>
    </article>
  `
}

function renderErankGroup(title, help, rows, options = {}) {
  if (rows.length === 0) return ''
  const limit = options.limit ?? 12
  const cards = rows.slice(0, limit).map(renderErankCard).join('')
  const moreLabel = rows.length > limit ? `<small>${rows.length - limit}件は省略しています。</small>` : ''
  const body = `
    <div class="erank-group-heading">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(help)}</p>
      </div>
      <span>${rows.length}件</span>
    </div>
    <div class="erank-group-list">${cards}</div>
    ${moreLabel}
  `

  if (options.collapsible) {
    return `
      <details class="erank-group erank-group-collapsed">
        <summary>${escapeHtml(title)} ${rows.length}件を見る</summary>
        ${body}
      </details>
    `
  }

  return `<section class="erank-group">${body}</section>`
}

function renderErankResults() {
  const ranked = erankResultRows()
  elements.erankCount.textContent = String(ranked.length)
  renderErankSummary(ranked)

  if (ranked.length === 0) {
    elements.erankResultsList.innerHTML = '<div class="empty-state">2「eRankで広く見る」が終わると、ここに検索数・クリック・競合・KDが表示されます。</div>'
    return
  }

  const proceedRows = ranked.filter((row) => row.erankOpportunity.action === 'everbee')
  const expandRows = ranked.filter((row) => row.erankOpportunity.action === 'expand')
  const holdRows = ranked.filter((row) => row.erankOpportunity.action === 'hold' || row.erankOpportunity.action === 'reject')

  elements.erankResultsList.innerHTML = [
    renderErankGroup('次にEverBeeで売上確認する候補', '検索・クリック・KDの反応がよい語句です。ここから細かい商品候補へ変換します。', proceedRows, { limit: 16 }),
    renderErankGroup('関連語から追加探索する候補', '弱くはないけれど、もう少し関連語を広げたい語句です。EverBee候補づくりの材料にも使います。', expandRows, { limit: 10 }),
    renderErankGroup('今回は保留した候補', '需要が弱い、または除外リスクがある語句です。必要な時だけ確認します。', holdRows, { limit: 12, collapsible: true }),
  ].join('') || '<div class="empty-state">eRank結果は入りましたが、次に進める候補がありませんでした。</div>'
}

function renderResults() {
  const options = currentOptions()
  const ranked = rankResearchRows(state.researchRows, options)
    .filter((row) => row.score.validation.hasEverbeeData)
  elements.buildNextRoundBtn.disabled = state.researchRows.length === 0

  if (ranked.length === 0) {
    elements.resultsList.innerHTML = '<div class="empty-state">3「EverBeeで売上確認」が終わると、ここに売上で見た狙い目候補が表示されます。</div>'
    return
  }

  elements.resultsList.innerHTML = ranked.map((row) => {
    const normalized = row.score.normalized
    const labelClass = opportunityScoreClass(row.score)
    const tags = row.idea.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join('')
    const scoreReasons = scoreReasonLabels(row.score)
      .map((reason) => `<span class="reason-chip">${escapeHtml(reason)}</span>`)
      .join('')
    const reasons = row.score.exclusionReasons.length
      ? `<div><span>注意</span><p>${escapeHtml(row.score.exclusionReasons.join(' / '))}</p></div>`
      : ''

    return `
      <article class="result-item">
        <div class="result-top">
          <div class="opportunity-score ${labelClass}"><span>狙い目</span><strong>${row.score.score}</strong></div>
          <div>
            <h3>${escapeHtml(normalized.keyword)}</h3>
            <div class="meta-line">
              <span class="pill">${escapeHtml(row.score.label)}</span>
              <span class="pill">${escapeHtml(row.score.validation.label)}</span>
              <span class="pill">${escapeHtml(row.idea.theme)}</span>
            </div>
            ${scoreReasons ? `<div class="reason-line">${scoreReasons}</div>` : ''}
          </div>
        </div>

        <div class="metric-grid">
          <div class="metric"><span>Listings</span><strong>${escapeHtml(normalized.listingsAnalyzed ?? '-')}</strong></div>
          <div class="metric"><span>Sales</span><strong>${escapeHtml(normalized.topMonthlySales ?? '-')}</strong></div>
          <div class="metric"><span>Revenue</span><strong>${escapeHtml(normalized.topRevenue ?? '-')}</strong></div>
          <div class="metric"><span>Price</span><strong>${escapeHtml(normalized.averagePrice ?? '-')}</strong></div>
          <div class="metric"><span>Age</span><strong>${escapeHtml(normalized.listingAgeMonths ?? '-')} mo</strong></div>
          <div class="metric"><span>eRank Search</span><strong>${escapeHtml(normalized.erankSearchVolume ?? '-')}</strong></div>
          <div class="metric"><span>eRank Clicks</span><strong>${escapeHtml(normalized.erankClicks ?? '-')}</strong></div>
          <div class="metric"><span>eRank CTR</span><strong>${escapeHtml(normalized.erankCtr ?? '-')}</strong></div>
          <div class="metric"><span>eRank Comp</span><strong>${escapeHtml(normalized.erankCompetition ?? '-')}</strong></div>
          <div class="metric"><span>eRank KD</span><strong>${escapeHtml(normalized.erankKeywordDifficulty ?? '-')}</strong></div>
          <div class="metric"><span>eRank Trend</span><strong>${escapeHtml(normalized.erankTrend ?? '-')}</strong></div>
        </div>

        <div class="idea-grid">
          <div><span>ターゲット</span><p>${escapeHtml(row.idea.target)}</p></div>
          <div><span>デザイン方向性</span><p>${escapeHtml(row.idea.designDirection)}</p></div>
          <div><span>SEOタイトル案</span><p>${escapeHtml(row.idea.seoTitle)}</p></div>
          <div><span>タグ案</span><div class="tag-list">${tags}</div></div>
          ${reasons}
        </div>
      </article>
    `
  }).join('')
}

function fillBucketTextarea(input, values) {
  input.value = values.join('\n')
}

function bucketInputsAreEmpty() {
  return !elements.visibilityBucketInput.value.trim()
    && !elements.reachBucketInput.value.trim()
    && !elements.bestSellerBucketInput.value.trim()
}

function autoBucketKeywords(showStatus = true) {
  const options = currentOptions()
  const allRanked = rankResearchRows(state.researchRows, options)
  const everbeeRanked = allRanked.filter((row) => row.score.validation.hasEverbeeData)
  const ranked = everbeeRanked.length > 0 ? everbeeRanked : allRanked

  if (ranked.length === 0) {
    if (showStatus) elements.seoStatus.textContent = 'EverBee/eRankの結果を入れると、自動で3つのバケットに分けられます。'
    return false
  }

  const buckets = {
    visibility: [],
    reach: [],
    bestSeller: [],
  }
  const reviewCount = { value: 0 }

  for (const row of ranked) {
    const bucket = classifyKeywordBucket(row, options)
    if (bucket.bucket === 'visibility') buckets.visibility.push(row.keyword)
    else if (bucket.bucket === 'reach') buckets.reach.push(row.keyword)
    else if (bucket.bucket === 'bestSeller') buckets.bestSeller.push(row.keyword)
    else reviewCount.value += 1
  }

  fillBucketTextarea(elements.visibilityBucketInput, buckets.visibility.slice(0, 8))
  fillBucketTextarea(elements.reachBucketInput, buckets.reach.slice(0, 10))
  fillBucketTextarea(elements.bestSellerBucketInput, buckets.bestSeller.slice(0, 10))

  if (showStatus) {
    elements.seoStatus.textContent = `バケット整理が完了しました。Visibility ${buckets.visibility.length}件 / Reach ${buckets.reach.length}件 / Best seller ${buckets.bestSeller.length}件 / 保留 ${reviewCount.value}件`
  }

  return true
}

function renderSeoPlan() {
  if (!state.seoPlan) {
    elements.seoTitleOutput.textContent = 'SEO案を作るとここにタイトルが出ます。'
    elements.seoTitleCount.textContent = '0 / 140'
    elements.seoTagList.innerHTML = '<div class="empty-state small">タグ候補はここに13個まで表示されます。</div>'
    elements.seoWarnings.innerHTML = ''
    return
  }

  elements.seoTitleOutput.textContent = state.seoPlan.title || '-'
  elements.seoTitleCount.textContent = `${state.seoPlan.titleLength} / 140`
  elements.seoTitleCount.classList.toggle('warn', state.seoPlan.titleLength > 140)
  elements.seoTagList.innerHTML = state.seoPlan.tags.length
    ? state.seoPlan.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')
    : '<div class="empty-state small">タグ候補がまだありません。</div>'
  elements.seoWarnings.innerHTML = state.seoPlan.warnings.length
    ? state.seoPlan.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')
    : '<li class="ok">大きな警告はありません。最後にEtsy上で商標と表記だけ確認してください。</li>'
}

function buildSeoPlan() {
  if (bucketInputsAreEmpty()) autoBucketKeywords(false)

  state.seoPlan = buildSeoPlanFromBuckets({
    visibility: elements.visibilityBucketInput.value,
    reach: elements.reachBucketInput.value,
    bestSeller: elements.bestSellerBucketInput.value,
  }, currentOptions())

  renderSeoPlan()
  elements.seoStatus.textContent = `SEO案を作成しました。タイトル ${state.seoPlan.titleLength}文字 / タグ ${state.seoPlan.tags.length}個`
}

function renderAll() {
  renderBroadHints()
  renderCandidates()
  renderErankResults()
  renderResults()
  renderSeoPlan()
}

function generateCandidates() {
  state.candidates = generateKeywordCandidates(currentOptions())
  renderAll()
}

function mergeCandidates(nextCandidates) {
  const seen = new Set()
  state.candidates = [...nextCandidates, ...state.candidates]
    .filter((candidate) => {
      const key = normalizePhrase(candidate.keyword)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, Number(elements.limitInput.value) || 80)
}

function buildNextRound() {
  const followUps = generateFollowUpKeywords(state.researchRows, currentOptions())
  if (followUps.length === 0) {
    elements.extensionStatus.textContent = '売上ありの候補がまだありません。EverBee結果を入れてから派生できます。'
    return
  }
  mergeCandidates(followUps)
  renderAll()
  elements.extensionStatus.textContent = `${followUps.length}件の派生候補を追加しました。`
}

function addResearchRow(row) {
  const keyword = normalizePhrase(row.keyword)
  if (!keyword) return

  const nextRow = {
    keyword,
    listingsAnalyzed: row.listingsAnalyzed,
    topMonthlySales: row.topMonthlySales,
    topRevenue: row.topRevenue,
    averagePrice: row.averagePrice,
    listingAge: row.listingAge,
    erankSearchVolume: row.erankSearchVolume,
    erankClicks: row.erankClicks,
    erankCtr: row.erankCtr,
    erankCompetition: row.erankCompetition,
    erankKeywordDifficulty: row.erankKeywordDifficulty,
    erankTrend: row.erankTrend,
    notes: row.notes ?? '',
  }

  const existingIndex = state.researchRows.findIndex((item) => normalizePhrase(item.keyword) === keyword)
  if (existingIndex >= 0) {
    state.researchRows.splice(existingIndex, 1, nextRow)
  } else {
    state.researchRows.push(nextRow)
  }
}

function addManualResearch() {
  addResearchRow({
    keyword: elements.keywordSelect.value,
    listingsAnalyzed: elements.listingsInput.value,
    topMonthlySales: elements.salesInput.value,
    topRevenue: elements.revenueInput.value,
    averagePrice: elements.priceInput.value,
    listingAge: elements.ageInput.value,
    erankSearchVolume: elements.erankSearchInput.value,
    erankClicks: elements.erankClicksInput.value,
    erankCtr: elements.erankCtrInput.value,
    erankCompetition: elements.erankCompetitionInput.value,
    erankKeywordDifficulty: elements.erankKeywordDifficultyInput.value,
    erankTrend: elements.erankTrendInput.value,
    notes: elements.notesInput.value,
  })

  elements.listingsInput.value = ''
  elements.salesInput.value = ''
  elements.revenueInput.value = ''
  elements.priceInput.value = ''
  elements.ageInput.value = ''
  elements.erankSearchInput.value = ''
  elements.erankClicksInput.value = ''
  elements.erankCtrInput.value = ''
  elements.erankCompetitionInput.value = ''
  elements.erankKeywordDifficultyInput.value = ''
  elements.erankTrendInput.value = ''
  elements.notesInput.value = ''
  renderAll()
}

function importCsv() {
  const rows = parseEverbeeRows(elements.csvInput.value)
  rows.forEach(addResearchRow)
  if (rows.some((row) => rowHasErankInput(row) && !rowHasEverbeeInput(row))) {
    const count = fillEverbeeJobFromErank()
    setSimpleStatus(`eRank結果を読み込みました。関連語も使って、EverBeeで売上確認する候補を${count}件作りました。`)
  }
  renderAll()
}

function rowHasErankInput(row) {
  return [
    row.erankSearchVolume,
    row.erankClicks,
    row.erankCtr,
    row.erankCompetition,
    row.erankKeywordDifficulty,
    row.erankTrend,
  ].some((value) => String(value ?? '').trim() !== '')
}

function rowHasEverbeeInput(row) {
  return [
    row.listingsAnalyzed,
    row.topMonthlySales,
    row.topRevenue,
    row.averagePrice,
    row.listingAge,
  ].some((value) => String(value ?? '').trim() !== '')
}

function fillEverbeeJobFromErank() {
  const keywords = salesCheckKeywords()
  elements.researchJobInput.value = keywords.join('\n')
  return keywords.length
}

function extensionResearchRows(extensionState) {
  if (!extensionState?.results?.length) return []
  return extensionState.results.flatMap((row) => [
    row,
    ...(Array.isArray(row.relatedKeywords) ? row.relatedKeywords : []),
  ])
}

function importExtensionResults(extensionState) {
  if (!extensionState?.results?.length) return
  extensionResearchRows(extensionState).forEach(addResearchRow)
  ingestBroadSnippetsFromExtensionState(extensionState)
  if (state.progress.mode === 'erank') {
    const keywords = salesCheckKeywords()
    elements.researchJobInput.value = keywords.join('\n')
    const relatedCount = extensionState.results.reduce((count, row) => count + (Array.isArray(row.relatedKeywords) ? row.relatedKeywords.length : 0), 0)
    const proceedCount = erankWinnerRows().length
    const exploreCount = erankExploreRows().length
    const nextMessage = proceedCount > 0
      ? `eRank確認中です。関連キーワード${relatedCount}件も見て、有望語句${proceedCount}件からEverBee候補${keywords.length}件を作っています。`
      : exploreCount > 0
        ? `eRank確認中です。強い語句は少なめですが、追加探索に使える語句${exploreCount}件からEverBee候補${keywords.length}件を作っています。`
        : `eRank確認中です。関連キーワード${relatedCount}件を見ていますが、今はまだ強い候補が少なめです。`
    setSimpleStatus(nextMessage)
  }
  renderAll()
}

async function copyText(text, button, doneLabel, defaultLabel) {
  if (!text) return
  await navigator.clipboard.writeText(text)
  button.textContent = doneLabel
  setTimeout(() => {
    button.textContent = defaultLabel
  }, 1600)
}

async function copyKeywords() {
  await copyText(
    state.candidates.map((candidate) => candidate.keyword).join('\n'),
    elements.copyKeywordsBtn,
    'コピー済み',
    '候補リストをコピー'
  )
}

async function copyReadyKeywords() {
  const text = readyKeywords().join('\n')
  elements.researchJobInput.value = text
  await copyText(text, elements.copyReadyBtn, 'Step 3へ入力済み', 'Step 3へ候補を入れる')
}

async function copySeoTitle() {
  if (!state.seoPlan) buildSeoPlan()
  await copyText(state.seoPlan?.title ?? '', elements.copySeoTitleBtn, 'コピー済み', 'タイトルコピー')
}

async function copySeoTags() {
  if (!state.seoPlan) buildSeoPlan()
  await copyText(state.seoPlan?.tagString ?? '', elements.copySeoTagsBtn, 'コピー済み', 'タグコピー')
}

async function downloadJob() {
  const options = currentOptions()
  const job = {
    app: 'Market Finder',
    version: 2,
    createdAt: new Date().toISOString(),
    options,
    keywords: readyKeywords(),
  }
  await copyText(
    JSON.stringify(job, null, 2),
    elements.downloadJobBtn,
    'JSONコピー済み',
    '接続できない時のJSON'
  )
}

function fillResearchJob() {
  elements.researchJobInput.value = readyKeywords().join('\n')
  elements.extensionStatus.textContent = 'Step 2の候補を調査欄へ入れました。この欄の中身だけChrome拡張で調査します。'
}

function clearResearchJob() {
  elements.researchJobInput.value = ''
  elements.extensionStatus.textContent = '調査キーワード欄をクリアしました。'
}

function setSimpleStatus(message) {
  elements.simpleStatus.textContent = message
}

function setFlowMode(mode) {
  document.body.classList.remove('flow-auto', 'flow-csv', 'flow-seo')
  document.body.classList.add(`flow-${mode}`)
  ;[elements.flowAutoBtn, elements.flowCsvBtn, elements.flowSeoBtn].forEach((button) => {
    button.classList.toggle('is-active', button.dataset.flowChoice === mode)
  })

  if (mode === 'auto') {
    elements.simpleSeoStepNumber.textContent = '4'
    setSimpleStatus('次にeRankで調べる候補が下に出ています。次は2「eRankで広く見る」です。')
  } else if (mode === 'csv') {
    elements.simpleSeoStepNumber.textContent = '2'
    setSimpleStatus('CSVを貼って、1「CSVを読み込む」を押してください。')
  } else {
    elements.simpleSeoStepNumber.textContent = '2'
    setSimpleStatus('良いキーワードを貼って、1「SEO用に入れる」を押してください。')
  }
}

function simpleGenerate() {
  generateCandidates()
  setSimpleStatus(`${state.candidates.length}件のeRank候補に更新しました。次は2「eRankで広く見る」です。`)
}

async function simpleStartErankResearch() {
  await startErankResearch()
}

async function simpleStartResearch() {
  const keywords = salesCheckKeywords()
  elements.researchJobInput.value = keywords.join('\n')
  setSimpleStatus(`${keywords.length}件をEverBeeで売上確認します。終わるまでそのまま待ってください。`)
  await startExtensionResearch()
}

function simpleImportCsv() {
  elements.csvInput.value = elements.simpleCsvInput.value
  importCsv()
  setSimpleStatus(`${state.researchRows.length}件の結果を読み込みました。次は2「SEO案を作る」です。`)
}

function simpleUseSeoKeywords() {
  const keywords = elements.simpleSeoKeywordsInput.value
  elements.visibilityBucketInput.value = keywords
  elements.reachBucketInput.value = ''
  elements.bestSellerBucketInput.value = ''
  state.seoPlan = null
  renderSeoPlan()
  setSimpleStatus('キーワードをSEO欄へ入れました。次は2「SEO案を作る」です。')
}

function simpleBuildSeo() {
  if (document.body.classList.contains('flow-auto') || document.body.classList.contains('flow-csv')) {
    autoBucketKeywords(false)
  }
  buildSeoPlan()
  setSimpleStatus('SEO案を作りました。下のタイトルとタグを確認してください。')
}

function openAdvancedModal() {
  elements.advancedModal.hidden = false
}

function closeAdvancedModal() {
  elements.advancedModal.hidden = true
}

function friendlyExtensionError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/extension context invalidated/i.test(message)) {
    return 'Chrome拡張を更新したあと、ページ側の接続が古くなっています。Chrome拡張をReloadしてから、このMarket Finderページも再読み込みしてください。'
  }
  if (/receiving end does not exist|could not establish connection/i.test(message)) {
    return 'Chrome拡張とページがつながっていません。Chrome拡張をReloadしてから、Market Finderページも再読み込みしてください。'
  }
  if (/応答がありません/.test(message)) {
    return 'Chrome拡張から応答がありません。Chrome拡張をReloadしてから、Market Finderページも再読み込みしてください。'
  }
  return message || 'Chrome拡張の処理に失敗しました。'
}

function ensureExtensionStarted(response, fallbackMessage) {
  const started = response?.response?.started
  if (started === false) {
    throw new Error(response.response.error || fallbackMessage)
  }
}

function fillSampleCsv() {
  const keyword = state.candidates[0]?.keyword ?? 'dad est 2026 dad to be shirt'
  const event = selectedEvent()
  const category = selectedCategory()
  const idea = buildProductIdea(keyword, {
    eventId: event.id,
    categoryId: category.id,
    year: selectedYearOption() || event.defaultYear,
  })
  const score = scoreEverbeeResult({
    keyword,
    listingsAnalyzed: 1039,
    topMonthlySales: 54,
    topRevenue: 1749,
    averagePrice: 20.44,
    listingAge: '24 Mo.',
    erankSearchVolume: 720,
    erankClicks: 410,
    erankCtr: 57,
    erankCompetition: 4200,
    erankKeywordDifficulty: 18,
    erankTrend: 12,
  })

  elements.csvInput.value = [
    'Keyword,Listings Analyzed,Top Monthly Sales,Top Revenue,Average Price,Listing Age,eRank Search Volume,eRank Clicks,eRank CTR,eRank Competition,eRank KD,eRank Trend,Notes',
    `"${keyword}","1,039",54,1749,20.44,24 Mo.,720,410,57,4200,18,12,"${idea.target} / sample score ${score.score}"`,
  ].join('\n')
}

function setRunningControls(active) {
  elements.startExtensionBtn.disabled = active
  elements.broadStartBtn.disabled = active
  elements.simpleImportErankBtn.disabled = active
  elements.simpleStartBtn.disabled = active
  elements.stopExtensionBtn.disabled = !active
  elements.progressStopBtn.disabled = !active
}

function openProgressModal({ mode, title, total, message }) {
  state.progress = {
    mode,
    title,
    total,
    visible: true,
    started: true,
    wasActive: false,
    stopped: false,
    failed: false,
    message: message ?? '',
  }
  elements.progressModal.hidden = false
  renderProgressModal(state.extensionState)
}

function closeProgressModal() {
  elements.progressModal.hidden = true
  state.progress.visible = false
}

function failProgress(message) {
  state.progress.failed = true
  state.progress.message = message
  state.progress.visible = true
  elements.progressModal.hidden = false
  renderProgressModal(state.extensionState)
}

function renderProgressModal(extensionState = state.extensionState) {
  const active = Boolean(extensionState?.active)
  if (active) state.progress.wasActive = true

  const done = extensionState?.results?.length ?? 0
  const remaining = extensionState?.remaining ?? Math.max(0, state.progress.total - done)
  const total = Math.max(state.progress.total, done + remaining, done)
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const completed = state.progress.started && state.progress.wasActive && !active && !state.progress.failed
  const stopped = completed && state.progress.stopped
  const failed = state.progress.failed || Boolean(extensionState?.error && !active)
  const currentKeyword = active ? extensionState?.currentKeyword || '次のキーワードを準備中' : '-'

  setRunningControls(active)

  elements.progressTitle.textContent = state.progress.title
  elements.progressCurrentKeyword.textContent = currentKeyword
  elements.progressDone.textContent = String(done)
  elements.progressRemaining.textContent = String(remaining)
  elements.progressTotal.textContent = String(total)
  elements.progressBar.style.width = `${failed ? Math.max(percent, 100) : percent}%`

  elements.progressModal.classList.toggle('is-complete', completed && !failed && !stopped)
  elements.progressModal.classList.toggle('is-error', failed || stopped)

  if (failed) {
    elements.progressBadge.textContent = 'エラー'
    elements.progressBadge.className = 'status-badge warn'
    elements.progressDetail.textContent = state.progress.message || extensionState?.error || '調査中にエラーが起きました。'
    elements.progressHideBtn.textContent = '閉じる'
    return
  }

  if (stopped) {
    elements.progressBadge.textContent = '停止'
    elements.progressBadge.className = 'status-badge warn'
    elements.progressDetail.textContent = `停止しました。ここまでに${done}件完了しています。`
    elements.progressHideBtn.textContent = '閉じる'
    return
  }

  if (completed) {
    elements.progressBadge.textContent = '完了'
    elements.progressBadge.className = 'status-badge ready'
    if (state.progress.mode === 'erank') {
      const keywords = salesCheckKeywords()
      const relatedCount = (extensionState?.results ?? []).reduce((count, row) => count + (Array.isArray(row.relatedKeywords) ? row.relatedKeywords.length : 0), 0)
      const proceedCount = erankWinnerRows().length
      const exploreCount = erankExploreRows().length
      elements.researchJobInput.value = keywords.join('\n')
      const message = proceedCount > 0
        ? `eRank確認が完了しました。関連キーワード${relatedCount}件も見て、有望語句${proceedCount}件からEverBee候補${keywords.length}件を作りました。`
        : exploreCount > 0
          ? `eRank確認が完了しました。強い語句は少なめですが、追加探索語句${exploreCount}件からEverBee候補${keywords.length}件を作りました。`
          : `eRank確認が完了しました。今回は弱めなので、イベント・商品・手入力イベントを変えてもう一度広く見るのがおすすめです。`
      setSimpleStatus(message)
    } else if (state.progress.mode === 'keyword') {
      setSimpleStatus(`${done}件のEverBee売上確認が完了しました。次は4「SEO案を作る」です。`)
    }
    elements.progressDetail.textContent = state.progress.mode === 'broad'
      ? `広め調査が完了しました。商品名を取り込めた場合は、種ワード欄も更新済みです。`
      : state.progress.mode === 'erank'
        ? `eRank確認が完了しました。弱い語句で止めず、関連語も見てEverBee候補を作りました。`
        : `${done}件のEverBee調査が完了しました。`
    elements.progressHideBtn.textContent = '閉じる'
    return
  }

  if (active) {
    elements.progressBadge.textContent = '調査中'
    elements.progressBadge.className = 'status-badge warn'
    elements.progressDetail.textContent = state.progress.mode === 'broad'
      ? 'EverBeeで広め検索を進めています。画面から拾えた商品名は自動で種ワード抽出へ回します。'
      : state.progress.mode === 'erank'
        ? 'eRankで検索数・クリック・競合を順番に確認しています。'
        : 'EverBeeでキーワードを順番に調査しています。完了するとこの画面が完了表示に変わります。'
    elements.progressHideBtn.textContent = '閉じて続行'
    return
  }

  elements.progressBadge.textContent = '準備中'
  elements.progressBadge.className = 'status-badge'
  elements.progressDetail.textContent = state.progress.message || 'Chrome拡張へ調査を依頼しています。'
  elements.progressHideBtn.textContent = '閉じて続行'
}

function requestExtension(action, payload = {}, timeoutMs = 5000) {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingExtensionRequests.delete(requestId)
      reject(new Error('Chrome拡張から応答がありません。拡張機能を再読み込みしてください。'))
    }, timeoutMs)

    pendingExtensionRequests.set(requestId, { resolve, reject, timeoutId })
    window.postMessage({ source: PAGE_SOURCE, action, requestId, ...payload }, window.location.origin)
  })
}

function handleExtensionMessage(event) {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.source !== EXTENSION_SOURCE) return

  if (data.action === 'BRIDGE_READY') {
    state.extensionConnected = true
    updateExtensionBadge()
    pollExtensionState()
    return
  }

  const pending = data.requestId ? pendingExtensionRequests.get(data.requestId) : null

  if (data.action === 'MARKET_STATE') {
    state.extensionConnected = true
    state.extensionState = data.state
    importExtensionResults(data.state)
    renderExtensionState()
  }

  if (!pending) return
  window.clearTimeout(pending.timeoutId)
  pendingExtensionRequests.delete(data.requestId)

  if (data.ok === false) {
    const message = friendlyExtensionError(data.error ?? 'Chrome拡張の処理に失敗しました。')
    if (/ページ側の接続が古くなっています|つながっていません/.test(message)) {
      state.extensionConnected = false
      updateExtensionBadge()
    }
    pending.reject(new Error(message))
  } else {
    pending.resolve(data)
  }
}

function updateExtensionBadge() {
  elements.extensionBadge.textContent = state.extensionConnected ? '接続済み' : '未接続'
  elements.extensionBadge.className = `status-badge ${state.extensionConnected ? 'ready' : 'warn'}`
}

function renderExtensionState() {
  updateExtensionBadge()
  const extensionState = state.extensionState
  if (!extensionState) {
    elements.extensionStatus.textContent = state.extensionConnected
      ? 'Chrome拡張と接続しました。'
      : 'Chrome拡張の再読み込み後に使えます。'
    renderProgressModal(extensionState)
    return
  }

  const done = extensionState.results?.length ?? 0
  elements.extensionStatus.textContent = extensionState.active
    ? `調査中: ${extensionState.currentKeyword || '-'} / 完了 ${done}件 / 残り ${extensionState.remaining}件`
    : `待機中 / 完了 ${done}件`
  renderProgressModal(extensionState)
}

async function pollExtensionState() {
  if (!state.extensionConnected) return
  try {
    const response = await requestExtension('GET_MARKET_STATE', {}, 3000)
    state.extensionState = response.state
    importExtensionResults(response.state)
    renderExtensionState()
    if (response.state?.active) window.setTimeout(pollExtensionState, 2000)
  } catch (error) {
    state.extensionConnected = false
    updateExtensionBadge()
    elements.extensionStatus.textContent = friendlyExtensionError(error)
  }
}

async function startExtensionResearch() {
  state.broadAutoImport = false
  const keywords = parseResearchJob(elements.researchJobInput.value)
  if (keywords.length === 0) {
    elements.extensionStatus.textContent = '調査キーワード / JSON欄に、調査したいキーワードを入れてください。'
    return
  }

  try {
    openProgressModal({
      mode: 'keyword',
      title: 'EverBeeキーワード調査',
      total: keywords.length,
      message: 'Chrome拡張へ調査を依頼しています。',
    })
    await requestExtension('CLEAR_MARKET_RESULTS')
    const startResponse = await requestExtension('START_MARKET_RESEARCH', {
      keywords,
      everbeeUrl: elements.everbeeUrlInput.value.trim() || 'https://app.everbee.io/product-analytics',
      delayMs: Math.max(3000, Math.min(Number(elements.delayInput.value) * 1000 || 5000, 20000)),
    })
    ensureExtensionStarted(startResponse, 'EverBee調査を開始できませんでした。')
    elements.extensionStatus.textContent = `${keywords.length}件のEverBee調査を開始しました。`
    pollExtensionState()
  } catch (error) {
    const message = friendlyExtensionError(error)
    elements.extensionStatus.textContent = message
    failProgress(message)
  }
}

async function startErankResearch() {
  if (state.candidates.length === 0) generateCandidates()
  const keywords = erankResearchKeywords()
  if (keywords.length === 0) {
    setSimpleStatus('候補がありません。イベントと商品を選び直すか、1「eRank候補を更新」を押してください。')
    return
  }

  try {
    openProgressModal({
      mode: 'erank',
      title: 'eRank広めチェック',
      total: keywords.length,
      message: 'Chrome拡張へeRankの広め調査を依頼しています。',
    })
    await requestExtension('CLEAR_MARKET_RESULTS')
    const startResponse = await requestExtension('START_ERANK_RESEARCH', {
      keywords,
      erankUrl: 'https://erank.com/tools/keyword-tool',
      delayMs: Math.max(3000, Math.min(Number(elements.delayInput.value) * 1000 || 5000, 20000)),
    })
    ensureExtensionStarted(startResponse, 'eRank調査を開始できませんでした。')
    setSimpleStatus(`${keywords.length}件の広め語句をeRankで確認します。終わったら3「EverBeeで売上確認」です。`)
    pollExtensionState()
  } catch (error) {
    const message = friendlyExtensionError(error)
    setSimpleStatus(message)
    failProgress(message)
  }
}

async function startBroadEverbeeResearch() {
  const keywords = broadQueryList()
  if (keywords.length === 0) {
    elements.broadStatus.textContent = '広め検索語を作ってください。'
    return
  }

  try {
    openProgressModal({
      mode: 'broad',
      title: '広めEverBee調査',
      total: keywords.length,
      message: 'Chrome拡張へ広め調査を依頼しています。',
    })
    state.broadAutoImport = true
    state.broadSnippetKeys = new Set(
      parseBroadMarketListings(elements.broadMarketInput.value)
        .map((row) => normalizePhrase(row.title))
        .filter(Boolean)
    )
    elements.researchJobInput.value = keywords.join('\n')
    elements.broadStatus.textContent = `${keywords.length}件の広め調査を開始します。`
    await requestExtension('CLEAR_MARKET_RESULTS')
    const startResponse = await requestExtension('START_MARKET_RESEARCH', {
      keywords,
      everbeeUrl: elements.everbeeUrlInput.value.trim() || 'https://app.everbee.io/product-analytics',
      delayMs: Math.max(3000, Math.min(Number(elements.delayInput.value) * 1000 || 5000, 20000)),
    })
    ensureExtensionStarted(startResponse, '広めEverBee調査を開始できませんでした。')
    elements.extensionStatus.textContent = `${keywords.length}件の広めEverBee調査を開始しました。`
    pollExtensionState()
  } catch (error) {
    state.broadAutoImport = false
    const message = friendlyExtensionError(error)
    elements.broadStatus.textContent = message
    failProgress(message)
  }
}

async function stopExtensionResearch() {
  try {
    state.progress.stopped = true
    const response = await requestExtension('STOP_MARKET_RESEARCH')
    state.extensionState = response.state
    renderExtensionState()
  } catch (error) {
    const message = friendlyExtensionError(error)
    elements.extensionStatus.textContent = message
    failProgress(message)
  }
}

function bindEvents() {
  elements.eventSelect.addEventListener('change', () => {
    renderTargets({ syncYear: true })
    generateCandidates()
  })
  elements.customEventInput.addEventListener('input', () => {
    renderTargets({ syncYear: false })
    generateCandidates()
  })
  elements.categorySelect.addEventListener('change', generateCandidates)
  elements.yearInput.addEventListener('input', generateCandidates)
  elements.generateBtn.addEventListener('click', generateCandidates)
  elements.broadBuildQueriesBtn.addEventListener('click', buildBroadQueries)
  elements.broadStartBtn.addEventListener('click', startBroadEverbeeResearch)
  elements.broadExtractBtn.addEventListener('click', extractBroadMarketHints)
  elements.broadApplyBtn.addEventListener('click', applyBroadHintsToSeeds)
  elements.broadSampleBtn.addEventListener('click', fillBroadSample)
  elements.addResearchBtn.addEventListener('click', addManualResearch)
  elements.importCsvBtn.addEventListener('click', importCsv)
  elements.sampleCsvBtn.addEventListener('click', fillSampleCsv)
  elements.copyKeywordsBtn.addEventListener('click', copyKeywords)
  elements.copyReadyBtn.addEventListener('click', copyReadyKeywords)
  elements.downloadJobBtn.addEventListener('click', downloadJob)
  elements.buildNextRoundBtn.addEventListener('click', buildNextRound)
  elements.autoBucketBtn.addEventListener('click', () => autoBucketKeywords(true))
  elements.buildSeoPlanBtn.addEventListener('click', buildSeoPlan)
  elements.copySeoTitleBtn.addEventListener('click', copySeoTitle)
  elements.copySeoTagsBtn.addEventListener('click', copySeoTags)
  elements.fillResearchJobBtn.addEventListener('click', fillResearchJob)
  elements.clearResearchJobBtn.addEventListener('click', clearResearchJob)
  elements.startExtensionBtn.addEventListener('click', startExtensionResearch)
  elements.stopExtensionBtn.addEventListener('click', stopExtensionResearch)
  elements.progressHideBtn.addEventListener('click', closeProgressModal)
  elements.progressStopBtn.addEventListener('click', stopExtensionResearch)
  elements.flowAutoBtn.addEventListener('click', () => setFlowMode('auto'))
  elements.flowCsvBtn.addEventListener('click', () => setFlowMode('csv'))
  elements.flowSeoBtn.addEventListener('click', () => setFlowMode('seo'))
  elements.simpleGenerateBtn.addEventListener('click', simpleGenerate)
  elements.simpleImportErankBtn.addEventListener('click', simpleStartErankResearch)
  elements.simpleStartBtn.addEventListener('click', simpleStartResearch)
  elements.simpleImportCsvBtn.addEventListener('click', simpleImportCsv)
  elements.simpleUseSeoKeywordsBtn.addEventListener('click', simpleUseSeoKeywords)
  elements.simpleSeoBtn.addEventListener('click', simpleBuildSeo)
  elements.openAdvancedModalBtn.addEventListener('click', openAdvancedModal)
  elements.closeAdvancedModalBtn.addEventListener('click', closeAdvancedModal)
  elements.advancedModal.addEventListener('click', (event) => {
    if (event.target === elements.advancedModal) closeAdvancedModal()
  })
  window.addEventListener('message', handleExtensionMessage)
}

function initExtensionBridge() {
  updateExtensionBadge()
  window.postMessage({ source: PAGE_SOURCE, action: 'PING' }, window.location.origin)
  window.setTimeout(() => {
    if (!state.extensionConnected) renderExtensionState()
  }, 1200)
}

function init() {
  fillSelects()
  renderTargets({ syncYear: true })
  bindEvents()
  setFlowMode('auto')
  generateCandidates()
  setRunningControls(false)
  initExtensionBridge()
}

init()
