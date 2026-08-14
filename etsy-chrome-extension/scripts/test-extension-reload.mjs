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
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'))

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

test('fails a stalled EverBee keyword before Chrome can terminate the worker', () => {
  const everbeeKeywordWait = Number(backgroundTypeScriptSource.match(/MARKET_KEYWORD_TIMEOUT_MS\s*=\s*(\d+)/)?.[1])

  // Manifest V3 terminates a single service-worker request after five minutes.
  // The queue must fail forward before that boundary or it can freeze forever.
  assert.ok(
    everbeeKeywordWait > 30000 && everbeeKeywordWait < 300000,
    `expected EverBee timeout between 30s and Chrome's 5-minute limit, received ${everbeeKeywordWait}`,
  )
})

test('waits for slow eRank metric columns before timing out the keyword', () => {
  const metricWait = Number(erankContentTypeScriptSource.match(/ERANK_METRICS_READY_TIMEOUT_MS\s*=\s*(\d+)/)?.[1])
  const erankKeywordWait = Number(backgroundTypeScriptSource.match(/ERANK_KEYWORD_TIMEOUT_MS\s*=\s*(\d+)/)?.[1])

  assert.ok(metricWait >= 180000, `expected metric wait >= 180000ms, received ${metricWait}`)
  // A keyword whose metrics never render must not hold the queue for the full inner wait,
  // but the outer bound still has to outlast the inner one or the two overlap on the tab.
  assert.ok(
    erankKeywordWait >= metricWait + 30000,
    `expected eRank outer timeout to exceed metric wait, received ${erankKeywordWait}`,
  )
  assert.match(erankContentTypeScriptSource, /startedAt - hiddenMs < ERANK_METRICS_READY_TIMEOUT_MS/)
})

test('does not spend the metric wait while the research tab is hidden', () => {
  // Chrome clamps timers and skips lazy rendering in hidden tabs, so time spent there is
  // not time the page had a chance to load.
  assert.match(erankContentTypeScriptSource, /function waitVisible/)
  assert.match(erankContentTypeScriptSource, /document\.visibilityState === 'hidden'/)
  assert.match(erankContentTypeScriptSource, /REQUEST_RESEARCH_TAB_FOCUS/)
  assert.match(backgroundTypeScriptSource, /request\.action === 'REQUEST_RESEARCH_TAB_FOCUS'/)
})

