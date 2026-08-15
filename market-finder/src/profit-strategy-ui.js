import {
  decideProductAction,
  scoreProfitStrategy,
} from './profit-strategy.js'
import { normalizePhrase } from '../../shared/market-keyword-engine/index.js'

const EXPLORATION_MODES = new Set(['M1', 'M3', 'M5'])
const PROFIT_BOOLEAN_FIELDS = new Set([
  'productMatch',
  'presentationReady',
  'specificBuyer',
  'distinctVisual',
  'personalization',
])
const PROFIT_NUMBER_FIELDS = new Set([
  'salePriceYen',
  'productCostYen',
  'etsyFeesYen',
  'offsiteAdsFeesYen',
])
const EMPTY_MANUAL_INPUT = {
  buyerIntent: 0,
  productMatch: false,
  presentationReady: false,
  specificBuyer: false,
  distinctVisual: false,
  personalization: false,
  salePriceYen: null,
  productCostYen: null,
  etsyFeesYen: null,
  offsiteAdsFeesYen: null,
}

function normalizeExplorationMode(value) {
  return EXPLORATION_MODES.has(value) ? value : 'M1'
}

function normalizeStoredProfitInputs(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([keyword, inputs]) => [
        normalizePhrase(keyword),
        inputs && typeof inputs === 'object' && !Array.isArray(inputs) ? { ...inputs } : {},
      ])
      .filter(([keyword]) => Boolean(keyword)),
  )
}

export function restoreProfitStrategyUiState(saved = {}) {
  return {
    selectedExplorationMode: normalizeExplorationMode(saved.selectedExplorationMode),
    profitInputsByKeyword: normalizeStoredProfitInputs(saved.profitInputsByKeyword),
  }
}

export function selectExplorationMode(uiState = {}, selectedMode) {
  const restored = restoreProfitStrategyUiState(uiState)
  return {
    ...restored,
    selectedExplorationMode: normalizeExplorationMode(selectedMode),
  }
}

export function profitManualInputsForKeyword(uiState = {}, keyword) {
  const restored = restoreProfitStrategyUiState(uiState)
  const saved = restored.profitInputsByKeyword[normalizePhrase(keyword)] ?? {}
  return {
    buyerIntent: [0, 5, 10, 15].includes(Number(saved.buyerIntent)) ? Number(saved.buyerIntent) : 0,
    productMatch: saved.productMatch === true,
    presentationReady: saved.presentationReady === true,
    specificBuyer: saved.specificBuyer === true,
    distinctVisual: saved.distinctVisual === true,
    personalization: saved.personalization === true,
    salePriceYen: nonNegativeNumber(saved.salePriceYen),
    productCostYen: nonNegativeNumber(saved.productCostYen),
    etsyFeesYen: nonNegativeNumber(saved.etsyFeesYen),
    offsiteAdsFeesYen: nonNegativeNumber(saved.offsiteAdsFeesYen),
  }
}

export function updateManualProfitInput(uiState = {}, { keyword, field, value } = {}) {
  const restored = restoreProfitStrategyUiState(uiState)
  const keywordKey = normalizePhrase(keyword)
  if (!keywordKey
    || (field !== 'buyerIntent' && !PROFIT_BOOLEAN_FIELDS.has(field) && !PROFIT_NUMBER_FIELDS.has(field))) {
    return restored
  }
  const current = profitManualInputsForKeyword(restored, keywordKey)
  const normalizedValue = field === 'buyerIntent'
    ? ([0, 5, 10, 15].includes(Number(value)) ? Number(value) : 0)
    : PROFIT_NUMBER_FIELDS.has(field)
      ? nonNegativeNumber(value)
      : value === true
  return {
    ...restored,
    profitInputsByKeyword: {
      ...restored.profitInputsByKeyword,
      [keywordKey]: {
        ...current,
        [field]: normalizedValue,
      },
    },
  }
}

export function selectVisibleProfitRow(visibleRows = [], selectedKey = '') {
  const rows = Array.isArray(visibleRows) ? visibleRows : []
  if (rows.length === 0) return { selectedKey: '', row: null }
  const selected = rows.find((row) => row?.key === selectedKey) ?? rows[0]
  return { selectedKey: selected.key, row: selected }
}

export function bindProfitStrategyInputEvents(panel, handler) {
  if (!panel || typeof panel.addEventListener !== 'function' || typeof handler !== 'function') return false
  panel.addEventListener('input', handler)
  panel.addEventListener('change', handler)
  return true
}

