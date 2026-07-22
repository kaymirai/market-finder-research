#!/usr/bin/env node
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'

const backgroundSource = await readFile(new URL('../dist/background.js', import.meta.url), 'utf8')
const backgroundTypeScriptSource = await readFile(new URL('../src/background.ts', import.meta.url), 'utf8')
const erankContentTypeScriptSource = await readFile(new URL('../src/erankContent.ts', import.meta.url), 'utf8')
const bridgeSource = await readFile(new URL('../dist/marketFinderBridge.js', import.meta.url), 'utf8')
const everbeeSource = await readFile(new URL('../dist/everbeeContent.js', import.meta.url), 'utf8')

function createChromeMock() {
  return {
    runtime: {
      lastError: undefined,
      onInstalled: { addListener() {} },
      onMessage: { addListener() {} },
    },
  }
}

test('records eRank attempts even when metric capture fails', () => {
  assert.match(backgroundTypeScriptSource, /erankAttemptedAt\?: string/)
  assert.match(backgroundTypeScriptSource, /erankAttemptedAt: marketMode === 'erank' \? attemptedAt : ''/)
})

test('waits for slow eRank metric columns before timing out the keyword', () => {
  const metricWait = Number(erankContentTypeScriptSource.match(/ERANK_METRICS_READY_TIMEOUT_MS\s*=\s*(\d+)/)?.[1])
  const keywordWait = Number(backgroundTypeScriptSource.match(/MARKET_KEYWORD_TIMEOUT_MS\s*=\s*(\d+)/)?.[1])

  assert.ok(metricWait >= 180000, `expected metric wait >= 180000ms, received ${metricWait}`)
  assert.ok(keywordWait >= metricWait + 30000, `expected outer timeout to exceed metric wait, received ${keywordWait}`)
  assert.match(erankContentTypeScriptSource, /Date\.now\(\) - startedAt < ERANK_METRICS_READY_TIMEOUT_MS/)
})