test('submits the eRank search with Enter and only falls back to a nearby button', () => {
  const submit = erankContentTypeScriptSource.match(/async function submitSearch[\s\S]*?\n    \}/)?.[0] ?? ''

  // eRank's field is not in a form, so a page-wide text match hits "Go to Dashboard".
  assert.match(erankContentTypeScriptSource, /SEARCH_BUTTON_NEGATIVE_WORDS/)
  assert.match(erankContentTypeScriptSource, /dashboard/)
  assert.match(erankContentTypeScriptSource, /function findSubmitButtonNear/)
  assert.match(submit, /KeyboardEvent\('keydown', \{ key: 'Enter'/)
  assert.match(submit, /searchLooksStarted/)
  assert.doesNotMatch(erankContentTypeScriptSource, /SEARCH_BUTTON_WORDS = \[[^\]]*'go'/)
})

test('finishes stable eRank rows whose demand metrics are explicitly unavailable', () => {
  assert.match(erankContentTypeScriptSource, /targetDemandNoData/)
  assert.match(erankContentTypeScriptSource, /targetDemandResolved/)
  assert.match(erankContentTypeScriptSource, /erankCaptureStatus/)
  assert.match(erankContentTypeScriptSource, /no-data/)
})

test('recognizes the current eRank no-data result before waiting for metric columns', () => {
  assert.match(erankContentTypeScriptSource, /could not find data for/i)
  assert.match(erankContentTypeScriptSource, /if \(pageHasNoDataMessage\(\)\) return extractMetrics\(keyword\)/)
})

test('waits for Competition and treats KD as optional after a short grace period', () => {
  const readiness = erankContentTypeScriptSource.match(/async function waitForKeywordIdeasMetricsReady[\s\S]*?(?=\n    function describeElement)/)?.[0] ?? ''
  const targetReady = readiness.match(/const targetReady = ([\s\S]*?)(?=\n\s*const competitionReady)/)?.[1] ?? ''

  assert.match(erankContentTypeScriptSource, /ERANK_KD_GRACE_AFTER_COMPETITION_MS/)
  assert.match(readiness, /competitionReadyAt/)
  assert.match(readiness, /targetCompetitionResolved/)
  assert.match(readiness, /kdGraceElapsed/)
  assert.match(readiness, /const partialLoadResolved = snapshot\.targetFound/)
  assert.match(readiness, /\? !snapshot\.targetPartial/)
  assert.doesNotMatch(targetReady, /targetKdResolved/)
})

test('selects the visual keyword row that covers the Competition and KD columns', () => {
  const rowFinder = erankContentTypeScriptSource.match(/function findVisualRowForKeyword[\s\S]*?(?=\n    function textLooksLikeKeywordCell)/)?.[0] ?? ''

  assert.match(erankContentTypeScriptSource, /function visualColumnCoverageCount/)
  assert.match(rowFinder, /visualColumnCoverageCount/)
  assert.match(rowFinder, /coverage/)
})

test('wakes on eRank DOM changes and retains a finite safety timeout', () => {
  const metricWait = Number(erankContentTypeScriptSource.match(/ERANK_METRICS_READY_TIMEOUT_MS\s*=\s*(\d+)/)?.[1])
  const erankKeywordWait = Number(backgroundTypeScriptSource.match(/ERANK_KEYWORD_TIMEOUT_MS\s*=\s*(\d+)/)?.[1])

  assert.ok(metricWait >= 300000, `expected metric wait >= 300000ms, received ${metricWait}`)
  assert.ok(erankKeywordWait >= metricWait + 30000, `expected eRank outer timeout to exceed metric wait, received ${erankKeywordWait}`)
  assert.match(erankContentTypeScriptSource, /function waitForMetricDomChange\(/)
  assert.match(erankContentTypeScriptSource, /new MutationObserver\(/)
  assert.match(erankContentTypeScriptSource, /await waitForMetricDomChange\(\)/)
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

test('stops the eRank queue when the daily keyword lookup limit is reached', () => {
  const processor = backgroundTypeScriptSource.match(/async function processNextMarketKeyword[\s\S]*?(?=\n    async function runEverbeeKeyword)/)?.[0] ?? ''

  assert.match(erankContentTypeScriptSource, /function pageHasDailyLookupLimit\(/)
  assert.ok(erankContentTypeScriptSource.includes('keyword lookups?\\/day'))
  assert.match(backgroundTypeScriptSource, /ERANK_DAILY_LOOKUP_LIMIT_REACHED/)
  assert.match(backgroundTypeScriptSource, /function isErankDailyLimitError\(/)
  assert.match(processor, /marketQueue\.unshift\(keyword\)/)
  assert.match(processor, /marketActive = false/)
  assert.match(processor, /focusMarketFinderTab\(\)/)
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
        ...(row.reviews === undefined ? [] : [makeCell(row.reviewField ?? 'reviews', row.reviews)]),
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

// EverBee renders its grid with MUI DataGrid column virtualisation: cells to the right of
// the viewport are absent from the DOM until the grid is scrolled, and are removed again
// when it scrolls back.
function everbeeVirtualisedGridDocument(rows, hiddenFields) {
  let scrollLeft = 0
  const scroller = {
    className: 'MuiDataGrid-virtualScroller',
    scrollWidth: 3000,
    clientWidth: 850,
    get scrollLeft() {
      return scrollLeft
    },
    set scrollLeft(value) {
      scrollLeft = value
    },
  }

  const makeCell = (field, value) => ({
    innerText: String(value ?? ''),
    getAttribute(name) {
      return name === 'data-field' ? field : null
    },
  })

  const rowElements = rows.map((row) => ({
    getAttribute(name) {
      if (name === 'data-id') return row.id
      if (name === 'data-rowindex') return String(row.index)
      return null
    },
    querySelectorAll(selector) {
      if (!selector.includes('[role="cell"]')) return []
      const visible = [
        makeCell('product', row.title),
        makeCell('totalSales', row.totalSales),
        makeCell('sales', row.monthlySales),
        makeCell('revenue', row.revenue),
        makeCell('listingAge', row.listingAge),
        makeCell('price', row.price),
        makeCell('shopName', row.shopName),
      ]
      // Only revealed once the grid has been scrolled far enough right.
      if (scrollLeft < 1200) return visible
      return [...visible, ...hiddenFields.map((field) => makeCell(field, row[field]))]
    },
  }))

  return {
    body: { innerText: '' },
    querySelector(selector) {
      return selector.includes('MuiDataGrid-virtualScroller') ? scroller : null
    },
    querySelectorAll(selector) {
      return selector === '[role="row"][data-id]' ? rowElements : []
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
      reviews: null,
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
      reviews: null,
    },
  ])
})

test('sweeps the virtualised grid so off-screen columns are not silently lost', async () => {
  const hooks = {}
  const document = everbeeVirtualisedGridDocument([
    {
      id: 'listing-a',
      index: 0,
      title: 'Reviewed Shirt',
      totalSales: '140',
      monthlySales: '42',
      revenue: '$1,260',
      listingAge: '6 Mo.',
      price: '$30.00',
      shopName: 'FreshShop',
      reviews: '312',
    },
  ], ['reviews'])

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

  // Reading only what is on screen misses the review column entirely.
  assert.equal(hooks.extractEverbeeProductRows()[0].reviews, null)

  const swept = await hooks.extractEverbeeProductRowsWithHiddenColumns()
  assert.equal(swept[0].reviews, 312)
  assert.equal(swept[0].title, 'Reviewed Shirt')
})

test('reads seller review counts without dropping rows that have none', () => {
  const hooks = {}
  const document = everbeeGridDocument([
    {
      id: 'listing-a',
      index: 0,
      title: 'Reviewed Shirt',
      totalSales: '140',
      monthlySales: '42',
      revenue: '$1,260',
      listingAge: '6 Mo.',
      price: '$30.00',
      shopName: 'FreshShop',
      reviews: '1,204',
    },
    {
      id: 'listing-b',
      index: 1,
      title: 'Renamed Column Shirt',
      totalSales: '90',
      monthlySales: '20',
      revenue: '$400',
      listingAge: '4 Mo.',
      price: '$20.00',
      shopName: 'OtherShop',
      reviews: '17',
      reviewField: 'totalReviews',
    },
    {
      id: 'listing-c',
      index: 2,
      title: 'No Review Column Shirt',
      totalSales: '50',
      monthlySales: '10',
      revenue: '$200',
      listingAge: '3 Mo.',
      price: '$20.00',
      shopName: 'ThirdShop',
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

  const byId = new Map(hooks.extractEverbeeProductRows().map((row) => [row.listingId, row]))

  assert.equal(byId.get('listing-a').reviews, 1204)
  // EverBee has renamed this column before, so an alias must still be read.
  assert.equal(byId.get('listing-b').reviews, 17)
  // A listing with no review column is still a usable row.
  assert.equal(byId.get('listing-c').reviews, null)
  assert.equal(byId.size, 3)
})

test('does not force-reload open pages when the extension is updated', () => {
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
  assert.equal(queryOptions, null)
  assert.deepEqual(reloadedTabIds, [])
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

test('opens each Etsy Marketplace Insights keyword through its stable result URL', () => {
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

  assert.equal(typeof hooks.etsyMarketplaceInsightSearchUrl, 'function')
  assert.equal(
    hooks.etsyMarketplaceInsightSearchUrl('halloween dentist shirt'),
    'https://www.etsy.com/your/shops/me/marketplace-insights/search?query=halloween%20dentist%20shirt&search_trigger=results_search_bar&search_term_type=any_phrase',
  )
})

test('replaces an Etsy Marketplace Insights tab whose navigation callback never answers', async () => {
  let backgroundListener = null
  let createdTab = null
  const existingUrl = 'https://www.etsy.com/your/shops/me/marketplace-insights/search?query=old'
  const chrome = {
    runtime: {
      lastError: undefined,
      getManifest() {
        return { version: '1.43' }
      },
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(value) {
          backgroundListener = value
        },
      },
    },
    storage: { local: { set() {} } },
    tabs: {
      query(_options, callback) {
        callback([{ id: 41, url: existingUrl }])
      },
      update() {
        // Reproduces the real stuck tab: Chrome never invokes the callback.
      },
      create(options, callback) {
        createdTab = { id: 77, url: options.url, status: 'complete' }
        callback(createdTab)
      },
      get(tabId, callback) {
        callback(tabId === 77 ? createdTab : null)
      },
      onUpdated: {
        addListener() {},
        removeListener() {},
      },
    },
  }

  const hostSetTimeout = setTimeout
  const hostClearTimeout = clearTimeout
  runInNewContext(backgroundSource, {
    chrome,
    clearTimeout: hostClearTimeout,
    console,
    fetch,
    setTimeout(callback, delayMs) {
      const testDelay = delayMs === 30000 ? 1000 : delayMs === 5000 ? 1 : 0
      return hostSetTimeout(callback, testDelay)
    },
    URL,
  })

  const run = new Promise((resolve) => {
    backgroundListener(
      { action: 'RUN_ETSY_MARKETPLACE_INSIGHT', query: 'halloween medical secretary shirt' },
      { tab: { id: 5 } },
      resolve,
    )
  })
  const response = await Promise.race([
    run,
    new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 100)),
  ])

  assert.equal(response.timedOut, undefined)
  assert.equal(response.started, true)
  assert.equal(response.tabId, 77)
  assert.equal(
    createdTab.url,
    'https://www.etsy.com/your/shops/me/marketplace-insights/search?query=halloween%20medical%20secretary%20shirt&search_trigger=results_search_bar&search_term_type=any_phrase',
  )
})

test('Etsy Marketplace Insights content script returns the visible keyword metrics', async () => {
  let contentSource = ''
  try {
    contentSource = await readFile(new URL('../dist/etsyMarketplaceContent.js', import.meta.url), 'utf8')
  } catch {
    // The assertion below reports the missing production artifact as the intended RED failure.
  }
  assert.ok(contentSource, 'dedicated Etsy Marketplace Insights content script is missing')

  const manifestEntry = manifest.content_scripts.find((entry) => (
    entry.js.includes('dist/etsyMarketplaceContent.js')
  ))
  assert.deepEqual(manifestEntry?.matches, [
    'https://www.etsy.com/your/shops/me/marketplace-insights/*',
    'https://*.etsy.com/your/shops/me/marketplace-insights/*',
  ])

  const fixture = {
    query: 'halloween it manager shirt',
    heading: 'Similar search terms',
    summary: '',
    remaining: '14 searches remaining',
    related: [
      {
        keyword: 'halloween it manager shirt',
        searches: '3',
        listings: '2.8k',
        conversion: 'Low',
      },
      {
        keyword: 'jul 1',
        searches: '0',
        listings: '0',
        conversion: '',
      },
      {
        keyword: 'halloween help desk shirt',
        searches: '12',
        listings: '840',
        conversion: 'High',
      },
    ],
  }
  let listener = null
  const document = marketplaceDocument(fixture)
  runInNewContext(contentSource, {
    chrome: {
      runtime: {
        onMessage: {
          addListener(value) {
            listener = value
          },
        },
      },
    },
    document,
    URL,
  })

  assert.equal(typeof listener, 'function')
  const response = await new Promise((resolve) => {
    const keepChannelOpen = listener(
      { action: 'ETSY_MARKETPLACE_CAPTURE', query: fixture.query },
      {},
      resolve,
    )
    assert.equal(keepChannelOpen, true)
  })
  assert.equal(response.ok, true)
  assert.equal(response.result.etsySearches30d, 3)
  assert.equal(response.result.etsyListings, 2800)
  assert.deepEqual(Array.from(response.result.etsyRelatedTerms), ['halloween help desk shirt'])
})

test('background captures Etsy Marketplace Insights through the dedicated content script', async () => {
  let backgroundListener = null
  const sentMessages = []
  const chrome = {
    runtime: {
      lastError: undefined,
      getManifest() {
        return { version: '1.43' }
      },
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(value) {
          backgroundListener = value
        },
      },
    },
    storage: { local: { set() {} } },
    tabs: {
      query(_options, callback) {
        callback([{
          id: 41,
          url: 'https://www.etsy.com/your/shops/me/marketplace-insights/search?query=halloween%20it%20manager%20shirt',
        }])
      },
      sendMessage(tabId, message, callback) {
        sentMessages.push({ tabId, message })
        callback({
          ok: true,
          result: {
            ok: true,
            keyword: message.query,
            etsySearches30d: 3,
            etsyListings: 2800,
            etsyRelatedTerms: [],
            etsyRelatedKeywordMetrics: [],
            etsyCheckedAt: '2026-07-31T00:00:00.000Z',
            remainingSearches: 14,
            error: '',
          },
        })
      },
    },
    scripting: {
      async executeScript() {
        throw new Error('inline page-function injection must not be used')
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
  assert.equal(typeof backgroundListener, 'function')

  const response = await new Promise((resolve) => {
    const keepChannelOpen = backgroundListener(
      { action: 'CAPTURE_ETSY_MARKETPLACE_INSIGHT', query: 'halloween it manager shirt' },
      {},
      resolve,
    )
    assert.equal(keepChannelOpen, true)
  })

  assert.equal(response.ok, true)
  assert.equal(response.result.etsyListings, 2800)
  assert.equal(sentMessages.length, 1)
  assert.equal(sentMessages[0].tabId, 41)
  assert.equal(sentMessages[0].message.action, 'ETSY_MARKETPLACE_CAPTURE')
  assert.equal(sentMessages[0].message.query, 'halloween it manager shirt')
})

async function captureThroughBackgroundWithTabResponse(tabResponse) {
  let backgroundListener = null
  const chrome = {
    runtime: {
      lastError: undefined,
      getManifest() {
        return { version: '1.43' }
      },
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(value) {
          backgroundListener = value
        },
      },
    },
    storage: { local: { set() {} } },
    tabs: {
      query(_options, callback) {
        callback([{
          id: 41,
          url: 'https://www.etsy.com/your/shops/me/marketplace-insights/search?query=halloween%20it%20manager%20shirt',
        }])
      },
      sendMessage(_tabId, _message, callback) {
        callback(tabResponse)
      },
    },
    scripting: {
      async executeScript() {
        throw new Error('unexpected content script fallback')
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

  return new Promise((resolve) => {
    backgroundListener(
      { action: 'CAPTURE_ETSY_MARKETPLACE_INSIGHT', query: 'halloween it manager shirt' },
      {},
      resolve,
    )
  })
}

test('reinjects the Etsy capture script when the first content message never answers', async () => {
  let backgroundListener = null
  let messageAttempts = 0
  let injectionAttempts = 0
  const chrome = {
    runtime: {
      lastError: undefined,
      getManifest() {
        return { version: '1.43' }
      },
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(value) {
          backgroundListener = value
        },
      },
    },
    storage: { local: { set() {} } },
    tabs: {
      query(_options, callback) {
        callback([{
          id: 41,
          url: 'https://www.etsy.com/your/shops/me/marketplace-insights/search?query=halloween%20it%20manager%20shirt',
        }])
      },
      sendMessage(_tabId, _message, callback) {
        messageAttempts += 1
        if (messageAttempts === 1) return
        callback({
          ok: true,
          result: {
            ok: true,
            keyword: 'halloween it manager shirt',
            etsySearches30d: 0,
            etsyListings: 0,
            etsyRelatedTerms: [],
            etsyRelatedKeywordMetrics: [],
            etsyCheckedAt: '2026-08-01T00:00:00.000Z',
            remainingSearches: 14,
            error: '',
          },
        })
      },
    },
    scripting: {
      async executeScript() {
        injectionAttempts += 1
      },
    },
  }

  runInNewContext(backgroundSource, {
    chrome,
    clearTimeout() {},
    console,
    fetch,
    setTimeout(callback) {
      queueMicrotask(callback)
      return 1
    },
    URL,
  })

  const capture = new Promise((resolve) => {
    backgroundListener(
      { action: 'CAPTURE_ETSY_MARKETPLACE_INSIGHT', query: 'halloween it manager shirt' },
      {},
      resolve,
    )
  })
  const response = await Promise.race([
    capture,
    new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 100)),
  ])

  assert.equal(response.timedOut, undefined)
  assert.equal(response.ok, true)
  assert.equal(response.result.etsySearches30d, 0)
  assert.equal(messageAttempts, 2)
  assert.equal(injectionAttempts, 1)
})

test('labels an Etsy content-script response error at the message boundary', async () => {
  const response = await captureThroughBackgroundWithTabResponse({
    ok: false,
    error: 'probe failure',
  })

  assert.equal(response.ok, false)
  assert.match(response.error, /ETSY_CAPTURE_MESSAGE: probe failure/)
})

test('labels an Etsy result-shape failure at the merge boundary', async () => {
  const response = await captureThroughBackgroundWithTabResponse({
    ok: true,
    result: {
      ok: true,
      keyword: 'halloween it manager shirt',
      etsySearches30d: 0,
      etsyListings: 0,
      etsyRelatedTerms: null,
      etsyRelatedKeywordMetrics: null,
      etsyCheckedAt: '2026-07-31T00:00:00.000Z',
      remainingSearches: 14,
      error: '',
    },
  })

  assert.equal(response.ok, false)
  assert.match(response.error, /ETSY_CAPTURE_MERGE:/)
})

test('labels an Etsy DOM extraction exception inside the content script', async () => {
  const contentSource = await readFile(new URL('../dist/etsyMarketplaceContent.js', import.meta.url), 'utf8')
  let listener = null
  const root = {
    innerText: '',
    querySelectorAll() {
      throw new Error('probe extraction failure')
    },
  }
  runInNewContext(contentSource, {
    chrome: {
      runtime: {
        onMessage: {
          addListener(value) {
            listener = value
          },
        },
      },
    },
    document: {
      body: root,
      querySelector() {
        return root
      },
    },
    URL,
  })

  const response = await new Promise((resolve) => {
    listener({ action: 'ETSY_MARKETPLACE_CAPTURE', query: 'probe' }, {}, resolve)
  })
  assert.equal(response.ok, false)
  assert.match(response.error, /ETSY_CONTENT_EXTRACT: probe extraction failure/)
})

test('safe visible Etsy extractor returns zero metrics from the real row shape', () => {
  const fixture = {
    query: 'halloween it manager shirt',
    heading: '似たような検索ワード',
    summary: 'halloween it manager shirt\n検索数\n—\n検索結果\n—',
    remaining: '',
    related: [
      {
        keyword: 'halloween it manager shirt',
        searches: '0 0.0%',
        listings: '0',
        conversion: 'エラー',
      },
      {
        keyword: 'halloween pain management shirt',
        searches: '3',
        listings: '2.8 千',
        conversion: 'とても低い',
      },
    ],
  }
  const hooks = {}
  const document = marketplaceDocument(fixture)
  runInNewContext(backgroundSource, {
    __ETSY_MIRAI_TEST_HOOKS__: hooks,
    chrome: createChromeMock(),
    clearTimeout,
    console,
    document,
    fetch,
    setTimeout,
    URL,
  })

  assert.equal(typeof hooks.extractVisibleEtsyMarketplaceInsightInPage, 'function')
  const result = hooks.extractVisibleEtsyMarketplaceInsightInPage(fixture.query)
  assert.equal(result.ok, true)
  assert.equal(result.etsySearches30d, 0)
  assert.equal(result.etsyListings, 0)
  assert.deepEqual(Array.from(result.etsyRelatedTerms), ['halloween pain management shirt'])
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

test('stops Etsy Marketplace Insights retries immediately on rate limiting', async () => {
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
  await assert.rejects(
    hooks.waitForEtsyMarketplaceInsightResult(
      async () => {
        attempts += 1
        return { ok: false, error: 'ETSY_MARKETPLACE_RATE_LIMITED: Slow down, buddy.' }
      },
      async () => {},
      { attempts: 4, initialDelayMs: 0, retryDelayMs: 0 },
    ),
    /ETSY_MARKETPLACE_RATE_LIMITED/,
  )
  assert.equal(attempts, 1)
})

test('stops Etsy Marketplace Insights retries when the content message channel is unresponsive', async () => {
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
  await assert.rejects(
    hooks.waitForEtsyMarketplaceInsightResult(
      async () => {
        attempts += 1
        throw new Error('ETSY_CAPTURE_MESSAGE: ETSY_CAPTURE_RESPONSE_TIMEOUT: no response')
      },
      async () => {},
      { attempts: 4, initialDelayMs: 0, retryDelayMs: 0 },
    ),
    /ETSY_CAPTURE_RESPONSE_TIMEOUT/,
  )
  assert.equal(attempts, 1)
})

test('detects the Etsy Slow down page as a rate limit', () => {
  const fixture = {
    query: 'halloween singing shirt',
    heading: '',
    summary: 'Uh oh! Slow down, buddy.',
    remaining: '',
    related: [],
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
  assert.equal(result.ok, false)
  assert.match(result.error, /ETSY_MARKETPLACE_RATE_LIMITED/)
})

test('detects the Japanese Etsy Slow down page as a rate limit', () => {
  const fixture = {
    query: 'halloween typography shirt',
    heading: 'あらら！',
    summary: 'まあまあ、そう焦らずに。',
    remaining: '',
    related: [],
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
  assert.equal(result.ok, false)
  assert.match(result.error, /ETSY_MARKETPLACE_RATE_LIMITED/)
})

test('forwards the automatic Etsy search and capture request through the page bridge', () => {
  assert.match(bridgeSource, /RUN_AND_CAPTURE_ETSY_MARKETPLACE_INSIGHT/)
})

test('reports the page bridge as ready only after the background runtime responds', () => {
  assert.match(backgroundTypeScriptSource, /request\.action === 'PING_MARKET_FINDER'/)
  assert.match(bridgeSource, /sendRuntimeMessage\(['"]PING_MARKET_FINDER['"]\)/)
  assert.match(bridgeSource, /action: ['"]BRIDGE_READY['"]/)
  assert.match(bridgeSource, /action: ['"]BRIDGE_UNAVAILABLE['"]/)
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

test('does not mistake the Last 30 days period label for search or listing metrics', () => {
  const fixture = {
    query: 'halloween sewing shirt',
    heading: 'Similar search terms',
    summary: 'Your search\nhalloween sewing shirt\nSearches\nLast 30 days\nListings\nLast 30 days',
    remaining: '',
    related: [],
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
  assert.equal(result.etsySearches30d, null)
  assert.equal(result.etsyListings, null)
  assert.equal(result.ok, false)
})

test('reads zero metrics from the current Japanese result row instead of the 30-day period label', () => {
  const fixture = {
    query: 'custom name book lover shirt',
    heading: '似たような検索ワード',
    summary: [
      'custom name book lover shirt',
      '検索数',
      '—',
      '検索結果',
      '—',
      '期間',
      '過去 30 日間',
      '過去 30 日間 の間の検索数',
    ].join('\n'),
    remaining: '',
    related: [
      {
        keyword: 'custom name book lover shirt',
        searches: '0 0.0%',
        listings: '0',
        conversion: 'エラー',
      },
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
  assert.equal(result.etsySearches30d, 0)
  assert.equal(result.etsyListings, 0)
  assert.equal(result.ok, true)
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