function boundedScore(value, maximum) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(maximum, Math.round(numeric)))
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function nonNegativeNumber(value) {
  const numeric = finiteNumber(value)
  return numeric !== null && numeric >= 0 ? numeric : null
}

export function scoreOrderProfitEconomics(input = {}) {
  const values = Object.fromEntries(
    [...PROFIT_NUMBER_FIELDS].map((field) => [field, nonNegativeNumber(input?.[field])]),
  )
  if (Object.values(values).some((value) => value === null)) {
    return { score: 0, expectedProfitYen: null, complete: false }
  }

  const expectedProfitYen = values.salePriceYen
    - values.productCostYen
    - values.etsyFeesYen
    - values.offsiteAdsFeesYen
  const score = expectedProfitYen >= 800
    ? 7
    : expectedProfitYen >= 600
      ? 6
      : expectedProfitYen >= 400
        ? 5
        : expectedProfitYen >= 200
          ? 3
          : expectedProfitYen > 0 ? 1 : 0
  return { score, expectedProfitYen, complete: true }
}

function hasEvidenceValue(value) {
  if (value === true) return true
  if (value === false) return false
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  if (value === null || value === undefined || value === '') return false
  return String(value).trim().toLowerCase() !== 'unknown'
}

export function deriveTrendFitEvidence(source = {}) {
  const marketplaceHistory = source.marketplaceInsightsHistory ?? source.marketplaceInsightsTimeSeries
  const hasMarketplaceHistory = (Array.isArray(marketplaceHistory) && marketplaceHistory.length >= 2)
    || finiteNumber(source.etsySearchTrendPercent) !== null
    || hasEvidenceValue(source.marketplaceInsightsTrend)
  const hasCountryComparison = hasEvidenceValue(
    source.countryComparison
      ?? source.etsyCountryComparison
      ?? source.marketplaceCountryComparison
      ?? source.hasCountryComparison,
  )
  const hasGoogleTrends = hasEvidenceValue(
    source.googleTrends ?? source.googleTrend ?? source.googleTrendsEvidence,
  )
  const hasErankTrend = hasEvidenceValue(source.erankTrend)
  const labels = [
    hasMarketplaceHistory ? 'Marketplace Insights時系列' : '',
    hasCountryComparison ? '国比較' : '',
    hasGoogleTrends ? 'Google Trends' : '',
    hasErankTrend ? 'eRank trend' : '',
  ].filter(Boolean)

  return {
    score: labels.length >= 2 ? 5 : labels.length === 1 ? 3 : 0,
    labels,
    note: `傾向根拠: ${labels.length ? labels.join(' / ') : '未取得'}`,
  }
}

function firstEvidenceValue(...values) {
  return values.find((value) => hasEvidenceValue(value)) ?? null
}

export function composeFinalTrendEvidence({
  candidate = {},
  raw = {},
  normalized = {},
  marketplaceResult = {},
} = {}) {
  const explicitGoogleEvidence = firstEvidenceValue(
    normalized.googleTrendsEvidence,
    normalized.googleTrends,
    normalized.googleTrend,
    raw.googleTrendsEvidence,
    raw.googleTrends,
    raw.googleTrend,
    candidate.googleTrendsEvidence,
  )
  const source = String(candidate.sourceDetail ?? candidate.sourceLabel ?? '').trim()
  const googleTrendsEvidence = explicitGoogleEvidence ?? (
    /\bgoogle(?:\s+trends?)?\b/i.test(source)
      ? {
          keyword: String(candidate.sourceBaseKeyword ?? candidate.keyword ?? '').trim(),
          source,
          capturedAt: String(candidate.sourceAt ?? '').trim(),
        }
      : null
  )
  const countryComparison = firstEvidenceValue(
    normalized.countryComparison,
    normalized.etsyCountryComparison,
    normalized.marketplaceCountryComparison,
    raw.countryComparison,
    raw.etsyCountryComparison,
    raw.marketplaceCountryComparison,
    marketplaceResult.countryComparison,
    marketplaceResult.etsyCountryComparison,
    candidate.countryComparison,
  )
  const etsySearchTrendPercent = [
    normalized.etsySearchTrendPercent,
    raw.etsySearchTrendPercent,
    marketplaceResult.etsySearchTrendPercent,
  ].map(finiteNumber).find((value) => value !== null) ?? null
  const erankTrend = firstEvidenceValue(normalized.erankTrend, raw.erankTrend)

  return {
    googleTrendsEvidence,
    countryComparison,
    etsySearchTrendPercent,
    erankTrend,
  }
}