test('starts the eRank fail-safe timeout when the search request is sent', () => {
  const runner = backgroundTypeScriptSource.match(/async function runKeywordInErankTab[\s\S]*?(?=\n    function sendEverbeeMessage)/)?.[0] ?? ''

  assert.doesNotMatch(runner, /await activateTab\(tabId\)\s+const firstTry/)
  assert.match(runner, /withTimeout\(\s*sendErankMessage\(tabId, keyword\)/)
  assert.doesNotMatch(backgroundTypeScriptSource, /runKeywordInErankTab\(await ensureErankTab\(\), keyword\)/)
})

test('redirects an eRank dashboard tab to Keyword Tool before searching', () => {
  assert.match(backgroundTypeScriptSource, /function isErankKeywordToolUrl\(/)
  assert.match(backgroundTypeScriptSource, /async function prepareErankTab\(/)
  assert.match(backgroundTypeScriptSource, /updateTabUrlAndActivate\(tabId, marketErankUrl\)/)
  assert.match(backgroundTypeScriptSource, /await waitForTabComplete\(tabId\)/)
  assert.ok((backgroundTypeScriptSource.match(/prepareErankTab\(/g) ?? []).length >= 3)
})

function visibleElement(innerText = '') {
  return {
    innerText,
    parentElement: null,
    nextElementSibling: null,
    getBoundingClientRect() {
      return { width: 100, height: 20 }
    },
    querySelectorAll() {
      return []
    },
  }
}

function marketplaceDocument(fixture) {
  const input = visibleElement()
  input.value = fixture.query
  const summaryRow = visibleElement(fixture.summary)

  const makeRow = (item) => {
    const cells = [item.keyword, item.searches, item.listings, item.conversion].map(visibleElement)
    const row = visibleElement(cells.map((cell) => cell.innerText).join('\n'))
    row.querySelectorAll = () => cells
    return row
  }
  const rows = fixture.related.map(makeRow)
  const outsideRows = (fixture.outsideRelated ?? []).map(makeRow)
  const relatedScope = visibleElement()
  relatedScope.querySelectorAll = (selector) => selector.includes('tbody tr') || selector.includes('[role="row"]')
    ? rows
    : []
  const heading = visibleElement(fixture.heading)
  heading.parentElement = relatedScope
  heading.closest = () => relatedScope

  const summary = visibleElement(fixture.summary)
  const root = visibleElement(`${fixture.summary}\n${fixture.remaining}`)
  root.querySelectorAll = (selector) => {
    if (selector.includes('input[type="search"]')) return [input]
    if (selector.includes('section, article')) return [summary, heading, ...rows]
    if (selector === 'table tbody tr, [role="row"]') return [...outsideRows, ...rows]
    if (selector === 'tr, [role="row"]') return [summaryRow, ...outsideRows, ...rows]
    if (selector.includes('h2, h3, h4')) return [heading]
    return []
  }

  return {
    body: root,
    querySelector() {
      return root
    },
  }
}

function everbeeGridDocument(rows) {
  const elements = rows.flatMap((row) => {
    const makeCell = (field, value) => ({
      innerText: String(value ?? ''),
      getAttribute(name) {
        return name === 'data-field' ? field : null
      },
    })
    const makeRow = (cells) => ({
      getAttribute(name) {
        if (name === 'data-id') return row.id
        if (name === 'data-rowindex') return String(row.index)
        return null
      },
      querySelectorAll(selector) {
        return selector.includes('[role="cell"]') ? cells : []
      },
    })

    return [
      makeRow([makeCell('product', row.title)]),
      makeRow([
        makeCell('totalSales', row.totalSales),
        makeCell('sales', row.monthlySales),
        makeCell('revenue', row.revenue),
        makeCell('listingAge', row.listingAge),
        makeCell('price', row.price),
        makeCell('shopName', row.shopName),
      ]),
    ]
  })

  return {
    body: { innerText: '' },
    querySelectorAll(selector) {
      return selector === '[role="row"][data-id]' ? elements.reverse() : []
    },
  }
}

test('joins EverBee product and metric rows by data-id and sorts by monthly sales', () => {
  const hooks = {}
  const document = everbeeGridDocument([
    {
      id: 'listing-a',
      index: 0,
      title: 'Fresh Book Club Teacher Shirt',
      totalSales: '140',
      monthlySales: '42',
      revenue: '$1,260',
      listingAge: '6 Mo.',
      price: '$30.00',
      shopName: 'FreshShop',
    },
    {
      id: 'listing-b',
      index: 1,
      title: 'Older Cat Shirt',
      totalSales: '3,100',
      monthlySales: '85',
      revenue: '$1,700',
      listingAge: '31 Mo.',
      price: '$20.00',
      shopName: 'OldShop',
    },
  ])

  runInNewContext(everbeeSource, {
    __ETSY_MIRAI_TEST_HOOKS__: hooks,
    chrome: createChromeMock(),
    clearTimeout,
    console,
    document,
    location: { href: 'https://app.everbee.io/product-analytics', pathname: '/product-analytics' },
    setTimeout,
    URL,
    window: { setTimeout },
  })

  assert.equal(typeof hooks.extractEverbeeProductRows, 'function')
  const result = hooks.extractEverbeeProductRows()
  assert.deepEqual(Array.from(result, (row) => ({ ...row })), [
    {
      listingId: 'listing-b',
      title: 'Older Cat Shirt',
      totalSales: 3100,
      monthlySales: 85,
      monthlyRevenue: 1700,
      listingAge: '31 Mo.',
      listingAgeMonths: 31,
      price: 20,
      shopName: 'OldShop',
    },
    {
      listingId: 'listing-a',
      title: 'Fresh Book Club Teacher Shirt',
      totalSales: 140,
      monthlySales: 42,
      monthlyRevenue: 1260,
      listingAge: '6 Mo.',
      listingAgeMonths: 6,
      price: 30,
      shopName: 'FreshShop',
    },
  ])
})

test('reloads open Market Finder tabs when an unpacked extension is reloaded', () => {
  let installedListener = null
  let queryOptions = null
  const reloadedTabIds = []

  const chrome = {
    runtime: {
      lastError: undefined,
      onInstalled: {
        addListener(listener) {
          installedListener = listener
        },
      },
      onMessage: {
        addListener() {},
      },
    },
    tabs: {
      query(options, callback) {
        queryOptions = options
        callback([{ id: 17 }, { id: 29 }, { id: undefined }])
      },
      reload(tabId, _options, callback) {
        reloadedTabIds.push(tabId)
        callback?.()
      },
    },
  }

  runInNewContext(backgroundSource, {
    chrome,
    clearTimeout,
    console,
    fetch,
    setTimeout,
    URL,
  })

  assert.equal(typeof installedListener, 'function')
  installedListener({ reason: 'update' })
  assert.deepEqual(Array.from(queryOptions.url), [
    'http://localhost:3021/*',
    'http://127.0.0.1:3021/*',
    'http://localhost:4173/*',
    'http://127.0.0.1:4173/*',
  ])
  assert.deepEqual(reloadedTabIds, [17, 29])
})

test('retries Etsy Marketplace Insights capture until usable metrics are ready', async () => {
  const hooks = {}
  runInNewContext(backgroundSource, {
    __ETSY_MIRAI_TEST_HOOKS__: hooks,
    chrome: createChromeMock(),
    clearTimeout,
    console,
    fetch,
    setTimeout,
    URL,
  })

  assert.equal(typeof hooks.waitForEtsyMarketplaceInsightResult, 'function')
  let attempts = 0
  const result = await hooks.waitForEtsyMarketplaceInsightResult(
    async () => {
      attempts += 1
      return attempts < 3
        ? { ok: false, error: 'results are still loading' }
        : { ok: true, keyword: 'cat meme shirt', etsySearches30d: 42, etsyListings: 810 }
    },
    async () => {},
    { attempts: 4, initialDelayMs: 0, retryDelayMs: 0 },
  )

  assert.equal(attempts, 3)
  assert.equal(result.ok, true)
  assert.equal(result.etsySearches30d, 42)
})

test('retries a transient Etsy capture exception before stopping automation', async () => {
  const hooks = {}
  runInNewContext(backgroundSource, {
    __ETSY_MIRAI_TEST_HOOKS__: hooks,
    chrome: createChromeMock(),
    clearTimeout,
    console,
    fetch,
    setTimeout,
    URL,
  })

  let attempts = 0
  const result = await hooks.waitForEtsyMarketplaceInsightResult(
    async () => {
      attempts += 1
      if (attempts === 1) throw new Error('page is updating')
      return { ok: true, keyword: 'cat meme shirt', etsySearches30d: 42, etsyListings: 810 }
    },
    async () => {},
    { attempts: 3, initialDelayMs: 0, retryDelayMs: 0 },
  )

  assert.equal(attempts, 2)
  assert.equal(result.ok, true)
})

test('forwards the automatic Etsy search and capture request through the page bridge', () => {
  assert.match(bridgeSource, /RUN_AND_CAPTURE_ETSY_MARKETPLACE_INSIGHT/)
})

test('extracts related keyword metrics from Japanese and English Marketplace Insights', () => {
  const fixtures = [
    {
      query: 'halloween ghost shirt',
      heading: '似たような検索ワード',
      summary: 'あなたの検索\nhalloween ghost shirt\n検索\n520\n+29.9%\n検索結果\n157.2 千\nコンバージョン率\nとても低い',
      remaining: '今週の無料検索 残り14回',
      related: [
        { keyword: 'cute halloween ghost shirt', searches: '18', listings: '142.2 千', conversion: 'とても低い' },
        { keyword: 'boo spooky striped halloween ghost shirt', searches: '7', listings: '2.2 千', conversion: 'とても低い' },
      ],
    },
    {
      query: 'halloween ghost shirt',
      heading: 'Similar search terms',
      summary: 'Your search\nhalloween ghost shirt\nSearches\n520\n+29.9%\nSearch results\n157.2K\nConversion rate\nVery low',
      remaining: '14 free searches remaining',
      related: [
        { keyword: 'cute halloween ghost shirt', searches: '18', listings: '142.2K', conversion: 'Very low' },
        { keyword: 'boo spooky striped halloween ghost shirt', searches: '7', listings: '2.2K', conversion: 'Very low' },
      ],
    },
  ]

  for (const fixture of fixtures) {
    const hooks = {}
    const document = marketplaceDocument(fixture)
    const window = {
      getComputedStyle() {
        return { display: 'block', visibility: 'visible' }
      },
    }
    runInNewContext(backgroundSource, {
      __ETSY_MIRAI_TEST_HOOKS__: hooks,
      chrome: createChromeMock(),
      clearTimeout,
      console,
      document,
      fetch,
      setTimeout,
      URL,
      window,
    })

    assert.equal(typeof hooks.extractEtsyMarketplaceInsightInPage, 'function')
    const result = hooks.extractEtsyMarketplaceInsightInPage(fixture.query)
    assert.equal(result.etsySearches30d, 520)
    assert.equal(result.etsyListings, 157200)
    assert.equal(result.etsySearchTrendPercent, 29.9)
    assert.deepEqual(Array.from(result.etsyRelatedTerms), fixture.related.map((item) => item.keyword))
    assert.deepEqual(
      Array.from(result.etsyRelatedKeywordMetrics, (item) => ({ ...item })),
      [
        { keyword: 'cute halloween ghost shirt', etsySearches30d: 18, etsyListings: 142200, conversionLabel: fixture.related[0].conversion },
        { keyword: 'boo spooky striped halloween ghost shirt', etsySearches30d: 7, etsyListings: 2200, conversionLabel: fixture.related[1].conversion },
      ],
    )
    assert.equal(result.remainingSearches, 14)
  }
})

test('keeps more than 20 visible related rows in Japanese and English', () => {
  for (const language of ['ja', 'en']) {
    const related = Array.from({ length: 30 }, (_, index) => ({
      keyword: `halloween niche ${index + 1} shirt`,
      searches: String(100 - index),
      listings: String(1000 + index),
      conversion: language === 'ja' ? '普通' : 'Medium',
    }))
    const fixture = {
      query: 'halloween shirt',
      heading: language === 'ja' ? '似たような検索ワード' : 'Similar search terms',
      summary: language === 'ja'
        ? 'あなたの検索\nhalloween shirt\n検索\n800\n検索結果\n200 千\nコンバージョン率\n低い'
        : 'Your search\nhalloween shirt\nSearches\n800\nSearch results\n200K\nConversion rate\nLow',
      remaining: '',
      related,
    }
    const hooks = {}
    const document = marketplaceDocument(fixture)
    const window = {
      getComputedStyle() {
        return { display: 'block', visibility: 'visible' }
      },
    }
    runInNewContext(backgroundSource, {
      __ETSY_MIRAI_TEST_HOOKS__: hooks,
      chrome: createChromeMock(),
      clearTimeout,
      console,
      document,
      fetch,
      setTimeout,
      URL,
      window,
    })

    const result = hooks.extractEtsyMarketplaceInsightInPage(fixture.query)
    assert.equal(result.etsyRelatedTerms.length, 30)
    assert.equal(result.etsyRelatedKeywordMetrics.length, 30)
  }
})

test('scopes Exploration ideas to its own related rows', () => {
  const fixture = {
    query: 'halloween ghost shirt',
    heading: 'Exploration ideas',
    summary: 'Your search\nhalloween ghost shirt\nSearches\n520\nSearch results\n157.2K\nConversion rate\nVery low',
    remaining: '',
    related: [
      { keyword: 'french ghost halloween t-shirt', searches: '34', listings: '46', conversion: 'Very low' },
    ],
    outsideRelated: [
      { keyword: 'unrelated navigation shirt', searches: '999', listings: '1', conversion: 'Very high' },
    ],
  }
  const hooks = {}
  const document = marketplaceDocument(fixture)
  const window = {
    getComputedStyle() {
      return { display: 'block', visibility: 'visible' }
    },
  }
  runInNewContext(backgroundSource, {
    __ETSY_MIRAI_TEST_HOOKS__: hooks,
    chrome: createChromeMock(),
    clearTimeout,
    console,
    document,
    fetch,
    setTimeout,
    URL,
    window,
  })

  const result = hooks.extractEtsyMarketplaceInsightInPage(fixture.query)
  assert.deepEqual(Array.from(result.etsyRelatedTerms), ['french ghost halloween t-shirt'])
  assert.equal(result.etsyRelatedKeywordMetrics.length, 1)
})

test('merges similar terms and exploration ideas into one Etsy capture', () => {
  const hooks = {}
  runInNewContext(backgroundSource, {
    __ETSY_MIRAI_TEST_HOOKS__: hooks,
    chrome: createChromeMock(),
    clearTimeout,
    console,
    fetch,
    setTimeout,
    URL,
  })

  assert.equal(typeof hooks.mergeEtsyMarketplaceInsightResults, 'function')
  const base = {
    ok: true,
    keyword: 'halloween ghost shirt',
    etsySearches30d: 520,
    etsyListings: 157200,
    etsySearchTrendPercent: 29.9,
    etsyCheckedAt: '2026-07-20T00:00:00.000Z',
    remainingSearches: null,
  }
  const merged = hooks.mergeEtsyMarketplaceInsightResults([
    {
      mode: 'similar',
      result: {
        ...base,
        etsyRelatedTerms: ['cute halloween ghost shirt', 'shared halloween ghost shirt'],
        etsyRelatedKeywordMetrics: [
          { keyword: 'cute halloween ghost shirt', etsySearches30d: 18, etsyListings: 142200, conversionLabel: 'Very low' },
          { keyword: 'shared halloween ghost shirt', etsySearches30d: 20, etsyListings: 5000, conversionLabel: 'Low' },
        ],
      },
    },
    {
      mode: 'explore',
      result: {
        ...base,
        etsyRelatedTerms: ['french ghost halloween t-shirt', 'shared halloween ghost shirt'],
        etsyRelatedKeywordMetrics: [
          { keyword: 'french ghost halloween t-shirt', etsySearches30d: 34, etsyListings: 46, conversionLabel: 'Very low' },
          { keyword: 'shared halloween ghost shirt', etsySearches30d: 22, etsyListings: 4800, conversionLabel: 'Medium' },
        ],
      },
    },
  ])

  assert.deepEqual(Array.from(merged.etsyRelatedModes), ['similar', 'explore'])
  assert.deepEqual(Array.from(merged.etsyRelatedTerms), [
    'cute halloween ghost shirt',
    'shared halloween ghost shirt',
    'french ghost halloween t-shirt',
  ])
  const shared = merged.etsyRelatedKeywordMetrics.find((item) => item.keyword === 'shared halloween ghost shirt')
  const frenchGhost = merged.etsyRelatedKeywordMetrics.find((item) => item.keyword === 'french ghost halloween t-shirt')
  assert.deepEqual({ ...shared, sourceModes: Array.from(shared.sourceModes) }, {
    keyword: 'shared halloween ghost shirt',
    etsySearches30d: 22,
    etsyListings: 4800,
    conversionLabel: 'Medium',
    sourceModes: ['similar', 'explore'],
  })
  assert.deepEqual(Array.from(frenchGhost.sourceModes), ['explore'])
})

test('switches between similar and exploration views in Japanese and English', async () => {
  for (const labels of [
    { similar: '似たようなワード', explore: '探索のアイデア' },
    { similar: 'Similar words', explore: 'Exploration ideas' },
  ]) {
    let inputs = []
    class FakeInput {
      constructor(mode, label, checked) {
        this.mode = mode
        this.label = label
        this.checked = checked
        this.parentElement = null
        this.previousElementSibling = null
        this.nextElementSibling = null
      }

      getBoundingClientRect() {
        return { width: 100, height: 20 }
      }

      getAttribute(name) {
        if (name === 'aria-label') return this.label
        if (name === 'aria-checked') return this.checked ? 'true' : 'false'
        return null
      }

      closest() {
        return null
      }

      click() {
        inputs.forEach((input) => { input.checked = false })
        this.checked = true
      }
    }

    inputs = [
      new FakeInput('similar', labels.similar, true),
      new FakeInput('explore', labels.explore, false),
    ]
    const hooks = {}
    const document = {
      querySelectorAll() {
        return inputs
      },
      getElementById() {
        return null
      },
    }
    const window = {
      getComputedStyle() {
        return { display: 'block', visibility: 'visible' }
      },
      setTimeout,
    }
    runInNewContext(backgroundSource, {
      __ETSY_MIRAI_TEST_HOOKS__: hooks,
      chrome: createChromeMock(),
      clearTimeout,
      console,
      document,
      fetch,
      HTMLInputElement: FakeInput,
      setTimeout,
      URL,
      window,
    })

    const current = await hooks.switchEtsyMarketplaceRelatedModeInPage('current')
    const switched = await hooks.switchEtsyMarketplaceRelatedModeInPage('explore')
    assert.equal(current.mode, 'similar')
    assert.equal(switched.found, true)
    assert.equal(switched.mode, 'explore')
    assert.equal(inputs[1].checked, true)
  }
})
