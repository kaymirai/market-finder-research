import {
  MARKET_EVENTS,
  PRODUCT_CATEGORIES,
  advanceMarketplaceInsightResearch,
  buildKeywordClusterKey,
  buildCrossNicheDrilldown,
  buildMarketplaceInsightPlan,
  generateBroadMarketQueries,
  generateBroadEventCandidates,
  generateKeywordCandidates,
  parseBroadMarketListings,
  everbeeResultsToBroadListings,
  extractNicheHintsFromListings,
  parseEverbeeRows,
  buildProductIdea,
  recommendProductRoute,
  classifyKeywordBucket,
  buildSeoPlanFromBuckets,
  scoreEverbeeResult,
  explainEverbeeScore,
  scoreErankOpportunity,
  classifyCandidateKeyword,
  detectRiskTerms,
  clusterKeywordCandidates,
  getMarketTiming,
  getBroadEventDiscoveryProfile,
  getSourceFreshness,
  keywordMatchesCategoryProduct,
  mergeMarketplaceInsightRelatedMetrics,
  normalizePhrase,
  resolveMarketEvent,
} from '../../shared/market-keyword-engine/index.js?v=20260722-1'
import {
  createMemoizedAnalysis,
  mergeRowsByKey,
} from './research-performance.js?v=20260720-1'
import {
  buildEtsyCandidatesFromErank,
  extensionResultsImportMode,
  marketplaceCompletedKeywords,
  shouldDiscardMarketplacePlan,
} from './research-flow.js?v=20260720-7'
import {
  advanceCrossNicheWorkflow,
  createCrossNicheWorkflowState,
  isCrossNicheWorkflowPending,
} from './cross-niche-workflow.js?v=20260720-1'
import {
  attachErankQueryProvenance,
  buildErankQueryPlan,
  summarizeErankQueryPlan,
} from './erank-query-plan.js?v=20260722-1'
import {
  createResearchRoundsState,
  researchRowsForRound,
  selectResearchRound,
  startResearchRound,
  summarizeOpportunityCounts,
  updateResearchRound,
} from './research-rounds.js?v=20260722-1'
import {
  EVENT_MARKET_TRACKS,
  buildResearchMarketHistory,
  classifyEventMarketTrack,
  normalizeResearchMarketHistory,
  prioritizeEventCandidates,
} from './event-market-tracks.js?v=20260720-1'

const PAGE_SOURCE = 'market-finder-page'
const EXTENSION_SOURCE = 'market-finder-extension'
const PERSISTENCE_KEY = 'etsy-mirai-market-finder-state-v1'
const PERSISTENCE_VERSION = 1
const SEARCH_SEED_METADATA_URL = './data/etsy-search-keyword-metadata-2026-05-23.csv'
const SEARCH_SEED_PICK_LIMIT = 20
const ERANK_RESEARCH_LIMIT = 20
const SEARCH_SEED_PREVIEW_LIMIT = 6
const DISCOVERY_LANE_LABELS = {
  motif: 'モチーフ',
  moment: '場面',
  audience: '相手',
  aesthetic: 'テイスト',
  adjacent: '周辺需要',
}
const QUERY_STRATEGY_LABELS = {
  direct: 'Direct',
  adjacent: 'Adjacent',
  observed: 'Observed',
  'cross-niche': 'Cross niche',
}
const MARKETPLACE_STAGE_LABELS = {
  discovery: '入口',
  validation: '検証',
  reserve: '予備',
  followup: '関連深掘り',
}
const MARKETPLACE_STATUS_LABELS = {
  planned: '未検索',
  opened: '取得中',
  completed: '取得済み',
  skipped: 'スキップ',
  error: '要確認',
}
const MARKETPLACE_STOP_LABELS = {
  'max-followups': '最大40語を完了',
  stagnant: '新しい有望群なし',
  'candidate-pool-depleted': '有効候補が5語未満',
}