function directDemandScore(searches, clicks) {
  if ((searches ?? 0) >= 100 || (clicks ?? 0) >= 30) return 18
  if ((searches ?? 0) >= 50 || (clicks ?? 0) >= 15) return 8
  return 0
}

function directSupplyScore(listings, competition, keywordDifficulty) {
  if ((keywordDifficulty !== null && keywordDifficulty <= 45)
    || (competition !== null && competition < 20000)
    || (listings !== null && listings < 20000)) return 14
  if ((competition !== null && competition < 50000)
    || (listings !== null && listings < 50000)) return 3
  return 0
}

function demandSupplyEvidence(marketScore, normalized) {
  const scoreSource = String(marketScore?.validation?.demandSupplySource ?? '').toLowerCase()
  const scoreDemand = finiteNumber(marketScore?.parts?.demandScore)
  const scoreSupply = finiteNumber(marketScore?.parts?.erankCompetitionScore)
  if (scoreDemand !== null && scoreSupply !== null && (scoreSource === 'etsy' || scoreSource === 'erank')) {
    const sourceLabel = scoreSource === 'etsy' ? 'Etsy公式' : 'eRank'
    return {
      score: boundedScore(((scoreDemand + scoreSupply) / 32) * 25, 25),
      sourceLabel,
      note: `${sourceLabel}: 需要 ${scoreDemand} + 供給 ${scoreSupply}`,
    }
  }

  const etsySearches = finiteNumber(normalized.etsySearches30d)
  const etsyListings = finiteNumber(normalized.etsyListings)
  if (etsySearches !== null && etsyListings !== null) {
    const demand = directDemandScore(etsySearches, null)
    const supply = directSupplyScore(etsyListings, null, null)
    return {
      score: boundedScore(((demand + supply) / 32) * 25, 25),
      sourceLabel: 'Etsy公式',
      note: `Etsy公式: 検索 ${etsySearches} / 掲載 ${etsyListings}`,
    }
  }

  const erankSearches = finiteNumber(normalized.erankSearchVolume)
  const erankClicks = finiteNumber(normalized.erankClicks)
  const erankCompetition = finiteNumber(normalized.erankCompetition)
  const erankKeywordDifficulty = finiteNumber(normalized.erankKeywordDifficulty)
  if ((erankSearches !== null || erankClicks !== null)
    && (erankCompetition !== null || erankKeywordDifficulty !== null)) {
    const demand = directDemandScore(erankSearches, erankClicks)
    const supply = directSupplyScore(null, erankCompetition, erankKeywordDifficulty)
    return {
      score: boundedScore(((demand + supply) / 32) * 25, 25),
      sourceLabel: 'eRank',
      note: `eRank: Search ${erankSearches ?? '-'} / Clicks ${erankClicks ?? '-'} / Competition ${erankCompetition ?? '-'} / KD ${erankKeywordDifficulty ?? '-'}`,
    }
  }

  if (scoreDemand !== null || scoreSupply !== null) {
    return {
      score: boundedScore((((scoreDemand ?? 0) + (scoreSupply ?? 0)) / 32) * 25, 25),
      sourceLabel: '既存score',
      note: `既存score: 需要 ${scoreDemand ?? 0} + 供給 ${scoreSupply ?? 0}`,
    }
  }

  return { score: 0, sourceLabel: '根拠待ち', note: '根拠待ち: EtsyまたはeRankの需要・供給が未取得' }
}

function newcomerEvidence(normalized = {}) {
  const median = finiteNumber(normalized.medianSellerReviews)
  const lowReviewShare = finiteNumber(normalized.lowReviewSellerShare) ?? 0
  if (normalized.hasReviewData !== true || median === null) {
    return { score: 0, note: 'Newcomer: 上位レビュー数は未取得' }
  }
  if (median <= 50 || lowReviewShare >= 0.5) {
    return { score: 20, note: `Newcomer: 上位レビュー中央値 ${median}、低レビュー店比率 ${Math.round(lowReviewShare * 100)}%` }
  }
  if (median <= 200 || lowReviewShare >= 0.25) {
    return { score: 12, note: `Newcomer: 上位レビュー中央値 ${median}、参入余地を要比較` }
  }
  return { score: 5, note: `Newcomer: 上位レビュー中央値 ${median}、レビュー差が大きい` }
}

function actionLabel(action) {
  if (action === 'pending') return '根拠待ち'
  if (action === 'launch-small') return '小さく商品化テスト'
  if (action === 'explore') return '派生市場を追加探索'
  if (action === 'hold') return '保留して根拠を追加'
  return '今回は見送り'
}

