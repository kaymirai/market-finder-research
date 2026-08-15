import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [html, app, css] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
])
const controller = await import('../src/profit-strategy-ui.js').catch(() => ({}))

function controllerFunction(name) {
  assert.equal(typeof controller[name], 'function', `${name} must be implemented by the real UI controller`)
  return controller[name]
}

test('offers the three manually saved exploration modes in Conditions', () => {
  assert.match(html, /id="explorationModeControl"/)
  assert.match(html, /市場分散/)
  assert.match(html, /併用/)
  assert.match(html, /勝ち市場深掘り/)
})

test('shows the strategic funnel targets in a collapsible progress panel', () => {
  assert.match(html, /id="researchFunnelProgress"/)
  assert.match(html, /200/)
  assert.match(html, /15〜20/)
  assert.match(html, /4〜6/)
  assert.match(html, /25〜40/)
  assert.match(html, /eRankは任意/)
  assert.match(css, /\.research-funnel-progress/)
})

test('keeps market opportunity and product profit as separate result axes', () => {
  assert.match(html, /市場機会スコア/)
  assert.match(html, /商品化・利益スコア/)
  assert.match(html, /id="profitStrategyPanel"/)
  assert.match(app, /from '\.\/profit-strategy-ui\.js\?v=/)
  assert.match(css, /\.profit-score-pair/)
})

test('shows monthly fifty and one-hundred-thousand-yen target counts beside profit evidence', () => {
  assert.match(app, /from '\.\/monthly-profit-target\.js\?v=/)
  assert.match(app, /calculateMonthlyProfitTarget\(/)
  assert.match(app, /月5万円/)
  assert.match(app, /月10万円/)
  assert.match(app, /必要販売数/)
  assert.match(app, /推定月間販売数/)
  assert.match(css, /\.monthly-profit-target/)
})

test('saves and restores a selected exploration mode without overwriting manual profit inputs', () => {
  const restoreProfitStrategyUiState = controllerFunction('restoreProfitStrategyUiState')
  const selectExplorationMode = controllerFunction('selectExplorationMode')
  const original = restoreProfitStrategyUiState({
    selectedExplorationMode: 'M3',
    profitInputsByKeyword: {
      'retired librarian shirt': { buyerIntent: 10, productMatch: true },
    },
  })

  const changed = selectExplorationMode(original, 'M5')
  const restored = restoreProfitStrategyUiState(changed)

  assert.equal(restored.selectedExplorationMode, 'M5')
  assert.deepEqual(restored.profitInputsByKeyword, {
    'retired librarian shirt': { buyerIntent: 10, productMatch: true },
  })
  assert.equal(original.selectedExplorationMode, 'M3')
})

test('keeps manual profit inputs isolated by normalized keyword', () => {
  const updateManualProfitInput = controllerFunction('updateManualProfitInput')
  const profitManualInputsForKeyword = controllerFunction('profitManualInputsForKeyword')
  let uiState = { selectedExplorationMode: 'M1', profitInputsByKeyword: {} }

  uiState = updateManualProfitInput(uiState, {
    keyword: '  Retired   Librarian Shirt ',
    field: 'buyerIntent',
    value: 15,
  })
  uiState = updateManualProfitInput(uiState, {
    keyword: 'Book Club Shirt',
    field: 'productMatch',
    value: true,
  })

  assert.equal(profitManualInputsForKeyword(uiState, 'retired librarian shirt').buyerIntent, 15)
  assert.equal(profitManualInputsForKeyword(uiState, 'retired librarian shirt').productMatch, false)
  assert.equal(profitManualInputsForKeyword(uiState, 'book club shirt').buyerIntent, 0)
  assert.equal(profitManualInputsForKeyword(uiState, 'book club shirt').productMatch, true)
})

test('restores manual inputs across canonical ampersand, apostrophe, full-width-space, and symbol variants', () => {
  const restoreProfitStrategyUiState = controllerFunction('restoreProfitStrategyUiState')
  const updateManualProfitInput = controllerFunction('updateManualProfitInput')
  const profitManualInputsForKeyword = controllerFunction('profitManualInputsForKeyword')
  let uiState = { selectedExplorationMode: 'M1', profitInputsByKeyword: {} }

  uiState = updateManualProfitInput(uiState, {
    keyword: 'Mom & Daughter Shirt',
    field: 'buyerIntent',
    value: 15,
  })
  uiState = updateManualProfitInput(uiState, {
    keyword: "Nurse's Life Shirt",
    field: 'productMatch',
    value: true,
  })
  const restored = restoreProfitStrategyUiState(JSON.parse(JSON.stringify(uiState)))

  assert.equal(profitManualInputsForKeyword(restored, 'mom and daughter shirt').buyerIntent, 15)
  assert.equal(profitManualInputsForKeyword(restored, 'Mom　&　Daughter／Shirt!!!').buyerIntent, 15)
  assert.equal(profitManualInputsForKeyword(restored, 'Nurse’s Life Shirt').productMatch, true)
  assert.equal(profitManualInputsForKeyword(restored, 'Nurses Life Shirt').productMatch, true)
})

test('scores expected order profit with explicit boundaries up to the 800 yen target', () => {
  const scoreOrderProfitEconomics = controllerFunction('scoreOrderProfitEconomics')
  for (const [expectedProfitYen, score] of [
    [-1, 0],
    [0, 0],
    [1, 1],
    [199, 1],
    [200, 3],
    [399, 3],
    [400, 5],
    [599, 5],
    [600, 6],
    [799, 6],
    [800, 7],
  ]) {
    const result = scoreOrderProfitEconomics({
      salePriceYen: 2000,
      productCostYen: 1000,
      etsyFeesYen: 200,
      offsiteAdsFeesYen: 800 - expectedProfitYen,
    })
    assert.equal(result.expectedProfitYen, expectedProfitYen)
    assert.equal(result.score, score, `${expectedProfitYen} yen`)
  }
})

test('keeps missing or invalid economics inputs unscored', () => {
  const scoreOrderProfitEconomics = controllerFunction('scoreOrderProfitEconomics')
  assert.deepEqual(scoreOrderProfitEconomics({
    salePriceYen: 2000,
    productCostYen: 1000,
    etsyFeesYen: null,
    offsiteAdsFeesYen: 0,
  }), {
    score: 0,
    expectedProfitYen: null,
    complete: false,
  })
})

test('saves four non-negative yen inputs by normalized keyword and restores blanks as null', () => {
  const updateManualProfitInput = controllerFunction('updateManualProfitInput')
  const profitManualInputsForKeyword = controllerFunction('profitManualInputsForKeyword')
  let uiState = { selectedExplorationMode: 'M1', profitInputsByKeyword: {} }

  for (const [field, value] of [
    ['salePriceYen', '2800'],
    ['productCostYen', 1200],
    ['etsyFeesYen', 350],
    ['offsiteAdsFeesYen', 0],
  ]) {
    uiState = updateManualProfitInput(uiState, {
      keyword: '  Nurse   Retirement Shirt ',
      field,
      value,
    })
  }
  uiState = updateManualProfitInput(uiState, {
    keyword: 'Book Club Shirt',
    field: 'salePriceYen',
    value: -1,
  })
  const restored = profitManualInputsForKeyword(
    JSON.parse(JSON.stringify(uiState)),
    'nurse retirement shirt',
  )

  assert.deepEqual({
    salePriceYen: restored.salePriceYen,
    productCostYen: restored.productCostYen,
    etsyFeesYen: restored.etsyFeesYen,
    offsiteAdsFeesYen: restored.offsiteAdsFeesYen,
  }, {
    salePriceYen: 2800,
    productCostYen: 1200,
    etsyFeesYen: 350,
    offsiteAdsFeesYen: 0,
  })
  assert.equal(profitManualInputsForKeyword(uiState, 'book club shirt').salePriceYen, null)
})

test('binds input and change to immediate idempotent profit-state updates', () => {
  const bindProfitStrategyInputEvents = controllerFunction('bindProfitStrategyInputEvents')
  const updateManualProfitInput = controllerFunction('updateManualProfitInput')
  const profitManualInputsForKeyword = controllerFunction('profitManualInputsForKeyword')
  const panel = new EventTarget()
  const receivedTypes = []
  let uiState = { selectedExplorationMode: 'M1', profitInputsByKeyword: {} }
  const handler = (event) => {
    receivedTypes.push(event.type)
    uiState = updateManualProfitInput(uiState, {
      keyword: 'nurse retirement shirt',
      field: 'salePriceYen',
      value: '3000',
    })
  }

  assert.equal(bindProfitStrategyInputEvents(panel, handler), true)
  panel.dispatchEvent(new Event('input'))
  panel.dispatchEvent(new Event('change'))

  assert.deepEqual(receivedTypes, ['input', 'change'])
  assert.equal(profitManualInputsForKeyword(uiState, 'nurse retirement shirt').salePriceYen, 3000)
  assert.match(app, /bindProfitStrategyInputEvents\(elements\.profitStrategyPanel,\s*handleProfitStrategyInput\)/)
})

test('never returns a hidden row when the active final-result filter has no visible rows', () => {
  const selectVisibleProfitRow = controllerFunction('selectVisibleProfitRow')
  const visibleRows = [{ key: 'visible', keyword: 'visible keyword' }]

  assert.deepEqual(selectVisibleProfitRow([], 'hidden'), { selectedKey: '', row: null })
  assert.deepEqual(selectVisibleProfitRow(visibleRows, 'hidden'), {
    selectedKey: 'visible',
    row: visibleRows[0],
  })
  assert.deepEqual(selectVisibleProfitRow(visibleRows, 'visible'), {
    selectedKey: 'visible',
    row: visibleRows[0],
  })
})

test('scores Etsy demand and supply directly before EverBee exists and names Etsy as the source', () => {
  const deriveProfitStrategyAssessment = controllerFunction('deriveProfitStrategyAssessment')
  const result = deriveProfitStrategyAssessment({
    keyword: 'retired librarian shirt',
    normalized: {
      etsySearches30d: 640,
      etsyListings: 4200,
      etsyMarketplaceFreshness: { eligibleForRanking: true },
    },
  }, { selectedExplorationMode: 'M1', profitInputsByKeyword: {} })

  assert.ok(result.profitScore.weights.demandSupply > 0)
  assert.equal(result.demandSupplySourceLabel, 'Etsy公式')
  assert.match(result.profitScore.evidence.demandSupply, /^Etsy公式:/)
})

test('keeps an ungraded market pending instead of inventing grade C', () => {
  const deriveProfitStrategyAssessment = controllerFunction('deriveProfitStrategyAssessment')
  const result = deriveProfitStrategyAssessment({
    keyword: 'pending keyword',
    normalized: { etsySearches30d: 120, etsyListings: 8000 },
  }, { selectedExplorationMode: 'M1', profitInputsByKeyword: {} })

  assert.equal(result.marketGrade, '')
  assert.equal(result.action.action, 'pending')
  assert.equal(result.actionLabel, '根拠待ち')
})

test('uses the actual demand source on a scored market', () => {
  const deriveProfitStrategyAssessment = controllerFunction('deriveProfitStrategyAssessment')
  const baseScore = {
    score: 78,
    opportunityLabel: 'B',
    parts: { demandScore: 18, erankCompetitionScore: 14 },
    normalized: {
      keyword: 'retired librarian shirt',
      etsySearches30d: 640,
      etsyListings: 4200,
    },
    riskTerms: [],
  }
  const uiState = { selectedExplorationMode: 'M1', profitInputsByKeyword: {} }

  const etsy = deriveProfitStrategyAssessment({
    keyword: 'retired librarian shirt',
    opportunityLabel: 'B',
    everbeeRow: { score: { ...baseScore, validation: { demandSupplySource: 'etsy' } } },
  }, uiState)
  const erank = deriveProfitStrategyAssessment({
    keyword: 'retired librarian shirt',
    opportunityLabel: 'B',
    everbeeRow: { score: { ...baseScore, validation: { demandSupplySource: 'erank' } } },
  }, uiState)

  assert.equal(etsy.demandSupplySourceLabel, 'Etsy公式')
  assert.equal(erank.demandSupplySourceLabel, 'eRank')
  assert.match(erank.profitScore.evidence.demandSupply, /^eRank:/)
})

test('uses acquired yen values before manual fallbacks and never reuses product checks as profit', () => {
  const deriveProfitStrategyAssessment = controllerFunction('deriveProfitStrategyAssessment')
  const result = deriveProfitStrategyAssessment({
    keyword: 'retired librarian shirt',
    normalized: {
      salePriceYen: 2800,
      productCostYen: 1200,
      etsyFeesYen: 400,
      offsiteAdsFeesYen: 400,
    },
  }, {
    selectedExplorationMode: 'M1',
    profitInputsByKeyword: {
      'retired librarian shirt': {
        salePriceYen: 1000,
        productCostYen: 900,
        etsyFeesYen: 100,
        offsiteAdsFeesYen: 100,
        productMatch: true,
        presentationReady: true,
      },
    },
  })

  assert.equal(result.expectedProfitYen, 800)
  assert.equal(result.profitScore.weights.economics, 7)
  assert.equal(result.profitScore.evidence.economics, '想定注文利益 800円 / 目標800円')

  const checksOnly = deriveProfitStrategyAssessment({
    keyword: 'checks only',
    normalized: {},
  }, {
    selectedExplorationMode: 'M1',
    profitInputsByKeyword: {
      'checks only': { productMatch: true, presentationReady: true },
    },
  })
  assert.equal(checksOnly.profitScore.weights.economics, 0)
})

test('does not score freshness alone as trend evidence', () => {
  const deriveProfitStrategyAssessment = controllerFunction('deriveProfitStrategyAssessment')
  const result = deriveProfitStrategyAssessment({
    keyword: 'fresh only',
    normalized: {
      etsyMarketplaceFreshness: { eligibleForRanking: true },
      everbeeFreshness: { eligibleForRanking: true },
    },
  })

  assert.equal(result.profitScore.weights.trendFit, 0)
  assert.equal(result.profitScore.evidence.trendFit, '傾向根拠: 未取得')
})

test('scores each explicit trend source and gives full points for multiple sources', () => {
  const deriveTrendFitEvidence = controllerFunction('deriveTrendFitEvidence')
  assert.equal(deriveTrendFitEvidence({ hasCountryComparison: false }).score, 0)
  for (const [input, label] of [
    [{ marketplaceInsightsHistory: [{ searches: 10 }, { searches: 20 }] }, 'Marketplace Insights時系列'],
    [{ countryComparison: { US: 100, JP: 80 } }, '国比較'],
    [{ googleTrends: { value: 64 } }, 'Google Trends'],
    [{ erankTrend: 'Rising' }, 'eRank trend'],
  ]) {
    const result = deriveTrendFitEvidence(input)
    assert.equal(result.score, 3, label)
    assert.deepEqual(result.labels, [label])
  }

  const multiple = deriveTrendFitEvidence({
    etsySearchTrendPercent: 22,
    googleTrends: { value: 64 },
  })
  assert.equal(multiple.score, 5)
  assert.deepEqual(multiple.labels, ['Marketplace Insights時系列', 'Google Trends'])
})

test('composes only saved Google and country evidence for a final result row', () => {
  const composeFinalTrendEvidence = controllerFunction('composeFinalTrendEvidence')
  const fromGoogle = composeFinalTrendEvidence({
    candidate: {
      keyword: 'retired librarian shirt',
      sourceLabel: '今回の自動探索で追加',
      sourceDetail: 'Google Trends',
      sourceAt: '2026-07-20T00:00:00.000Z',
    },
    raw: {
      countryComparison: { US: 72, CA: 49 },
      erankTrend: 'Rising',
    },
    normalized: {},
    marketplaceResult: { etsySearchTrendPercent: 18 },
  })

  assert.deepEqual(fromGoogle.googleTrendsEvidence, {
    keyword: 'retired librarian shirt',
    source: 'Google Trends',
    capturedAt: '2026-07-20T00:00:00.000Z',
  })
  assert.deepEqual(fromGoogle.countryComparison, { US: 72, CA: 49 })
  assert.equal(fromGoogle.etsySearchTrendPercent, 18)
  assert.equal(fromGoogle.erankTrend, 'Rising')

  const absent = composeFinalTrendEvidence({
    candidate: { keyword: 'pinterest only', sourceDetail: 'Pinterest' },
    raw: {},
    normalized: {},
    marketplaceResult: {},
  })
  assert.deepEqual(absent, {
    googleTrendsEvidence: null,
    countryComparison: null,
    etsySearchTrendPercent: null,
    erankTrend: null,
  })
})

test('renders four short yen inputs and evidence labels without changing the market card', () => {
  for (const field of ['salePriceYen', 'productCostYen', 'etsyFeesYen', 'offsiteAdsFeesYen']) {
    assert.match(app, new RegExp(`data-profit-input="${field}"`), field)
  }
  assert.match(app, /想定注文利益/)
  assert.match(app, /目標800円/)
  assert.match(app, /傾向根拠/)
  assert.match(html, /注文利益と人の判断/)
  assert.match(app, /市場の需要・競合は変更しません/)
})

test('passes saved Marketplace Insights trend evidence into the selected final row', () => {
  assert.match(
    app,
    /composeFinalTrendEvidence\(\{[\s\S]*candidate,[\s\S]*raw,[\s\S]*normalized,[\s\S]*marketplaceResult:\s*planItem\?\.result/,
  )
})

test('changing profit inputs through the controller cannot mutate an existing market score object', () => {
  const deriveProfitStrategyAssessment = controllerFunction('deriveProfitStrategyAssessment')
  const marketScore = {
    score: 78,
    opportunityLabel: 'B',
    validation: { demandSupplySource: 'etsy' },
    parts: { demandScore: 18, erankCompetitionScore: 14 },
    normalized: {
      keyword: 'retired librarian shirt',
      etsySearches30d: 640,
      etsyListings: 4200,
      medianSellerReviews: 84,
    },
    riskTerms: [],
  }
  const before = JSON.stringify(marketScore)
  const row = {
    keyword: 'retired librarian shirt',
    opportunityLabel: 'B',
    everbeeRow: { score: marketScore },
  }
  const first = deriveProfitStrategyAssessment(row, {
    selectedExplorationMode: 'M1',
    profitInputsByKeyword: {
      'retired librarian shirt': { buyerIntent: 5, differentiation: false },
    },
  })
  const second = deriveProfitStrategyAssessment(row, {
    selectedExplorationMode: 'M1',
    profitInputsByKeyword: {
      'retired librarian shirt': {
        buyerIntent: 15,
        productMatch: true,
        presentationReady: true,
        specificBuyer: true,
        distinctVisual: true,
        personalization: true,
      },
    },
  })

  assert.notEqual(first.profitScore.total, second.profitScore.total)
  assert.equal(JSON.stringify(marketScore), before)
})