const state = {
  candidates: [],
  candidateMessage: 'まだ候補はありません。商品と条件を選んで「候補を自動で探す」を押してください。',
  activeDiscoveryLane: 'all',
  candidateRoundId: '',
  marketplaceInsightMode: 'free',
  marketplaceInsightPlan: null,
  marketplaceInsightBusy: false,
  marketplaceInsightAutoRunning: false,
  marketplaceInsightMessage: '',
  crossNicheWorkflow: createCrossNicheWorkflowState(),
  erankQueryPlan: [],
  researchRounds: createResearchRoundsState(),
  candidateCatalog: [],
  researchRows: [],
  researchedMarketHistory: [],
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
    current: '',
    done: 0,
    completed: false,
  },
  extensionConnected: false,
  extensionState: null,
  restoredResearchSavedAt: '',
  restoredResultsAccepted: false,
  acceptExtensionResults: false,
  seoPlan: null,
  selectedResultKey: '',
  recentTrendKeywords: new Set(),
  lastTrendRunStartedAt: '',
  searchSeedRows: [],
  searchSeedLoaded: false,
  searchSeedError: '',
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
  searchSeedCount: document.querySelector('#searchSeedCount'),
  searchSeedList: document.querySelector('#searchSeedList'),
  searchSeedStatus: document.querySelector('#searchSeedStatus'),
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
  candidateRoundTabs: document.querySelector('#candidateRoundTabs'),
  broadEventDiscovery: document.querySelector('#broadEventDiscovery'),
  discoveryLaneTabs: document.querySelector('#discoveryLaneTabs'),
  discoveryStrategySummary: document.querySelector('#discoveryStrategySummary'),
  erankQueryPlanSummary: document.querySelector('#erankQueryPlanSummary'),
  marketplaceInsightPanel: document.querySelector('#marketplaceInsightPanel'),
  marketplaceModeControl: document.querySelector('#marketplaceModeControl'),
  marketplaceFreeModeBtn: document.querySelector('#marketplaceFreeModeBtn'),
  marketplacePlusModeBtn: document.querySelector('#marketplacePlusModeBtn'),
  marketplaceAccessBadge: document.querySelector('#marketplaceAccessBadge'),
  marketplacePlanHelp: document.querySelector('#marketplacePlanHelp'),
  marketplacePlanCount: document.querySelector('#marketplacePlanCount'),
  marketplacePlanRemaining: document.querySelector('#marketplacePlanRemaining'),
  marketplaceOfficialRemaining: document.querySelector('#marketplaceOfficialRemaining'),
  marketplaceAdaptiveStatus: document.querySelector('#marketplaceAdaptiveStatus'),
  marketplaceCandidatePoolCount: document.querySelector('#marketplaceCandidatePoolCount'),
  marketplaceFollowUpCount: document.querySelector('#marketplaceFollowUpCount'),
  marketplaceResearchRound: document.querySelector('#marketplaceResearchRound'),
  marketplaceStopReason: document.querySelector('#marketplaceStopReason'),
  marketplaceCurrentQuery: document.querySelector('#marketplaceCurrentQuery'),
  marketplaceStartBtn: document.querySelector('#marketplaceStartBtn'),
  marketplaceStartStatus: document.querySelector('#marketplaceStartStatus'),
  marketplaceBuildPlanBtn: document.querySelector('#marketplaceBuildPlanBtn'),
  marketplaceNextBtn: document.querySelector('#marketplaceNextBtn'),
  marketplaceAutoStopBtn: document.querySelector('#marketplaceAutoStopBtn'),
  marketplaceCaptureBtn: document.querySelector('#marketplaceCaptureBtn'),
  marketplaceNextBatchBtn: document.querySelector('#marketplaceNextBatchBtn'),
  marketplaceSkipBtn: document.querySelector('#marketplaceSkipBtn'),
  marketplaceQueue: document.querySelector('#marketplaceQueue'),
  marketplaceStatus: document.querySelector('#marketplaceStatus'),
  marketplaceResultsList: document.querySelector('#marketplaceResultsList'),
  everbeeQueueStatus: document.querySelector('#everbeeQueueStatus'),
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
  etsySearchesInput: document.querySelector('#etsySearchesInput'),
  etsyListingsInput: document.querySelector('#etsyListingsInput'),
  etsyRelatedTermsInput: document.querySelector('#etsyRelatedTermsInput'),
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
  researchRoundProgress: document.querySelector('#researchRoundProgress'),
  researchRoundTabs: document.querySelector('#researchRoundTabs'),
  researchRoundSummary: document.querySelector('#researchRoundSummary'),
  crossNicheSection: document.querySelector('#crossNicheSection'),
  crossNicheCount: document.querySelector('#crossNicheCount'),
  crossNicheList: document.querySelector('#crossNicheList'),
  crossNicheStatus: document.querySelector('#crossNicheStatus'),
  copyKeywordsBtn: document.querySelector('#copyKeywordsBtn'),
  copyReadyBtn: document.querySelector('#copyReadyBtn'),
  downloadJobBtn: document.querySelector('#downloadJobBtn'),
  candidateErankBtn: document.querySelector('#candidateErankBtn'),
  erankToEverbeeBtn: document.querySelector('#erankToEverbeeBtn'),
  everbeeUrlInput: document.querySelector('#everbeeUrlInput'),
  researchJobInput: document.querySelector('#researchJobInput'),
  fillResearchJobBtn: document.querySelector('#fillResearchJobBtn'),
  clearResearchJobBtn: document.querySelector('#clearResearchJobBtn'),
  delayInput: document.querySelector('#delayInput'),
  startExtensionBtn: document.querySelector('#startExtensionBtn'),
  stopExtensionBtn: document.querySelector('#stopExtensionBtn'),
  quickExtensionBadge: document.querySelector('#quickExtensionBadge'),
  quickExtensionStatus: document.querySelector('#quickExtensionStatus'),
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

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function latestResearchCheckedAt(rows = []) {
  return rows
    .flatMap((row) => [row.erankCheckedAt, row.etsyCheckedAt, row.everbeeCheckedAt])
    .filter((value) => value && !Number.isNaN(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? ''
}

function isTimestampLike(value) {
  const text = String(value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(text) || /\d{1,2}:\d{2}/.test(text)
}

const TREND_MONTH_WORDS = new Set([
  'jan', 'january', 'feb', 'february', 'mar', 'march', 'apr', 'april',
  'may', 'jun', 'june', 'jul', 'july', 'aug', 'august', 'sep', 'sept',
  'september', 'oct', 'october', 'nov', 'november', 'dec', 'december',
])

const TREND_GENERIC_WORDS = new Set([
  'shirt',
  'shirts',
  'tee',
  'tshirt',
  'tshirts',
  'gift',
  'gifts',
  'mug',
  'tote',
  'bag',
  'sticker',
  'wall',
  'art',
  'wedding',
  'birthday',
  'holiday',
  'christmas',
  'halloween',
  'graduation',
  'party',
  'custom',
  'personalized',
])

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
      activeDiscoveryLane: state.activeDiscoveryLane,
      candidateRoundId: state.candidateRoundId,
      marketplaceInsightMode: state.marketplaceInsightMode,
      marketplaceInsightPlan: state.marketplaceInsightPlan,
      marketplaceInsightMessage: state.marketplaceInsightMessage,
      crossNicheWorkflow: state.crossNicheWorkflow,
      erankQueryPlan: state.erankQueryPlan,
      researchRounds: state.researchRounds,
      candidateCatalog: state.candidateCatalog,
      researchedMarketHistory: state.researchedMarketHistory,
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
  state.restoredResearchSavedAt = state.researchRows.length > 0
    ? latestResearchCheckedAt(state.researchRows) || String(persisted.savedAt ?? '')
    : ''
  state.broadHints = Array.isArray(savedState.broadHints) ? savedState.broadHints : []
  state.broadSnippetKeys = new Set(Array.isArray(savedState.broadSnippetKeys) ? savedState.broadSnippetKeys : [])
  state.activeDiscoveryLane = String(savedState.activeDiscoveryLane ?? 'all')
  state.candidateRoundId = String(savedState.candidateRoundId ?? '')
  state.marketplaceInsightMode = savedState.marketplaceInsightMode === 'plus' ? 'plus' : 'free'
  state.marketplaceInsightPlan = savedState.marketplaceInsightPlan ?? null
  state.marketplaceInsightMessage = String(savedState.marketplaceInsightMessage ?? '')
  state.crossNicheWorkflow = createCrossNicheWorkflowState(savedState.crossNicheWorkflow)
  state.erankQueryPlan = Array.isArray(savedState.erankQueryPlan) ? savedState.erankQueryPlan : []
  state.researchRounds = createResearchRoundsState(savedState.researchRounds)
  state.candidateCatalog = Array.isArray(savedState.candidateCatalog) ? savedState.candidateCatalog : []
  state.researchedMarketHistory = normalizeResearchMarketHistory(savedState.researchedMarketHistory)
  state.selectedResultKey = String(savedState.selectedResultKey ?? '')
  state.seoPlan = savedState.seoPlan ?? null

  return persisted
}

function migrateLegacyResearchRounds() {
  if (state.researchRounds.rounds.length > 0 || state.researchRows.length === 0) return
  const initialKeywords = cleanKeywordList(
    state.researchRows
      .filter((row) => !Number(row.crossNicheDepth))
      .map((row) => row.sourceKeyword || row.keyword)
  )
  state.researchRounds = startResearchRound(state.researchRounds, {
    type: 'initial',
    depth: 0,
    status: 'complete',
    candidateKeywords: initialKeywords,
    resultKeywords: initialKeywords,
    startedAt: state.restoredResearchSavedAt,
    completedAt: state.restoredResearchSavedAt,
    startReason: '旧形式の保存結果から初回ラウンドを復元',
    stopReason: isCrossNicheWorkflowPending(state.crossNicheWorkflow)
      ? '初回確認後にクロスニッチ探索へ移行済み'
      : '旧形式の保存結果を復元',
  })
  if (isCrossNicheWorkflowPending(state.crossNicheWorkflow)) {
    state.researchRounds = startResearchRound(state.researchRounds, {
      type: 'cross-niche',
      depth: state.crossNicheWorkflow.round || 1,
      status: state.crossNicheWorkflow.status,
      candidateKeywords: state.crossNicheWorkflow.batch.map((candidate) => candidate.keyword),
      startedAt: state.crossNicheWorkflow.startedAt,
      startReason: '旧形式のクロスニッチ進捗を復元',
    })
    state.researchRounds.selectedRoundId = 'all'
  }
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

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

function parseSearchSeedCsv(value) {
  const lines = String(value ?? '').split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map((header) => normalizePhrase(header).replace(/\s+/g, '_'))

  return lines.slice(1)
    .map((line) => {
      const cells = parseCsvLine(line)
      const row = {}
      headers.forEach((header, index) => {
        row[header] = cells[index] ?? ''
      })
      const keyword = normalizePhrase(row.keyword)
      const searches = Number(String(row.searches ?? '').replace(/,/g, ''))
      const results = Number(String(row.results ?? '').replace(/,/g, ''))
      const ratio = Number(String(row.search_result_ratio ?? '').replace(/,/g, ''))
      if (!keyword || !Number.isFinite(searches) || searches <= 0) return null
      return {
        keyword,
        searches,
        results: Number.isFinite(results) ? results : null,
        searchResultRatio: Number.isFinite(ratio) ? ratio : null,
        capturedAt: row.captured_at ?? '',
        confidence: row.confidence ?? '',
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.searches - a.searches || a.keyword.localeCompare(b.keyword, 'en'))
}

function categorySeedTerms(category = selectedCategory()) {
  const product = normalizePhrase(category.searchTerm)
  const map = {
    shirt: ['shirt', 't-shirt', 'tshirt', 'tee'],
    sweatshirt: ['sweatshirt', 'crewneck'],
    mug: ['mug', 'cup', 'drinkware'],
    'tote bag': ['tote bag', 'tote', 'bag'],
    sticker: ['sticker', 'stickers'],
  }
  return map[product] ?? [product]
}

function phraseHasTerm(keyword, term) {
  const keywordTokens = normalizePhrase(keyword).split(' ').filter(Boolean)
  const termTokens = normalizePhrase(term).split(' ').filter(Boolean)
  if (termTokens.length === 0) return false
  for (let index = 0; index <= keywordTokens.length - termTokens.length; index += 1) {
    const matches = termTokens.every((token, offset) => keywordTokens[index + offset] === token)
    if (matches) return true
  }
  return false
}

function searchSeedMatchesCategory(row, category = selectedCategory()) {
  const keyword = normalizePhrase(row.keyword)
  return categorySeedTerms(category).some((term) => phraseHasTerm(keyword, term))
}

function searchSeedLooksUseful(row) {
  const keyword = normalizePhrase(row.keyword)
  const words = keyword.split(' ').filter(Boolean)
  if (words.length < 2) return false
  if (detectRiskTerms(keyword, elements.riskInput.value.split(/\r?\n|,/)).length > 0) return false
  return keywordClass(keyword).action === 'candidate'
}

function searchSeedOpportunityScore(row) {
  const searches = Number(row.searches) || 0
  const results = Number(row.results) || 0
  const ratio = Number(row.searchResultRatio) || 0
  const searchScore = Math.min(35, Math.log10(searches + 1) * 8)
  const ratioScore = Math.min(50, Math.log10(1 + (ratio * 100)) * 25)
  const resultScore = results <= 0
    ? 0
    : results <= 5000
      ? 15
      : results <= 30000
        ? 12
        : results <= 100000
          ? 8
          : results <= 500000
            ? 3
            : -8
  return Math.max(0, Math.min(100, Math.round(searchScore + ratioScore + resultScore)))
}

function rankSearchSeedRows(rows) {
  return [...rows].sort((left, right) => (
    searchSeedOpportunityScore(right) - searchSeedOpportunityScore(left)
    || (Number(right.searchResultRatio) || 0) - (Number(left.searchResultRatio) || 0)
    || (Number(right.searches) || 0) - (Number(left.searches) || 0)
    || left.keyword.localeCompare(right.keyword, 'en')
  ))
}

function searchSeedRowsForCurrentCategory(limit = SEARCH_SEED_PICK_LIMIT) {
  const matching = state.searchSeedRows
    .filter((row) => searchSeedMatchesCategory(row))
    .filter((row) => searchSeedLooksUseful(row))
  const fallback = state.searchSeedRows
    .filter((row) => searchSeedLooksUseful(row))
  return rankSearchSeedRows(matching.length > 0 ? matching : fallback).slice(0, limit)
}

function formatCompactNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return number.toLocaleString('en-US')
}

function formatSeedRatio(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return number.toFixed(number >= 1 ? 2 : 3).replace(/\.?0+$/, '')
}

function parseTrendScoutEntries(value) {
  const ignored = new Set(['keyword', 'keywords', 'trend', 'source', 'search', 'clicks', 'competition', 'kd', 'change', 'rank'])
  const entries = []
  const seen = new Set()

  String(value ?? '')
    .split(/\r?\n/)
    .forEach((line) => {
      const source = String(line ?? '').trim()
      if (!source) return
      const cells = source.split(/\t|,|\|/).map((cell) => cell.trim()).filter(Boolean)
      const candidates = cells.length > 1 ? cells : [source]
      const keywordIndex = candidates.findIndex((cell) => {
        const cleaned = cell.replace(/^\s*#?\d+[\).\-\s]+/, '').trim()
        return /[a-zA-Z]/.test(cleaned) && !ignored.has(normalizePhrase(cleaned)) && !isTimestampLike(cleaned)
      })
      if (keywordIndex < 0) return

      const keyword = normalizePhrase(candidates[keywordIndex].replace(/^\s*#?\d+[\).\-\s]+/, '').trim())
      if (!keyword || seen.has(keyword)) return
      seen.add(keyword)

      const rest = cells.filter((_, index) => index !== keywordIndex)
      const capturedAt = rest.find((cell) => isTimestampLike(cell)) ?? ''
      const sourceLabel = rest.find((cell) => !isTimestampLike(cell) && !ignored.has(normalizePhrase(cell))) ?? ''
      entries.push({ keyword, source: sourceLabel, capturedAt })
    })

  return entries
}

function trendScoutTerms() {
  return parseTrendScoutEntries(elements.trendScoutInput?.value).map((entry) => entry.keyword)
}

function combinedSeedKeywords() {
  return cleanKeywordList([
    ...String(elements.seedInput.value ?? '').split(/\r?\n|,/),
    ...trendScoutTerms(),
  ]).join('\n')
}

function trendCandidateEntries() {
  const category = selectedCategory()
  const product = normalizePhrase(category.searchTerm)
  const eventTerm = normalizePhrase(selectedEvent().searchTerm)
  const year = selectedYearOption()

  return parseTrendScoutEntries(elements.trendScoutInput?.value)
    .map((entry) => ({
      ...entry,
      trendQuality: trendSeedQuality(entry),
    }))
    .filter((entry) => entry.trendQuality.usable)
    .sort((a, b) => b.trendQuality.score - a.trendQuality.score || normalizePhrase(a.keyword).localeCompare(normalizePhrase(b.keyword), 'en'))
    .flatMap((entry) => {
      const keyword = normalizePhrase(entry.keyword)
      if (!keyword) return []
      const hasProduct = keywordMatchesCategoryProduct(keyword, category.id)
      const base = hasProduct ? keyword : `${keyword} ${product}`
      return [
        base,
        eventTerm && !keyword.includes(eventTerm) ? `${eventTerm} ${base}` : '',
        year ? `${base} ${year}` : '',
      ].filter(Boolean).map((candidateKeyword) => ({
        ...entry,
        keyword: normalizePhrase(candidateKeyword),
        baseKeyword: keyword,
      }))
    })
    .filter((entry) => entry.keyword.split(' ').filter(Boolean).length >= 2)
    .filter((entry) => keywordClass(entry.keyword).action === 'candidate')
    .slice(0, 50)
}

function trendCandidateKeywords() {
  return cleanKeywordList(trendCandidateEntries().map((entry) => entry.keyword))
    .slice(0, 50)
}

function isTrendDateAxisNoise(keyword) {
  const words = normalizePhrase(keyword).split(' ').filter(Boolean)
  const hasMonth = words.some((word) => TREND_MONTH_WORDS.has(word))
  const hasYearish = words.some((word) => /^(?:20\d{2}|\d{2})$/.test(word))
  const specificWords = words.filter((word) => (
    !TREND_MONTH_WORDS.has(word)
    && !TREND_GENERIC_WORDS.has(word)
    && !/^(?:20\d{2}|\d{2}|[\d,]+)$/.test(word)
  ))
  return hasMonth && hasYearish && specificWords.length === 0
}

function trendSeedQuality(entry) {
  const keyword = normalizePhrase(entry?.keyword)
  const words = keyword.split(' ').filter(Boolean)
  if (!keyword) return { usable: false, score: 0, reason: '空です' }
  if (isTrendDateAxisNoise(keyword)) return { usable: false, score: 0, reason: '月/年だけのグラフ軸です' }
  if (words.every((word) => TREND_GENERIC_WORDS.has(word) || /^\d+$/.test(word))) {
    return { usable: false, score: 0, reason: '商品名やイベント名だけで広すぎます' }
  }
  if (detectRiskTerms(keyword, elements.riskInput.value.split(/\r?\n|,/)).length > 0) return { usable: false, score: 0, reason: 'リスク語句を含みます' }

  const source = String(entry?.source ?? '').toLowerCase()
  const sourceScore = source.includes('erank') ? 34 : (source.includes('search volume') || source.includes('search opportunity')) ? 30 : source.includes('pinterest') ? 28 : source.includes('google') ? 24 : 18
  const specificityScore = words.reduce((score, word) => {
    if (TREND_GENERIC_WORDS.has(word) || TREND_MONTH_WORDS.has(word) || /^\d+$/.test(word)) return score
    return score + (word.length >= 7 ? 10 : 6)
  }, 0)
  const phraseBonus = words.length >= 2 ? 8 : words[0]?.length >= 7 ? 4 : 0
  const broadPenalty = words.length <= 2 && words.some((word) => ['wedding', 'birthday', 'gift', 'shirt', 'tshirt', 'wall', 'art'].includes(word)) ? 16 : 0
  const score = Math.max(0, Math.min(100, sourceScore + specificityScore + phraseBonus - broadPenalty))
  return { usable: score >= 22, score, reason: score >= 22 ? 'トレンド種として採用' : '広すぎるため除外' }
}

function keywordClassificationOptions() {
  return {
    eventId: elements.eventSelect.value,
    customEventName: customEventName(),
    categoryId: elements.categorySelect.value,
  }
}

function keywordClass(keyword) {
  return classifyCandidateKeyword(keyword, keywordClassificationOptions())
}

function currentBroadEventProfile() {
  return getBroadEventDiscoveryProfile(keywordClassificationOptions())
}

function isBroadEventDiscovery() {
  return currentBroadEventProfile().enabled
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
    observedTerms: combinedSeedKeywords(),
    customRiskTerms: elements.riskInput.value,
    discoveryMode: isBroadEventDiscovery() ? 'broad-event' : 'standard',
  }
}

function marketTrackOptionsForRow(row = {}) {
  return {
    ...currentOptions(),
    eventId: row.researchEventId || elements.eventSelect.value,
    categoryId: row.researchCategoryId || elements.categorySelect.value,
  }
}

function marketTrackLabel(track) {
  return track === EVENT_MARKET_TRACKS.eventSpecific ? 'イベント固有' : '通年隣接'
}

function wearerIntentLabel(intent) {
  if (intent === 'recipient') return '贈答向け'
  if (intent === 'group') return 'グループ向け'
  if (intent === 'self') return '本人向け'
  return ''
}

function buyerIntentDetail(row = {}) {
  return [
    wearerIntentLabel(row.wearerIntent),
    row.recipientRole ? `受け手: ${row.recipientRole}` : '',
    row.giverRole ? `贈り手: ${row.giverRole}` : '',
    row.occasion ? `節目: ${row.occasion}` : '',
    row.personalization ? `個別化: ${row.personalization}` : '',
  ].filter(Boolean)
}

function eventLabelFromId(eventId) {
  return MARKET_EVENTS.find((event) => event.id === eventId)?.jpLabel || eventId
}

function marketTrackMetadataForRow(row = {}) {
  const options = marketTrackOptionsForRow(row)
  const decorated = prioritizeEventCandidates([{
    ...row,
    keyword: row.score?.normalized?.keyword ?? row.keyword,
  }], state.researchedMarketHistory, options)[0]
  return {
    intentTrack: decorated.intentTrack,
    historyClusterKey: decorated.historyClusterKey,
    previouslyResearchedElsewhere: decorated.previouslyResearchedElsewhere,
    priorEventIds: decorated.priorEventIds,
    researchEventId: row.researchEventId || options.eventId,
  }
}

function syncResearchMarketHistory() {
  state.researchedMarketHistory = buildResearchMarketHistory(
    state.researchedMarketHistory,
    state.researchRows,
    currentOptions(),
  )
}

const analyzeResearchRows = createMemoizedAnalysis((rows, options) => {
  const scoredRows = rows
    .map((row) => ({ ...row, score: scoreEverbeeResult(row, options) }))
    .sort((a, b) => b.score.score - a.score.score || normalizePhrase(a.keyword).localeCompare(normalizePhrase(b.keyword), 'en'))
  const erankRows = scoredRows
    .filter((row) => row.score.validation.hasErankData && !row.score.validation.hasEverbeeData)
    .map((row) => ({
      ...row,
      erankOpportunity: scoreErankOpportunity(row, options),
    }))
    .sort((a, b) => b.erankOpportunity.score - a.erankOpportunity.score || normalizePhrase(a.keyword).localeCompare(normalizePhrase(b.keyword), 'en'))
  const everbeeRows = scoredRows
    .filter((row) => row.score.validation.hasEverbeeData)
    .map((row) => ({
      ...row,
      idea: buildProductIdea(row.keyword, options),
      productRoute: recommendProductRoute(row, row.score, options),
    }))

  return { scoredRows, erankRows, everbeeRows }
})

function currentResearchAnalysis() {
  return analyzeResearchRows(state.researchRows, currentOptions())
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

function mergeCandidateCatalog(candidates = []) {
  const byKeyword = new Map(
    state.candidateCatalog.map((candidate) => [normalizePhrase(candidate.keyword), candidate])
  )
  candidates.forEach((candidate) => {
    const keyword = normalizePhrase(candidate?.keyword)
    if (!keyword) return
    byKeyword.set(keyword, { ...byKeyword.get(keyword), ...candidate, keyword })
  })
  state.candidateCatalog = [...byKeyword.values()]
}

function currentResearchRound() {
  return state.researchRounds.rounds.find((round) => round.id === state.researchRounds.activeRoundId) ?? null
}

function activeRoundLabel() {
  const round = currentResearchRound()
  if (!round || round.type === 'initial') return '初回候補'
  return `クロスニッチ${round.depth}/2`
}

function beginInitialResearchRound() {
  const keywords = readyKeywords().slice(0, ERANK_RESEARCH_LIMIT)
  state.researchRounds = startResearchRound(state.researchRounds, {
    type: 'initial',
    depth: 0,
    candidateKeywords: keywords,
    status: 'pending-erank',
    startedAt: new Date().toISOString(),
    startReason: '自動探索で作成した初回候補を確認',
  })
  state.candidateRoundId = state.researchRounds.activeRoundId
}

function syncActiveRoundStatus(status, details = {}) {
  const round = currentResearchRound()
  if (!round) return
  state.researchRounds = updateResearchRound(state.researchRounds, round.id, {
    ...details,
    status,
  })
}

function activeCrossNicheBatchKeywords() {
  if (!isCrossNicheWorkflowPending(state.crossNicheWorkflow)) return new Set()
  return new Set(
    state.crossNicheWorkflow.batch
      .map((candidate) => normalizePhrase(candidate.keyword))
      .filter(Boolean)
  )
}

function preserveCrossNicheResearch(scope) {
  if (!isCrossNicheWorkflowPending(state.crossNicheWorkflow)) return false
  if (scope === 'erank') return state.crossNicheWorkflow.status === 'pending-erank'
  if (scope === 'everbee') return ['pending-etsy', 'pending-everbee'].includes(state.crossNicheWorkflow.status)
  return false
}

function removePhraseFromTokens(tokens, phrase) {
  const phraseTokens = normalizePhrase(phrase).split(' ').filter(Boolean)
  if (phraseTokens.length === 0) return tokens
  const next = []
  for (let index = 0; index < tokens.length; index += 1) {
    const matches = phraseTokens.every((token, offset) => tokens[index + offset] === token)
    if (matches) {
      index += phraseTokens.length - 1
    } else {
      next.push(tokens[index])
    }
  }
  return next
}

function erankProbeKeyword(keyword) {
  const category = selectedCategory()
  const eventTerm = normalizePhrase(selectedEvent().searchTerm)
  let tokens = normalizePhrase(keyword).split(' ').filter(Boolean)
  if (eventTerm) tokens = removePhraseFromTokens(tokens, eventTerm)
  tokens = tokens.filter((token) => !/^(?:20\d{2}|\d{2})$/.test(token) || /\b(?:est|class|senior|grad)\b/.test(keyword))

  let probe = normalizePhrase(tokens.join(' '))
  if (!probe) return ''
  if (!searchSeedMatchesCategory({ keyword: probe }, category)) {
    probe = normalizePhrase(`${probe} ${category.searchTerm}`)
  }
  if (detectRiskTerms(probe, elements.riskInput.value.split(/\r?\n|,/)).length > 0) return ''
  if (keywordClass(probe).action !== 'candidate') return ''

  return probe
}

function erankShortlistKeywords() {
  const ranked = currentResearchAnalysis().scoredRows
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
  const rows = currentResearchAnalysis().erankRows
  const batchKeywords = activeCrossNicheBatchKeywords()
  if (batchKeywords.size === 0) return rows
  return rows.filter((row) => [
    row.keyword,
    row.sourceKeyword,
    ...(Array.isArray(row.sourceKeywords) ? row.sourceKeywords : []),
  ].some((keyword) => batchKeywords.has(normalizePhrase(keyword))))
}

function etsyValidationCandidates() {
  if (restoredResultsAwaitingConfirmation()) return []
  return buildEtsyCandidatesFromErank(erankResultRows(), state.candidates)
}

function restoredResultsAwaitingConfirmation() {
  return Boolean(state.restoredResearchSavedAt && !state.restoredResultsAccepted)
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
    const withProduct = keywordMatchesCategoryProduct(keyword, category.id) ? keyword : `${keyword} ${product}`
    const withEvent = hasEventSignal || !eventTerm ? withProduct : `${eventTerm} ${withProduct}`
    return [withProduct, withEvent, year ? `${withProduct} ${year}` : '']
  })

  return cleanKeywordList([...productized, ...generated]).slice(0, 50)
}

function salesCheckKeywords() {
  const official = marketplaceCompletedKeywords(state.marketplaceInsightPlan)
  if (official.length > 0) return cleanKeywordList(official).slice(0, 50)
  const narrowed = narrowEverbeeKeywordsFromErank()
  return narrowed.length > 0 ? narrowed : readyKeywords()
}

function buildCurrentErankQueryPlan() {
  return buildErankQueryPlan(state.candidates, {
    eventTerm: selectedEvent().searchTerm,
    candidateLimit: ERANK_RESEARCH_LIMIT,
    baseQueryFor: (keyword, candidate) => candidate.queryStrategy === 'cross-niche'
      ? keyword
      : erankProbeKeyword(keyword),
  })
}

function erankResearchKeywords() {
  state.erankQueryPlan = buildCurrentErankQueryPlan()
  return state.erankQueryPlan.map((item) => item.query)
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
      <small>${escapeHtml(hint.count)} / ${escapeHtml(hint.listingCount ?? 1)}商品${hint.recentListingCount ? ` / 新着${escapeHtml(hint.recentListingCount)}` : ''}</small>
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
  const existingRows = parseBroadMarketListings(elements.broadMarketInput.value)
  const rowsByTitle = new Map(existingRows.map((row) => [normalizePhrase(row.title), row]))
  let changed = 0

  for (const row of rows) {
    const title = normalizePhrase(row.title)
    if (!title) continue
    const existing = rowsByTitle.get(title)
    const incomingHasMetrics = String(row.sales ?? '').trim() !== '' || String(row.listingAgeMonths ?? '').trim() !== ''
    if (existing && !incomingHasMetrics) continue
    const sameMetrics = existing && ['sales', 'totalSales', 'revenue', 'listingAgeMonths', 'price', 'shopName']
      .every((field) => String(existing[field] ?? '').trim() === String(row[field] ?? '').trim())
    if (sameMetrics) continue
    rowsByTitle.set(title, row)
    changed += 1
  }

  if (changed === 0) return 0

  const mergedRows = Array.from(rowsByTitle.values())
  const header = 'Product Name,Tags,Sales,Total Sales,Revenue,Listing Age Months,Price,Shop Name'
  const lines = mergedRows.map((row) => [
    csvCell(row.title),
    csvCell(row.tags ?? ''),
    csvCell(row.sales ?? ''),
    csvCell(row.totalSales ?? ''),
    csvCell(row.revenue ?? ''),
    csvCell(row.listingAgeMonths ?? ''),
    csvCell(row.price ?? ''),
    csvCell(row.shopName ?? ''),
  ].join(','))
  elements.broadMarketInput.value = `${header}\n${lines.join('\n')}`
  state.broadSnippetKeys = new Set(mergedRows.map((row) => normalizePhrase(row.title)).filter(Boolean))
  extractBroadMarketHints()
  return changed
}

function marketResultsToBroadRows(results = []) {
  return everbeeResultsToBroadListings(results)
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
  elements.broadStatus.textContent = `${selected.length}個を追加ニッチ語句へ入れて、調査候補を作りました。`
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

function renderSearchSeedRows() {
  if (!elements.searchSeedList) return
  if (state.searchSeedError) {
    elements.searchSeedCount.textContent = '未読込'
    elements.searchSeedList.innerHTML = '<div class="empty-state small">検索種データを読み込めませんでした。</div>'
    elements.searchSeedStatus.textContent = state.searchSeedError
    return
  }

  if (!state.searchSeedLoaded) {
    elements.searchSeedCount.textContent = '読込中'
    elements.searchSeedList.innerHTML = '<div class="empty-state small">入口ワードデータを読み込んでいます。</div>'
    return
  }

  const rows = searchSeedRowsForCurrentCategory(SEARCH_SEED_PREVIEW_LIMIT)
  elements.searchSeedCount.textContent = `${state.searchSeedRows.length}件`
  if (rows.length === 0) {
    elements.searchSeedList.innerHTML = '<div class="empty-state small">この商品に近い種ワードがありません。商品を変えるか、流行語を手入力してください。</div>'
    elements.searchSeedStatus.textContent = '入口ワードデータは読み込み済みですが、今の商品に合う候補が少なめです。'
    return
  }

  elements.searchSeedList.innerHTML = rows.map((row) => `
    <div class="search-seed-item">
      <div>
        <strong>${escapeHtml(row.keyword)}</strong>
        <span>Search ${formatCompactNumber(row.searches)} / 商品数 ${formatCompactNumber(row.results)} / 率 ${formatSeedRatio(row.searchResultRatio)}</span>
      </div>
      <div class="search-seed-score">
        <small>入口</small>
        <b>${searchSeedOpportunityScore(row)}</b>
      </div>
    </div>
  `).join('')
  elements.searchSeedStatus.textContent = `検索数と率のバランスがよい順に${rows.length}件を表示中。上の「候補を自動で探す」で自動的に使います。`
}

function appendSearchSeedRowsToTrendScout(options = {}) {
  const rows = searchSeedRowsForCurrentCategory(options.limit ?? SEARCH_SEED_PICK_LIMIT)
  if (rows.length === 0) return 0
  const candidates = rows.map((row) => ({
    keyword: row.keyword,
    source: `Search Opportunity Seed searches ${row.searches} ratio ${row.searchResultRatio ?? '-'}`,
    capturedAt: row.captured_at ?? '',
  }))
  return appendTrendScoutCandidates(candidates)
}

function displayedRoundCandidates() {
  const roundId = state.candidateRoundId || state.researchRounds.activeRoundId
  const round = state.researchRounds.rounds.find((item) => item.id === roundId)
  if (!round) return state.candidates
  const catalog = new Map(state.candidateCatalog.map((candidate) => [normalizePhrase(candidate.keyword), candidate]))
  return round.candidateKeywords.map((keyword) => catalog.get(keyword) ?? {
    keyword,
    categoryLabel: selectedCategory().label,
    score: 0,
    wordCount: keyword.split(' ').length,
    riskTerms: [],
    status: 'ready',
    intentTrack: classifyEventMarketTrack(keyword, currentOptions()),
  })
}

function discoveryCandidates() {
  const candidates = displayedRoundCandidates()
  if (state.activeDiscoveryLane === 'all') return candidates
  return candidates.filter((candidate) => candidate.discoveryLane === state.activeDiscoveryLane)
}

function renderDiscoveryControls() {
  const displayedCandidates = displayedRoundCandidates()
  const enabled = isBroadEventDiscovery() && displayedCandidates.some((candidate) => candidate.discoveryLane)
  elements.broadEventDiscovery.hidden = !enabled
  if (!enabled) {
    state.activeDiscoveryLane = 'all'
    elements.discoveryLaneTabs.innerHTML = ''
    elements.discoveryStrategySummary.innerHTML = ''
    return
  }

  if (state.activeDiscoveryLane !== 'all' && !DISCOVERY_LANE_LABELS[state.activeDiscoveryLane]) {
    state.activeDiscoveryLane = 'all'
  }
  const laneButtons = [
    { id: 'all', label: 'すべて', count: displayedCandidates.length },
    ...Object.entries(DISCOVERY_LANE_LABELS).map(([id, label]) => ({
      id,
      label,
      count: displayedCandidates.filter((candidate) => candidate.discoveryLane === id).length,
    })),
  ]
  elements.discoveryLaneTabs.innerHTML = laneButtons.map((lane) => `
    <button type="button" role="tab" data-discovery-lane="${escapeHtml(lane.id)}" class="${state.activeDiscoveryLane === lane.id ? 'is-active' : ''}" aria-selected="${state.activeDiscoveryLane === lane.id}">
      ${escapeHtml(lane.label)} ${lane.count}
    </button>
  `).join('')

  elements.discoveryStrategySummary.innerHTML = Object.entries(QUERY_STRATEGY_LABELS).map(([strategy, label]) => {
    const count = displayedCandidates.filter((candidate) => candidate.queryStrategy === strategy).length
    return `<span>${escapeHtml(label)} ${count}</span>`
  }).join('')
}

function rebuildMarketplaceInsightPlan({ preserveExisting = false } = {}) {
  const mode = state.marketplaceInsightMode === 'plus' ? 'plus' : 'free'
  const quota = mode === 'plus' ? 60 : 15
  const validationCandidates = etsyValidationCandidates()
  if (validationCandidates.length === 0) {
    if (preserveExisting && state.marketplaceInsightPlan?.items?.length > 0) return true
    state.marketplaceInsightPlan = null
    state.marketplaceInsightMessage = `eRankで需要を確認すると、${quota}語までEtsy公式確認プランを作成できます。`
    return false
  }

  const previous = preserveExisting ? state.marketplaceInsightPlan : null
  const previousItems = Array.isArray(previous?.items) ? previous.items : []
  const capturedRelatedMetrics = previousItems.flatMap((item) => {
    const metrics = Array.isArray(item.result?.etsyRelatedKeywordMetrics)
      ? item.result.etsyRelatedKeywordMetrics
      : []
    return metrics.map((metric) => ({ ...metric, sourceQuery: metric.sourceQuery || item.query }))
  })
  const relatedKeywordMetrics = mergeMarketplaceInsightRelatedMetrics(
    Array.isArray(previous?.relatedKeywordMetrics) ? previous.relatedKeywordMetrics : [],
    capturedRelatedMetrics,
  )
  const built = buildMarketplaceInsightPlan(validationCandidates, {
    ...currentOptions(),
    marketplaceInsightMode: mode,
    relatedKeywordMetrics,
  })
  const builtByQuery = new Map(built.items.map((item) => [normalizePhrase(item.query), item]))
  const mergedItems = []
  const mergedKeys = new Set()
  if (preserveExisting) {
    previousItems.forEach((existing) => {
      const key = normalizePhrase(existing.query)
      if (!key || mergedKeys.has(key)) return
      const rebuilt = builtByQuery.get(key)
      const keepExisting = Boolean(rebuilt)
        || existing.stage === 'followup'
        || existing.status !== 'planned'
      if (!keepExisting) return
      mergedItems.push(rebuilt ? { ...rebuilt, ...existing } : existing)
      mergedKeys.add(key)
    })
  }
  built.items.forEach((item) => {
    const key = normalizePhrase(item.query)
    if (!key || mergedKeys.has(key)) return
    mergedItems.push(item)
    mergedKeys.add(key)
  })
  const items = mergedItems
    .slice(0, built.quota)
    .map((item, index) => ({ ...item, id: `etsy-insight-${index + 1}` }))
  const counts = ['discovery', 'validation', 'reserve', 'followup'].reduce((result, stage) => ({
    ...result,
    [stage]: items.filter((item) => item.stage === stage).length,
  }), {})
  const followUpItems = items.filter((item) => item.stage === 'followup')
  state.marketplaceInsightPlan = {
    ...built,
    mode,
    counts,
    eventId: selectedEvent().id,
    categoryId: selectedCategory().id,
    createdAt: new Date().toISOString(),
    officialRemaining: previous?.officialRemaining ?? null,
    relatedKeywordMetrics,
    candidatePool: built.candidatePool,
    researchRound: previous?.researchRound ?? built.researchRound,
    releasedFollowUpCount: followUpItems.length,
    completedFollowUpCount: followUpItems.filter((item) => ['completed', 'skipped'].includes(item.status)).length,
    stagnantRounds: previous?.stagnantRounds ?? built.stagnantRounds,
    lastEvaluatedRound: previous?.lastEvaluatedRound ?? built.lastEvaluatedRound,
    roundBaselineClusterKeys: previous?.roundBaselineClusterKeys ?? built.roundBaselineClusterKeys,
    stopReason: previous?.stopReason ?? '',
    followUpRemaining: Math.max(0, built.followUpCapacity - followUpItems.length),
    items,
  }
  state.marketplaceInsightMessage = preserveExisting
    ? state.marketplaceInsightMessage
    : mode === 'plus'
      ? 'Etsy Plus段階式プランを作成しました。入口20語から始め、関連語を5語ずつ最大40語まで深掘りします。'
      : '無料15語プランを作成しました。「Etsy公式確認を自動実行」で順番に取得します。'
  return true
}

function setMarketplaceInsightMode(rawMode) {
  const mode = rawMode === 'plus' ? 'plus' : 'free'
  if (state.marketplaceInsightMode === mode) return
  state.marketplaceInsightMode = mode
  const rebuilt = rebuildMarketplaceInsightPlan({ preserveExisting: true })
  if (rebuilt) {
    state.marketplaceInsightMessage = mode === 'plus'
      ? 'Etsy Plusモードへ切り替えました。既存の進捗を残して、関連語の深掘り枠を追加しました。'
      : '無料15語モードへ切り替えました。調査済みデータは調査一覧に残ります。'
  }
  renderMarketplaceInsightPlan()
  persistMarketFinderState()
}

function marketplaceNextBatchState(plan = state.marketplaceInsightPlan) {
  if (state.marketplaceInsightMode !== 'plus' || !plan?.items?.length) {
    return { ready: false, reason: 'Plusモードで利用できます。' }
  }
  if (plan.stopReason) {
    return { ready: false, reason: MARKETPLACE_STOP_LABELS[plan.stopReason] ?? plan.stopReason }
  }
  const completedSeedCount = plan.items.filter((item) => item.stage !== 'followup' && item.status === 'completed').length
  const followUps = plan.items.filter((item) => item.stage === 'followup')
  const activeFollowUps = followUps.filter((item) => ['planned', 'opened', 'error'].includes(item.status))
  if (activeFollowUps.length > 0) return { ready: false, reason: '現在の5語を先に確認' }
  if (completedSeedCount < 10) return { ready: false, reason: `入口をあと${10 - completedSeedCount}語取得` }
  if (followUps.length > 0 && completedSeedCount < (plan.seedQuota || 20)) {
    return { ready: false, reason: `残りの入口${(plan.seedQuota || 20) - completedSeedCount}語を取得` }
  }
  const existing = new Set(plan.items.map((item) => normalizePhrase(item.query)))
  const available = (plan.candidatePool ?? []).filter((candidate) => (
    candidate.eligibleForFollowUp !== false
    && !existing.has(normalizePhrase(candidate.query ?? candidate.keyword))
  )).length
  if (available < 5) return { ready: false, reason: '有効候補が5語未満' }
  return { ready: true, reason: '上位5語を追加できます。' }
}

function releaseMarketplaceInsightBatch() {
  const plan = state.marketplaceInsightPlan
  if (!plan || state.marketplaceInsightMode !== 'plus') return
  const result = advanceMarketplaceInsightResearch(plan, currentOptions())
  const items = (result.plan.items ?? []).map((item, index) => ({ ...item, id: `etsy-insight-${index + 1}` }))
  const counts = ['discovery', 'validation', 'reserve', 'followup'].reduce((summary, stage) => ({
    ...summary,
    [stage]: items.filter((item) => item.stage === stage).length,
  }), {})
  state.marketplaceInsightPlan = { ...result.plan, items, counts }
  const messages = {
    'batch-added': `関連深掘りラウンド${result.plan.researchRound}として上位${result.addedCount}語を追加しました。`,
    'need-more-seeds': '入口結果を10語以上取得すると、最初の関連深掘りを追加できます。',
    'batch-in-progress': '現在の関連深掘り5語を先に確認してください。',
    'continue-seeds': '最初の深掘り後は、残りの入口語を取得してください。',
    'max-followups': '関連深掘り40語を完了しました。',
    stagnant: '2ラウンド連続で新しい有望群が見つからなかったため、深掘りを終了しました。',
    'candidate-pool-depleted': '未検索の有効候補が5語未満になったため、この枝を終了しました。',
  }
  state.marketplaceInsightMessage = messages[result.reason] ?? '関連深掘りの状態を更新しました。'
  renderAll()
  persistMarketFinderState()
}

function openedMarketplaceInsightItem() {
  return state.marketplaceInsightPlan?.items?.find((item) => item.status === 'opened') ?? null
}

function lastCompletedMarketplaceInsightItem() {
  return [...(state.marketplaceInsightPlan?.items ?? [])]
    .filter((item) => item.status === 'completed' && item.completedAt)
    .sort((left, right) => String(right.completedAt).localeCompare(String(left.completedAt)))[0] ?? null
}

function capturableMarketplaceInsightItem() {
  return openedMarketplaceInsightItem() ?? lastCompletedMarketplaceInsightItem()
}

function nextMarketplaceInsightItem() {
  return openedMarketplaceInsightItem()
    ?? state.marketplaceInsightPlan?.items?.find((item) => item.status === 'planned' || item.status === 'error')
    ?? null
}

function renderMarketplaceInsightResults() {
  const completed = (state.marketplaceInsightPlan?.items ?? [])
    .filter((item) => item.status === 'completed' && item.result)

  if (completed.length === 0) {
    elements.marketplaceResultsList.innerHTML = '<div class="empty-state">「Etsy公式確認を自動実行」から始めると、取得した公式データがここに表示されます。</div>'
    return
  }

  elements.marketplaceResultsList.innerHTML = `
    <div class="marketplace-results-head">
      <span>キーワード</span>
      <span>30日検索</span>
      <span>掲載数</span>
      <span>検索変化</span>
      <span>関連語</span>
      <span>状態</span>
    </div>
    ${completed.map((item) => {
      const result = item.result ?? {}
      const trend = Number(result.etsySearchTrendPercent)
      const trendLabel = Number.isFinite(trend) ? `${trend > 0 ? '+' : ''}${trend}%` : '-'
      const relatedCount = Array.isArray(result.etsyRelatedTerms) ? result.etsyRelatedTerms.length : 0
      return `
        <article class="marketplace-result-row">
          <strong data-label="キーワード">${escapeHtml(item.query)}</strong>
          <span data-label="30日検索">${escapeHtml(displayMetricValue(result.etsySearches30d))}</span>
          <span data-label="掲載数">${escapeHtml(displayMetricValue(result.etsyListings))}</span>
          <span data-label="検索変化">${escapeHtml(trendLabel)}</span>
          <span data-label="関連語">${relatedCount}</span>
          <span data-label="状態" class="pill ready">取得済み</span>
        </article>
      `
    }).join('')}
  `
}

function renderMarketplaceInsightPlan() {
  const mode = state.marketplaceInsightMode === 'plus' ? 'plus' : 'free'
  const defaultQuota = mode === 'plus' ? 60 : 15
  const eligibleCandidates = etsyValidationCandidates()
  const officialProbeCount = eligibleCandidates.filter((candidate) => candidate.officialProbe).length
  const hasErankResults = erankResultRows().length > 0
  const restoredAwaiting = restoredResultsAwaitingConfirmation()
  const officialKeywords = marketplaceCompletedKeywords(state.marketplaceInsightPlan)
  const hasPlan = Boolean(state.marketplaceInsightPlan?.items?.length)
  const canUsePlan = hasPlan && !restoredAwaiting
  elements.marketplaceInsightPanel.hidden = false
  elements.marketplaceStartBtn.hidden = canUsePlan
  elements.marketplaceBuildPlanBtn.hidden = !canUsePlan
  elements.marketplaceNextBtn.hidden = !canUsePlan || state.marketplaceInsightAutoRunning
  elements.marketplaceAutoStopBtn.hidden = !state.marketplaceInsightAutoRunning
  elements.marketplaceCaptureBtn.hidden = !canUsePlan
  elements.marketplaceNextBatchBtn.hidden = !canUsePlan
  elements.marketplaceSkipBtn.hidden = !canUsePlan
  elements.marketplaceStartBtn.disabled = state.marketplaceInsightBusy || state.marketplaceInsightAutoRunning || eligibleCandidates.length === 0
  elements.marketplaceStartStatus.textContent = restoredAwaiting
      ? '前回の保存結果です。eRank結果の上にある「この前回結果から続ける」を押すと利用できます。'
    : hasPlan
      ? 'Etsy公式確認プランを作成済みです。下のボタンから自動実行または再開できます。'
    : !hasErankResults
      ? 'eRankで需要を確認すると利用できます。'
      : eligibleCandidates.length === 0
        ? 'eRank結果はありますが、Etsy公式へ進める基準を通った候補は0件です。上の「今回は保留した候補」を確認してください。'
      : !state.extensionConnected
        ? 'eRank確認は完了しています。実Chromeで開き、Chrome拡張1.27をReloadしてから押してください。'
        : officialProbeCount > 0
          ? `eRank保留のうち需要数値がある安全な上位${officialProbeCount}件を、Etsy公式データで再確認します。`
        : `eRankで絞った${eligibleCandidates.length}件をEtsy公式で順番に自動確認します。`
  elements.erankToEverbeeBtn.disabled = state.marketplaceInsightBusy || restoredAwaiting || (officialKeywords.length === 0 && erankResultRows().length === 0)
  elements.everbeeQueueStatus.textContent = officialKeywords.length > 0
    ? `Etsy公式で取得した${officialKeywords.length}件を優先してEverBeeへ渡します。`
    : erankResultRows().length > 0
      ? 'Etsy公式は未取得です。押した場合は確認後にeRank候補で続行できます。'
      : 'Etsy公式結果を取り込むと、その候補を優先して売上確認します。'
  elements.marketplaceFreeModeBtn.classList.toggle('is-active', mode === 'free')
  elements.marketplaceFreeModeBtn.setAttribute('aria-pressed', String(mode === 'free'))
  elements.marketplacePlusModeBtn.classList.toggle('is-active', mode === 'plus')
  elements.marketplacePlusModeBtn.setAttribute('aria-pressed', String(mode === 'plus'))
  elements.marketplaceAccessBadge.textContent = mode === 'plus' ? 'Etsy Plus・無制限' : '週15回無料'
  elements.marketplaceAdaptiveStatus.hidden = mode !== 'plus'
  elements.marketplacePlanHelp.textContent = mode === 'plus'
    ? '入口20語から開始し、最大200語の候補プールから関連語を5語ずつ最大40語まで深掘りします。検索は常に1語ずつです。'
    : '無料枠を入口5・検証7・予備3へ配分します。検索は常に1語ずつです。'
  elements.marketplaceBuildPlanBtn.textContent = mode === 'plus' ? 'Plus段階式プランを作り直す' : '無料15語プランを作り直す'

  const plan = state.marketplaceInsightPlan
  if (!plan?.items?.length) {
    elements.marketplacePlanCount.textContent = mode === 'plus' ? '入口 0 / 20' : `0 / ${defaultQuota}`
    elements.marketplacePlanRemaining.textContent = '0'
    elements.marketplaceOfficialRemaining.textContent = mode === 'plus' ? '無制限' : '未取得'
    elements.marketplaceCandidatePoolCount.textContent = '0 / 200'
    elements.marketplaceFollowUpCount.textContent = '0 / 40'
    elements.marketplaceResearchRound.textContent = '0'
    elements.marketplaceStopReason.textContent = '入口を調査中'
    elements.marketplaceCurrentQuery.textContent = 'eRank結果を確認してください'
    elements.marketplaceQueue.innerHTML = ''
    elements.marketplaceBuildPlanBtn.disabled = state.marketplaceInsightBusy || eligibleCandidates.length === 0
    elements.marketplaceNextBtn.disabled = true
    elements.marketplaceCaptureBtn.disabled = true
    elements.marketplaceNextBatchBtn.disabled = true
    elements.marketplaceSkipBtn.disabled = true
    elements.marketplaceStatus.textContent = state.marketplaceInsightMessage || 'eRank結果からEtsy公式で調べる候補を準備します。'
    renderMarketplaceInsightResults()
    return
  }

  const completed = plan.items.filter((item) => item.status === 'completed').length
  const completedSeeds = plan.items.filter((item) => item.stage !== 'followup' && item.status === 'completed').length
  const remaining = plan.items.filter((item) => !['completed', 'skipped'].includes(item.status)).length
  const opened = openedMarketplaceInsightItem()
  const current = nextMarketplaceInsightItem()
  elements.marketplacePlanCount.textContent = mode === 'plus' ? `入口 ${completedSeeds} / 20` : `${completed} / ${plan.quota}`
  elements.marketplacePlanRemaining.textContent = String(remaining)
  const hasOfficialRemaining = plan.officialRemaining !== null
    && plan.officialRemaining !== undefined
    && String(plan.officialRemaining).trim() !== ''
    && Number.isFinite(Number(plan.officialRemaining))
  elements.marketplaceOfficialRemaining.textContent = mode === 'plus'
    ? '無制限'
    : hasOfficialRemaining
      ? String(plan.officialRemaining)
      : '未取得'
  const followUpItems = plan.items.filter((item) => item.stage === 'followup')
  const completedFollowUps = followUpItems.filter((item) => ['completed', 'skipped'].includes(item.status)).length
  const nextBatchState = marketplaceNextBatchState(plan)
  elements.marketplaceCandidatePoolCount.textContent = `${plan.candidatePool?.length ?? 0} / 200`
  elements.marketplaceFollowUpCount.textContent = `${completedFollowUps} / 40`
  elements.marketplaceResearchRound.textContent = String(plan.researchRound ?? 0)
  elements.marketplaceStopReason.textContent = plan.stopReason
    ? MARKETPLACE_STOP_LABELS[plan.stopReason] ?? plan.stopReason
    : nextBatchState.reason
  elements.marketplaceCurrentQuery.textContent = current?.query ?? 'このプランは完了しました'
  elements.marketplaceBuildPlanBtn.disabled = state.marketplaceInsightBusy || state.marketplaceInsightAutoRunning || eligibleCandidates.length === 0
  elements.marketplaceNextBtn.disabled = state.marketplaceInsightBusy || state.marketplaceInsightAutoRunning || Boolean(opened) || !current || !state.extensionConnected
  const capturable = capturableMarketplaceInsightItem()
  elements.marketplaceCaptureBtn.disabled = state.marketplaceInsightBusy || state.marketplaceInsightAutoRunning || !capturable || !state.extensionConnected
  elements.marketplaceNextBtn.classList.toggle('primary-btn', !opened)
  elements.marketplaceNextBtn.classList.toggle('ghost-btn', Boolean(opened))
  elements.marketplaceCaptureBtn.classList.toggle('primary-btn', Boolean(opened))
  elements.marketplaceCaptureBtn.classList.toggle('ghost-btn', !opened)
  elements.marketplaceCaptureBtn.textContent = opened
    ? '表示中の結果を取り込む'
    : capturable
      ? '同じ語の関連ページを追加取り込み'
      : '表示中の結果を取り込む'
  elements.marketplaceNextBatchBtn.disabled = state.marketplaceInsightBusy || state.marketplaceInsightAutoRunning || !nextBatchState.ready
  elements.marketplaceSkipBtn.disabled = state.marketplaceInsightBusy || state.marketplaceInsightAutoRunning || !current
  elements.marketplaceQueue.innerHTML = plan.items.map((item, index) => {
    const isCurrent = item === current
    const laneLabel = DISCOVERY_LANE_LABELS[item.discoveryLane] ?? '基準'
    const stageLabel = MARKETPLACE_STAGE_LABELS[item.stage] ?? item.stage
    const statusLabel = MARKETPLACE_STATUS_LABELS[item.status] ?? item.status
    const className = item.status === 'completed' ? 'is-complete' : isCurrent ? 'is-current' : ''
    const metricLabel = item.stage === 'followup'
      ? ` / 優先 ${item.score ?? item.opportunityIndex ?? '-'} / 検索 ${item.result?.etsySearches30d ?? item.etsySearches30d ?? '-'} / 掲載 ${item.result?.etsyListings ?? item.etsyListings ?? '-'}${Number.isFinite(Number(item.result?.etsySearchTrendPercent)) ? ` / 変化 ${Number(item.result.etsySearchTrendPercent) > 0 ? '+' : ''}${item.result.etsySearchTrendPercent}%` : ''}`
      : ''
    const cohortLabel = item.cohortIndex === null || item.cohortIndex === undefined
      ? ''
      : ` / 調査内比較 ${Math.round(Number(item.cohortIndex))}`
    const probeLabel = item.officialProbe ? ' / eRank保留から再確認' : ''
    return `
      <li class="${className}">
        <span class="queue-index">${index + 1}</span>
        <span class="queue-query">
          <strong>${escapeHtml(item.query)}</strong>
          <small>${escapeHtml(stageLabel)} / ${escapeHtml(laneLabel)} / ${escapeHtml(QUERY_STRATEGY_LABELS[item.queryStrategy] ?? item.queryStrategy)}${escapeHtml(probeLabel)}${escapeHtml(cohortLabel)}${escapeHtml(metricLabel)}</small>
        </span>
        <span class="queue-status">${escapeHtml(statusLabel)}</span>
      </li>
    `
  }).join('')
  elements.marketplaceStatus.textContent = state.marketplaceInsightMessage || (mode === 'plus'
    ? 'Etsy Plusの無制限枠を使いますが、検索は確認しながら1語ずつ実行します。'
    : '検索は1回ずつ実行します。自動では無料枠を消費しません。')
  renderMarketplaceInsightResults()
}

function renderCandidates() {
  renderDiscoveryControls()
  const displayedCandidates = displayedRoundCandidates()
  const visibleCandidates = discoveryCandidates()
  const querySummary = summarizeErankQueryPlan(buildCurrentErankQueryPlan())
  if (elements.erankQueryPlanSummary) {
    elements.erankQueryPlanSummary.textContent = querySummary.queryCount > 0
      ? `${activeRoundLabel()}: 候補${querySummary.candidateCount}件 / 実検索${querySummary.queryCount}件（完全語句${querySummary.directCount}・基底語${querySummary.baseCount}）`
      : '候補を作ると、完全語句とイベントを外した基底語の検索内訳が表示されます。'
  }
  elements.candidateCount.textContent = state.activeDiscoveryLane === 'all'
    ? String(displayedCandidates.length)
    : `${visibleCandidates.length}/${displayedCandidates.length}`
  elements.candidateRoundTabs.innerHTML = state.researchRounds.rounds.map((round) => {
    const active = (state.candidateRoundId || state.researchRounds.activeRoundId) === round.id
    return `<button type="button" role="tab" data-candidate-round="${escapeHtml(round.id)}" aria-selected="${String(active)}" class="${active ? 'is-active' : ''}">${escapeHtml(researchRoundLabel(round))} ${round.candidateKeywords.length}</button>`
  }).join('')
  elements.copyKeywordsBtn.disabled = state.candidates.length === 0
  elements.copyReadyBtn.disabled = readyKeywords().length === 0
  elements.downloadJobBtn.disabled = readyKeywords().length === 0
  elements.candidateErankBtn.disabled = readyKeywords().length === 0
  elements.keywordSelect.innerHTML = state.candidates.map((candidate) => (
    `<option value="${escapeHtml(candidate.keyword)}">${escapeHtml(candidate.keyword)}</option>`
  )).join('')

  if (displayedCandidates.length === 0) {
    elements.candidateList.innerHTML = `<div class="empty-state">${escapeHtml(state.candidateMessage || 'まだ候補はありません。')}</div>`
    return
  }

  elements.candidateList.innerHTML = visibleCandidates.map((candidate) => {
    const researched = findResearchRow(candidate.keyword)
    const resultScore = researched ? scoreEverbeeResult(researched, currentOptions()) : null
    const erankCheckedAt = formatDateTime(researched?.erankCheckedAt)
    const erankTitle = `eRankの検索数・クリック・競合・KDを取得済みです。人気確定ではありません。${erankCheckedAt ? ` 確認: ${erankCheckedAt}` : ''}`
    const resultPill = resultScore?.validation.hasEverbeeData
      ? `<span class="pill ready">Opportunity ${escapeHtml(resultScore.opportunityLabel)}</span><span class="pill">Confidence ${escapeHtml(resultScore.confidenceLabel)}</span>`
      : resultScore?.validation.hasEtsyMarketplaceData
        ? '<span class="pill ready">Etsy公式確認済み</span>'
        : resultScore?.validation.hasErankData
        ? `<span class="pill" title="${escapeHtml(erankTitle)}">eRank確認済み</span>`
      : ''
    const sourceText = candidateSourceText(candidate, researched, resultScore)
    const categoryLabel = candidate.categoryLabel === 'Trend Scout' ? 'Trend候補' : candidate.categoryLabel
    const categoryTitle = candidate.categoryLabel === 'Trend Scout'
      ? '自動探索で拾った流行語候補です。人気かどうかはeRank/EverBeeで確認します。'
      : '選択中の商品カテゴリです。'
    const statusTitle = candidate.status === 'ready'
      ? '次のeRank確認に入れてよい候補です。人気確定ではありません。'
      : '商標・著作権などの確認が必要な候補です。'
    const trackLabel = marketTrackLabel(candidate.intentTrack)
    const priorEventLabels = (candidate.priorEventIds ?? []).map(eventLabelFromId).join('、')

    return `
      <article class="candidate-row">
        <div>
          <strong>${escapeHtml(candidate.keyword)}</strong>
          <div class="meta-line">
            <span class="pill ${candidate.status === 'ready' ? 'ready' : 'review'}" title="${escapeHtml(statusTitle)}">${candidate.status === 'ready' ? '調査OK' : '要確認'}</span>
            <span class="pill" title="キーワードの単語数です。短すぎる語句は広すぎる場合があります。">${candidate.wordCount} words</span>
            <span class="pill" title="${escapeHtml(categoryTitle)}">${escapeHtml(categoryLabel)}</span>
            ${candidate.discoveryLane ? `<span class="pill">${escapeHtml(DISCOVERY_LANE_LABELS[candidate.discoveryLane] ?? candidate.discoveryLane)}</span>` : ''}
            ${candidate.queryStrategy ? `<span class="pill">${escapeHtml(QUERY_STRATEGY_LABELS[candidate.queryStrategy] ?? candidate.queryStrategy)}</span>` : ''}
            ${wearerIntentLabel(candidate.wearerIntent) ? `<span class="pill">${escapeHtml(wearerIntentLabel(candidate.wearerIntent))}</span>` : ''}
            <span class="pill market-track-pill is-${escapeHtml(candidate.intentTrack)}">${escapeHtml(trackLabel)}</span>
            ${candidate.previouslyResearchedElsewhere ? `<span class="pill review">別イベントで調査済み${priorEventLabels ? `: ${escapeHtml(priorEventLabels)}` : ''}</span>` : ''}
            ${candidate.clusterSize > 1 ? `<span class="pill">同系統 ${candidate.clusterSize}語</span>` : ''}
            ${candidate.timing?.label && candidate.timing.label !== 'evergreen' ? `<span class="pill">時期 ${escapeHtml(candidate.timing.label)} / ${escapeHtml(candidate.timing.weeksUntil)}週</span>` : ''}
            ${candidate.sourceFreshness?.freshnessLabel === 'inspiration' || candidate.sourceFreshness?.freshnessLabel === 'expired' ? '<span class="pill review">古いデータ・発想用</span>' : ''}
            ${resultPill}
            ${candidate.riskTerms.length ? `<span class="pill danger">${escapeHtml(candidate.riskTerms.join(', '))}</span>` : ''}
          </div>
          <div class="candidate-source-line">${escapeHtml(sourceText)}</div>
        </div>
        <div class="score-chip"><span>調査順<br>目安</span><strong>${candidate.score}</strong></div>
      </article>
    `
  }).join('')
}

function scoreReasonLabels(score) {
  const reasons = []
  const demandSource = score.validation.hasEtsyMarketplaceData ? 'Etsy公式' : 'eRank'
  if (!score.gateReasons.includes('demand')) reasons.push(`${demandSource}需要あり`)
  if (!score.gateReasons.includes('supply')) reasons.push(`${demandSource}参入余地あり`)
  if (score.normalized.everbeeCompetitionBand === 'empty') reasons.push('EverBee結果なし')
  else if (score.normalized.everbeeCompetitionBand === 'saturated') reasons.push('EverBee競合過密')
  else if (score.normalized.everbeeCompetitionBand !== 'unknown') reasons.push(`EverBee競合 ${score.normalized.listingsAnalyzed}件`)
  else if (score.gateReasons.includes('competition-unverified')) reasons.push('競合未取得')
  if (!score.gateReasons.includes('sales-breadth')) reasons.push('複数商品で販売')
  if (!score.gateReasons.includes('sales-concentration')) reasons.push('単一商品への集中なし')
  if (!score.gateReasons.includes('freshness')) reasons.push('有効期限内のデータ')
  if (score.riskTerms.length > 0) reasons.push('要リスク確認')
  return reasons.slice(0, 5)
}

function opportunityScoreClass(score) {
  if (score.opportunityLabel === 'D') return 'd'
  if (score.opportunityLabel === 'A') return 'a'
  if (score.opportunityLabel === 'B') return 'b'
  if (score.opportunityLabel === 'C') return 'c'
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
  const restoredNotice = state.restoredResearchSavedAt
    ? `<div class="restored-results-note${state.restoredResultsAccepted ? ' is-accepted' : ''}"><strong>${state.restoredResultsAccepted ? '前回の保存結果を今回の続きとして使用中です。' : '前回の保存結果を表示中です。Chrome拡張のReloadで再調査した結果ではありません。'}</strong><span>保存: ${escapeHtml(formatDateTime(state.restoredResearchSavedAt) || '日時不明')} / 新しい調査は「候補を自動で探す」から始めます。</span>${state.restoredResultsAccepted ? '' : '<button type="button" class="ghost-btn" data-use-restored-results>この前回結果から続ける</button>'}</div>`
    : ''
  const conclusion = proceedRows.length > 0
    ? `有望そうな語句を${proceedRows.length}件見つけました。関連語も使って、Etsy公式確認候補を${nextKeywords.length}件に絞りました。`
    : expandRows.length > 0
      ? `強い語句はまだ少なめですが、追加探索に使える語句を${expandRows.length}件見つけました。関連語からEtsy公式確認候補を${nextKeywords.length}件作っています。`
      : `今回の広い検索は弱めでした。無理に進めず、イベント・商品・手入力イベントを変えてもう一度広く見てください。`

  elements.erankSummary.innerHTML = `
    ${restoredNotice}
    <div class="summary-main">
      <strong>${escapeHtml(conclusion)}</strong>
      <span>弱い結果が出ても、ここで終わりではありません。eRankの関連キーワードも見て、次に調べる候補を作ります。</span>
    </div>
    <div class="summary-stats">
      <span><strong>${rows.length}</strong><small>確認した語句</small></span>
      <span><strong>${proceedRows.length}</strong><small>Etsy確認へ</small></span>
      <span><strong>${expandRows.length}</strong><small>追加探索</small></span>
      <span><strong>${holdRows.length}</strong><small>今回は保留</small></span>
    </div>
  `
}

function erankSourceLabel(row) {
  const sourceKeyword = erankSourceKeyword(row)
  if (row.queryKind === 'direct') return `完全語句 / 元候補: ${sourceKeyword || row.keyword}`
  if (row.queryKind === 'base') return `基底語 / 元候補: ${(row.sourceKeywords ?? [sourceKeyword]).filter(Boolean).join('、')}`
  if (sourceKeyword) return `eRank派生: ${sourceKeyword} から発見`
  return 'eRankで調べた元語句'
}

function erankCaptureStateRows() {
  return state.erankQueryPlan.flatMap((item) => {
    const row = state.researchRows.find((candidate) => normalizePhrase(candidate.keyword) === normalizePhrase(item.query))
    if (row && rowHasErankInput(row)) return []
    const attempted = Boolean(row?.erankAttemptedAt || row?.erankCheckedAt)
    return [{
      ...item,
      error: row?.error ?? '',
      erankAttemptedAt: row?.erankAttemptedAt ?? '',
      status: attempted ? 'failed' : 'unsearched',
    }]
  })
}

function renderErankCaptureStates(rows) {
  if (rows.length === 0) return ''
  return `
    <details class="erank-group erank-group-collapsed" open>
      <summary>数値を取得できていない検索 ${rows.length}件</summary>
      <div class="erank-capture-state-list">
        ${rows.map((row) => `
          <div class="erank-capture-state is-${escapeHtml(row.status)}">
            <span class="pill ${row.status === 'failed' ? 'review' : ''}">${row.status === 'failed' ? '検索済み・数値取得失敗' : '未検索'}</span>
            <strong>${escapeHtml(row.query)}</strong>
            <small>${escapeHtml(row.queryKind === 'base' ? '基底語' : '完全語句')} / 元候補: ${escapeHtml(row.sourceKeywords.join('、'))}${row.error ? ` / ${escapeHtml(row.error)}` : ''}</small>
          </div>
        `).join('')}
      </div>
    </details>
  `
}

function erankSourceKeyword(row) {
  const direct = String(row.sourceKeyword ?? '').trim()
  if (direct) return direct
  const notes = String(row.notes ?? '')
  const match = notes.match(/related keywords for\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}

function mergeRowNotes(existingNote = '', incomingNote = '') {
  return [existingNote, incomingNote]
    .flatMap((note) => String(note ?? '').split(/\s+\/\s+/))
    .map((note) => note.trim())
    .filter((note, index, notes) => note && notes.indexOf(note) === index)
    .join(' / ')
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

function erankNextActionLabel(opportunity) {
  return opportunity.action === 'everbee' ? 'Etsyで確認' : opportunity.label
}

function renderChips(values = []) {
  return values.length
    ? values.map((value) => `<span class="pill">${escapeHtml(value)}</span>`).join('')
    : '<span class="empty-inline">候補なし</span>'
}

function renderDecisionEvidence(score) {
  const evidence = explainEverbeeScore(score)
  const rows = evidence.rows.map((row) => `
    <div class="decision-row decision-${escapeHtml(row.status)}">
      <span>${escapeHtml(row.metric)}</span>
      <strong>${escapeHtml(row.value)}</strong>
      <em>${escapeHtml(row.label)}</em>
      <p>${escapeHtml(row.detail)}</p>
    </div>
  `).join('')

  return `
    <section class="decision-panel">
      <div class="mini-heading">
        <span>判定理由</span>
      </div>
      <p>${escapeHtml(evidence.summary)}</p>
      <div class="decision-grid">${rows}</div>
    </section>
  `
}

function renderNounBrief(brief = {}) {
  return `
    <section class="noun-brief">
      <div class="mini-heading">
        <span>主役名詞だけを確認</span>
        <button type="button" class="text-btn" data-copy-noun-brief>名詞コピー</button>
      </div>
      <p class="box-help">${escapeHtml(brief.sourceNote ?? '流行キーワードから名詞だけを抜き出します。')}</p>

      <div class="idea-grid noun-grid">
        <div><span>主役名詞</span><div class="tag-list">${renderChips(brief.heroNouns ?? [])}</div></div>
        <div><span>関連名詞</span><div class="tag-list">${renderChips(brief.relatedNouns ?? [])}</div></div>
        <div><span>要注意名詞</span><div class="tag-list">${renderChips(brief.unsafeNouns ?? [])}</div></div>
        <div><span>根拠ワード</span><div class="tag-list">${renderChips(brief.sourceSignals ?? [])}</div></div>
      </div>

      <p class="noun-note">${escapeHtml(brief.usableForTypography ?? '')}</p>
    </section>
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
        <span class="pill action-${escapeHtml(opportunity.action)}">${escapeHtml(erankNextActionLabel(opportunity))}</span>
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
            <span class="pill action-${escapeHtml(opportunity.action)}">${escapeHtml(erankNextActionLabel(opportunity))}</span>
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
  const captureStates = erankCaptureStateRows()
  elements.erankCount.textContent = String(ranked.length + captureStates.filter((row) => row.status === 'failed').length)
  elements.downloadErankCsvBtn.disabled = ranked.length === 0 && captureStates.length === 0
  elements.erankToEverbeeBtn.disabled = ranked.length === 0
  renderErankSummary(ranked)

  if (ranked.length === 0) {
    elements.erankResultsList.innerHTML = renderErankCaptureStates(captureStates)
      || '<div class="empty-state">「eRankで検索数を見る」が終わると、ここに結果が表示されます。</div>'
    return
  }

  const proceedRows = ranked.filter((row) => row.erankOpportunity.action === 'everbee')
  const expandRows = ranked.filter((row) => row.erankOpportunity.action === 'expand')
  const holdRows = ranked.filter((row) => row.erankOpportunity.action === 'hold' || row.erankOpportunity.action === 'reject')

  elements.erankResultsList.innerHTML = [
    renderErankCaptureStates(captureStates),
    renderErankGroup('次にEtsy公式で確認する候補', '検索・クリック・KDの反応がよい語句です。Marketplace Insightsで直近30日の需要を確かめます。', proceedRows, { limit: 16 }),
    renderErankGroup('関連語から追加探索する候補', '弱くはないけれど、もう少し関連語を広げたい語句です。Etsy公式確認候補づくりの材料にも使います。', expandRows, { limit: 10 }),
    renderErankGroup('今回は保留した候補', '需要が弱い候補です。権利リスクがなくSearchまたはClicksがある上位候補は、Etsy Plusの公式データで再確認できます。', holdRows, { limit: 12, collapsible: true }),
  ].join('') || '<div class="empty-state">eRank結果は入りましたが、次に進める候補がありませんでした。</div>'
}

function renderResults() {
  const ranked = currentResearchAnalysis().everbeeRows

  if (ranked.length === 0) {
    elements.resultsList.innerHTML = '<div class="empty-state">「EverBeeで売上を確認する」が終わると、ここにおすすめキーワードが表示されます。</div>'
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
          ${renderProductRoute(row.productRoute)}
          <div><span>ターゲット</span><p>${escapeHtml(row.idea.target)}</p></div>
          <div><span>SEOタイトル案</span><p>${escapeHtml(row.idea.seoTitle)}</p></div>
          <div><span>タグ案</span><div class="tag-list">${tags}</div></div>
          ${reasons}
        </div>
        ${renderNounBrief(row.idea.nounBrief)}
      </article>
    `
  }).join('')
}

function renderProductRoute(route) {
  if (!route) return ''
  if (!route.primary) {
    return `
    <div><span>おすすめ商品</span><p>${escapeHtml(route.decision ?? '見送り')}: なし</p></div>
    <div><span>判断メモ</span><p>${escapeHtml(route.summary ?? '商品化しない候補です。')}</p></div>
    <div><span>逃がし候補</span><p>なし</p></div>
  `
  }
  const alternates = route.alternates?.length
    ? route.alternates.map((item) => `${item.label}: ${item.reason}`).join(' / ')
    : 'なし'
  return `
    <div><span>おすすめ商品</span><p>${escapeHtml(route.decision)}: ${escapeHtml(route.primary.label)}</p></div>
    <div><span>判断メモ</span><p>${escapeHtml(route.summary)}</p></div>
    <div><span>逃がし候補</span><p>${escapeHtml(alternates)}</p></div>
  `
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
  const sourceKeyword = erankSourceKeyword(row)
  const sourceLine = sourceKeyword ? `eRank派生: ${sourceKeyword} から発見` : row.idea.theme
  const age = normalized.listingAgeMonths === null || normalized.listingAgeMonths === undefined
    ? '-'
    : `${normalized.listingAgeMonths} mo`
  const track = marketTrackMetadataForRow(row)
  const priorEventLabels = track.priorEventIds.map(eventLabelFromId).join('、')
  const intentDetails = buyerIntentDetail(row)

  return `
    <button type="button" class="research-table-row everbee-table-row${selectedClass}" data-result-key="${escapeHtml(key)}" aria-pressed="${key === selectedKey ? 'true' : 'false'}">
      <span class="table-cell score-cell" data-label="狙い目">
        ${renderSmallScore(`Opportunity ${row.score.opportunityLabel}`, row.score.score, labelClass)}
      </span>
      <span class="table-cell keyword-cell" data-label="キーワード">
        <strong>${escapeHtml(normalized.keyword)}</strong>
        <span class="table-subline">${escapeHtml(sourceLine)}</span>
        <span class="table-reasons">
          <span class="reason-chip market-track-pill is-${escapeHtml(track.intentTrack)}">${escapeHtml(marketTrackLabel(track.intentTrack))}</span>
          ${intentDetails.map((detail) => `<span class="reason-chip">${escapeHtml(detail)}</span>`).join('')}
          ${track.previouslyResearchedElsewhere ? `<span class="reason-chip">別イベントで調査済み${priorEventLabels ? `: ${escapeHtml(priorEventLabels)}` : ''}</span>` : ''}
        </span>
        ${scoreReasons ? `<span class="table-reasons">${scoreReasons}</span>` : ''}
      </span>
      <span class="table-cell number-cell" data-label="EverBee競合">${escapeHtml(displayMetricValue(normalized.listingsAnalyzed))}</span>
      <span class="table-cell number-cell" data-label="販売商品">${escapeHtml(displayMetricValue(normalized.sellingListingCount))}</span>
      <span class="table-cell number-cell" data-label="最近販売">${escapeHtml(displayMetricValue(normalized.recentSellingListingCount))}</span>
      <span class="table-cell number-cell" data-label="中央値">${escapeHtml(displayMetricValue(normalized.medianMonthlySales))}</span>
      <span class="table-cell number-cell" data-label="集中率">${normalized.topSalesShare === null ? '-' : `${Math.round(normalized.topSalesShare * 100)}%`}</span>
    </button>
  `
}

function renderEverbeeDetail(row) {
  const normalized = row.score.normalized
  const labelClass = opportunityScoreClass(row.score)
  const tags = row.idea.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join('')
  const sourceKeyword = erankSourceKeyword(row)
  const scoreReasons = scoreReasonLabels(row.score)
    .map((reason) => `<span class="reason-chip">${escapeHtml(reason)}</span>`)
    .join('')
  const reasons = row.score.exclusionReasons.length
    ? `<div><span>注意</span><p>${escapeHtml(row.score.exclusionReasons.join(' / '))}</p></div>`
    : ''
  const track = marketTrackMetadataForRow(row)
  const priorEventLabels = track.priorEventIds.map(eventLabelFromId).join('、')
  const intentDetails = buyerIntentDetail(row)

  return `
    <article class="result-detail-card">
      <div class="result-top">
        <div class="opportunity-score ${labelClass}"><span>狙い目</span><strong>${row.score.score}</strong></div>
        <div>
          <h3>${escapeHtml(normalized.keyword)}</h3>
          <div class="meta-line">
            <span class="pill">${escapeHtml(row.score.label)}</span>
            <span class="pill">Confidence ${escapeHtml(row.score.confidenceLabel)}</span>
            <span class="pill">Stage ${escapeHtml(row.score.candidateStage)}</span>
            <span class="pill">${escapeHtml(row.idea.theme)}</span>
            <span class="pill market-track-pill is-${escapeHtml(track.intentTrack)}">${escapeHtml(marketTrackLabel(track.intentTrack))}</span>
            ${intentDetails.map((detail) => `<span class="pill">${escapeHtml(detail)}</span>`).join('')}
            ${track.previouslyResearchedElsewhere ? `<span class="pill review">別イベントで調査済み${priorEventLabels ? `: ${escapeHtml(priorEventLabels)}` : ''}</span>` : ''}
          </div>
          ${sourceKeyword ? `<div class="candidate-source-line">eRank派生元: ${escapeHtml(sourceKeyword)}</div>` : ''}
          ${scoreReasons ? `<div class="reason-line">${scoreReasons}</div>` : ''}
        </div>
      </div>

      <div class="metric-grid selected-metric-grid">
        <div class="metric"><span>EverBee Listings Analyzed</span><strong>${escapeHtml(displayMetricValue(normalized.listingsAnalyzed))}</strong></div>
        <div class="metric"><span>Visible Listings</span><strong>${escapeHtml(displayMetricValue(normalized.visibleListingCount))}</strong></div>
        <div class="metric"><span>Selling Listings</span><strong>${escapeHtml(displayMetricValue(normalized.sellingListingCount))}</strong></div>
        <div class="metric"><span>Recent Selling</span><strong>${escapeHtml(displayMetricValue(normalized.recentSellingListingCount))}</strong></div>
        <div class="metric"><span>Median Sales</span><strong>${escapeHtml(displayMetricValue(normalized.medianMonthlySales))}</strong></div>
        <div class="metric"><span>Total Visible Sales</span><strong>${escapeHtml(displayMetricValue(normalized.totalVisibleMonthlySales))}</strong></div>
        <div class="metric"><span>Top Sales Share</span><strong>${normalized.topSalesShare === null ? '-' : `${Math.round(normalized.topSalesShare * 100)}%`}</strong></div>
        <div class="metric"><span>Median Age</span><strong>${escapeHtml(displayMetricValue(normalized.medianListingAgeMonths))} mo</strong></div>
        <div class="metric"><span>Etsy 30d Searches</span><strong>${escapeHtml(displayMetricValue(normalized.etsySearches30d))}</strong></div>
        <div class="metric"><span>Etsy Listings</span><strong>${escapeHtml(displayMetricValue(normalized.etsyListings))}</strong></div>
        <div class="metric"><span>Etsy Checked</span><strong>${escapeHtml(formatDateTime(normalized.etsyCheckedAt) || '-')}</strong></div>
        <div class="metric"><span>eRank Search</span><strong>${escapeHtml(displayMetricValue(normalized.erankSearchVolume))}</strong></div>
        <div class="metric"><span>eRank Clicks</span><strong>${escapeHtml(displayMetricValue(normalized.erankClicks))}</strong></div>
        <div class="metric"><span>eRank CTR</span><strong>${escapeHtml(displayMetricValue(normalized.erankCtr))}</strong></div>
        <div class="metric"><span>eRank Comp</span><strong>${escapeHtml(displayMetricValue(normalized.erankCompetition, 'Unknown'))}</strong></div>
        <div class="metric"><span>eRank KD</span><strong>${escapeHtml(displayMetricValue(normalized.erankKeywordDifficulty, '未取得'))}</strong></div>
        <div class="metric"><span>eRank Checked</span><strong>${escapeHtml(formatDateTime(normalized.erankCheckedAt) || '-')}</strong></div>
        <div class="metric"><span>EverBee Checked</span><strong>${escapeHtml(formatDateTime(normalized.everbeeCheckedAt) || '-')}</strong></div>
      </div>
      ${renderEverbeeProductRows(row)}
      ${renderDecisionEvidence(row.score)}

      <div class="idea-grid">
        ${renderProductRoute(row.productRoute)}
        <div><span>ターゲット</span><p>${escapeHtml(row.idea.target)}</p></div>
        <div><span>SEOタイトル案</span><p>${escapeHtml(row.idea.seoTitle)}</p></div>
        <div><span>タグ案</span><div class="tag-list">${tags}</div></div>
        ${reasons}
      </div>
      ${renderNounBrief(row.idea.nounBrief)}
    </article>
  `
}

function renderEverbeeProductRows(row) {
  const productRows = (Array.isArray(row.productRows) ? row.productRows : [])
    .filter((product) => normalizePhrase(product?.title))
    .sort((a, b) => (Number(b.monthlySales) || 0) - (Number(a.monthlySales) || 0)
      || (Number(b.monthlyRevenue) || 0) - (Number(a.monthlyRevenue) || 0))
    .slice(0, 14)

  if (productRows.length === 0) return ''

  const rows = productRows.map((product) => {
    const ageMonths = Number(product.listingAgeMonths)
    const isNewWinner = Number.isFinite(ageMonths) && ageMonths > 0 && ageMonths <= 12 && Number(product.monthlySales) > 0
    return `
      <div class="everbee-product-row">
        <span class="everbee-product-title">
          <strong>${escapeHtml(product.title)}</strong>
          <small>${escapeHtml(product.shopName || '-')} / 売上 $${escapeHtml(formatCompactNumber(product.monthlyRevenue))}</small>
        </span>
        <strong>${escapeHtml(formatCompactNumber(product.monthlySales))}</strong>
        <span class="everbee-age${isNewWinner ? ' is-new-winner' : ''}">${escapeHtml(displayMetricValue(product.listingAgeMonths))}か月</span>
        <strong>${escapeHtml(formatCompactNumber(product.totalSales))}</strong>
      </div>
    `
  }).join('')

  return `
    <section class="everbee-product-evidence">
      <div class="everbee-product-heading">
        <h4>EverBee売れ筋商品</h4>
        <span>月間販売数順 / 緑は公開12か月以内</span>
      </div>
      <div class="everbee-product-head">
        <span>商品名</span><span>月販</span><span>公開</span><span>累計</span>
      </div>
      <div class="everbee-product-list">${rows}</div>
    </section>
  `
}

function everbeeResultRows() {
  return currentResearchAnalysis().everbeeRows
}

function renderResultTrackGroup({ title, description, items, emptyMessage, className }) {
  const rows = items.length > 0
    ? items.map((item) => renderEverbeeTableRow(item, state.selectedResultKey)).join('')
    : `<div class="empty-state small">${escapeHtml(emptyMessage)}</div>`
  return `
    <section class="result-track-group ${escapeHtml(className)}">
      <div class="result-track-heading">
        <div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>
        <span class="count-badge"><strong>${items.length}</strong><small>候補</small></span>
      </div>
      <div class="research-table-shell everbee-table-shell">
        <div class="research-table everbee-table">
          <div class="research-table-head everbee-table-head">
            <span>狙い目</span>
            <span>キーワード</span>
            <span>EverBee競合</span>
            <span>販売商品</span>
            <span>最近販売</span>
            <span>中央値</span>
            <span>集中率</span>
          </div>
          ${rows}
        </div>
      </div>
    </section>
  `
}

function selectedRoundEverbeeRows() {
  const selected = state.researchRounds.selectedRoundId
  if (!selected || selected === 'all') return everbeeResultRows()
  const round = state.researchRounds.rounds.find((item) => item.id === selected)
  if (!round) return everbeeResultRows()
  return analyzeResearchRows(researchRowsForRound(state.researchRows, round), currentOptions()).everbeeRows
}

function researchRoundLabel(round) {
  return round.type === 'initial' ? '初回' : `クロスニッチ${round.depth}`
}

function renderResearchRoundControls() {
  const rounds = state.researchRounds.rounds
  elements.researchRoundTabs.innerHTML = [
    { id: 'all', label: '総合' },
    ...rounds.map((round) => ({ id: round.id, label: researchRoundLabel(round) })),
  ].map((item) => `
    <button type="button" role="tab" data-round-filter="${escapeHtml(item.id)}" aria-selected="${String(state.researchRounds.selectedRoundId === item.id)}" class="${state.researchRounds.selectedRoundId === item.id ? 'is-active' : ''}">${escapeHtml(item.label)}</button>
  `).join('')

  const summaries = rounds.map((round) => {
    const rows = analyzeResearchRows(researchRowsForRound(state.researchRows, round), currentOptions()).everbeeRows
    const counts = summarizeOpportunityCounts(rows)
    state.researchRounds = updateResearchRound(state.researchRounds, round.id, {
      resultKeywords: rows.map((row) => row.keyword),
      opportunityCounts: counts,
    })
    const status = round.status === 'complete'
      ? '完了'
      : round.status === 'pending-erank'
        ? 'eRank待ち'
        : round.status === 'pending-etsy'
          ? 'Etsy公式待ち'
          : 'EverBee待ち'
    return `<div class="research-round-summary-item"><strong>${escapeHtml(researchRoundLabel(round))}</strong><span>A ${counts.A} / B ${counts.B} / C ${counts.C} / D ${counts.D}</span><small>${escapeHtml(status)}</small></div>`
  })
  elements.researchRoundSummary.innerHTML = summaries.join('')

  const pending = isCrossNicheWorkflowPending(state.crossNicheWorkflow)
  elements.researchRoundProgress.hidden = !pending
  elements.researchRoundProgress.innerHTML = pending
    ? `<strong>追加探索を進行中です。</strong><span>${escapeHtml(crossNicheWorkflowMessage())} 初回結果は下に残しています。</span>`
    : ''
}

function renderOpportunityResultGroup({ title, description, items, emptyMessage, className, collapsible = false }) {
  const group = renderResultTrackGroup({ title, description, items, emptyMessage, className })
  if (!collapsible) return group
  return `<details class="result-opportunity-collapsed"><summary>${escapeHtml(title)} ${items.length}件を見る</summary>${group}</details>`
}

function renderResultsTable() {
  renderResearchRoundControls()
  const ranked = selectedRoundEverbeeRows()
  elements.downloadStep4CsvBtn.disabled = everbeeResultRows().length === 0

  if (ranked.length === 0) {
    state.selectedResultKey = ''
    elements.resultsList.innerHTML = '<div class="empty-state">このラウンドにはまだEverBee確認済みの結果がありません。上のタブで初回または総合を確認できます。</div>'
    return
  }

  const keyedRows = ranked.map((row, index) => ({ row, key: resultRowKey(row, index) }))
  if (!state.selectedResultKey || !keyedRows.some((item) => item.key === state.selectedResultKey)) {
    state.selectedResultKey = keyedRows[0].key
  }

  const selectedItem = keyedRows.find((item) => item.key === state.selectedResultKey) ?? keyedRows[0]
  const itemsByKey = new Map(keyedRows.map((item) => [item.key, item]))
  const groupItems = (rows) => rows.map((row) => itemsByKey.get(resultRowKey(row)))
    .filter(Boolean)
  const testRows = ranked.filter((row) => ['A', 'B'].includes(row.score.opportunityLabel))
  const exploreRows = ranked.filter((row) => row.score.opportunityLabel === 'C')
  const excludedRows = ranked.filter((row) => row.score.opportunityLabel === 'D')
  const opportunityGroups = [
    renderOpportunityResultGroup({
      title: '商品化テスト候補',
      description: 'A/Bだけを表示します。根拠がそろった順に、小さく商品化テストする候補です。',
      items: groupItems(testRows),
      emptyMessage: 'このラウンドのA/B商品化テスト候補は0件です。C候補から追加探索を続けます。',
      className: 'is-test-ready',
    }),
    renderOpportunityResultGroup({
      title: '追加探索候補',
      description: 'C判定です。商品化推奨ではなく、派生語や不足データを追加確認する候補です。',
      items: groupItems(exploreRows),
      emptyMessage: '追加探索候補はありません。',
      className: 'is-exploration',
    }),
    renderOpportunityResultGroup({
      title: '除外候補',
      description: 'D判定または権利・需要・鮮度の条件を通らなかった候補です。',
      items: groupItems(excludedRows),
      emptyMessage: '除外候補はありません。',
      className: 'is-excluded',
      collapsible: true,
    }),
  ].join('')

  elements.resultsList.innerHTML = `
    <div class="results-comparison-layout">
      <div class="result-track-list">
        <div class="table-caption">候補を押すと、右に商品案・SEO案・タグ案が出ます。</div>
        ${opportunityGroups}
      </div>
      <div class="selected-result-panel">
        ${renderEverbeeDetail(selectedItem.row)}
      </div>
    </div>
  `
}

function formatCrossNichePercent(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : '-'
}

function formatCrossNicheLift(value) {
  return Number.isFinite(value) ? `${Math.round(value * 10) / 10}x` : '-'
}

function crossNicheVerdictLabel(verdict) {
  if (verdict === 'promising') return '有望'
  if (verdict === 'watch') return '追加確認'
  if (verdict === 'weak-demand') return '需要減少'
  if (verdict === 'weak-competition') return '競合減少不足'
  if (verdict === 'weak-sales') return '販売不足'
  return '未検証'
}

function crossNicheSourceLabel(source) {
  if (source === 'everbee-title') return 'EverBee売れ筋タイトル'
  if (source === 'etsy-related') return 'Etsy関連語'
  if (source === 'measured-child') return '調査済みの子市場'
  return source
}

function currentCrossNicheDrilldown() {
  return buildCrossNicheDrilldown(state.researchRows, currentOptions())
}

function crossNicheStageResolver() {
  const batch = state.crossNicheWorkflow.batch
  const batchKeywords = new Set(batch.map((candidate) => normalizePhrase(candidate.keyword)))
  const erankRows = currentResearchAnalysis().erankRows
    .filter((row) => batchKeywords.has(normalizePhrase(row.keyword)))
  const qualifiedForEtsy = new Set(
    buildEtsyCandidatesFromErank(erankRows, batch)
      .map((candidate) => normalizePhrase(candidate.keyword ?? candidate.query))
  )
  const planItems = new Map(
    (state.marketplaceInsightPlan?.items ?? [])
      .map((item) => [normalizePhrase(item.query), item])
      .filter(([keyword]) => keyword)
  )

  return (keyword) => {
    const normalized = normalizePhrase(keyword)
    const row = findResearchRow(normalized)
    const erankAttempted = Boolean(row && (rowHasErankInput(row) || row.erankCheckedAt))
    if (!erankAttempted) return 'pending-erank'

    const everbeeAttempted = Boolean(row && (rowHasEverbeeInput(row) || row.everbeeCheckedAt))
    if (everbeeAttempted) return 'done'
    if (!qualifiedForEtsy.has(normalized)) return 'done'

    const planItem = planItems.get(normalized)
    if (planItem?.status === 'skipped') return 'done'
    const etsyAttempted = Boolean(row && (rowHasEtsyMarketplaceInput(row) || row.etsyCheckedAt))
      || planItem?.status === 'completed'
    if (!etsyAttempted) return 'pending-etsy'

    const etsyHasData = Boolean(row && rowHasEtsyMarketplaceInput(row))
      || [planItem?.result?.etsySearches30d, planItem?.result?.etsyListings]
        .some((value) => value !== null && value !== undefined && value !== '')
    return etsyHasData ? 'pending-everbee' : 'done'
  }
}

function crossNicheWorkflowMessage() {
  const count = state.crossNicheWorkflow.batch.length
  if (state.crossNicheWorkflow.status === 'pending-erank') {
    return `上位${count}件を調査候補へ自動追加しました。次は2段目の「eRankで検索数を見る」を押してください。`
  }
  if (state.crossNicheWorkflow.status === 'pending-etsy') {
    return `eRank確認が終わりました。次は4段目の「Etsy公式確認を自動実行」を押してください。`
  }
  if (state.crossNicheWorkflow.status === 'pending-everbee') {
    return `Etsy公式確認が終わりました。次は4段目の「EverBeeで売上を確認する」を押してください。`
  }
  if (state.crossNicheWorkflow.status === 'complete') {
    return `クロスニッチ再調査は完了しました。初回結果と実測済みの子キーワードを合わせて最終順位を確定しました。`
  }
  return '高競合で複数商品が売れている市場が見つかると、上位候補を通常調査へ自動追加します。'
}

function syncCrossNicheWorkflow({ announce = false, scroll = false } = {}) {
  if (restoredResultsAwaitingConfirmation()) return { didQueue: false, queuedCandidates: [] }

  const drilldown = currentCrossNicheDrilldown()
  const result = advanceCrossNicheWorkflow({
    workflow: state.crossNicheWorkflow,
    candidates: drilldown.candidates,
    hasParents: drilldown.parents.length > 0,
    stageForKeyword: crossNicheStageResolver(),
    limit: 12,
  })
  const previousStatus = state.crossNicheWorkflow.status
  state.crossNicheWorkflow = result.workflow

  if (result.didQueue) {
    const previousRound = currentResearchRound()
    if (previousRound) {
      const previousRows = analyzeResearchRows(
        researchRowsForRound(state.researchRows, previousRound),
        currentOptions(),
      ).everbeeRows
      state.researchRounds = updateResearchRound(state.researchRounds, previousRound.id, {
        status: 'complete',
        resultKeywords: previousRows.map((row) => row.keyword),
        opportunityCounts: summarizeOpportunityCounts(previousRows),
        completedAt: new Date().toISOString(),
        stopReason: previousRound.type === 'initial'
          ? '初回確認を完了し、高競合の売れ筋から追加探索へ移行'
          : 'この深度の確認を完了し、次の深度へ移行',
      })
    }
    const queuedCandidates = limitNextResearchCandidates(
      result.queuedCandidates.map(crossNicheCandidateForResearch),
      12
    )
    state.candidates = queuedCandidates
    mergeCandidateCatalog(queuedCandidates)
    state.researchRounds = startResearchRound(state.researchRounds, {
      type: 'cross-niche',
      depth: state.crossNicheWorkflow.round,
      candidateKeywords: queuedCandidates.map((candidate) => candidate.keyword),
      status: state.crossNicheWorkflow.status,
      startedAt: new Date().toISOString(),
      startReason: '高競合でも複数商品が売れている親市場を、買い手意図で追加探索',
    })
    state.candidateRoundId = state.researchRounds.activeRoundId
    state.researchRounds.selectedRoundId = 'all'
    state.activeDiscoveryLane = 'all'
    state.marketplaceInsightPlan = null
    state.marketplaceInsightMessage = ''
    state.selectedResultKey = ''
    state.seoPlan = null
    elements.researchJobInput.value = ''
    state.candidateMessage = crossNicheWorkflowMessage()
    setFlowMode('auto', { persist: false })
    if (scroll) {
      window.setTimeout(() => {
        document.querySelector('.candidates-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
    }
  }

  if (!result.didQueue && previousStatus !== state.crossNicheWorkflow.status) {
    const activeRound = currentResearchRound()
    if (activeRound?.type === 'cross-niche') {
      syncActiveRoundStatus(state.crossNicheWorkflow.status, {
        stopReason: state.crossNicheWorkflow.status === 'complete'
          ? '新しい有効候補がないか、最大深度2へ到達'
          : '',
      })
    }
  }

  if (announce && (result.didQueue || previousStatus !== state.crossNicheWorkflow.status)) {
    setSimpleStatus(crossNicheWorkflowMessage())
  }
  return result
}

function renderCrossNicheDrilldown() {
  const drilldown = currentCrossNicheDrilldown()
  const hasParents = drilldown.parents.length > 0
  elements.crossNicheSection.hidden = !hasParents
  elements.crossNicheCount.innerHTML = `<strong>${drilldown.candidates.length}</strong><small>候補</small>`

  if (!hasParents) {
    elements.crossNicheList.innerHTML = ''
    elements.crossNicheStatus.textContent = '高競合で複数商品が売れている探索用親市場は、今回の結果にはありません。'
    return
  }

  elements.crossNicheList.innerHTML = drilldown.parents.map((parent) => {
    const sourceLabel = parent.competition.source === 'everbee'
      ? 'EverBee競合'
      : parent.competition.source === 'etsy'
        ? 'Etsy掲載数'
        : 'eRank競合'
    const rows = parent.candidates.length > 0
      ? parent.candidates.map((candidate) => {
        const comparison = candidate.comparison ?? {}
        const sourceLabels = candidate.sources.map(crossNicheSourceLabel).join(' + ')
        const verdict = crossNicheVerdictLabel(candidate.verdict)
        return `
          <div class="cross-niche-row is-${escapeHtml(candidate.verdict)}">
            <span class="cross-niche-priority"><small>探索優先</small><strong>${candidate.priorityScore}</strong></span>
            <span class="cross-niche-keyword">
              <strong>${escapeHtml(candidate.keyword)}</strong>
              <small>追加軸: ${escapeHtml(candidate.modifier)} / ${escapeHtml(wearerIntentLabel(candidate.wearerIntent))} / 深度 ${candidate.depth} / ${escapeHtml(sourceLabels)}</small>
            </span>
            <span data-label="競合減少率"><small>競合減少率</small><strong>${escapeHtml(formatCrossNichePercent(comparison.competitionReduction))}</strong></span>
            <span data-label="需要維持率"><small>需要維持率</small><strong>${escapeHtml(formatCrossNichePercent(comparison.demandRetention))}</strong></span>
            <span data-label="効率改善"><small>効率改善</small><strong>${escapeHtml(formatCrossNicheLift(comparison.efficiencyLift))}</strong></span>
            <span class="cross-niche-verdict"><small>判定</small><strong>${escapeHtml(verdict)}</strong></span>
          </div>
        `
      }).join('')
      : '<div class="empty-state small">売れ筋商品から新しい交差軸を作れませんでした。</div>'

    return `
      <article class="cross-niche-parent">
        <div class="cross-niche-parent-heading">
          <div>
            <span class="soft-pill">探索用親市場 / 深度 ${parent.depth}</span>
            <h4>${escapeHtml(parent.keyword)}</h4>
          </div>
          <div class="cross-niche-parent-metrics">
            <span><small>${escapeHtml(sourceLabel)}</small><strong>${escapeHtml(formatCompactNumber(parent.competition.value))}</strong></span>
            <span><small>販売商品</small><strong>${escapeHtml(formatCompactNumber(parent.sales.sellingListingCount))}</strong></span>
            <span><small>最近販売</small><strong>${escapeHtml(formatCompactNumber(parent.sales.recentSellingListingCount))}</strong></span>
            <span><small>合計月販</small><strong>${escapeHtml(formatCompactNumber(parent.sales.totalMonthlySales))}</strong></span>
          </div>
        </div>
        <div class="cross-niche-table-head">
          <span>探索</span><span>子キーワード</span><span>競合減少</span><span>需要維持</span><span>効率</span><span>判定</span>
        </div>
        <div class="cross-niche-rows">${rows}</div>
      </article>
    `
  }).join('')

  elements.crossNicheStatus.textContent = crossNicheWorkflowMessage()
}

async function copySelectedNounBrief(button) {
  const rows = everbeeResultRows()
  const selected = rows.find((row, index) => resultRowKey(row, index) === state.selectedResultKey) ?? rows[0]
  const brief = selected?.idea?.nounBrief
  const text = [
    `キーワード: ${selected?.score?.normalized?.keyword ?? selected?.keyword ?? ''}`,
    `主役名詞: ${(brief?.heroNouns ?? []).join(', ')}`,
    `関連名詞: ${(brief?.relatedNouns ?? []).join(', ')}`,
    `要注意名詞: ${(brief?.unsafeNouns ?? []).join(', ')}`,
  ].filter(Boolean).join('\n')
  if (!text) return

  await navigator.clipboard.writeText(text)
  const original = button.textContent
  button.textContent = 'コピーしました'
  window.setTimeout(() => {
    button.textContent = original
  }, 1400)
}

function handleResultListClick(event) {
  if (!(event.target instanceof Element)) return
  const roundButton = event.target.closest('[data-round-filter]')
  if (roundButton) {
    state.researchRounds = selectResearchRound(state.researchRounds, roundButton.dataset.roundFilter)
    state.selectedResultKey = ''
    renderResultsTable()
    persistMarketFinderState()
    return
  }
  const copyButton = event.target.closest('[data-copy-noun-brief]')
  if (copyButton) {
    copySelectedNounBrief(copyButton).catch(() => {
      copyButton.textContent = 'コピー失敗'
    })
    return
  }
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
  const allRanked = currentResearchAnalysis().scoredRows
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
    elements.seoTitleOutput.textContent = 'タイトルとタグを作るとここにタイトルが出ます。'
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
      setTrendStatus('調査候補を作成済みです。条件を変えたら、もう一度「候補を自動で探す」を押します。', 'ready')
    } else {
      setTrendStatus('商品を選んだら、このボタンを押します。見つかった語句から調査候補を作ります。')
    }
    return
  }

  const variant = state.candidates.length > 0 ? 'ready' : 'warn'
  const message = state.candidates.length > 0
    ? `調査候補を作成済みです。条件を変えたら、もう一度「候補を自動で探す」を押します。`
    : `商品と条件を選んで「候補を自動で探す」を押してください。`
  setTrendStatus(message, variant)
}

function renderAll() {
  renderTrendScoutStatus()
  renderBroadHints()
  renderSearchSeedRows()
  renderCandidates()
  renderErankResults()
  renderMarketplaceInsightPlan()
  renderResultsTable()
  renderCrossNicheDrilldown()
  renderSeoPlan()
  persistMarketFinderState()
}

async function loadSearchSeedMetadata() {
  try {
    const response = await fetch(`${SEARCH_SEED_METADATA_URL}?v=20260524-1`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    state.searchSeedRows = parseSearchSeedCsv(text)
    state.searchSeedLoaded = true
    state.searchSeedError = ''
    renderSearchSeedRows()
  } catch (error) {
    state.searchSeedLoaded = false
    state.searchSeedError = `検索種データを読み込めませんでした: ${error?.message || error}`
    renderSearchSeedRows()
  }
}

function candidateProvenance(trendMeta, fallbackSourceLabel = '商品条件から自動生成') {
  if (!trendMeta) {
    return {
      sourceLabel: fallbackSourceLabel,
      sourceDetail: '',
      sourceAt: '',
      sourceBaseKeyword: '',
      sourceFreshness: getSourceFreshness(''),
    }
  }

  const baseKeyword = normalizePhrase(trendMeta.baseKeyword || trendMeta.keyword)
  const isCurrentRun = state.recentTrendKeywords.has(baseKeyword)
  const sourceDetail = String(trendMeta.source ?? '').trim()
  const sourceLabel = isCurrentRun
    ? '今回の自動探索で追加'
    : /サンプル|sample/i.test(sourceDetail)
      ? 'サンプル'
      : '保存済み/手入力Trend'

  const sourceAt = isCurrentRun ? (state.lastTrendRunStartedAt || trendMeta.capturedAt) : trendMeta.capturedAt
  return {
    sourceLabel,
    sourceDetail,
    sourceAt,
    sourceBaseKeyword: baseKeyword,
    sourceFreshness: getSourceFreshness(sourceAt),
  }
}

function candidateSourceText(candidate, researched, resultScore) {
  const sourceLabel = candidate.sourceLabel || (candidate.categoryLabel === 'Trend Scout' ? '保存済み/手入力Trend' : '商品条件から自動生成')
  const sourceDetail = candidate.sourceDetail ? `（${candidate.sourceDetail}）` : ''
  const sourceAt = formatDateTime(candidate.sourceAt)
  const parts = [`由来: ${sourceLabel}${sourceDetail}${sourceAt ? ` / ${sourceAt}` : ''}`]
  if (candidate.sourceFreshness?.freshnessDays !== null) {
    parts.push(`鮮度: ${candidate.sourceFreshness.freshnessDays}日 / ${candidate.sourceFreshness.freshnessLabel}`)
  }

  if (candidate.sourceBaseKeyword && candidate.sourceBaseKeyword !== candidate.keyword) {
    parts.push(`元語: ${candidate.sourceBaseKeyword}`)
  }

  if (resultScore?.validation.hasErankData) {
    parts.push(`eRank確認: ${formatDateTime(researched?.erankCheckedAt) || '済み（時刻なし）'}`)
  }
  if (resultScore?.validation.hasEtsyMarketplaceData) {
    parts.push(`Etsy公式確認: ${formatDateTime(researched?.etsyCheckedAt) || '済み（時刻なし）'}`)
  }

  return parts.join('　')
}

function candidateFromKeyword(keyword, generatedMap, trendMetaByKeyword = new Map()) {
  const normalized = normalizePhrase(keyword)
  const classification = keywordClass(normalized)
  if (classification.action !== 'candidate') return null
  const riskTerms = detectRiskTerms(normalized, elements.riskInput.value.split(/\r?\n|,/))
  const generated = generatedMap.get(normalized)
  const trendMeta = trendMetaByKeyword.get(normalized)
  if (generated) {
    return {
      ...generated,
      ...candidateProvenance(trendMeta),
    }
  }
  const event = selectedEvent()
  const category = selectedCategory()
  const fromTrendScout = Boolean(trendMeta)
  return {
    keyword: normalized,
    eventId: event.id,
    eventLabel: event.jpLabel,
    categoryId: category.id,
    categoryLabel: fromTrendScout ? 'Trend Scout' : category.label,
    score: fromTrendScout ? 70 : 45,
    wordCount: normalized.split(' ').filter(Boolean).length,
    riskTerms,
    status: riskTerms.length > 0 ? 'review' : 'ready',
    ...candidateProvenance(trendMeta),
  }
}

function generateCandidates({ preserveMarketplacePlan = false } = {}) {
  const options = currentOptions()
  const broadEventMode = isBroadEventDiscovery()
  const generated = broadEventMode
    ? generateBroadEventCandidates({ ...options, limit: 40 })
    : generateKeywordCandidates(options)
  const generatedMap = new Map(generated.map((candidate) => [normalizePhrase(candidate.keyword), candidate]))
  const trendEntries = trendCandidateEntries()
  const trendKeywords = cleanKeywordList(trendEntries.map((entry) => entry.keyword)).slice(0, 50)
  const trendMetaByKeyword = new Map()
  trendEntries.forEach((entry) => {
    const key = normalizePhrase(entry.keyword)
    if (key && !trendMetaByKeyword.has(key)) trendMetaByKeyword.set(key, entry)
  })
  const keywords = broadEventMode
    ? generated.map((candidate) => candidate.keyword)
    : cleanKeywordList([
        ...trendKeywords,
        ...generated.map((candidate) => candidate.keyword),
      ])

  const candidates = keywords
    .map((keyword) => candidateFromKeyword(keyword, generatedMap, trendMetaByKeyword))
    .filter(Boolean)
    .map((candidate) => ({
      ...candidate,
      timing: getMarketTiming(selectedEvent()),
      candidateStage: 'idea',
    }))
  const candidatePool = broadEventMode
    ? candidates
    : clusterKeywordCandidates(candidates, options)
  state.candidates = prioritizeEventCandidates(
    candidatePool,
    state.researchedMarketHistory,
    options,
  ).slice(0, broadEventMode ? 40 : Number(elements.limitInput.value) || 80)
  mergeCandidateCatalog(state.candidates)
  if (!preserveMarketplacePlan) beginInitialResearchRound()
  state.activeDiscoveryLane = 'all'
  if (preserveMarketplacePlan && state.marketplaceInsightPlan?.items?.length > 0) {
    rebuildMarketplaceInsightPlan({ preserveExisting: true })
  } else {
    state.marketplaceInsightPlan = null
    state.marketplaceInsightMessage = ''
  }
  state.candidateMessage = state.candidates.length > 0
    ? ''
    : '候補を作れませんでした。商品や流行語を変えてからもう一度押してください。'
  renderAll()
}

function resetCandidatesForInputChange(message = '条件を変更しました。もう一度「候補を自動で探す」を押してください。') {
  state.candidates = []
  state.activeDiscoveryLane = 'all'
  state.marketplaceInsightPlan = null
  state.marketplaceInsightMessage = ''
  state.candidateMessage = message
  renderAll()
}

function crossNicheCandidateForResearch(candidate) {
  const event = selectedEvent()
  const category = selectedCategory()
  const riskTerms = detectRiskTerms(candidate.keyword, elements.riskInput.value.split(/\r?\n|,/))
  const parentRow = findResearchRow(candidate.parentKeyword)
  const sourceAt = parentRow?.everbeeCheckedAt || parentRow?.etsyCheckedAt || parentRow?.erankCheckedAt || ''
  const researchCandidate = {
    keyword: candidate.keyword,
    eventId: event.id,
    eventLabel: event.jpLabel,
    categoryId: category.id,
    categoryLabel: category.label,
    score: candidate.priorityScore,
    wordCount: candidate.keyword.split(' ').filter(Boolean).length,
    riskTerms,
    status: riskTerms.length > 0 ? 'review' : 'ready',
    discoveryLane: 'adjacent',
    queryStrategy: 'cross-niche',
    axisTerms: [candidate.modifier],
    buyerIntentAxes: candidate.buyerIntentAxes ?? [],
    wearerIntent: candidate.wearerIntent ?? 'self',
    recipientRole: candidate.recipientRole ?? '',
    giverRole: candidate.giverRole ?? '',
    occasion: candidate.occasion ?? '',
    personalization: candidate.personalization ?? '',
    crossNicheParent: candidate.parentKeyword,
    crossNicheDepth: candidate.depth,
    sourceLabel: '高競合の売れ筋からクロスニッチ探索',
    sourceDetail: `${candidate.parentKeyword} + ${candidate.modifier}`,
    sourceAt,
    sourceBaseKeyword: candidate.parentKeyword,
    sourceFreshness: getSourceFreshness(sourceAt),
    timing: getMarketTiming(event),
    candidateStage: 'idea',
  }
  return prioritizeEventCandidates(
    [researchCandidate],
    state.researchedMarketHistory,
    currentOptions(),
  )[0]
}

function limitNextResearchCandidates(candidates, limit = 12) {
  const seen = new Set()
  return candidates.filter((candidate) => {
    const keyword = normalizePhrase(candidate?.keyword)
    if (!keyword || seen.has(keyword)) return false
    seen.add(keyword)
    return true
  }).slice(0, Math.max(1, limit))
}

function buildMergedResearchRow(existingRow, row, keyword) {
  const keepExistingWhenBlank = (field) => {
    const incoming = row[field]
    return String(incoming ?? '').trim() !== '' ? incoming : existingRow?.[field]
  }
  const incomingHasErank = rowHasErankInput(row)
  const incomingHasEtsyMarketplace = rowHasEtsyMarketplaceInput(row)
  const incomingHasEverbee = rowHasEverbeeInput(row)
  const incomingCheckedAt = row.checkedAt || row.createdAt || row.updatedAt || ''
  const incomingNotes = String(row.notes ?? '').trim()
  const mergedNotes = mergeRowNotes(existingRow?.notes, incomingNotes)
  const sourceKeyword = String(row.sourceKeyword ?? '').trim()
    || erankSourceKeyword(row)
    || existingRow?.sourceKeyword
    || erankSourceKeyword(existingRow ?? {})
  const candidate = state.candidates.find((item) => normalizePhrase(item.keyword) === keyword)
  const researchEvent = selectedEvent()
  const researchEventId = String(row.researchEventId ?? existingRow?.researchEventId ?? candidate?.eventId ?? researchEvent.id)
  const researchCategoryId = String(row.researchCategoryId ?? existingRow?.researchCategoryId ?? candidate?.categoryId ?? elements.categorySelect.value)
  const intentTrack = classifyEventMarketTrack(keyword, {
    ...currentOptions(),
    eventId: researchEventId,
    categoryId: researchCategoryId,
  }, {
    intentTrack: row.intentTrack ?? existingRow?.intentTrack ?? candidate?.intentTrack,
  })
  const historyClusterKey = String(row.historyClusterKey ?? existingRow?.historyClusterKey ?? candidate?.historyClusterKey ?? '').trim()
    || buildKeywordClusterKey(keyword, { categoryId: researchCategoryId })

  return {
    keyword,
    sourceKeyword,
    sourceKeywords: Array.isArray(row.sourceKeywords)
      ? row.sourceKeywords
      : (existingRow?.sourceKeywords ?? (sourceKeyword ? [sourceKeyword] : [])),
    query: String(row.query ?? existingRow?.query ?? keyword),
    queryKind: String(row.queryKind ?? existingRow?.queryKind ?? ''),
    erankCaptureStatus: String(row.erankCaptureStatus ?? existingRow?.erankCaptureStatus ?? ''),
    erankAttemptedAt: String(row.erankAttemptedAt ?? existingRow?.erankAttemptedAt ?? ''),
    error: String(row.error ?? existingRow?.error ?? ''),
    researchRoundId: String(row.researchRoundId ?? existingRow?.researchRoundId ?? currentResearchRound()?.id ?? ''),
    researchRoundType: String(row.researchRoundType ?? existingRow?.researchRoundType ?? currentResearchRound()?.type ?? ''),
    researchRoundDepth: String(row.researchRoundDepth ?? existingRow?.researchRoundDepth ?? currentResearchRound()?.depth ?? ''),
    researchRoundStatus: String(row.researchRoundStatus ?? existingRow?.researchRoundStatus ?? currentResearchRound()?.status ?? ''),
    researchEventId,
    researchEventLabel: String(row.researchEventLabel ?? existingRow?.researchEventLabel ?? candidate?.eventLabel ?? researchEvent.jpLabel),
    researchCategoryId,
    discoveryLane: String(row.discoveryLane ?? existingRow?.discoveryLane ?? candidate?.discoveryLane ?? ''),
    queryStrategy: String(row.queryStrategy ?? existingRow?.queryStrategy ?? candidate?.queryStrategy ?? ''),
    buyerIntentAxes: Array.isArray(row.buyerIntentAxes)
      ? row.buyerIntentAxes
      : (existingRow?.buyerIntentAxes ?? candidate?.buyerIntentAxes ?? []),
    wearerIntent: String(row.wearerIntent ?? existingRow?.wearerIntent ?? candidate?.wearerIntent ?? ''),
    recipientRole: String(row.recipientRole ?? existingRow?.recipientRole ?? candidate?.recipientRole ?? ''),
    giverRole: String(row.giverRole ?? existingRow?.giverRole ?? candidate?.giverRole ?? ''),
    occasion: String(row.occasion ?? existingRow?.occasion ?? candidate?.occasion ?? ''),
    personalization: String(row.personalization ?? existingRow?.personalization ?? candidate?.personalization ?? ''),
    intentTrack,
    historyClusterKey,
    listingsAnalyzed: keepExistingWhenBlank('listingsAnalyzed'),
    topMonthlySales: keepExistingWhenBlank('topMonthlySales'),
    topRevenue: keepExistingWhenBlank('topRevenue'),
    averagePrice: keepExistingWhenBlank('averagePrice'),
    listingAge: keepExistingWhenBlank('listingAge'),
    visibleListingCount: keepExistingWhenBlank('visibleListingCount'),
    sellingListingCount: keepExistingWhenBlank('sellingListingCount'),
    recentSellingListingCount: keepExistingWhenBlank('recentSellingListingCount'),
    medianMonthlySales: keepExistingWhenBlank('medianMonthlySales'),
    medianMonthlyRevenue: keepExistingWhenBlank('medianMonthlyRevenue'),
    totalVisibleMonthlySales: keepExistingWhenBlank('totalVisibleMonthlySales'),
    topSalesShare: keepExistingWhenBlank('topSalesShare'),
    medianListingAgeMonths: keepExistingWhenBlank('medianListingAgeMonths'),
    productRows: Array.isArray(row.productRows) ? row.productRows : (existingRow?.productRows ?? []),
    crossNicheParent: String(row.crossNicheParent ?? '').trim()
      || String(existingRow?.crossNicheParent ?? '').trim()
      || String(candidate?.crossNicheParent ?? '').trim(),
    crossNicheDepth: String(row.crossNicheDepth ?? '').trim() !== ''
      ? row.crossNicheDepth
      : String(existingRow?.crossNicheDepth ?? '').trim() !== ''
        ? existingRow.crossNicheDepth
        : candidate?.crossNicheDepth ?? '',
    erankSearchVolume: keepExistingWhenBlank('erankSearchVolume'),
    erankClicks: keepExistingWhenBlank('erankClicks'),
    erankCtr: keepExistingWhenBlank('erankCtr'),
    erankCompetition: keepExistingWhenBlank('erankCompetition'),
    erankKeywordDifficulty: keepExistingWhenBlank('erankKeywordDifficulty'),
    erankTrend: keepExistingWhenBlank('erankTrend'),
    etsySearches30d: keepExistingWhenBlank('etsySearches30d'),
    etsyListings: keepExistingWhenBlank('etsyListings'),
    etsyRelatedTerms: keepExistingWhenBlank('etsyRelatedTerms'),
    erankCheckedAt: incomingHasErank
      ? (row.erankCheckedAt || incomingCheckedAt || existingRow?.erankCheckedAt || '')
      : existingRow?.erankCheckedAt ?? '',
    etsyCheckedAt: incomingHasEtsyMarketplace
      ? (row.etsyCheckedAt || incomingCheckedAt || existingRow?.etsyCheckedAt || '')
      : existingRow?.etsyCheckedAt ?? '',
    everbeeCheckedAt: incomingHasEverbee
      ? (row.everbeeCheckedAt || incomingCheckedAt || existingRow?.everbeeCheckedAt || '')
      : existingRow?.everbeeCheckedAt ?? '',
    notes: mergedNotes,
  }
}

function addResearchRows(rows) {
  state.researchRows = mergeRowsByKey(state.researchRows, rows, {
    keyOf: (row) => normalizePhrase(row.keyword),
    merge: buildMergedResearchRow,
  })
  syncResearchMarketHistory()
}

function addResearchRow(row) {
  addResearchRows([row])
}

function addManualResearch() {
  const checkedAt = new Date().toISOString()
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
    etsySearches30d: elements.etsySearchesInput.value,
    etsyListings: elements.etsyListingsInput.value,
    etsyRelatedTerms: elements.etsyRelatedTermsInput.value,
    checkedAt,
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
  elements.etsySearchesInput.value = ''
  elements.etsyListingsInput.value = ''
  elements.etsyRelatedTermsInput.value = ''
  elements.notesInput.value = ''
  syncCrossNicheWorkflow({ announce: true, scroll: true })
  renderAll()
}

function importCsv() {
  const rows = parseEverbeeRows(elements.csvInput.value)
  state.restoredResearchSavedAt = ''
  state.acceptExtensionResults = false
  addResearchRows(rows)
  if (rows.some((row) => rowHasErankInput(row) && !rowHasEverbeeInput(row))) {
    const count = fillEverbeeJobFromErank()
    setSimpleStatus(`検索結果を読み込みました。関連語も使って、売上確認する候補を${count}件作りました。`)
  }
  syncCrossNicheWorkflow({ announce: true, scroll: true })
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

function rowHasEtsyMarketplaceInput(row) {
  return [
    row.etsySearches30d,
    row.etsyListings,
    row.etsyRelatedTerms,
  ].some((value) => String(value ?? '').trim() !== '')
}

function rowHasEverbeeInput(row) {
  return [
    row.listingsAnalyzed,
    row.topMonthlySales,
    row.topRevenue,
    row.averagePrice,
    row.listingAge,
    row.visibleListingCount,
    row.sellingListingCount,
    row.recentSellingListingCount,
    row.medianMonthlySales,
    row.totalVisibleMonthlySales,
    row.topSalesShare,
    Array.isArray(row.productRows) && row.productRows.length > 0 ? 'productRows' : '',
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
    attachErankQueryProvenance(row, state.erankQueryPlan),
    ...(Array.isArray(row.relatedKeywords) ? row.relatedKeywords : []),
  ])
}

function importExtensionResults(extensionState) {
  const importMode = extensionResultsImportMode(extensionState, state.researchRows, state.acceptExtensionResults)
  if (importMode === 'ignore') return
  const importedRows = extensionResearchRows(extensionState).map(sanitizeErankMetricLeak)
  if (importMode === 'restore') {
    state.restoredResearchSavedAt = latestResearchCheckedAt(importedRows) || new Date().toISOString()
    state.restoredResultsAccepted = false
  } else {
    state.restoredResearchSavedAt = ''
  }
  addResearchRows(importedRows)
  ingestBroadSnippetsFromExtensionState(extensionState)
  if (state.progress.mode === 'erank') {
    const keywords = salesCheckKeywords()
    elements.researchJobInput.value = keywords.join('\n')
    const relatedCount = extensionState.results.reduce((count, row) => count + (Array.isArray(row.relatedKeywords) ? row.relatedKeywords.length : 0), 0)
    const proceedCount = erankWinnerRows().length
    const exploreCount = erankExploreRows().length
    const nextMessage = proceedCount > 0
      ? `eRank確認中です。関連キーワード${relatedCount}件も見て、有望語句${proceedCount}件からEtsy公式確認候補${keywords.length}件を作っています。`
      : exploreCount > 0
        ? `eRank確認中です。強い語句は少なめですが、追加探索に使える語句${exploreCount}件からEtsy公式確認候補${keywords.length}件を作っています。`
        : `eRank確認中です。関連キーワード${relatedCount}件を見ていますが、今はまだ強い候補が少なめです。`
    setSimpleStatus(nextMessage)
  }
  if (!extensionState.active) {
    syncCrossNicheWorkflow({ announce: true, scroll: state.progress.mode === 'keyword' })
  }
  persistMarketFinderState()
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
  await copyText(text, elements.copyReadyBtn, '調査欄へ入力済み', '調査欄へ候補を入れる')
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

const RESEARCH_METADATA_CSV_HEADERS = [
  'Research Round',
  'Round Type',
  'Round Depth',
  'Round Status',
  'eRank Query',
  'eRank Query Kind',
  'eRank Source Keywords JSON',
  'eRank Capture Status',
  'eRank Attempted At',
  'Buyer Intent Axes JSON',
  'Wearer Intent',
  'Recipient Role',
  'Giver Role',
  'Occasion',
  'Personalization',
  'Round A Count',
  'Round B Count',
  'Round C Count',
  'Round D Count',
  'Round Start Reason',
  'Round Stop Reason',
  'Research Status',
]

function researchRoundForRow(row) {
  const explicit = state.researchRounds.rounds.find((round) => round.id === row.researchRoundId)
  if (explicit) return explicit
  const directKeyword = normalizePhrase(row.keyword ?? row.query)
  const exact = state.researchRounds.rounds.find((round) => round.candidateKeywords.includes(directKeyword))
  if (exact) return exact
  return state.researchRounds.rounds.find((round) => researchRowsForRound([row], round).length > 0) ?? null
}

function researchMetadataCsvValues(row) {
  const round = researchRoundForRow(row)
  const roundRows = round
    ? analyzeResearchRows(researchRowsForRound(state.researchRows, round), currentOptions()).everbeeRows
    : []
  const counts = round ? summarizeOpportunityCounts(roundRows) : { A: 0, B: 0, C: 0, D: 0 }
  const overallStatus = state.researchRounds.rounds.length > 0
    && state.researchRounds.rounds.every((item) => item.status === 'complete')
    ? 'complete'
    : 'in-progress'
  return [
    round?.id ?? row.researchRoundId ?? '',
    round?.type ?? row.researchRoundType ?? '',
    round?.depth ?? row.researchRoundDepth ?? '',
    round?.status ?? row.researchRoundStatus ?? '',
    row.query ?? row.keyword ?? '',
    row.queryKind ?? '',
    JSON.stringify(row.sourceKeywords ?? (row.sourceKeyword ? [row.sourceKeyword] : [])),
    row.erankCaptureStatus ?? (row.erankCheckedAt ? 'captured' : ''),
    row.erankAttemptedAt ?? row.erankCheckedAt ?? '',
    JSON.stringify(row.buyerIntentAxes ?? []),
    row.wearerIntent ?? '',
    row.recipientRole ?? '',
    row.giverRole ?? '',
    row.occasion ?? '',
    row.personalization ?? '',
    counts.A,
    counts.B,
    counts.C,
    counts.D,
    round?.startReason ?? '',
    round?.stopReason ?? '',
    overallStatus,
  ]
}

function exportErankCsv() {
  const rows = erankResultRows()
  const captureStates = erankCaptureStateRows()
  if (rows.length === 0 && captureStates.length === 0) return

  const header = [
    'Source Type',
    'Source Keyword',
    'Keyword',
    'Market Track',
    'Research Event',
    'Research Category',
    'History Cluster',
    'Action',
    'Opportunity Score',
    'Search',
    'Clicks',
    'CTR',
    'Competition',
    'KD',
    'Trend',
    'Cross Niche Parent',
    'Cross Niche Depth',
    'Notes',
    ...RESEARCH_METADATA_CSV_HEADERS,
  ]

  const lines = rows.map((row) => {
    const normalized = row.erankOpportunity.normalized
    const sourceKeyword = erankSourceKeyword(row)
    const track = marketTrackMetadataForRow(row)
    return [
      row.queryKind === 'base'
        ? 'eRank base query'
        : row.queryKind === 'direct'
          ? 'eRank direct query'
          : sourceKeyword ? 'eRank related keyword' : 'eRank searched keyword',
      sourceKeyword,
      normalized.keyword,
      track.intentTrack,
      track.researchEventId,
      row.researchCategoryId || elements.categorySelect.value,
      track.historyClusterKey,
      row.erankOpportunity.label,
      row.erankOpportunity.score,
      normalized.erankSearchVolume ?? '',
      normalized.erankClicks ?? '',
      normalized.erankCtr ?? '',
      normalized.erankCompetition ?? '',
      normalized.erankKeywordDifficulty ?? '',
      normalized.erankTrend ?? '',
      row.crossNicheParent ?? '',
      row.crossNicheDepth ?? '',
      row.notes ?? '',
      ...researchMetadataCsvValues(row),
    ].map(csvCell).join(',')
  })
  const stateLines = captureStates.map((row) => {
    const track = marketTrackMetadataForRow(row)
    return [
      'eRank planned query',
      row.sourceKeyword,
      row.query,
      track.intentTrack,
      track.researchEventId,
      elements.categorySelect.value,
      track.historyClusterKey,
      row.status === 'failed' ? '検索済み・数値取得失敗' : '未検索',
      '', '', '', '', '', '', '', '', '',
      row.error ?? '',
      ...researchMetadataCsvValues({
        ...row,
        keyword: row.query,
        erankCaptureStatus: row.status,
      }),
    ].map(csvCell).join(',')
  })

  const date = new Date().toISOString().slice(0, 10)
  downloadTextFile(`market-finder-erank-${date}.csv`, [header.map(csvCell).join(','), ...lines, ...stateLines].join('\n'), 'text/csv;charset=utf-8')
}

function exportStep4Csv() {
  const rows = everbeeResultRows()
  if (rows.length === 0) return

  const header = [
    'Rank',
    'Keyword',
    'eRank Source Keyword',
    'Market Track',
    'Research Event',
    'Research Category',
    'History Cluster',
    'Opportunity Score',
    'Grade',
    'Decision Summary',
    'Validation',
    'Opportunity',
    'Confidence',
    'Candidate Stage',
    'Listings Analyzed',
    'Visible Listing Count',
    'Selling Listing Count',
    'Recent Selling Listing Count',
    'Median Monthly Sales',
    'Median Monthly Revenue',
    'Total Visible Monthly Sales',
    'Top Sales Share',
    'Median Listing Age Months',
    'Etsy Searches 30d',
    'Etsy Listings',
    'Etsy Related Terms',
    'eRank Checked At',
    'Etsy Checked At',
    'EverBee Checked At',
    'EverBee Product Rows JSON',
    'Cross Niche Parent',
    'Cross Niche Depth',
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
    'Product Decision',
    'Recommended Product Category',
    'Product Route Summary',
    'Alternate Product Categories',
    'Product Theme',
    'Target',
    'Hero Nouns',
    'Related Nouns',
    'Unsafe Nouns',
    'Noun Source Signals',
    'Noun Note',
    'SEO Title',
    'Tags',
    'Positive Reasons',
    'Warnings',
    'Notes',
    ...RESEARCH_METADATA_CSV_HEADERS,
  ]

  const lines = rows.map((row, index) => {
    const normalized = row.score.normalized
    const brief = row.idea.nounBrief ?? {}
    const route = row.productRoute ?? {}
    const blockedForProduct = route.decision === 'Do not use'
    const track = marketTrackMetadataForRow(row)
    return [
      index + 1,
      normalized.keyword,
      erankSourceKeyword(row),
      track.intentTrack,
      track.researchEventId,
      row.researchCategoryId || elements.categorySelect.value,
      track.historyClusterKey,
      row.score.score,
      row.score.label,
      explainEverbeeScore(row.score).summary,
      row.score.validation.label,
      row.score.opportunityLabel,
      row.score.confidenceLabel,
      row.score.candidateStage,
      normalized.listingsAnalyzed ?? '',
      normalized.visibleListingCount ?? '',
      normalized.sellingListingCount ?? '',
      normalized.recentSellingListingCount ?? '',
      normalized.medianMonthlySales ?? '',
      normalized.medianMonthlyRevenue ?? '',
      normalized.totalVisibleMonthlySales ?? '',
      normalized.topSalesShare ?? '',
      normalized.medianListingAgeMonths ?? '',
      normalized.etsySearches30d ?? '',
      normalized.etsyListings ?? '',
      (normalized.etsyRelatedTerms ?? []).join(', '),
      normalized.erankCheckedAt ?? '',
      normalized.etsyCheckedAt ?? '',
      normalized.everbeeCheckedAt ?? '',
      JSON.stringify(Array.isArray(row.productRows) ? row.productRows : []),
      row.crossNicheParent ?? '',
      row.crossNicheDepth ?? '',
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
      route.decision ?? '',
      route.primary?.label ?? '',
      route.summary ?? '',
      (route.alternates ?? []).map((item) => item.label).join(', '),
      row.idea.theme,
      row.idea.target,
      (brief.heroNouns ?? []).join(', '),
      (brief.relatedNouns ?? []).join(', '),
      (brief.unsafeNouns ?? []).join(', '),
      (brief.sourceSignals ?? []).join(', '),
      brief.usableForTypography ?? '',
      blockedForProduct ? '' : row.idea.seoTitle,
      blockedForProduct ? '' : row.idea.tags.join(', '),
      scoreReasonLabels(row.score).join(' / '),
      row.score.exclusionReasons.join(' / '),
      row.notes ?? '',
      ...researchMetadataCsvValues(row),
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
    state.crossNicheWorkflow = createCrossNicheWorkflowState()
    state.erankQueryPlan = []
    state.researchRounds = createResearchRoundsState()
    state.candidateCatalog = []
    state.candidateRoundId = ''
    state.restoredResearchSavedAt = ''
    state.restoredResultsAccepted = false
    state.acceptExtensionResults = false
  }
  state.selectedResultKey = ''
  state.seoPlan = null
  renderAll()
}

function fillResearchJob() {
  elements.researchJobInput.value = readyKeywords().join('\n')
  elements.extensionStatus.textContent = '調査候補を調査欄へ入れました。この欄の中身だけChrome拡張で調査します。'
  persistMarketFinderState()
}

function clearResearchJob() {
  elements.researchJobInput.value = ''
  elements.extensionStatus.textContent = '調査キーワード欄をクリアしました。'
  persistMarketFinderState()
}

function fillTrendSample() {
  const sampleAt = new Date().toISOString()
  state.recentTrendKeywords = new Set()
  elements.trendScoutInput.value = [
    `spooky reader | サンプル | ${sampleAt}`,
    `pickleball mom | サンプル | ${sampleAt}`,
    `western birthday | サンプル | ${sampleAt}`,
    `book nook | サンプル | ${sampleAt}`,
    `coastal grandma | サンプル | ${sampleAt}`,
    `teacher era | サンプル | ${sampleAt}`,
  ].join('\n')
  resetCandidatesForInputChange('サンプルを入れました。候補一覧はまだ空です。「候補を自動で探す」を押してください。')
  setTrendStatus('サンプルの流行語を入れました。まだ候補一覧には入っていません。', 'warn')
}

function applyTrendScoutTerms() {
  if (!prepareForNewCandidateDiscovery()) return
  const count = trendScoutTerms().length
  generateCandidates()
  const made = state.candidates.length
  if (made === 0) {
    setTrendStatus('候補を作れませんでした。商品や流行語を変えてからもう一度押してください。', 'warn')
    return
  }

  setTrendStatus(count > 0
    ? `${count}件の流行語から調査候補を${made}件作りました。次は「eRankで検索数を見る」です。`
    : `流行語なしで調査候補を${made}件作りました。次は「eRankで検索数を見る」です。`, 'ready')
}

function prepareForNewCandidateDiscovery() {
  state.acceptExtensionResults = false
  if (state.researchRows.length === 0) return true
  if (!confirmExportBeforeClearingResults({ scope: 'all', label: '前回のeRank・Etsy・EverBee結果' })) return false
  clearResearchResults('all')
  return true
}

function appendTrendScoutCandidates(candidates) {
  const existing = new Set(trendScoutTerms().map((term) => normalizePhrase(term)))
  const nextLines = []
  const currentRunCapturedAt = state.lastTrendRunStartedAt || new Date().toISOString()

  candidates.forEach((candidate) => {
    const keyword = normalizePhrase(candidate?.keyword ?? candidate)
    if (!keyword) return
    const source = String(candidate?.source ?? '').trim()
    const quality = trendSeedQuality({ keyword, source })
    if (!quality.usable) return
    const capturedAt = String(candidate?.capturedAt ?? '').trim() || currentRunCapturedAt
    if (!candidate?.capturedAt) state.recentTrendKeywords.add(keyword)
    if (existing.has(keyword)) return
    existing.add(keyword)
    nextLines.push([keyword, source || '自動探索', capturedAt].join(' | '))
  })

  if (nextLines.length === 0) return 0
  const current = String(elements.trendScoutInput.value ?? '').trim()
  elements.trendScoutInput.value = [current, ...nextLines].filter(Boolean).join('\n')
  return nextLines.length
}

async function collectTrendScoutTerms() {
  if (!prepareForNewCandidateDiscovery()) return
  const originalLabel = elements.trendAutoBtn.textContent
  state.lastTrendRunStartedAt = new Date().toISOString()
  state.recentTrendKeywords = new Set()
  elements.trendAutoBtn.disabled = true
  elements.trendAutoBtn.textContent = '取得中...'
  openProgressModal({
    mode: 'trend',
    title: '候補を自動で探す',
    total: state.extensionConnected ? 3 : 2,
    message: '開始しました。調査候補を作っています。',
  })
  resetCandidatesForInputChange('おすすめ元から探しています。完了するとここに候補が入ります。')
  updateProgressModal({
    current: state.extensionConnected ? '3サイトの候補語を確認中' : '商品条件から候補を作成中',
    done: 0,
    message: state.extensionConnected
      ? '取得中です。eRank / Pinterest / Google を開いて、見えている語句を拾っています。'
      : '外部サイトの自動取得は未接続です。商品条件と入口ワードだけで候補を作ります。',
  })
  setTrendStatus(state.progress.message, 'working')
  const searchSeedAdded = appendSearchSeedRowsToTrendScout()

  if (!state.extensionConnected) {
    try {
      generateCandidates()
      const made = state.candidates.length
      const message = made > 0
        ? `候補作成は完了しました。外部サイトの自動取得は未接続ですが、入口ワード${searchSeedAdded}件と商品条件から調査候補を${made}件作りました。次は「eRankで検索数を見る」です。`
        : '候補を作れませんでした。外部サイトの自動取得も使う場合は、実Chromeで開き、Chrome拡張1.27をReloadしてください。Market Finderページは自動で再読み込みされます。'
      updateProgressModal({
        current: made > 0 ? '調査候補を反映' : '候補なし',
        done: 2,
        message,
      })
      setTrendStatus(message, made > 0 ? 'ready' : 'warn')
      completeProgressModal(message)
    } catch (error) {
      const message = error?.message || '候補の自動探索でエラーが起きました。'
      setTrendStatus(message, 'warn')
      failProgress(message)
    } finally {
      elements.trendAutoBtn.disabled = false
      elements.trendAutoBtn.textContent = originalLabel
    }
    return
  }

  try {
    updateProgressModal({
      current: 'eRank / Pinterest / Googleを確認中',
      done: 1,
      message: 'Chrome連携で外部ページを確認しています。終わると候補を整理します。',
    })
    const result = await requestExtension('COLLECT_TRENDS', {
      sources: ['erank', 'pinterest', 'google'],
      limit: 24,
      contextQuery: normalizePhrase(`${selectedEvent().searchTerm} ${selectedCategory().searchTerm}`),
    }, 90000)
    const response = result.response ?? {}
    const trends = Array.isArray(response.trends) ? response.trends : []
    const errors = Array.isArray(response.errors) ? response.errors : []
    updateProgressModal({
      current: '見つかった語句を整理中',
      done: 3,
      message: `${trends.length}件の語句を確認しました。調査候補へ変換しています。`,
    })
    const added = appendTrendScoutCandidates(trends)
    generateCandidates()

    let message = ''
    let variant = 'ready'
    if (added > 0) {
      const note = errors.length > 0 ? ` 取得できなかったページ: ${errors.slice(0, 2).join(' / ')}` : ''
      message = `完了しました。入口ワード${searchSeedAdded}件と外部の流行語${added}件を使い、調査候補を${state.candidates.length}件作りました。次は「eRankで検索数を見る」です。${note}`
    } else if (trends.length > 0 && state.candidates.length > 0) {
      message = `完了しました。入口ワード${searchSeedAdded}件と既存の流行語から調査候補を${state.candidates.length}件作りました。`
    } else if (errors.length > 0) {
      message = `完了しましたが、自動取得できませんでした。対象ページにログインして表示後、もう一度押してください。${errors.slice(0, 2).join(' / ')}`
      variant = 'warn'
    } else {
      message = '完了しましたが、候補語は見つかりませんでした。対象ページを表示してから、もう一度押してください。'
      variant = 'warn'
    }
    updateProgressModal({
      current: variant === 'ready' ? '調査候補を反映' : '確認が必要',
      done: 3,
      message,
    })
    setTrendStatus(message, variant)
    completeProgressModal(message)
  } catch (error) {
    const message = friendlyExtensionError(error)
    setTrendStatus(message, 'warn')
    failProgress(message)
  } finally {
    elements.trendAutoBtn.disabled = false
    elements.trendAutoBtn.textContent = originalLabel
  }
}

function acceptRestoredResearchResults() {
  if (!state.restoredResearchSavedAt || state.researchRows.length === 0) return
  state.restoredResultsAccepted = true
  const result = syncCrossNicheWorkflow({ announce: true, scroll: true })
  if (!result.didQueue) {
    setSimpleStatus('前回の保存結果を今回の続きとして使います。現在の調査段階から再開します。')
  }
  renderAll()
}

function setSimpleStatus(message) {
  elements.simpleStatus.textContent = message
}

function setFlowMode(mode, options = {}) {
  const activeMode = mode === 'csv' ? 'csv' : 'auto'
  document.body.classList.remove('flow-auto', 'flow-csv', 'flow-seo')
  document.body.classList.add(`flow-${activeMode}`)
  ;[elements.flowAutoBtn, elements.flowCsvBtn, elements.flowSeoBtn].forEach((choice) => {
    choice.checked = choice.dataset.flowChoice === activeMode
    choice.closest('.flow-choice')?.classList.toggle('is-active', choice.checked)
  })

  if (activeMode === 'auto') {
    elements.simpleSeoStepNumber.textContent = '4'
    setSimpleStatus('商品と条件を選んで「候補を自動で探す」を押してください。')
  } else {
    elements.simpleSeoStepNumber.textContent = '2'
    setSimpleStatus('CSVを貼って、1「CSVを読み込む」を押してください。')
  }

  if (options.persist !== false) persistMarketFinderState()
}

async function simpleStartErankResearch() {
  await startErankResearch()
}

async function simpleStartResearch() {
  if (restoredResultsAwaitingConfirmation()) {
    setSimpleStatus('前回の保存結果です。eRank結果の上にある「この前回結果から続ける」を押してから進んでください。')
    return
  }
  const officialKeywords = marketplaceCompletedKeywords(state.marketplaceInsightPlan)
  if (officialKeywords.length === 0 && erankResultRows().length > 0) {
    const proceed = window.confirm('Etsy公式データを取得していません。eRank結果だけでEverBeeへ進みますか？')
    if (!proceed) {
      elements.everbeeQueueStatus.textContent = 'EverBee確認を中止しました。先にEtsy公式結果を取り込んでください。'
      return
    }
  }
  const keywords = salesCheckKeywords()
  elements.researchJobInput.value = keywords.join('\n')
  setSimpleStatus(`${keywords.length}件を売上確認します。終わるまでそのまま待ってください。`)
  await startExtensionResearch()
}

function simpleImportCsv() {
  elements.csvInput.value = elements.simpleCsvInput.value
  importCsv()
  setSimpleStatus(`${state.researchRows.length}件の結果を読み込みました。最終結果で候補・名詞・CSV保存を確認してください。`)
}

function simpleUseSeoKeywords() {
  const keywords = elements.simpleSeoKeywordsInput.value
  elements.visibilityBucketInput.value = keywords
  elements.reachBucketInput.value = ''
  elements.bestSellerBucketInput.value = ''
  state.seoPlan = null
  renderSeoPlan()
  setSimpleStatus('キーワードをSEO欄へ入れました。次は「タイトルとタグを作る」です。')
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
  if (/activeTab.*permission is required|either the .*activeTab.*permission is required/i.test(message)) {
    return 'Chrome拡張の画面キャプチャ権限が不足しています。実Chromeで開き、拡張をReloadしてバージョン1.27になっているか確認してください。'
  }
  if (/extension context invalidated/i.test(message)) {
    return 'Chrome拡張の旧接続が残っています。実Chromeで拡張1.27をReloadすると、開いているMarket Finderも自動で再読み込みされます。'
  }
  if (/receiving end does not exist|could not establish connection/i.test(message)) {
    return 'Chrome拡張とページがつながっていません。Market Finderを実Chromeで開き、Chrome拡張1.27をReloadしてください。ページは自動で再読み込みされます。'
  }
  if (/応答がありません/.test(message)) {
    return 'Chrome拡張から応答がありません。Market Finderを実Chromeで開き、Chrome拡張1.27をReloadしてください。'
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
  const checkedAt = new Date().toISOString()
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
    etsySearches30d: 180,
    etsyListings: 9000,
    etsyRelatedTerms: 'spooky season shirt, ghost teacher shirt',
    visibleListingCount: 12,
    sellingListingCount: 4,
    recentSellingListingCount: 3,
    medianMonthlySales: 4,
    medianMonthlyRevenue: 120,
    totalVisibleMonthlySales: 36,
    topSalesShare: 0.4,
    medianListingAgeMonths: 8,
    erankCheckedAt: checkedAt,
    etsyCheckedAt: checkedAt,
    everbeeCheckedAt: checkedAt,
  })

  elements.csvInput.value = [
    'Keyword,Listings Analyzed,Top Monthly Sales,Top Revenue,Average Price,Listing Age,eRank Search Volume,eRank Clicks,eRank CTR,eRank Competition,eRank KD,eRank Trend,Etsy Searches 30d,Etsy Listings,Etsy Related Terms,Notes,Visible Listing Count,Selling Listing Count,Recent Selling Listing Count,Median Monthly Sales,Median Monthly Revenue,Total Visible Monthly Sales,Top Sales Share,Median Listing Age Months,eRank Checked At,Etsy Checked At,EverBee Checked At',
    `"${keyword}","1,039",14,420,20.44,8 Mo.,720,410,57,4200,18,12,180,9000,"spooky season shirt, ghost teacher shirt","${idea.target} / sample score ${score.score}",12,4,3,4,120,36,0.4,8,${checkedAt},${checkedAt},${checkedAt}`,
  ].join('\n')
}

function setRunningControls(active) {
  elements.startExtensionBtn.disabled = active
  elements.broadStartBtn.disabled = active
  elements.candidateErankBtn.disabled = active || readyKeywords().length === 0
  elements.marketplaceStartBtn.disabled = active || etsyValidationCandidates().length === 0
  elements.erankToEverbeeBtn.disabled = active || erankResultRows().length === 0
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
    current: '',
    done: 0,
    completed: false,
  }
  elements.progressModal.hidden = false
  renderProgressModal(state.extensionState)
}

function updateProgressModal({ current, done, total, message } = {}) {
  if (current !== undefined) state.progress.current = current
  if (done !== undefined) state.progress.done = done
  if (total !== undefined) state.progress.total = total
  if (message !== undefined) state.progress.message = message
  state.progress.visible = true
  elements.progressModal.hidden = false
  renderProgressModal(state.extensionState)
}

function completeProgressModal(message) {
  state.progress.completed = true
  state.progress.wasActive = true
  state.progress.done = Math.max(state.progress.done ?? 0, state.progress.total ?? 0)
  state.progress.message = message ?? state.progress.message
  state.progress.visible = true
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
  const localProgress = state.progress.mode === 'trend'
  const active = localProgress
    ? state.progress.started && !state.progress.completed && !state.progress.failed && !state.progress.stopped
    : Boolean(extensionState?.active)
  if (active) state.progress.wasActive = true

  const done = localProgress ? state.progress.done ?? 0 : extensionState?.results?.length ?? 0
  const remaining = localProgress
    ? Math.max(0, state.progress.total - done)
    : extensionState?.remaining ?? Math.max(0, state.progress.total - done)
  const total = Math.max(state.progress.total, done + remaining, done)
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const completed = localProgress
    ? state.progress.completed && !state.progress.failed
    : state.progress.started && state.progress.wasActive && !active && !state.progress.failed
  const stopped = completed && state.progress.stopped
  const failed = state.progress.failed || Boolean(extensionState?.error && !active)
  const currentKeyword = localProgress
    ? state.progress.current || '-'
    : active ? extensionState?.currentKeyword || '次のキーワードを準備中' : '-'

  const starting = state.progress.visible && state.progress.started && !state.progress.wasActive && !state.progress.failed && !state.progress.stopped
  setRunningControls(active || starting)
  if (localProgress) elements.progressStopBtn.disabled = true

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
      syncActiveRoundStatus('pending-etsy')
      const keywords = salesCheckKeywords()
      const relatedCount = (extensionState?.results ?? []).reduce((count, row) => count + (Array.isArray(row.relatedKeywords) ? row.relatedKeywords.length : 0), 0)
      const proceedCount = erankWinnerRows().length
      const exploreCount = erankExploreRows().length
      elements.researchJobInput.value = keywords.join('\n')
      const message = proceedCount > 0
        ? `eRank確認が完了しました。関連キーワード${relatedCount}件も見て、有望語句${proceedCount}件からEtsy公式確認候補${keywords.length}件を作りました。`
        : exploreCount > 0
          ? `eRank確認が完了しました。強い語句は少なめですが、追加探索語句${exploreCount}件からEtsy公式確認候補${keywords.length}件を作りました。`
          : `eRank確認が完了しました。今回は弱めなので、イベント・商品・手入力イベントを変えてもう一度広く見るのがおすすめです。`
      setSimpleStatus(message)
    } else if (state.progress.mode === 'keyword') {
      const round = currentResearchRound()
      if (round?.type === 'initial' && !isCrossNicheWorkflowPending(state.crossNicheWorkflow)) {
        const rows = analyzeResearchRows(researchRowsForRound(state.researchRows, round), currentOptions()).everbeeRows
        syncActiveRoundStatus('complete', {
          resultKeywords: rows.map((row) => row.keyword),
          opportunityCounts: summarizeOpportunityCounts(rows),
          completedAt: new Date().toISOString(),
          stopReason: 'EverBee確認を完了。追加探索できる高競合親市場なし',
        })
      }
      setSimpleStatus(isCrossNicheWorkflowPending(state.crossNicheWorkflow)
        ? `${done}件の売上確認が完了しました。${crossNicheWorkflowMessage()}`
        : `${done}件の売上確認が完了しました。最終結果で候補と名詞候補を確認してください。必要ならCSV保存できます。`)
    } else if (state.progress.mode === 'trend') {
      setSimpleStatus(state.progress.message || `候補の自動探索が完了しました。候補一覧に${state.candidates.length}件を追加しました。`)
    }
    elements.progressDetail.textContent = state.progress.mode === 'broad'
      ? `広め調査が完了しました。商品名を取り込めた場合は、種ワード欄も更新済みです。`
      : state.progress.mode === 'erank'
        ? `eRank確認が完了しました。弱い語句で止めず、関連語も見てEtsy公式確認候補を作りました。`
        : state.progress.mode === 'trend'
          ? state.progress.message || `候補の自動探索が完了しました。候補一覧に${state.candidates.length}件を追加しました。`
          : isCrossNicheWorkflowPending(state.crossNicheWorkflow)
            ? `${done}件のEverBee調査が完了しました。${crossNicheWorkflowMessage()}`
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
        : state.progress.mode === 'trend'
          ? state.progress.message || 'eRank / Pinterest / Google から候補の元になる語句を探しています。'
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
    renderMarketplaceInsightPlan()
    pollExtensionState()
    return
  }

  const pending = data.requestId ? pendingExtensionRequests.get(data.requestId) : null

  if (data.action === 'MARKET_STATE') {
    state.extensionConnected = true
    state.extensionState = data.state
    importExtensionResults(data.state)
    renderExtensionState()
    renderMarketplaceInsightPlan()
  }

  if (!pending) return
  window.clearTimeout(pending.timeoutId)
  pendingExtensionRequests.delete(data.requestId)

  if (data.ok === false) {
    const message = friendlyExtensionError(data.error ?? 'Chrome拡張の処理に失敗しました。')
    if (/旧接続が残っています|ページ側の接続が古くなっています|つながっていません/.test(message)) {
      state.extensionConnected = false
      updateExtensionBadge()
      renderMarketplaceInsightPlan()
    }
    pending.reject(new Error(message))
  } else {
    pending.resolve(data)
  }
}

function updateExtensionBadge() {
  const label = state.extensionConnected ? '接続済み' : '未接続'
  const className = `status-badge ${state.extensionConnected ? 'ready' : 'warn'}`
  elements.extensionBadge.textContent = label
  elements.extensionBadge.className = className
  if (elements.quickExtensionBadge) {
    elements.quickExtensionBadge.textContent = label
    elements.quickExtensionBadge.className = className
  }
}

function renderExtensionState() {
  updateExtensionBadge()
  const extensionState = state.extensionState
  if (!extensionState) {
    const message = state.extensionConnected
      ? 'Chrome拡張と接続しました。'
      : 'Chrome拡張の再読み込み後に使えます。'
    elements.extensionStatus.textContent = message
    if (elements.quickExtensionStatus) {
      elements.quickExtensionStatus.textContent = state.extensionConnected
        ? '接続済みです。eRankやEverBeeの自動取得を使えます。'
        : '未接続です。実Chromeで開き、Chrome拡張1.27をReloadしてください。ページは自動で再読み込みされます。'
    }
    renderProgressModal(extensionState)
    return
  }

  const done = extensionState.results?.length ?? 0
  const message = extensionState.active
    ? `調査中: ${extensionState.currentKeyword || '-'} / 完了 ${done}件 / 残り ${extensionState.remaining}件`
    : `待機中 / 完了 ${done}件`
  elements.extensionStatus.textContent = message
  if (elements.quickExtensionStatus) elements.quickExtensionStatus.textContent = message
  renderProgressModal(extensionState)
}

async function pollExtensionState() {
  if (!state.extensionConnected) return
  try {
    const response = await requestExtension('GET_MARKET_STATE', {}, 3000)
    state.extensionState = response.state
    importExtensionResults(response.state)
    renderExtensionState()
    renderMarketplaceInsightPlan()
    if (response.state?.active) window.setTimeout(pollExtensionState, 2000)
  } catch (error) {
    const message = friendlyExtensionError(error)
    state.extensionConnected = false
    releaseRunningControls()
    updateExtensionBadge()
    renderMarketplaceInsightPlan()
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
  const preserveExisting = preserveCrossNicheResearch('everbee')
  if (!preserveExisting && !confirmExportBeforeClearingResults({ scope: 'everbee', label: '前回のEverBee売上結果' })) return
  if (!preserveExisting) clearResearchResults('everbee')
  state.acceptExtensionResults = true

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
  const queryPlan = buildCurrentErankQueryPlan()
  const keywords = queryPlan.map((item) => item.query)
  if (keywords.length === 0) {
    const message = '候補一覧が空です。先に「候補を自動で探す」を押してください。'
    setSimpleStatus(message)
    state.candidateMessage = message
    renderCandidates()
    return
  }
  const preserveExisting = preserveCrossNicheResearch('erank')
  if (!preserveExisting && !confirmExportBeforeClearingResults({ scope: 'all', label: '前回の調査結果' })) return
  if (!preserveExisting) clearResearchResults('all')
  state.erankQueryPlan = queryPlan
  mergeCandidateCatalog(state.candidates)
  if (!preserveExisting) beginInitialResearchRound()
  else syncActiveRoundStatus('pending-erank')
  state.acceptExtensionResults = true

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
    const querySummary = summarizeErankQueryPlan(state.erankQueryPlan)
    setSimpleStatus(`${activeRoundLabel()}: 候補${querySummary.candidateCount}件を、完全語句${querySummary.directCount}件・基底語${querySummary.baseCount}件の合計${querySummary.queryCount}検索で確認します。`)
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
  state.acceptExtensionResults = true

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

function createMarketplaceInsightPlan() {
  if (!rebuildMarketplaceInsightPlan()) {
    renderMarketplaceInsightPlan()
    return
  }
  renderMarketplaceInsightPlan()
  persistMarketFinderState()
}

async function startMarketplaceInsight() {
  if (!state.extensionConnected) {
    state.marketplaceInsightMessage = 'Chrome拡張へ接続してからEtsy公式の自動確認を開始してください。'
    renderMarketplaceInsightPlan()
    return
  }
  if (etsyValidationCandidates().length === 0) {
    state.marketplaceInsightMessage = 'Etsy公式へ進めるeRank確認済み候補がありません。先にeRankで検索数を確認してください。'
    renderMarketplaceInsightPlan()
    return
  }
  if (!state.marketplaceInsightPlan?.items?.length && !rebuildMarketplaceInsightPlan()) {
    renderMarketplaceInsightPlan()
    return
  }

  renderMarketplaceInsightPlan()
  await runMarketplaceInsightAutomation()
}

async function runMarketplaceInsightAutomation() {
  if (state.marketplaceInsightAutoRunning || state.marketplaceInsightBusy) return
  if (!state.extensionConnected) {
    state.marketplaceInsightMessage = 'Chrome拡張へ接続してからEtsy公式の自動確認を開始してください。'
    renderMarketplaceInsightPlan()
    return
  }

  state.marketplaceInsightAutoRunning = true
  let stoppedByError = false
  try {
    while (state.marketplaceInsightAutoRunning) {
      let item = state.marketplaceInsightPlan?.items?.find((candidate) => candidate.status === 'planned' || candidate.status === 'error')
      if (!item && marketplaceNextBatchState().ready) {
        releaseMarketplaceInsightBatch()
        item = state.marketplaceInsightPlan?.items?.find((candidate) => candidate.status === 'planned' || candidate.status === 'error')
      }
      if (!item) break

      const completed = state.marketplaceInsightPlan.items.filter((candidate) => candidate.status === 'completed').length
      const total = state.marketplaceInsightPlan.items.filter((candidate) => candidate.status !== 'skipped').length
      state.marketplaceInsightBusy = true
      item.status = 'opened'
      item.openedAt = new Date().toISOString()
      item.error = ''
      state.marketplaceInsightMessage = `${completed + 1} / ${total}件目「${item.query}」を検索し、結果を自動取得しています。`
      renderMarketplaceInsightPlan()

      try {
        const result = await requestExtension('RUN_AND_CAPTURE_ETSY_MARKETPLACE_INSIGHT', { query: item.query }, 90000)
        const response = result.response ?? result
        if (response?.started === false || response?.ok === false) {
          throw new Error(response?.error || 'Marketplace Insightsの自動取得を開始できませんでした。')
        }
        const captured = await captureMarketplaceInsight({
          marketplaceItem: item,
          suppliedResult: result,
          manageBusy: false,
        })
        if (!captured) {
          stoppedByError = true
          break
        }
      } catch (error) {
        item.status = 'error'
        item.error = error?.message || String(error)
        state.marketplaceInsightMessage = `${friendlyExtensionError(error)} 自動確認を停止しました。`
        stoppedByError = true
        break
      } finally {
        state.marketplaceInsightBusy = false
        renderAll()
        persistMarketFinderState()
      }
    }
  } finally {
    const stoppedByUser = !state.marketplaceInsightAutoRunning
    state.marketplaceInsightAutoRunning = false
    const remaining = state.marketplaceInsightPlan?.items?.filter((item) => ['planned', 'opened', 'error'].includes(item.status)).length ?? 0
    if (!stoppedByError && stoppedByUser) {
      state.marketplaceInsightMessage = `自動確認を停止しました。未処理は${remaining}件です。`
    } else if (!stoppedByError && remaining === 0) {
      const completed = state.marketplaceInsightPlan?.items?.filter((item) => item.status === 'completed').length ?? 0
      state.marketplaceInsightMessage = `Etsy公式の自動確認が完了しました。${completed}件を取得しました。`
      syncActiveRoundStatus('pending-everbee')
    }
    syncCrossNicheWorkflow({ announce: true })
    renderAll()
    persistMarketFinderState()
  }
}

function stopMarketplaceInsightAutomation() {
  if (!state.marketplaceInsightAutoRunning) return
  state.marketplaceInsightAutoRunning = false
  state.marketplaceInsightMessage = '現在の語句を取得したあとで自動確認を停止します。'
  renderMarketplaceInsightPlan()
}

async function captureMarketplaceInsight(options = {}) {
  const item = options?.marketplaceItem ?? capturableMarketplaceInsightItem()
  if (!item) return false
  const hasSuppliedResult = Object.prototype.hasOwnProperty.call(options, 'suppliedResult')
  const manageBusy = options?.manageBusy !== false

  if (manageBusy) state.marketplaceInsightBusy = true
  state.marketplaceInsightMessage = `「${item.query}」の30日データを読み取っています。`
  renderMarketplaceInsightPlan()
  try {
    const result = hasSuppliedResult
      ? options.suppliedResult
      : await requestExtension('CAPTURE_ETSY_MARKETPLACE_INSIGHT', { query: item.query }, 20000)
    const response = result.response ?? result
    const insight = response?.result ?? response
    if (response?.ok === false || insight?.ok === false) {
      throw new Error(insight?.error || response?.error || 'Marketplace Insightsの数値を読み取れませんでした。')
    }
    const hasSearches = insight?.etsySearches30d !== null && insight?.etsySearches30d !== undefined && insight?.etsySearches30d !== ''
    const hasListings = insight?.etsyListings !== null && insight?.etsyListings !== undefined && insight?.etsyListings !== ''
    if (!hasSearches && !hasListings) {
      throw new Error('30日検索数と掲載数が見つかりません。Etsyの結果が表示されてから、もう一度取り込んでください。')
    }

    const checkedAt = insight.etsyCheckedAt || new Date().toISOString()
    const relatedTerms = Array.isArray(insight.etsyRelatedTerms) ? insight.etsyRelatedTerms : []
    const relatedModes = Array.isArray(insight.etsyRelatedModes) ? insight.etsyRelatedModes : []
    const searchTrendPercent = Number(insight.etsySearchTrendPercent)
    const hasSearchTrend = Number.isFinite(searchTrendPercent)
    const relatedMetrics = Array.isArray(insight.etsyRelatedKeywordMetrics)
      ? insight.etsyRelatedKeywordMetrics
        .map((metric) => ({
          keyword: normalizePhrase(metric?.keyword),
          etsySearches30d: metric?.etsySearches30d,
          etsyListings: metric?.etsyListings,
          conversionLabel: String(metric?.conversionLabel ?? '').trim(),
          sourceQuery: item.query,
          sourceModes: Array.isArray(metric?.sourceModes) ? metric.sourceModes : [],
        }))
        .filter((metric) => metric.keyword && [metric.etsySearches30d, metric.etsyListings]
          .some((value) => value !== null && value !== undefined && value !== ''))
      : []
    addResearchRow({
      keyword: insight.keyword || insight.query || item.query,
      etsySearches30d: insight.etsySearches30d,
      etsyListings: insight.etsyListings,
      etsyRelatedTerms: relatedTerms.join(', '),
      etsyCheckedAt: checkedAt,
      notes: `Etsy Marketplace Insights / 直近30日${hasSearchTrend ? ` / 検索変化 ${searchTrendPercent > 0 ? '+' : ''}${searchTrendPercent}%` : ''}`,
    })
    relatedMetrics.forEach((metric) => {
      const conversionNote = metric.conversionLabel ? ` / Conversion: ${metric.conversionLabel}` : ''
      const modeNote = metric.sourceModes?.length ? ` / Views: ${metric.sourceModes.join('+')}` : ''
      addResearchRow({
        keyword: metric.keyword,
        etsySearches30d: metric.etsySearches30d,
        etsyListings: metric.etsyListings,
        etsyCheckedAt: checkedAt,
        notes: `Etsy Marketplace Insights related to ${item.query}${conversionNote}${modeNote}`,
      })
    })
    const previousRelatedTerms = Array.isArray(item.result?.etsyRelatedTerms) ? item.result.etsyRelatedTerms : []
    const mergedRelatedTerms = Array.from(new Set(
      [...previousRelatedTerms, ...relatedTerms].map(normalizePhrase).filter(Boolean),
    ))
    const mergedRelatedMetrics = mergeMarketplaceInsightRelatedMetrics(
      Array.isArray(item.result?.etsyRelatedKeywordMetrics) ? item.result.etsyRelatedKeywordMetrics : [],
      relatedMetrics,
    )
    item.status = 'completed'
    item.completedAt = checkedAt
    item.result = {
      etsySearches30d: insight.etsySearches30d,
      etsyListings: insight.etsyListings,
      etsySearchTrendPercent: hasSearchTrend ? searchTrendPercent : null,
      etsyRelatedTerms: mergedRelatedTerms,
      etsyRelatedKeywordMetrics: mergedRelatedMetrics,
      etsyRelatedModes: relatedModes,
      etsyCheckedAt: checkedAt,
    }
    item.error = ''
    if (state.marketplaceInsightMode !== 'plus' && Number.isFinite(Number(insight.remainingSearches))) {
      state.marketplaceInsightPlan.officialRemaining = Number(insight.remainingSearches)
    }

    const added = appendTrendScoutCandidates(relatedTerms.map((keyword) => ({
      keyword,
      source: `Etsy Marketplace Insights related to ${item.query}`,
      capturedAt: checkedAt,
    })))
    if (!isCrossNicheWorkflowPending(state.crossNicheWorkflow)) {
      if (added > 0) generateCandidates({ preserveMarketplacePlan: true })
      else if (state.marketplaceInsightMode === 'plus' && relatedMetrics.length > 0) {
        rebuildMarketplaceInsightPlan({ preserveExisting: true })
      }
    }
    const followUpMessage = state.marketplaceInsightMode === 'plus'
      ? ` / 候補プール ${state.marketplaceInsightPlan?.candidatePool?.length ?? 0}件${marketplaceNextBatchState().ready ? ' / 次の5語を追加できます' : ''}`
      : ''
    const modeLabel = relatedModes.length > 0
      ? ` / 取得面 ${relatedModes.map((mode) => mode === 'similar' ? '似たワード' : mode === 'explore' ? '探索アイデア' : mode).join('＋')}`
      : ''
    state.marketplaceInsightMessage = `取得しました。30日検索数 ${insight.etsySearches30d ?? '-'} / 掲載数 ${insight.etsyListings ?? '-'}${hasSearchTrend ? ` / 検索変化 ${searchTrendPercent > 0 ? '+' : ''}${searchTrendPercent}%` : ''} / 関連語 ${relatedTerms.length}件（数値付き ${relatedMetrics.length}件）${modeLabel}${followUpMessage}。`
    return true
  } catch (error) {
    item.error = error?.message || String(error)
    state.marketplaceInsightMessage = `${friendlyExtensionError(error)} 自動確認を停止しました。表示中の結果を手動で取り込めます。`
    return false
  } finally {
    if (manageBusy) state.marketplaceInsightBusy = false
    if (manageBusy) syncCrossNicheWorkflow({ announce: true })
    renderAll()
  }
}

function skipMarketplaceInsight() {
  const item = nextMarketplaceInsightItem()
  if (!item) return
  const wasOpened = item.status === 'opened'
  item.status = 'skipped'
  item.skippedAt = new Date().toISOString()
  state.marketplaceInsightMessage = wasOpened
    ? `「${item.query}」をスキップしました。Etsy側で検索済みの場合、無料枠は戻りません。`
    : `「${item.query}」をスキップしました。無料検索は実行していません。`
  syncCrossNicheWorkflow({ announce: true })
  renderAll()
  persistMarketFinderState()
}

async function stopExtensionResearch() {
  try {
    state.progress.stopped = true
    const response = await requestExtension('STOP_MARKET_RESEARCH')
    const latest = response.state ? response : await requestExtension('GET_MARKET_STATE', {}, 3000)
    state.extensionState = latest.state
    importExtensionResults(latest.state)
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
  elements.discoveryLaneTabs.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest('[data-discovery-lane]')
    if (!button) return
    state.activeDiscoveryLane = button.dataset.discoveryLane || 'all'
    renderCandidates()
    persistMarketFinderState()
  })
  elements.candidateRoundTabs.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest('[data-candidate-round]')
    if (!button) return
    state.candidateRoundId = button.dataset.candidateRound || state.researchRounds.activeRoundId
    state.activeDiscoveryLane = 'all'
    renderCandidates()
    persistMarketFinderState()
  })
  elements.erankSummary.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    if (event.target.closest('[data-use-restored-results]')) acceptRestoredResearchResults()
  })
  elements.marketplaceModeControl.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest('[data-marketplace-mode]')
    if (!button) return
    setMarketplaceInsightMode(button.dataset.marketplaceMode)
  })
  elements.marketplaceBuildPlanBtn.addEventListener('click', createMarketplaceInsightPlan)
  elements.marketplaceStartBtn.addEventListener('click', startMarketplaceInsight)
  elements.marketplaceNextBtn.addEventListener('click', runMarketplaceInsightAutomation)
  elements.marketplaceAutoStopBtn.addEventListener('click', stopMarketplaceInsightAutomation)
  elements.marketplaceCaptureBtn.addEventListener('click', captureMarketplaceInsight)
  elements.marketplaceNextBatchBtn.addEventListener('click', releaseMarketplaceInsightBatch)
  elements.marketplaceSkipBtn.addEventListener('click', skipMarketplaceInsight)
  elements.trendSampleBtn.addEventListener('click', fillTrendSample)
  elements.trendAutoBtn.addEventListener('click', collectTrendScoutTerms)
  elements.trendApplyBtn.addEventListener('click', applyTrendScoutTerms)
  elements.addResearchBtn.addEventListener('click', addManualResearch)
  elements.importCsvBtn.addEventListener('click', importCsv)
  elements.sampleCsvBtn.addEventListener('click', fillSampleCsv)
  elements.resultsList.addEventListener('click', handleResultListClick)
  elements.researchRoundTabs.addEventListener('click', handleResultListClick)
  elements.copyKeywordsBtn.addEventListener('click', copyKeywords)
  elements.copyReadyBtn.addEventListener('click', copyReadyKeywords)
  elements.downloadJobBtn.addEventListener('click', downloadJob)
  elements.downloadErankCsvBtn.addEventListener('click', exportErankCsv)
  elements.downloadStep4CsvBtn.addEventListener('click', exportStep4Csv)
  elements.candidateErankBtn.addEventListener('click', simpleStartErankResearch)
  elements.erankToEverbeeBtn.addEventListener('click', simpleStartResearch)
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
  elements.flowAutoBtn.addEventListener('change', () => {
    if (elements.flowAutoBtn.checked) setFlowMode('auto')
  })
  elements.flowCsvBtn.addEventListener('change', () => {
    if (elements.flowCsvBtn.checked) setFlowMode('csv')
  })
  elements.flowSeoBtn.addEventListener('change', () => {
    if (elements.flowSeoBtn.checked) setFlowMode('seo')
  })
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
  migrateLegacyResearchRounds()
  renderTargets({ selectedTargets: persisted?.form?.targets })
  bindEvents()
  setFlowMode(persisted?.flowMode ?? 'auto', { persist: false })
  syncResearchMarketHistory()
  const activeRound = currentResearchRound()
  const catalogByKeyword = new Map(state.candidateCatalog.map((candidate) => [normalizePhrase(candidate.keyword), candidate]))
  state.candidates = isCrossNicheWorkflowPending(state.crossNicheWorkflow)
    ? state.crossNicheWorkflow.batch.map(crossNicheCandidateForResearch)
    : activeRound
      ? activeRound.candidateKeywords.map((keyword) => catalogByKeyword.get(keyword)).filter(Boolean)
      : []
  state.candidateRoundId = state.researchRounds.rounds.some((round) => round.id === state.candidateRoundId)
    ? state.candidateRoundId
    : state.researchRounds.activeRoundId
  state.candidateMessage = state.candidates.length > 0
    ? crossNicheWorkflowMessage()
    : 'まだ候補はありません。商品と条件を選んで「候補を自動で探す」を押してください。'
  if (shouldDiscardMarketplacePlan(state.marketplaceInsightPlan, erankResultRows())) {
    state.marketplaceInsightPlan = null
    state.marketplaceInsightMessage = ''
  }
  const needsAdaptiveMigration = !isCrossNicheWorkflowPending(state.crossNicheWorkflow)
    && state.marketplaceInsightMode === 'plus'
    && state.marketplaceInsightPlan?.items?.length > 0
    && (state.marketplaceInsightPlan.seedQuota !== 20
      || !Array.isArray(state.marketplaceInsightPlan.candidatePool))
  if (needsAdaptiveMigration) generateCandidates({ preserveMarketplacePlan: true })
  else {
    if (state.marketplaceInsightPlan?.items?.length > 0 && erankResultRows().length > 0) {
      rebuildMarketplaceInsightPlan({ preserveExisting: true })
    }
    renderAll()
  }
  if (state.researchRows.length > 0) {
    setSimpleStatus(`${state.researchRows.length}件の前回結果を復元しました。続きから使えます。`)
  }
  setRunningControls(false)
  initExtensionBridge()
  loadSearchSeedMetadata()
}

init()