function resolvedProfitEconomicsInputs(row, normalized, manual) {
  const aliases = {
    salePriceYen: ['salePriceYen', 'priceYen'],
    productCostYen: ['productCostYen', 'costYen'],
    etsyFeesYen: ['etsyFeesYen', 'marketplaceFeesYen'],
    offsiteAdsFeesYen: ['offsiteAdsFeesYen', 'offsiteAdFeesYen'],
  }
  const acquiredSources = [
    normalized,
    row,
    row?.raw,
    row?.everbeeRow?.score?.normalized,
    row?.everbeeRow,
  ]

  return Object.fromEntries(Object.entries(aliases).map(([field, fieldAliases]) => {
    for (const source of acquiredSources) {
      for (const alias of fieldAliases) {
        const value = nonNegativeNumber(source?.[alias])
        if (value !== null) return [field, value]
      }
    }
    return [field, manual[field]]
  }))
}

export function deriveProfitStrategyAssessment(row = {}, uiState = {}) {
  const keywordKey = normalizePhrase(row.keyword)
  const manual = profitManualInputsForKeyword(uiState, keywordKey)
  const marketScore = row.everbeeRow?.score ?? null
  const normalized = marketScore?.normalized ?? row.normalized ?? {}
  const demandSupply = demandSupplyEvidence(marketScore, normalized)
  const newcomer = newcomerEvidence(normalized)
  const salesEvidence = boundedScore(
    ((finiteNumber(normalized.sellingListingCount) ?? 0) >= 3 ? 5 : (finiteNumber(normalized.sellingListingCount) ?? 0) > 0 ? 2 : 0)
      + ((finiteNumber(normalized.recentSellingListingCount) ?? 0) >= 2 ? 3 : 0)
      + ((finiteNumber(normalized.medianMonthlySales) ?? 0) >= 1 ? 3 : 0)
      + (finiteNumber(normalized.topSalesShare) !== null && finiteNumber(normalized.topSalesShare) < 0.7 ? 2 : 0),
    13,
  )
  const trendEvidence = deriveTrendFitEvidence({
    ...row,
    ...(row.raw && typeof row.raw === 'object' ? row.raw : {}),
    ...normalized,
  })
  const differentiation = [
    manual.productMatch,
    manual.presentationReady,
    manual.specificBuyer,
    manual.distinctVisual,
    manual.personalization,
  ].filter(Boolean).length * 3
  const economicsInputs = resolvedProfitEconomicsInputs(row, normalized, manual)
  const economics = scoreOrderProfitEconomics(economicsInputs)
  const profitScore = scoreProfitStrategy({
    demandSupply: demandSupply.score,
    buyerIntent: manual.buyerIntent,
    newcomerAccess: newcomer.score,
    differentiation,
    salesEvidence,
    economics: economics.score,
    trendFit: trendEvidence.score,
    evidence: {
      demandSupply: demandSupply.note,
      newcomerAccess: newcomer.note,
      salesEvidence: `EverBee: 販売商品 ${normalized.sellingListingCount ?? '-'} / 最近販売 ${normalized.recentSellingListingCount ?? '-'} / 中央値 ${normalized.medianMonthlySales ?? '-'}`,
      trendFit: trendEvidence.note,
      buyerIntent: `人判断 ${manual.buyerIntent}/15`,
      differentiation: `人判断 ${differentiation}/15`,
      economics: economics.complete
        ? `想定注文利益 ${economics.expectedProfitYen.toLocaleString('ja-JP')}円 / 目標800円`
        : '想定注文利益 未計算 / 目標800円',
    },
  })
  const rawMarketGrade = String(row.opportunityLabel ?? marketScore?.opportunityLabel ?? '').trim().toUpperCase()
  const marketGrade = ['A', 'B', 'C', 'D'].includes(rawMarketGrade) ? rawMarketGrade : ''
  const ipRisk = marketGrade === 'D' || (marketScore?.riskTerms?.length ?? 0) > 0
  const action = marketGrade
    ? decideProductAction({ marketGrade, profitScore: profitScore.total, ipRisk })
    : { action: 'pending' }

  return {
    keywordKey,
    manual,
    marketScore,
    marketGrade,
    marketValue: marketScore?.score ?? row.scoreState?.score ?? null,
    demandSupplySourceLabel: demandSupply.sourceLabel,
    economicsInputs,
    expectedProfitYen: economics.expectedProfitYen,
    trendEvidence,
    profitScore,
    action,
    actionLabel: actionLabel(action.action),
  }
}

export { EMPTY_MANUAL_INPUT }
