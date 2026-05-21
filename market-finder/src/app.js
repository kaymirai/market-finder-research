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
const PERSISTENCE_KEY = 'etsy-mirai-market-finder-state-v1'
const PERSISTENCE_VERSION = 1

const state = {
  candidates: [],
  candidateMessage: 'まだ空です。左の条件を決めてから「Step 2へ候補を作る」を押してください。',
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
  selectedResultKey: '',
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
  trendScoutInput: document.querySelector('#trendScoutInput'),
  trendSampleBtn: document.querySelector('#trendSampleBtn'),
  trendAutoBtn: document.querySelector('#trendAutoBtn'),
  trendApplyBtn: document.querySelector('#trendApplyBtn'),
  trendStatus: document.querySelector('#trendStatus'),
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
  downloadErankCsvBtn: document.querySelector('#downloadErankCsvBtn'),
  downloadStep4CsvBtn: document.querySelector('#downloadStep4CsvBtn'),
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

function safeStorage() {
  try {
    const testKey = `${PERSISTENCE_KEY}:test`
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return window.localStorage
  } catch {
    return null
  }
}

function selectedFlowMode() {
  if (document.body.classList.contains('flow-csv')) return 'csv'
  if (document.body.classList.contains('flow-seo')) return 'seo'
  return 'auto'
}

function selectValueIfAvailable(select, value) {
  if (!select || value === undefined || value === null) return
  const normalizedValue = value === 'auto-discovery' ? '' : value
  const exists = Array.from(select.options).some((option) => option.value === normalizedValue)
  if (exists) select.value = normalizedValue
}

function setInputValue(input, value) {
  if (!input || value === undefined || value === null) return
  input.value = String(value)
}

function readPersistedState() {
  const storage = safeStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(PERSISTENCE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== PERSISTENCE_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

function persistMarketFinderState() {
  const storage = safeStorage()
  if (!storage) return

  const payload = {
    version: PERSISTENCE_VERSION,
    savedAt: new Date().toISOString(),
    flowMode: selectedFlowMode(),
    form: {
      eventId: elements.eventSelect.value,
      eventIdWasSet: Boolean(elements.eventSelect.value),
      customEventName: elements.customEventInput.value,
      customEventWasSet: Boolean(String(elements.customEventInput.value ?? '').trim()),
      categoryId: elements.categorySelect.value,
      year: elements.yearInput.value,
      limit: elements.limitInput.value,
      seedKeywords: elements.seedInput.value,
      trendScoutKeywords: elements.trendScoutInput.value,
      customRiskTerms: elements.riskInput.value,
      targets: selectedTargets(),
      broadQueries: elements.broadQueryInput.value,
      researchJob: elements.researchJobInput.value,
      everbeeUrl: elements.everbeeUrlInput.value,
      delay: elements.delayInput.value,
      visibilityBucket: elements.visibilityBucketInput.value,
      reachBucket: elements.reachBucketInput.value,
      bestSellerBucket: elements.bestSellerBucketInput.value,
      simpleSeoKeywords: elements.simpleSeoKeywordsInput.value,
    },
    marketState: {
      researchRows: state.researchRows,
      broadHints: state.broadHints,
      broadSnippetKeys: Array.from(state.broadSnippetKeys),
      selectedResultKey: state.selectedResultKey,
      seoPlan: state.seoPlan,
    },
  }

  try {
    storage.setItem(PERSISTENCE_KEY, JSON.stringify(payload))
  } catch {
    // localStorage may be full if pasted market data is large. The app still works without persistence.
  }
}

function restorePersistedState() {
  const persisted = readPersistedState()
  if (!persisted) return null

  const form = persisted.form ?? {}
  const savedState = persisted.marketState ?? {}

  if (form.eventIdWasSet === true) {
    selectValueIfAvailable(elements.eventSelect, form.eventId)
  } else {
    elements.eventSelect.value = ''
  }
  setInputValue(elements.customEventInput, form.customEventWasSet === true ? form.customEventName : '')
  selectValueIfAvailable(elements.categorySelect, form.categoryId)
  setInputValue(elements.yearInput, form.year)
  setInputValue(elements.limitInput, form.limit)
  setInputValue(elements.seedInput, form.seedKeywords)
  setInputValue(elements.trendScoutInput, form.trendScoutKeywords)
  setInputValue(elements.riskInput, form.customRiskTerms)
  setInputValue(elements.broadQueryInput, form.broadQueries)
  setInputValue(elements.researchJobInput, form.researchJob)
  setInputValue(elements.everbeeUrlInput, form.everbeeUrl)
  setInputValue(elements.delayInput, form.delay)
  setInputValue(elements.visibilityBucketInput, form.visibilityBucket)
  setInputValue(elements.reachBucketInput, form.reachBucket)
  setInputValue(elements.bestSellerBucketInput, form.bestSellerBucket)
  setInputValue(elements.simpleSeoKeywordsInput, form.simpleSeoKeywords)

  state.researchRows = Array.isArray(savedState.researchRows) ? savedState.researchRows : []
  state.broadHints = Array.isArray(savedState.broadHints) ? savedState.broadHints : []
  state.broadSnippetKeys = new Set(Array.isArray(savedState.broadSnippetKeys) ? savedState.broadSnippetKeys : [])
  state.selectedResultKey = String(savedState.selectedResultKey ?? '')
  state.seoPlan = savedState.seoPlan ?? null

  return persisted
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

function parseTrendScoutTerms(value) {
  const ignored = new Set(['keyword', 'keywords', 'trend', 'source', 'search', 'clicks', 'competition', 'kd', 'change', 'rank'])
  return cleanKeywordList(String(value ?? '')
    .split(/\r?\n/)
    .flatMap((line) => {
      const source = String(line ?? '').trim()
      if (!source) return []
      const cells = source.split(/\t|,|\|/).map((cell) => cell.trim()).filter(Boolean)
      const candidate = (cells.length > 1 ? cells : [source])
        .map((cell) => cell.replace(/^\s*#?\d+[\).\-\s]+/, '').trim())
        .find((cell) => /[a-zA-Z]/.test(cell) && !ignored.has(normalizePhrase(cell)))
      return candidate ? [candidate] : []
    }))
}

function trendScoutTerms() {
  return parseTrendScoutTerms(elements.trendScoutInput?.value)
}

function combinedSeedKeywords() {
  return cleanKeywordList([
    ...String(elements.seedInput.value ?? '').split(/\r?\n|,/),
    ...trendScoutTerms(),
  ]).join('\n')
}

function trendCandidateKeywords() {
  const category = selectedCategory()
  const product = normalizePhrase(category.searchTerm)
  const eventTerm = normalizePhrase(selectedEvent().searchTerm)
  const year = selectedYearOption()

  return cleanKeywordList(trendScoutTerms().flatMap((term) => {
    const keyword = normalizePhrase(term)
    if (!keyword) return []
    const hasProduct = keyword.includes(product)
    const base = hasProduct ? keyword : `${keyword} ${product}`
    return [
      base,
      `${keyword} gift`,
      eventTerm && !keyword.includes(eventTerm) ? `${eventTerm} ${base}` : '',
      year ? `${base} ${year}` : '',
    ]
  }))
    .filter((keyword) => keyword.split(' ').filter(Boolean).length >= 2)
    .slice(0, 50)
}

function currentOptions() {
  return {
    eventId: elements.eventSelect.value,
    customEventName: customEventName(),
    categoryId: elements.categorySelect.value,
    year: selectedYearOption(),
    limit: Number(elements.limitInput.value) || 80,
    targets: selectedTargets(),
    seedKeywords: combinedSeedKeywords(),
    customRiskTerms: elements.riskInput.value,
  }
}

function fillSelects() {
  const eventsByMonth = MARKET_EVENTS.filter((event) => event.id !== 'auto-discovery').reduce((groups, event) => {
    const month = Number(event.month) || 0
    if (!groups.has(month)) groups.set(month, [])
    groups.get(month).push(event)
    return groups
  }, new Map())

  elements.eventSelect.innerHTML = [
    '<option value="">イベントなし（自動で探す）</option>',
    ...Array.from(eventsByMonth.entries())
    .sort(([leftMonth], [rightMonth]) => leftMonth - rightMonth)
    .map(([month, events]) => {
      const groupLabel = month === 0 ? '自動探索・その他' : `北米 ${MONTH_LABELS[month] ?? `${month}月`}`
      const options = events.map((event) => (
        `<option value="${escapeHtml(event.id)}">${escapeHtml(event.jpLabel)} / ${escapeHtml(event.label)}</option>`
      )).join('')
      return `<optgroup label="${escapeHtml(groupLabel)}">${options}</optgroup>`
    }),
  ]
    .join('')
  elements.eventSelect.value = ''

  elements.categorySelect.innerHTML = PRODUCT_CATEGORIES.map((category) => (
    `<option value="${category.id}">${escapeHtml(category.label)}</option>`
  )).join('')
}

function renderTargets(options = {}) {
  const event = selectedEvent()
  const savedTargets = Array.isArray(options.selectedTargets) ? new Set(options.selectedTargets) : null
  elements.targetChips.innerHTML = event.targets.map((target, index) => `
    <label class="chip">
      <input type="checkbox" value="${escapeHtml(target)}" ${savedTargets ? (savedTargets.has(target) ? 'checked' : '') : (index < 7 ? 'checked' : '')}>
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
  const eventTerm = normalizePhrase(event.searchTerm)
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
    const hasEventSignal = eventTerm
      ? keyword.includes(eventTerm)
      || (eventSignals.length > 0 && eventSignals.every((token) => keyword.includes(token)))
      : true
    const withProduct = keyword.includes(product) ? keyword : `${keyword} ${product}`
    const withEvent = hasEventSignal || !eventTerm ? withProduct : `${eventTerm} ${withProduct}`
    return [withProduct, withEvent, year ? `${withProduct} ${year}` : '']
  })

  return cleanKeywordList([...productized, ...generated]).slice(0, 50)
}

function salesCheckKeywords() {
  const narrowed = narrowEverbeeKeywordsFromErank()
  return narrowed.length > 0 ? narrowed : readyKeywords()
}

function erankResearchKeywords() {
  return readyKeywords().slice(0, 40)
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
    persistMarketFinderState()
    return
  }

  elements.broadHintList.innerHTML = state.broadHints.map((hint, index) => `
    <label class="hint-chip">
      <input type="checkbox" value="${escapeHtml(hint.keyword)}" ${index < 24 && isStrongBroadHint(hint.keyword) ? 'checked' : ''}>
      <span>${escapeHtml(hint.keyword)}</span>
      <small>${escapeHtml(hint.count)}</small>
    </label>
  `).join('')
  persistMarketFinderState()
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
  persistMarketFinderState()
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
  elements.broadStatus.textContent = `${selected.length}個を追加ニッチ語句へ入れて、Step 2候補を作りました。`
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
    elements.candidateList.innerHTML = `<div class="empty-state">${escapeHtml(state.candidateMessage || 'まだ候補はありません。')}</div>`
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
  if ((normalized.listingAgeMonths ?? 0) >= 24) reasons.push('古い商品は参考中心')
  if ((normalized.listingAgeMonths ?? Infinity) < 2 && (normalized.topMonthlySales ?? 0) < 10) reasons.push('新しすぎるので保留')
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

function erankSourceLabel(row) {
  const sourceKeyword = erankSourceKeyword(row)
  if (sourceKeyword) return `eRank派生: ${sourceKeyword} から発見`
  return 'eRankで調べた元語句'
}

function erankSourceKeyword(row) {
  const notes = String(row.notes ?? '')
  const match = notes.match(/related keywords for\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}

function displayMetricValue(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback
  return value
}

function displayMoneyValue(value) {
  const displayed = displayMetricValue(value)
  return displayed === '-' ? '-' : `$${displayed}`
}

function compactReasonChips(reasons, limit = 3) {
  return reasons
    .slice(0, limit)
    .map((reason) => `<span class="reason-chip">${escapeHtml(reason)}</span>`)
    .join('')
}

function renderSmallScore(label, score, className) {
  return `
    <span class="mini-score ${className}">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(score)}</strong>
      <em>/100</em>
    </span>
  `
}

function renderErankTableRow(row) {
  const normalized = row.score.normalized
  const opportunity = row.erankOpportunity
  const sourceLabel = erankSourceLabel(row)
  const labelClass = erankOpportunityScoreClass(opportunity)
  const scoreReasons = compactReasonChips(opportunity.reasons, 4)

  return `
    <article class="research-table-row erank-table-row">
      <span class="table-cell score-cell" data-label="需要">
        ${renderSmallScore('需要', opportunity.score, labelClass)}
      </span>
      <span class="table-cell keyword-cell" data-label="キーワード">
        <strong>${escapeHtml(normalized.keyword)}</strong>
        <span class="table-subline">${escapeHtml(sourceLabel)}</span>
      </span>
      <span class="table-cell number-cell" data-label="Search">${escapeHtml(displayMetricValue(normalized.erankSearchVolume))}</span>
      <span class="table-cell number-cell" data-label="Clicks">${escapeHtml(displayMetricValue(normalized.erankClicks))}</span>
      <span class="table-cell number-cell" data-label="Competition">${escapeHtml(displayMetricValue(normalized.erankCompetition, 'Unknown'))}</span>
      <span class="table-cell number-cell" data-label="KD">${escapeHtml(displayMetricValue(normalized.erankKeywordDifficulty, '未取得'))}</span>
      <span class="table-cell reason-cell" data-label="判定">
        <span class="pill action-${escapeHtml(opportunity.action)}">${escapeHtml(opportunity.label)}</span>
        ${scoreReasons ? `<span class="table-reasons">${scoreReasons}</span>` : ''}
      </span>
    </article>
  `
}

function renderErankCard(row) {
  const normalized = row.score.normalized
  const opportunity = row.erankOpportunity
  const sourceLabel = erankSourceLabel(row)
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
            <span class="pill">${escapeHtml(sourceLabel)}</span>
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
  const tableRows = rows.slice(0, limit).map(renderErankTableRow).join('')
  const moreLabel = rows.length > limit ? `<small>${rows.length - limit}件は省略しています。</small>` : ''
  const body = `
    <div class="erank-group-heading">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(help)}</p>
      </div>
      <span>${rows.length}件</span>
    </div>
    <div class="research-table-shell erank-table-shell">
      <div class="research-table erank-table">
        <div class="research-table-head erank-table-head">
          <span>需要</span>
          <span>キーワード</span>
          <span>Search</span>
          <span>Clicks</span>
          <span>Competition</span>
          <span>KD</span>
          <span>判定</span>
        </div>
        ${tableRows}
      </div>
    </div>
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
  elements.downloadErankCsvBtn.disabled = ranked.length === 0
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

function resultRowKey(row, index = 0) {
  const keyword = normalizePhrase(row.score?.normalized?.keyword ?? row.keyword ?? '')
  return keyword || `result-${index}`
}

function renderEverbeeTableRow(item, selectedKey) {
  const { row, key } = item
  const normalized = row.score.normalized
  const labelClass = opportunityScoreClass(row.score)
  const scoreReasons = compactReasonChips(scoreReasonLabels(row.score), 2)
  const selectedClass = key === selectedKey ? ' is-selected' : ''
  const age = normalized.listingAgeMonths === null || normalized.listingAgeMonths === undefined
    ? '-'
    : `${normalized.listingAgeMonths} mo`

  return `
    <button type="button" class="research-table-row everbee-table-row${selectedClass}" data-result-key="${escapeHtml(key)}" aria-pressed="${key === selectedKey ? 'true' : 'false'}">
      <span class="table-cell score-cell" data-label="狙い目">
        ${renderSmallScore('狙い目', row.score.score, labelClass)}
      </span>
      <span class="table-cell keyword-cell" data-label="キーワード">
        <strong>${escapeHtml(normalized.keyword)}</strong>
        <span class="table-subline">${escapeHtml(row.idea.theme)}</span>
        ${scoreReasons ? `<span class="table-reasons">${scoreReasons}</span>` : ''}
      </span>
      <span class="table-cell number-cell" data-label="商品数">${escapeHtml(displayMetricValue(normalized.listingsAnalyzed))}</span>
      <span class="table-cell number-cell" data-label="月販売">${escapeHtml(displayMetricValue(normalized.topMonthlySales))}</span>
      <span class="table-cell number-cell" data-label="売上">${escapeHtml(displayMoneyValue(normalized.topRevenue))}</span>
      <span class="table-cell number-cell" data-label="新しさ">${escapeHtml(age)}</span>
    </button>
  `
}

function renderEverbeeDetail(row) {
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
    <article class="result-detail-card">
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

      <div class="metric-grid selected-metric-grid">
        <div class="metric"><span>Listings</span><strong>${escapeHtml(displayMetricValue(normalized.listingsAnalyzed))}</strong></div>
        <div class="metric"><span>Sales</span><strong>${escapeHtml(displayMetricValue(normalized.topMonthlySales))}</strong></div>
        <div class="metric"><span>Revenue</span><strong>${escapeHtml(displayMoneyValue(normalized.topRevenue))}</strong></div>
        <div class="metric"><span>Price</span><strong>${escapeHtml(displayMoneyValue(normalized.averagePrice))}</strong></div>
        <div class="metric"><span>Age</span><strong>${escapeHtml(displayMetricValue(normalized.listingAgeMonths))} mo</strong></div>
        <div class="metric"><span>eRank Search</span><strong>${escapeHtml(displayMetricValue(normalized.erankSearchVolume))}</strong></div>
        <div class="metric"><span>eRank Clicks</span><strong>${escapeHtml(displayMetricValue(normalized.erankClicks))}</strong></div>
        <div class="metric"><span>eRank CTR</span><strong>${escapeHtml(displayMetricValue(normalized.erankCtr))}</strong></div>
        <div class="metric"><span>eRank Comp</span><strong>${escapeHtml(displayMetricValue(normalized.erankCompetition, 'Unknown'))}</strong></div>
        <div class="metric"><span>eRank KD</span><strong>${escapeHtml(displayMetricValue(normalized.erankKeywordDifficulty, '未取得'))}</strong></div>
        <div class="metric"><span>eRank Trend</span><strong>${escapeHtml(displayMetricValue(normalized.erankTrend))}</strong></div>
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
}

function everbeeResultRows() {
  return rankResearchRows(state.researchRows, currentOptions())
    .filter((row) => row.score.validation.hasEverbeeData)
}

function renderResultsTable() {
  const ranked = everbeeResultRows()
  elements.buildNextRoundBtn.disabled = state.researchRows.length === 0
  elements.downloadStep4CsvBtn.disabled = ranked.length === 0

  if (ranked.length === 0) {
    state.selectedResultKey = ''
    elements.resultsList.innerHTML = '<div class="empty-state">3「EverBeeで売上確認」が終わると、ここに売上で見た狙い目候補が表示されます。</div>'
    return
  }

  const keyedRows = ranked.map((row, index) => ({ row, key: resultRowKey(row, index) }))
  if (!state.selectedResultKey || !keyedRows.some((item) => item.key === state.selectedResultKey)) {
    state.selectedResultKey = keyedRows[0].key
  }

  const selectedItem = keyedRows.find((item) => item.key === state.selectedResultKey) ?? keyedRows[0]
  const tableRows = keyedRows.map((item) => renderEverbeeTableRow(item, state.selectedResultKey)).join('')

  elements.resultsList.innerHTML = `
    <div class="results-comparison-layout">
      <div class="research-table-shell everbee-table-shell">
        <div class="table-caption">候補を押すと、右に商品案・SEO案・タグ案が出ます。</div>
        <div class="research-table everbee-table">
          <div class="research-table-head everbee-table-head">
            <span>狙い目</span>
            <span>キーワード</span>
            <span>商品数</span>
            <span>月販売</span>
            <span>売上</span>
            <span>新しさ</span>
          </div>
          ${tableRows}
        </div>
      </div>
      <div class="selected-result-panel">
        ${renderEverbeeDetail(selectedItem.row)}
      </div>
    </div>
  `
}

function handleResultListClick(event) {
  if (!(event.target instanceof Element)) return
  const rowButton = event.target.closest('[data-result-key]')
  if (!rowButton) return
  state.selectedResultKey = rowButton.dataset.resultKey
  renderResultsTable()
  persistMarketFinderState()
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
  persistMarketFinderState()
}

function setTrendStatus(message, variant = '') {
  elements.trendStatus.textContent = message
  elements.trendStatus.className = `inline-status${variant ? ` ${variant}` : ''}`
}

function renderTrendScoutStatus() {
  const terms = trendScoutTerms()
  if (terms.length === 0) {
    if (state.candidates.length > 0) {
      setTrendStatus('トレンド語なしでStep 2候補を作成済みです。条件を変えたら、もう一度「Step 2へ候補を作る」を押します。', 'ready')
    } else {
      setTrendStatus('まだStep 2には入りません。上のボタンを押すと候補を作ります。')
    }
    return
  }

  const variant = state.candidates.length > 0 ? 'ready' : 'warn'
  const message = state.candidates.length > 0
    ? `${terms.length}件のトレンド語を使ってStep 2候補を作成済みです。条件を変えたら、もう一度「Step 2へ候補を作る」を押します。`
    : `${terms.length}件のトレンド語があります。まだStep 2には入っていません。「Step 2へ候補を作る」を押してください。`
  setTrendStatus(message, variant)
}

function renderAll() {
  renderTrendScoutStatus()
  renderBroadHints()
  renderCandidates()
  renderErankResults()
  renderResultsTable()
  renderSeoPlan()
  persistMarketFinderState()
}

function candidateFromKeyword(keyword, generatedMap, trendSet = new Set()) {
  const normalized = normalizePhrase(keyword)
  const generated = generatedMap.get(normalized)
  if (generated) return generated
  const event = selectedEvent()
  const category = selectedCategory()
  const fromTrendScout = trendSet.has(normalized)
  return {
    keyword: normalized,
    eventId: event.id,
    eventLabel: event.jpLabel,
    categoryId: category.id,
    categoryLabel: fromTrendScout ? 'Trend Scout' : category.label,
    score: fromTrendScout ? 70 : 45,
    wordCount: normalized.split(' ').filter(Boolean).length,
    riskTerms: [],
    status: 'ready',
  }
}

function generateCandidates() {
  const options = currentOptions()
  const generated = generateKeywordCandidates(options)
  const generatedMap = new Map(generated.map((candidate) => [normalizePhrase(candidate.keyword), candidate]))
  const trendKeywords = trendCandidateKeywords()
  const trendSet = new Set(trendKeywords.map((keyword) => normalizePhrase(keyword)))
  const broad = generateBroadMarketQueries({
    ...options,
    year: '',
    includeYear: false,
    limit: 40,
  })
  const keywords = cleanKeywordList([
    ...trendKeywords,
    ...broad,
    ...generated.map((candidate) => candidate.keyword),
  ])

  state.candidates = keywords
    .map((keyword) => candidateFromKeyword(keyword, generatedMap, trendSet))
    .slice(0, Number(elements.limitInput.value) || 80)
  state.candidateMessage = state.candidates.length > 0
    ? ''
    : '候補を作れませんでした。商品やトレンド語を変えてからもう一度押してください。'
  renderAll()
}

function resetCandidatesForInputChange(message = '条件を変更しました。Step 2は空です。「Step 2へ候補を作る」を押すと候補が入ります。') {
  state.candidates = []
  state.candidateMessage = message
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

  const existingIndex = state.researchRows.findIndex((item) => normalizePhrase(item.keyword) === keyword)
  const existingRow = existingIndex >= 0 ? state.researchRows[existingIndex] : null
  const keepExistingWhenBlank = (field) => {
    const incoming = row[field]
    return String(incoming ?? '').trim() !== '' ? incoming : existingRow?.[field]
  }

  const nextRow = {
    keyword,
    listingsAnalyzed: keepExistingWhenBlank('listingsAnalyzed'),
    topMonthlySales: keepExistingWhenBlank('topMonthlySales'),
    topRevenue: keepExistingWhenBlank('topRevenue'),
    averagePrice: keepExistingWhenBlank('averagePrice'),
    listingAge: keepExistingWhenBlank('listingAge'),
    erankSearchVolume: keepExistingWhenBlank('erankSearchVolume'),
    erankClicks: keepExistingWhenBlank('erankClicks'),
    erankCtr: keepExistingWhenBlank('erankCtr'),
    erankCompetition: keepExistingWhenBlank('erankCompetition'),
    erankKeywordDifficulty: keepExistingWhenBlank('erankKeywordDifficulty'),
    erankTrend: keepExistingWhenBlank('erankTrend'),
    notes: String(row.notes ?? '').trim() ? row.notes : existingRow?.notes ?? '',
  }

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

function hasUnknownErankDemandLabels(rawText = '') {
  const text = normalizePhrase(rawText)
  const unknownCount = (text.match(/\b(?:unknown|n\/a|no data|-)\b/g) ?? []).length
  return /(avg\.?\s*searches?|average\s*searches?|searches?)\s*(unknown|n\/a|no data|-)\b/.test(text)
    || /(avg\.?\s*clicks?|average\s*clicks?|clicks?)\s*(unknown|n\/a|no data|-)\b/.test(text)
    || /\b(?:avg\.?\s*)?ctr\s*(unknown|n\/a|no data|-)\b/.test(text)
    || unknownCount >= 3
}

function sanitizeErankMetricLeak(row) {
  const next = { ...row }
  const competition = String(next.erankCompetition ?? '').trim()
  if (!competition) return next

  const demandKeys = ['erankSearchVolume', 'erankClicks', 'erankCtr']
  const leakedKeys = demandKeys.filter((key) => String(next[key] ?? '').trim() === competition)
  const allDemandMatchesCompetition = leakedKeys.length === demandKeys.length
  if (!allDemandMatchesCompetition && !(leakedKeys.length > 0 && hasUnknownErankDemandLabels(next.rawText))) return next

  leakedKeys.forEach((key) => {
    next[key] = ''
  })
  return next
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
  extensionResearchRows(extensionState).map(sanitizeErankMetricLeak).forEach(addResearchRow)
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

function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function exportErankCsv() {
  const rows = erankResultRows()
  if (rows.length === 0) return

  const header = [
    'Source Type',
    'Source Keyword',
    'Keyword',
    'Action',
    'Opportunity Score',
    'Search',
    'Clicks',
    'CTR',
    'Competition',
    'KD',
    'Trend',
    'Notes',
  ]

  const lines = rows.map((row) => {
    const normalized = row.erankOpportunity.normalized
    const sourceKeyword = erankSourceKeyword(row)
    return [
      sourceKeyword ? 'eRank related keyword' : 'eRank searched keyword',
      sourceKeyword,
      normalized.keyword,
      row.erankOpportunity.label,
      row.erankOpportunity.score,
      normalized.erankSearchVolume ?? '',
      normalized.erankClicks ?? '',
      normalized.erankCtr ?? '',
      normalized.erankCompetition ?? '',
      normalized.erankKeywordDifficulty ?? '',
      normalized.erankTrend ?? '',
      row.notes ?? '',
    ].map(csvCell).join(',')
  })

  const date = new Date().toISOString().slice(0, 10)
  downloadTextFile(`market-finder-erank-${date}.csv`, [header.map(csvCell).join(','), ...lines].join('\n'), 'text/csv;charset=utf-8')
}

function exportStep4Csv() {
  const rows = everbeeResultRows()
  if (rows.length === 0) return

  const header = [
    'Rank',
    'Keyword',
    'Opportunity Score',
    'Grade',
    'Validation',
    'Listings Analyzed',
    'Top Monthly Sales',
    'Top Revenue',
    'Average Price',
    'Listing Age Months',
    'eRank Search',
    'eRank Clicks',
    'eRank CTR',
    'eRank Competition',
    'eRank KD',
    'eRank Trend',
    'Product Theme',
    'Target',
    'Design Direction',
    'SEO Title',
    'Tags',
    'Positive Reasons',
    'Warnings',
    'Notes',
  ]

  const lines = rows.map((row, index) => {
    const normalized = row.score.normalized
    return [
      index + 1,
      normalized.keyword,
      row.score.score,
      row.score.label,
      row.score.validation.label,
      normalized.listingsAnalyzed ?? '',
      normalized.topMonthlySales ?? '',
      normalized.topRevenue ?? '',
      normalized.averagePrice ?? '',
      normalized.listingAgeMonths ?? '',
      normalized.erankSearchVolume ?? '',
      normalized.erankClicks ?? '',
      normalized.erankCtr ?? '',
      normalized.erankCompetition ?? '',
      normalized.erankKeywordDifficulty ?? '',
      normalized.erankTrend ?? '',
      row.idea.theme,
      row.idea.target,
      row.idea.designDirection,
      row.idea.seoTitle,
      row.idea.tags.join(', '),
      scoreReasonLabels(row.score).join(' / '),
      row.score.exclusionReasons.join(' / '),
      row.notes ?? '',
    ].map(csvCell).join(',')
  })

  const date = new Date().toISOString().slice(0, 10)
  downloadTextFile(`market-finder-step4-everbee-${date}.csv`, `\ufeff${[header.map(csvCell).join(','), ...lines].join('\n')}`, 'text/csv;charset=utf-8')
}

function exportAvailableResearchCsv({ includeErank = true, includeEverbee = true } = {}) {
  const exported = []
  if (includeEverbee && everbeeResultRows().length > 0) {
    exportStep4Csv()
    exported.push('EverBee売上結果')
  }
  if (includeErank && erankResultRows().length > 0) {
    exportErankCsv()
    exported.push('eRank需要結果')
  }
  return exported
}

function confirmExportBeforeClearingResults({ scope = 'all', label = '前回結果' } = {}) {
  const hasEverbee = everbeeResultRows().length > 0
  const hasErank = erankResultRows().length > 0
  const hasRows = state.researchRows.length > 0
  const willClearEverbee = scope === 'all' || scope === 'everbee'
  const willClearErank = scope === 'all'

  if (!hasRows || (!willClearEverbee && !willClearErank)) return true
  if (!hasEverbee && !hasErank) return window.confirm(`${label}があります。新しい調査を始める前に前回結果を消して続けますか？`)
  if (scope === 'everbee' && !hasEverbee) return true

  const exportMessage = [
    `${label}があります。`,
    '新しい調査を始めると、前回結果を画面から消します。',
    '',
    '消す前にCSVへ出力しますか？',
    '',
    'OK: CSVを保存してから続ける',
    'キャンセル: CSV保存なしで続けるか確認する',
  ].join('\n')

  if (window.confirm(exportMessage)) {
    exportAvailableResearchCsv({ includeErank: willClearErank, includeEverbee: willClearEverbee })
    return true
  }

  return window.confirm('CSV保存なしで前回結果を消して、新しい調査を始めますか？\n\nOK: 保存せず続ける\nキャンセル: 調査を始めない')
}

function clearResearchResults(scope = 'all') {
  if (scope === 'everbee') {
    state.researchRows = state.researchRows.filter((row) => !scoreEverbeeResult(row, currentOptions()).validation.hasEverbeeData)
  } else {
    state.researchRows = []
  }
  state.selectedResultKey = ''
  state.seoPlan = null
  renderAll()
}

function fillResearchJob() {
  elements.researchJobInput.value = readyKeywords().join('\n')
  elements.extensionStatus.textContent = 'Step 2の候補を調査欄へ入れました。この欄の中身だけChrome拡張で調査します。'
  persistMarketFinderState()
}

function clearResearchJob() {
  elements.researchJobInput.value = ''
  elements.extensionStatus.textContent = '調査キーワード欄をクリアしました。'
  persistMarketFinderState()
}

function fillTrendSample() {
  elements.trendScoutInput.value = [
    'summerween',
    'pickleball mom',
    'western birthday',
    'book nook',
    'coastal grandma',
    'teacher era',
  ].join('\n')
  resetCandidatesForInputChange('サンプルを入れました。Step 2はまだ空です。「Step 2へ候補を作る」を押してください。')
  setTrendStatus('サンプルのトレンド語を入れました。まだStep 2には入っていません。', 'warn')
}

function applyTrendScoutTerms() {
  const count = trendScoutTerms().length
  generateCandidates()
  const made = state.candidates.length
  if (made === 0) {
    setTrendStatus('候補を作れませんでした。商品やトレンド語を変えてからもう一度押してください。', 'warn')
    return
  }

  setTrendStatus(count > 0
    ? `${count}件のトレンド語からStep 2に${made}件の候補を作りました。次は「eRankで広く見る」です。`
    : `トレンド語なしでStep 2に${made}件の候補を作りました。次は「eRankで広く見る」です。`, 'ready')
}

function appendTrendScoutCandidates(candidates) {
  const existing = new Set(trendScoutTerms().map((term) => normalizePhrase(term)))
  const nextLines = []

  candidates.forEach((candidate) => {
    const keyword = normalizePhrase(candidate?.keyword ?? candidate)
    if (!keyword || existing.has(keyword)) return
    existing.add(keyword)
    const source = String(candidate?.source ?? '').trim()
    nextLines.push(source ? `${keyword} | ${source}` : keyword)
  })

  if (nextLines.length === 0) return 0
  const current = String(elements.trendScoutInput.value ?? '').trim()
  elements.trendScoutInput.value = [current, ...nextLines].filter(Boolean).join('\n')
  return nextLines.length
}

async function collectTrendScoutTerms() {
  if (!state.extensionConnected) {
    setTrendStatus('Chrome拡張とまだ接続できていません。拡張機能をReloadしてから、このMarket Finderページも再読み込みしてください。', 'warn')
    return
  }

  const originalLabel = elements.trendAutoBtn.textContent
  elements.trendAutoBtn.disabled = true
  elements.trendAutoBtn.textContent = '取得中...'
  resetCandidatesForInputChange('4サイトから探しています。完了するとここに候補が入ります。')
  setTrendStatus('取得中です。4サイトを開いて、見えている語句を拾っています。', 'working')

  try {
    const result = await requestExtension('COLLECT_TRENDS', {
      sources: ['erank', 'etsy', 'pinterest', 'google'],
      limit: 18,
    }, 90000)
    const response = result.response ?? {}
    const trends = Array.isArray(response.trends) ? response.trends : []
    const errors = Array.isArray(response.errors) ? response.errors : []
    const added = appendTrendScoutCandidates(trends)
    generateCandidates()

    if (added > 0) {
      const note = errors.length > 0 ? ` 取得できなかったページ: ${errors.slice(0, 2).join(' / ')}` : ''
      setTrendStatus(`完了しました。${added}件のトレンド語を追加し、Step 2に${state.candidates.length}件の候補を作りました。次は「eRankで広く見る」です。${note}`, 'ready')
    } else if (trends.length > 0 && state.candidates.length > 0) {
      setTrendStatus(`完了しました。新しく追加する語句はありませんでしたが、既存のトレンド語からStep 2に${state.candidates.length}件の候補を作りました。`, 'ready')
    } else if (errors.length > 0) {
      setTrendStatus(`完了しましたが、自動取得できませんでした。対象ページにログインして表示後、もう一度押してください。${errors.slice(0, 2).join(' / ')}`, 'warn')
    } else {
      setTrendStatus('完了しましたが、候補語は見つかりませんでした。対象ページを表示してから、もう一度押してください。', 'warn')
    }
  } catch (error) {
    setTrendStatus(friendlyExtensionError(error), 'warn')
  } finally {
    elements.trendAutoBtn.disabled = false
    elements.trendAutoBtn.textContent = originalLabel
  }
}

function setSimpleStatus(message) {
  elements.simpleStatus.textContent = message
}

function setFlowMode(mode, options = {}) {
  document.body.classList.remove('flow-auto', 'flow-csv', 'flow-seo')
  document.body.classList.add(`flow-${mode}`)
  ;[elements.flowAutoBtn, elements.flowCsvBtn, elements.flowSeoBtn].forEach((button) => {
    button.classList.toggle('is-active', button.dataset.flowChoice === mode)
  })

  if (mode === 'auto') {
    elements.simpleSeoStepNumber.textContent = '4'
    setSimpleStatus('商品だけでもOKです。相手・状況・趣味職業を自動で混ぜて候補を作ります。次は2「eRankで広く見る」です。')
  } else if (mode === 'csv') {
    elements.simpleSeoStepNumber.textContent = '2'
    setSimpleStatus('CSVを貼って、1「CSVを読み込む」を押してください。')
  } else {
    elements.simpleSeoStepNumber.textContent = '2'
    setSimpleStatus('良いキーワードを貼って、1「SEO用に入れる」を押してください。')
  }

  if (options.persist !== false) persistMarketFinderState()
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
  persistMarketFinderState()
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

function releaseRunningControls() {
  if (state.extensionState?.active) {
    state.extensionState = {
      ...state.extensionState,
      active: false,
      currentKeyword: '',
    }
  }
  setRunningControls(false)
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
  if (state.progress.failed || state.progress.stopped || !state.extensionState?.active) {
    releaseRunningControls()
  }
}

function failProgress(message) {
  state.progress.failed = true
  state.progress.message = message
  state.progress.visible = true
  releaseRunningControls()
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

  const starting = state.progress.visible && state.progress.started && !state.progress.wasActive && !state.progress.failed && !state.progress.stopped
  setRunningControls(active || starting)

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
    const message = friendlyExtensionError(error)
    state.extensionConnected = false
    releaseRunningControls()
    updateExtensionBadge()
    elements.extensionStatus.textContent = message
    if (state.progress.visible) failProgress(message)
  }
}

async function startExtensionResearch() {
  state.broadAutoImport = false
  const keywords = parseResearchJob(elements.researchJobInput.value)
  if (keywords.length === 0) {
    elements.extensionStatus.textContent = '調査キーワード / JSON欄に、調査したいキーワードを入れてください。'
    return
  }
  if (!confirmExportBeforeClearingResults({ scope: 'everbee', label: '前回のEverBee売上結果' })) return
  clearResearchResults('everbee')

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
  const keywords = erankResearchKeywords()
  if (keywords.length === 0) {
    const message = 'Step 2が空です。左の「Step 2へ候補を作る」を押してから、もう一度「eRankで広く見る」を押してください。'
    setSimpleStatus(message)
    state.candidateMessage = message
    renderCandidates()
    return
  }
  if (!confirmExportBeforeClearingResults({ scope: 'all', label: '前回の調査結果' })) return
  clearResearchResults('all')

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
  if (!confirmExportBeforeClearingResults({ scope: 'all', label: '前回の調査結果' })) return
  clearResearchResults('all')

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
    resetCandidatesForInputChange()
  })
  elements.customEventInput.addEventListener('input', () => {
    renderTargets({ syncYear: false })
    resetCandidatesForInputChange()
  })
  elements.categorySelect.addEventListener('change', () => resetCandidatesForInputChange())
  elements.yearInput.addEventListener('input', () => resetCandidatesForInputChange())
  elements.limitInput.addEventListener('input', () => resetCandidatesForInputChange())
  elements.seedInput.addEventListener('input', () => resetCandidatesForInputChange())
  elements.trendScoutInput.addEventListener('input', () => resetCandidatesForInputChange())
  elements.riskInput.addEventListener('input', () => resetCandidatesForInputChange())
  elements.targetChips.addEventListener('change', () => resetCandidatesForInputChange())
  ;[
    elements.broadQueryInput,
    elements.researchJobInput,
    elements.everbeeUrlInput,
    elements.delayInput,
    elements.visibilityBucketInput,
    elements.reachBucketInput,
    elements.bestSellerBucketInput,
    elements.simpleSeoKeywordsInput,
  ].forEach((input) => {
    input.addEventListener('input', persistMarketFinderState)
  })
  elements.broadBuildQueriesBtn.addEventListener('click', buildBroadQueries)
  elements.broadStartBtn.addEventListener('click', startBroadEverbeeResearch)
  elements.broadExtractBtn.addEventListener('click', extractBroadMarketHints)
  elements.broadApplyBtn.addEventListener('click', applyBroadHintsToSeeds)
  elements.broadSampleBtn.addEventListener('click', fillBroadSample)
  elements.trendSampleBtn.addEventListener('click', fillTrendSample)
  elements.trendAutoBtn.addEventListener('click', collectTrendScoutTerms)
  elements.trendApplyBtn.addEventListener('click', applyTrendScoutTerms)
  elements.addResearchBtn.addEventListener('click', addManualResearch)
  elements.importCsvBtn.addEventListener('click', importCsv)
  elements.sampleCsvBtn.addEventListener('click', fillSampleCsv)
  elements.resultsList.addEventListener('click', handleResultListClick)
  elements.copyKeywordsBtn.addEventListener('click', copyKeywords)
  elements.copyReadyBtn.addEventListener('click', copyReadyKeywords)
  elements.downloadJobBtn.addEventListener('click', downloadJob)
  elements.downloadErankCsvBtn.addEventListener('click', exportErankCsv)
  elements.downloadStep4CsvBtn.addEventListener('click', exportStep4Csv)
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
  const persisted = restorePersistedState()
  renderTargets({ selectedTargets: persisted?.form?.targets })
  bindEvents()
  setFlowMode(persisted?.flowMode ?? 'auto', { persist: false })
  state.candidates = []
  state.candidateMessage = 'まだ空です。左の条件を決めてから「Step 2へ候補を作る」を押してください。'
  renderAll()
  if (state.researchRows.length > 0) {
    setSimpleStatus(`${state.researchRows.length}件の前回結果を復元しました。続きから使えます。`)
  }
  setRunningControls(false)
  initExtensionBridge()
}

init()
