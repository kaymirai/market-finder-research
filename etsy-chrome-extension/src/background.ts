(() => {
    type ImageListing = {
        id: string
        product_link: string
    }

    type MarketResult = {
        keyword: string
        listingsAnalyzed: string
        topMonthlySales: string
        topRevenue: string
        averagePrice: string
        listingAge: string
        visibleListingCount?: string
        sellingListingCount?: string
        recentSellingListingCount?: string
        medianMonthlySales?: string
        medianMonthlyRevenue?: string
        totalVisibleMonthlySales?: string
        topSalesShare?: string
        medianListingAgeMonths?: string
        everbeeCheckedAt?: string
        erankSearchVolume?: string
        erankClicks?: string
        erankCtr?: string
        erankCompetition?: string
        erankKeywordDifficulty?: string
        erankTrend?: string
        erankCheckedAt?: string
        erankAttemptedAt?: string
        etsySearches30d?: string
        etsyListings?: string
        etsyRelatedTerms?: string[]
        etsyCheckedAt?: string
        notes: string
        listingSnippets?: string[]
        productRows?: Array<{
            listingId: string
            title: string
            totalSales: number
            monthlySales: number
            monthlyRevenue: number
            listingAge: string
            listingAgeMonths: number | null
            price: number
            shopName: string
        }>
        relatedKeywords?: MarketResult[]
        rawText?: string
        error?: string
    }

    type MarketState = {
        active: boolean
        mode: 'everbee' | 'erank'
        currentKeyword: string
        remaining: number
        results: MarketResult[]
        error: string
    }

    type TrendSourceId = 'erank' | 'etsy' | 'pinterest' | 'google'

    type TrendCandidate = {
        keyword: string
        source: string
        sourceUrl: string
        note?: string
    }

    type TrendSourceConfig = {
        id: TrendSourceId
        label: string
        url: string
    }

    type TrendSourceTab = {
        tabId: number
        created: boolean
    }

    type EtsyMarketplaceRelatedKeywordMetric = {
        keyword: string
        etsySearches30d: number | null
        etsyListings: number | null
        conversionLabel: string
        sourceModes?: string[]
    }

    type EtsyMarketplaceInsightResult = {
        ok: boolean
        keyword: string
        etsySearches30d: number | null
        etsyListings: number | null
        etsySearchTrendPercent?: number | null
        etsyRelatedTerms: string[]
        etsyRelatedKeywordMetrics: EtsyMarketplaceRelatedKeywordMetric[]
        etsyRelatedModes?: string[]
        etsyCheckedAt: string | null
        remainingSearches: number | null
        error?: string
    }

    let isProcessingImages = false
    let imageQueue: ImageListing[] = []
    let currentProjectId = ''
    let currentApiUrl = ''
    let activeImageTabId: number | null = null
    let tabTimeoutId: ReturnType<typeof setTimeout> | null = null

    let marketActive = false
    let marketMode: 'everbee' | 'erank' = 'everbee'
    let marketQueue: string[] = []
    let marketResults: MarketResult[] = []
    let marketTabId: number | null = null
    let erankTabId: number | null = null
    let etsyMarketplaceTabId: number | null = null
    let marketFinderTabId: number | null = null
    let marketEverbeeUrl = 'https://app.everbee.io/'
    let marketErankUrl = 'https://erank.com/tools/keyword-tool'
    let marketCurrentKeyword = ''
    let marketError = ''
    let marketDelayMs = 4500
    let marketTimerId: ReturnType<typeof setTimeout> | null = null
    let marketRunId = 0
    const MARKET_KEYWORD_TIMEOUT_MS = 240000

    const trendSourceConfigs: Record<TrendSourceId, TrendSourceConfig> = {
        erank: {
            id: 'erank',
            label: 'eRank Trend Buzz',
            url: 'https://members.erank.com/trend-buzz',
        },
        etsy: {
            id: 'etsy',
            label: 'Etsy Marketplace Insights',
            url: 'https://www.etsy.com/your/shops/me/marketplace-insights',
        },
        pinterest: {
            id: 'pinterest',
            label: 'Pinterest Trends',
            url: 'https://trends.pinterest.com/',
        },
        google: {
            id: 'google',
            label: 'Google Trends',
            url: 'https://trends.google.com/trending?geo=US',
        },
    }

    const marketFinderUrlPatterns = [
        'http://localhost:3021/*',
        'http://127.0.0.1:3021/*',
        'http://localhost:4173/*',
        'http://127.0.0.1:4173/*',
    ]

    chrome.runtime.onInstalled.addListener((details) => {
        if (details.reason !== 'install' && details.reason !== 'update') return
        reloadOpenMarketFinderTabs()
    })

    function reloadOpenMarketFinderTabs() {
        chrome.tabs.query({ url: marketFinderUrlPatterns }, (tabs) => {
            if (chrome.runtime.lastError) return

            tabs.forEach((tab) => {
                if (!tab.id) return
                chrome.tabs.reload(tab.id, {}, () => {
                    // Reading lastError keeps a closed-tab race from surfacing as an extension error.
                    const _message = chrome.runtime.lastError?.message
                })
            })
        })
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'START_PROCESS') {
            if (isProcessingImages) {
                sendResponse({ started: false, error: '画像取得はすでに実行中です。' })
                return true
            }

            currentProjectId = request.projectId
            currentApiUrl = request.apiUrl
            startCaptureProcess()
                .then(() => sendResponse({ started: true }))
                .catch((error: Error) => sendResponse({ started: false, error: error.message }))
            return true
        }

        if (request.action === 'IMAGE_FOUND' || request.action === 'IMAGE_ERROR') {
            handleContentResponse(request)
            return true
        }

        if (request.action === 'START_MARKET_RESEARCH') {
            rememberMarketFinderTab(sender)
            const keywords = normalizeKeywordList(request.keywords)
            if (marketActive) {
                sendResponse({ started: false, error: 'Market Finder調査はすでに実行中です。' })
                return true
            }
            if (keywords.length === 0) {
                sendResponse({ started: false, error: '調査キーワードがありません。' })
                return true
            }

            marketEverbeeUrl = normalizeUrl(request.everbeeUrl || marketEverbeeUrl)
            marketDelayMs = Math.max(2500, Math.min(Number(request.delayMs) || 4500, 20000))
            marketMode = 'everbee'
            marketQueue = keywords
            marketResults = []
            marketError = ''
            marketActive = true
            marketCurrentKeyword = ''
            const runId = ++marketRunId
            saveMarketState()
            processNextMarketKeyword(runId)
            sendResponse({ started: true })
            return true
        }

        if (request.action === 'START_ERANK_RESEARCH') {
            rememberMarketFinderTab(sender)
            const keywords = normalizeKeywordList(request.keywords)
            if (marketActive) {
                sendResponse({ started: false, error: 'Market Finder調査はすでに実行中です。' })
                return true
            }
            if (keywords.length === 0) {
                sendResponse({ started: false, error: 'eRankで調べるキーワードがありません。' })
                return true
            }

            marketErankUrl = normalizeErankUrl(request.erankUrl || marketErankUrl)
            marketDelayMs = Math.max(2500, Math.min(Number(request.delayMs) || 4500, 20000))
            marketMode = 'erank'
            marketQueue = keywords
            marketResults = []
            marketError = ''
            marketActive = true
            marketCurrentKeyword = ''
            const runId = ++marketRunId
            saveMarketState()
            processNextMarketKeyword(runId)
            sendResponse({ started: true })
            return true
        }

        if (request.action === 'COLLECT_TRENDS') {
            rememberMarketFinderTab(sender)
            collectTrendSources(request.sources, request.limit, request.contextQuery)
                .then((response) => sendResponse(response))
                .catch((error: Error) => sendResponse({
                    ok: false,
                    trends: [],
                    errors: [error.message],
                }))
            return true
        }

        if (request.action === 'RUN_ETSY_MARKETPLACE_INSIGHT') {
            rememberMarketFinderTab(sender)
            runEtsyMarketplaceInsight(String(request.query ?? ''))
                .then((response) => sendResponse(response))
                .catch((error: Error) => sendResponse({ started: false, ok: false, error: error.message }))
            return true
        }

        if (request.action === 'RUN_AND_CAPTURE_ETSY_MARKETPLACE_INSIGHT') {
            rememberMarketFinderTab(sender)
            runAndCaptureEtsyMarketplaceInsight(String(request.query ?? ''))
                .then((response) => sendResponse(response))
                .catch((error: Error) => sendResponse({ started: false, ok: false, error: error.message }))
            return true
        }

        if (request.action === 'CAPTURE_ETSY_MARKETPLACE_INSIGHT') {
            rememberMarketFinderTab(sender)
            captureEtsyMarketplaceInsight(String(request.query ?? ''))
                .then((result) => sendResponse({ ok: result.ok, result, error: result.error }))
                .catch((error: Error) => sendResponse({ ok: false, error: error.message }))
            return true
        }

        if (request.action === 'STOP_MARKET_RESEARCH') {
            stopMarketResearch()
            sendResponse({ stopped: true, state: getMarketState() })
            return true
        }

        if (request.action === 'GET_MARKET_STATE') {
            sendResponse(getMarketState())
            return true
        }

        if (request.action === 'CLEAR_MARKET_RESULTS') {
            marketResults = []
            marketError = ''
            saveMarketState()
            sendResponse(getMarketState())
            return true
        }

        return false
    })

    function rememberMarketFinderTab(sender: chrome.runtime.MessageSender) {
        if (sender.tab?.id) marketFinderTabId = sender.tab.id
    }

    function shouldRetryTabEditError(message: string) {
        return /tabs cannot be edited right now/i.test(message)
    }

    function focusWindowQuietly(windowId: number) {
        chrome.windows.update(windowId, { focused: true }, () => {
            // Reading lastError prevents harmless focus failures from surfacing in chrome://extensions.
            const _message = chrome.runtime.lastError?.message
        })
    }

    function focusMarketFinderTab() {
        if (marketFinderTabId === null) return
        chrome.tabs.get(marketFinderTabId, (tab) => {
            if (chrome.runtime.lastError || !tab?.id) {
                marketFinderTabId = null
                return
            }

            activateTab(tab.id)
        })
    }

    function activateTab(tabId: number, attempt = 0): Promise<void> {
        return new Promise<void>((resolve) => {
            chrome.tabs.get(tabId, (tab) => {
                const getError = chrome.runtime.lastError?.message
                if (getError || !tab?.id) {
                    resolve()
                    return
                }

                if (tab.windowId !== undefined) {
                    focusWindowQuietly(tab.windowId)
                }
                chrome.tabs.update(tabId, { active: true }, () => {
                    const updateError = chrome.runtime.lastError?.message
                    if (updateError && shouldRetryTabEditError(updateError) && attempt < 2) {
                        setTimeout(() => {
                            activateTab(tabId, attempt + 1).then(resolve)
                        }, 800)
                        return
                    }
                    setTimeout(resolve, 500)
                })
            })
        })
    }

    function normalizeKeywordList(value: unknown) {
        if (!Array.isArray(value)) return []
        const seen = new Set<string>()
        return value
            .map((item) => String(item ?? '').trim())
            .filter(Boolean)
            .filter((keyword) => {
                const key = keyword.toLowerCase()
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
            .slice(0, 150)
    }

    function normalizeUrl(value: string) {
        try {
            const url = new URL(value)
            return url.toString()
        } catch {
            return 'https://app.everbee.io/'
        }
    }

    function normalizeErankUrl(value: string) {
        try {
            const url = new URL(value)
            if (/(^|\.)erank\.com$/i.test(url.hostname)) return url.toString()
            return 'https://erank.com/tools/keyword-tool'
        } catch {
            return 'https://erank.com/tools/keyword-tool'
        }
    }

    function findEtsyMarketplaceTab(): Promise<number | null> {
        return new Promise((resolve) => {
            if (etsyMarketplaceTabId !== null) {
                chrome.tabs.get(etsyMarketplaceTabId, (tab) => {
                    if (!chrome.runtime.lastError && tab?.id && isEtsyMarketplaceInsightUrl(tab.url)) {
                        resolve(tab.id)
                        return
                    }
                    etsyMarketplaceTabId = null
                    findOpenTab()
                })
                return
            }
            findOpenTab()

            function findOpenTab() {
                chrome.tabs.query({}, (tabs) => {
                    const tab = tabs.find((candidate) => candidate.id && isEtsyMarketplaceInsightUrl(candidate.url))
                    resolve(tab?.id ?? null)
                })
            }
        })
    }

    function isEtsyMarketplaceInsightUrl(value?: string) {
        if (!value) return false
        try {
            const url = new URL(value)
            return /(^|\.)etsy\.com$/i.test(url.hostname) && /marketplace-insights/i.test(url.pathname)
        } catch {
            return false
        }
    }

    async function openEtsyMarketplaceInsightTab(activate = true) {
        const existingTabId = await findEtsyMarketplaceTab()
        if (existingTabId !== null) {
            etsyMarketplaceTabId = existingTabId
            if (activate) await activateTab(existingTabId)
            return existingTabId
        }

        const tabId = await new Promise<number>((resolve, reject) => {
            chrome.tabs.create({
                url: trendSourceConfigs.etsy.url,
                active: activate,
            }, (tab) => {
                if (chrome.runtime.lastError || !tab?.id) {
                    reject(new Error(chrome.runtime.lastError?.message || 'Etsy Marketplace Insightsを開けませんでした。'))
                    return
                }
                resolve(tab.id)
            })
        })
        etsyMarketplaceTabId = tabId
        await waitForTabComplete(tabId)
        await delay(2200)
        return tabId
    }

    async function runEtsyMarketplaceInsight(rawQuery: string, activate = true) {
        const query = rawQuery.trim().replace(/\s+/g, ' ')
        if (!query) return { started: false, ok: false, error: 'Marketplace Insightsで調べる語句がありません。' }

        const tabId = await openEtsyMarketplaceInsightTab(activate)
        const injection = await chrome.scripting.executeScript({
            target: { tabId },
            func: submitEtsyMarketplaceInsightQueryInPage,
            args: [query],
        })
        const result = injection[0]?.result as { submitted?: boolean; error?: string } | undefined
        if (!result?.submitted) {
            return {
                started: false,
                ok: false,
                error: result?.error || '検索欄が見つかりません。Etsyへログインし、Shop Manager > Stats > Marketplace Insightsを表示してください。',
            }
        }
        return { started: true, ok: true, query, tabId }
    }

    async function waitForEtsyMarketplaceInsightResult<T extends { ok?: boolean, error?: string }>(
        capture: () => Promise<T>,
        wait: (ms: number) => Promise<unknown> = delay,
        options: { attempts?: number, initialDelayMs?: number, retryDelayMs?: number } = {},
    ): Promise<T> {
        const attempts = Math.max(1, Number(options.attempts) || 12)
        const initialDelayMs = Math.max(0, Number(options.initialDelayMs) || 1800)
        const retryDelayMs = Math.max(0, Number(options.retryDelayMs) || 1200)
        let latest: T | null = null
        let latestError = ''

        if (initialDelayMs > 0) await wait(initialDelayMs)
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
                latest = await capture()
                if (latest?.ok) return latest
                latestError = latest?.error || latestError
            } catch (error) {
                latestError = error instanceof Error ? error.message : String(error)
            }
            if (attempt < attempts - 1 && retryDelayMs > 0) await wait(retryDelayMs)
        }

        throw new Error(latest?.error || latestError || 'Etsy Marketplace Insightsの結果待ちがタイムアウトしました。')
    }

    async function runAndCaptureEtsyMarketplaceInsight(rawQuery: string) {
        const opened = await runEtsyMarketplaceInsight(rawQuery, false)
        if (!opened.started || !opened.ok) return opened
        const query = String(opened.query ?? '').trim()
        if (!query) return { started: false, ok: false, error: 'Marketplace Insightsで調べる語句がありません。' }

        const result = await waitForEtsyMarketplaceInsightResult(
            () => captureEtsyMarketplaceInsight(query, false),
        )
        return { started: true, ok: true, query, result }
    }

    async function captureEtsyMarketplaceInsight(rawQuery: string, restoreMarketFinderFocus = true): Promise<EtsyMarketplaceInsightResult> {
        const query = rawQuery.trim().replace(/\s+/g, ' ')
        const tabId = await findEtsyMarketplaceTab()
        if (tabId === null) {
            return {
                ok: false,
                keyword: query,
                etsySearches30d: null,
                etsyListings: null,
                etsyRelatedTerms: [],
                etsyRelatedKeywordMetrics: [],
                etsyCheckedAt: null,
                remainingSearches: null,
                error: 'Marketplace Insightsのタブが見つかりません。先に「Etsy公式確認を自動実行」を押してください。',
            }
        }

        const captures: Array<{ mode: string, result: EtsyMarketplaceInsightResult }> = []
        let initialMode = 'unknown'
        try {
            const currentModeInjection = await chrome.scripting.executeScript({
                target: { tabId },
                func: switchEtsyMarketplaceRelatedModeInPage,
                args: ['current'],
            })
            initialMode = String(currentModeInjection[0]?.result?.mode ?? 'unknown')

            for (const mode of ['similar', 'explore'] as const) {
                try {
                    const switchInjection = await chrome.scripting.executeScript({
                        target: { tabId },
                        func: switchEtsyMarketplaceRelatedModeInPage,
                        args: [mode],
                    })
                    if (!switchInjection[0]?.result?.found) continue
                    const extraction = await chrome.scripting.executeScript({
                        target: { tabId },
                        func: extractEtsyMarketplaceInsightInPage,
                        args: [query],
                    })
                    const result = extraction[0]?.result as EtsyMarketplaceInsightResult | undefined
                    if (result) captures.push({ mode, result })
                } catch {
                    // A single related view should not block capture of the other view.
                }
            }

            if (captures.length === 0) {
                const extraction = await chrome.scripting.executeScript({
                    target: { tabId },
                    func: extractEtsyMarketplaceInsightInPage,
                    args: [query],
                })
                const result = extraction[0]?.result as EtsyMarketplaceInsightResult | undefined
                if (result) captures.push({ mode: 'visible', result })
            }
        } finally {
            if (initialMode === 'similar' || initialMode === 'explore') {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId },
                        func: switchEtsyMarketplaceRelatedModeInPage,
                        args: [initialMode],
                    })
                } catch {
                    // Restoring the selected view is best-effort only.
                }
            }
        }

        if (restoreMarketFinderFocus) focusMarketFinderTab()
        if (captures.length === 0) throw new Error('Marketplace Insightsの画面から結果を取得できませんでした。')
        return mergeEtsyMarketplaceInsightResults(captures)
    }

    function mergeEtsyMarketplaceInsightResults(captures: Array<{ mode: string, result: EtsyMarketplaceInsightResult }>) {
        const usable = captures.filter((capture) => capture?.result)
        const base = usable.find((capture) => capture.result.ok)?.result ?? usable[0]?.result
        if (!base) throw new Error('Marketplace Insightsの結果が空です。')

        const relatedTerms = new Map<string, string>()
        const relatedMetrics = new Map<string, EtsyMarketplaceRelatedKeywordMetric>()
        const relatedModes: string[] = []
        const normalizeKey = (value: string) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

        usable.forEach(({ mode, result }) => {
            if (mode && !relatedModes.includes(mode)) relatedModes.push(mode)
            result.etsyRelatedTerms.forEach((term) => {
                const key = normalizeKey(term)
                if (key && !relatedTerms.has(key)) relatedTerms.set(key, term)
            })
            result.etsyRelatedKeywordMetrics.forEach((metric) => {
                const key = normalizeKey(metric.keyword)
                if (!key) return
                const previous = relatedMetrics.get(key)
                const sourceModes = Array.from(new Set([
                    ...(previous?.sourceModes ?? []),
                    ...(metric.sourceModes ?? []),
                    mode,
                ].filter(Boolean)))
                relatedMetrics.set(key, {
                    ...previous,
                    ...metric,
                    keyword: metric.keyword || previous?.keyword || '',
                    etsySearches30d: metric.etsySearches30d ?? previous?.etsySearches30d ?? null,
                    etsyListings: metric.etsyListings ?? previous?.etsyListings ?? null,
                    conversionLabel: metric.conversionLabel || previous?.conversionLabel || '',
                    sourceModes,
                })
            })
        })

        return {
            ...base,
            ok: usable.some((capture) => capture.result.ok),
            etsyRelatedTerms: Array.from(relatedTerms.values()).slice(0, 200),
            etsyRelatedKeywordMetrics: Array.from(relatedMetrics.values()).slice(0, 200),
            etsyRelatedModes: relatedModes,
        }
    }

    async function switchEtsyMarketplaceRelatedModeInPage(requestedMode: string) {
        function visible(element: Element) {
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        }

        function labelText(element: HTMLElement) {
            const labelledBy = (element.getAttribute('aria-labelledby') ?? '')
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent ?? '')
                .join(' ')
            return [
                element.getAttribute('aria-label') ?? '',
                labelledBy,
                element.closest('label')?.textContent ?? '',
                element.previousElementSibling?.textContent ?? '',
                element.nextElementSibling?.textContent ?? '',
            ].join(' ').replace(/\s+/g, ' ').trim()
        }

        function identifyMode(element: HTMLElement) {
            const label = labelText(element)
            if (/explor|discover|idea|探索|アイデア/i.test(label)) return 'explore'
            if (/similar|related|似たような|関連/i.test(label)) return 'similar'
            return 'unknown'
        }

        function checked(element: HTMLElement) {
            return (element instanceof HTMLInputElement && element.checked)
                || element.getAttribute('aria-checked') === 'true'
        }

        const radios = Array.from(document.querySelectorAll<HTMLElement>('input[type="radio"], [role="radio"]'))
            .filter((element) => visible(element) || Boolean(element.closest('label')))
        const current = radios.find((element) => checked(element))
        const currentMode = current ? identifyMode(current) : 'unknown'
        if (requestedMode === 'current') return { found: radios.length > 0, mode: currentMode, changed: false }

        const target = radios.find((element) => identifyMode(element) === requestedMode)
        if (!target) return { found: false, mode: currentMode, changed: false }
        if (checked(target)) return { found: true, mode: requestedMode, changed: false }

        const clickTarget = target.closest<HTMLElement>('label') ?? target
        clickTarget.click()
        await new Promise((resolve) => window.setTimeout(resolve, 700))
        return { found: true, mode: requestedMode, changed: true }
    }

    async function submitEtsyMarketplaceInsightQueryInPage(query: string) {
        function visible(element: Element) {
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        }

        const inputs = Array.from(document.querySelectorAll<HTMLInputElement>([
            'main input[type="search"]',
            'main input[name*="keyword" i]',
            'main input[placeholder*="keyword" i]',
            'main input[aria-label*="keyword" i]',
            'main input[placeholder*="search" i]',
            'main input[aria-label*="search" i]',
            'input[type="search"]',
        ].join(','))).filter((input) => visible(input) && !input.disabled && !input.readOnly)
        const input = inputs[0]
        if (!input) {
            return { submitted: false, error: 'Marketplace Insightsの検索欄が見つかりません。Etsyへのログイン状態を確認してください。' }
        }

        input.focus()
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        if (setter) setter.call(input, query)
        else input.value = query
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        await new Promise((resolve) => window.setTimeout(resolve, 250))

        const form = input.closest('form')
        const scope = form ?? input.closest('main, section, article, [role="main"]') ?? document
        const buttons = Array.from(scope.querySelectorAll<HTMLButtonElement>('button, [role="button"]'))
            .filter((button) => visible(button) && !button.hasAttribute('disabled'))
        const submitButton = buttons.find((button) => {
            const label = `${button.textContent ?? ''} ${button.getAttribute('aria-label') ?? ''}`.trim()
            return /^(?:search|explore|view insights|show results|検索)$/i.test(label)
        }) ?? (form?.querySelector<HTMLButtonElement>('button[type="submit"], input[type="submit"]') ?? null)

        if (submitButton) {
            submitButton.click()
        } else if (form) {
            form.requestSubmit()
        } else {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
            input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
        }
        return { submitted: true }
    }

    function extractEtsyMarketplaceInsightInPage(expectedQuery: string): EtsyMarketplaceInsightResult {
        function visible(element: Element) {
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        }

        function normalize(value: string) {
            return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        }

        function parseCompactNumber(value: string): number | null {
            const match = String(value ?? '')
                .replace(/\u00a0/g, ' ')
                .match(/(\d[\d,]*(?:\.\d+)?)\s*(百万|千|万|億|[kmb])?/i)
            if (!match) return null
            const suffix = (match[2] ?? '').toLowerCase()
            const multiplier = suffix === 'k' || suffix === '千'
                ? 1_000
                : suffix === '万'
                    ? 10_000
                    : suffix === 'm' || suffix === '百万'
                        ? 1_000_000
                        : suffix === '億'
                            ? 100_000_000
                            : suffix === 'b'
                                ? 1_000_000_000
                                : 1
            const numeric = Number(match[1].replace(/,/g, ''))
            return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : null
        }

        const root = document.querySelector('main, [role="main"]') ?? document.body
        const input = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="search"], input[name*="keyword" i], input[placeholder*="keyword" i]'))
            .find((candidate) => visible(candidate))
        const actualQuery = String(input?.value ?? '').trim()
        if (expectedQuery && actualQuery && normalize(expectedQuery) !== normalize(actualQuery)) {
            return {
                ok: false,
                keyword: actualQuery,
                etsySearches30d: null,
                etsyListings: null,
                etsyRelatedTerms: [],
                etsyRelatedKeywordMetrics: [],
                etsyCheckedAt: null,
                remainingSearches: null,
                error: `表示中の語句は「${actualQuery}」です。「${expectedQuery}」の結果を表示してから取り込んでください。`,
            }
        }

        const texts = Array.from(root.querySelectorAll('section, article, [role="row"], [role="cell"], [data-testid], h1, h2, h3, h4, p, span, div'))
            .filter((element) => visible(element))
            .map((element) => (element as HTMLElement).innerText?.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim() ?? '')
            .filter((text, index, all) => text && text.length <= 500 && all.indexOf(text) === index)
            .sort((left, right) => left.length - right.length)

        function extractMetric(labelPattern: string, excludePattern?: RegExp) {
            const numberPattern = '(\\d[\\d,]*(?:\\.\\d+)?\\s*(?:百万|千|万|億|[kmb])?)'
            const after = new RegExp(`${labelPattern}[^\\d]{0,45}${numberPattern}`, 'i')
            const before = new RegExp(`${numberPattern}[^a-z0-9]{0,30}${labelPattern}`, 'i')
            for (const text of texts) {
                if (excludePattern?.test(text)) continue
                const match = text.match(after)
                if (match) return parseCompactNumber(match[1])
                const reverseMatch = text.match(before)
                if (reverseMatch) return parseCompactNumber(reverseMatch[1])
            }
            return null
        }

        const searchLabel = '(?:searches?(?:\\s+in\\s+(?:the\\s+)?last\\s+30\\s+days)?|30[- ]day searches|search volume|buyer searches|検索(?:数)?(?!結果))'
        const listingLabel = '(?:listings|items available|available listings|competition|search results?|掲載数|出品数|検索結果(?:数)?)'
        const etsySearches30d = extractMetric(searchLabel, /remaining|left|free searches|per week|残り|無料検索|週/i)
        const etsyListings = extractMetric(listingLabel)
        const normalizedQuery = normalize(actualQuery || expectedQuery)
        const searchTrendPercent = Array.from(root.querySelectorAll<HTMLElement>('tr, [role="row"]'))
            .filter((row) => visible(row))
            .map((row) => row.innerText?.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() ?? '')
            .find((rowText) => normalizedQuery && normalize(rowText).includes(normalizedQuery) && /[+-]?\d+(?:\.\d+)?\s*%/.test(rowText))
            ?.match(/([+-]?\d+(?:\.\d+)?)\s*%/)?.[1]
        const etsySearchTrendPercent = searchTrendPercent === undefined ? null : Number(searchTrendPercent)

        const relatedTerms: string[] = []
        const relatedTermByKey = new Map<string, string>()
        const relatedMetricsByKey = new Map<string, EtsyMarketplaceRelatedKeywordMetric>()
        const ignoredTerm = /^(?:searches?|search results?|listings?|competition|search volume|related searches?|related terms?|similar search terms?|exploration ideas?|explore ideas?|marketplace insights|conversion rate|very low|low|medium|high|very high|trend|last 30 days|your search|検索|検索数|検索結果|掲載数|出品数|似たような検索ワード|探索のアイデア|関連検索|関連キーワード|コンバージョン率|とても低い|低い|普通|高い|とても高い)$/i
        const relatedColumnHeader = /^(?:searches?|search results?|listings?|competition|search volume|conversion rate|検索|検索数|検索結果|掲載数|出品数|コンバージョン率)$/i
        function addRelatedTerm(rawValue: string) {
            const value = String(rawValue ?? '').replace(/\s+/g, ' ').trim()
            const key = normalize(value)
            if (!key || key === normalize(expectedQuery || actualQuery)) return null
            if (relatedTermByKey.has(key)) return relatedTermByKey.get(key) ?? null
            if (value.length < 3 || value.length > 80 || !/[a-z]/i.test(value) || ignoredTerm.test(value)) return null
            const words = value.split(/\s+/).filter(Boolean)
            if (words.length > 9 || /^[-+\d,.%$\s]+$/.test(value)) return null
            relatedTermByKey.set(key, value)
            relatedTerms.push(value)
            return value
        }

        function addRelatedMetric(rawKeyword: string, searches: number | null, listings: number | null, conversionLabel: string) {
            const keyword = addRelatedTerm(rawKeyword)
            if (!keyword || (searches === null && listings === null)) return
            const key = normalize(keyword)
            relatedMetricsByKey.set(key, {
                keyword,
                etsySearches30d: searches,
                etsyListings: listings,
                conversionLabel: String(conversionLabel ?? '').replace(/\s+/g, ' ').trim(),
            })
        }

        const relatedHeading = Array.from(root.querySelectorAll<HTMLElement>('h2, h3, h4, [role="heading"]'))
            .find((heading) => /related|similar search|exploration ideas?|explore ideas?|似たような検索ワード|探索のアイデア|関連(?:する)?検索|関連キーワード/i.test(heading.innerText ?? ''))
        const relatedScopes = [
            relatedHeading?.closest?.('table, section, article, [role="region"]'),
            relatedHeading?.parentElement,
            relatedHeading?.nextElementSibling,
        ].filter((scope, index, scopes): scope is Element => Boolean(scope) && scopes.indexOf(scope) === index)
        if (relatedScopes.length === 0) relatedScopes.push(root)

        const relatedRows = new Set<Element>()
        relatedScopes.forEach((scope) => {
            scope.querySelectorAll('table tbody tr, tbody tr, tr, [role="row"]').forEach((row) => relatedRows.add(row))
        })
        relatedRows.forEach((row) => {
            if (!visible(row)) return
            const rowText = (row as HTMLElement).innerText ?? ''
            const cellElements = Array.from(row.querySelectorAll<HTMLElement>('th, td, [role="cell"], [role="rowheader"]'))
            const cells = (cellElements.length > 0
                ? cellElements.map((cell) => cell.innerText ?? '')
                : rowText.split(/\r?\n/))
                .map((cell) => cell.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
                .filter(Boolean)
            const termIndex = cells.findIndex((cell) => /[a-z]/i.test(cell)
                && !ignoredTerm.test(cell)
                && !/^[-+\d,.%$\s]+$/.test(cell))
            if (termIndex < 0) return

            const trailingCells = cells.slice(termIndex + 1)
            const numericValues: number[] = []
            let conversionLabel = ''
            trailingCells.forEach((cell) => {
                const parsed = parseCompactNumber(cell)
                if (parsed !== null && numericValues.length < 2) {
                    numericValues.push(parsed)
                } else if (!conversionLabel && !relatedColumnHeader.test(cell)) {
                    conversionLabel = cell
                }
            })
            addRelatedMetric(cells[termIndex], numericValues[0] ?? null, numericValues[1] ?? null, conversionLabel)
        })

        relatedScopes.forEach((scope) => {
            scope.querySelectorAll<HTMLElement>('a, button, [role="rowheader"], [data-testid*="keyword" i]').forEach((element) => {
                if (visible(element)) addRelatedTerm(element.innerText ?? '')
            })
        })

        const pageText = (root as HTMLElement).innerText?.replace(/\u00a0/g, ' ') ?? ''
        const remainingMatch = pageText.match(/(\d+)\s+(?:free\s+)?search(?:es)?\s+(?:remaining|left)/i)
            ?? pageText.match(/(?:remaining|left)[^\d]{0,20}(\d+)\s+(?:search(?:es)?)?/i)
            ?? pageText.match(/(?:残り|あと)\s*(\d+)\s*(?:回|件)?/)
        const remainingSearches = remainingMatch ? Number(remainingMatch[1]) : null
        const ok = etsySearches30d !== null || etsyListings !== null
        const limitedRelatedTerms = relatedTerms.slice(0, 100)
        const limitedRelatedKeys = new Set(limitedRelatedTerms.map((term) => normalize(term)))
        return {
            ok,
            keyword: actualQuery || expectedQuery,
            etsySearches30d,
            etsyListings,
            etsySearchTrendPercent: Number.isFinite(etsySearchTrendPercent) ? etsySearchTrendPercent : null,
            etsyRelatedTerms: limitedRelatedTerms,
            etsyRelatedKeywordMetrics: Array.from(relatedMetricsByKey.entries())
                .filter(([key]) => limitedRelatedKeys.has(key))
                .map(([, metric]) => metric),
            etsyCheckedAt: ok ? new Date().toISOString() : null,
            remainingSearches: Number.isFinite(remainingSearches) ? remainingSearches : null,
            error: ok ? undefined : '30日検索数と掲載数が見つかりません。Etsyの検索結果が表示されているか確認してください。',
        }
    }

    const testHooks = (globalThis as typeof globalThis & {
        __ETSY_MIRAI_TEST_HOOKS__?: Record<string, unknown>
    }).__ETSY_MIRAI_TEST_HOOKS__
    if (testHooks) testHooks.extractEtsyMarketplaceInsightInPage = extractEtsyMarketplaceInsightInPage
    if (testHooks) testHooks.mergeEtsyMarketplaceInsightResults = mergeEtsyMarketplaceInsightResults
    if (testHooks) testHooks.switchEtsyMarketplaceRelatedModeInPage = switchEtsyMarketplaceRelatedModeInPage
    if (testHooks) testHooks.waitForEtsyMarketplaceInsightResult = waitForEtsyMarketplaceInsightResult

    function normalizeTrendSources(value: unknown): TrendSourceConfig[] {
        const requested = Array.isArray(value) && value.length > 0
            ? value.map((item) => String(item).toLowerCase())
            : ['erank', 'pinterest', 'google']

        const seen = new Set<string>()
        return requested
            .map((id) => trendSourceConfigs[id as TrendSourceId])
            .filter((config): config is TrendSourceConfig => Boolean(config))
            .filter((config) => {
                if (seen.has(config.id)) return false
                seen.add(config.id)
                return true
            })
    }

    async function collectTrendSources(sources: unknown, limit: unknown, rawContextQuery: unknown) {
        const configs = normalizeTrendSources(sources)
        const perSourceLimit = Math.max(6, Math.min(Number(limit) || 18, 40))
        const contextQuery = String(rawContextQuery ?? '').trim().replace(/\s+/g, ' ')
        const trends: TrendCandidate[] = []
        const errors: string[] = []
        const seen = new Set<string>()

        for (const config of configs) {
            try {
                const sourceTrends = await collectTrendSource(config, perSourceLimit, contextQuery)
                sourceTrends.forEach((trend) => {
                    const key = trend.keyword.toLowerCase()
                    if (!key || seen.has(key)) return
                    seen.add(key)
                    trends.push(trend)
                })
            } catch (error) {
                const message = error instanceof Error ? error.message : '取得に失敗しました。'
                errors.push(`${config.label}: ${message}`)
            }
        }

        focusMarketFinderTab()
        return { ok: errors.length === 0 || trends.length > 0, trends, errors }
    }

    async function collectTrendSource(config: TrendSourceConfig, limit: number, contextQuery: string): Promise<TrendCandidate[]> {
        const tab = await openTrendSourceTab(config, contextQuery)
        await waitForTabComplete(tab.tabId)
        await delay(4500)

        const trends = await extractTrendsFromTab(tab.tabId, config, limit)
        if (trends.length > 0) {
            if (tab.created) closeTabQuietly(tab.tabId)
            return trends
        }

        throw new Error('候補語が見つかりませんでした。ログイン後、ページを表示してから再実行してください。')
    }

    function contextualTrendUrl(config: TrendSourceConfig, contextQuery: string) {
        if (!contextQuery) return config.url
        if (config.id === 'google') {
            return `https://trends.google.com/trends/explore?geo=US&q=${encodeURIComponent(contextQuery)}`
        }
        if (config.id === 'pinterest') {
            return `https://trends.pinterest.com/?country=US&q=${encodeURIComponent(contextQuery)}`
        }
        return config.url
    }

    function openTrendSourceTab(config: TrendSourceConfig, contextQuery: string): Promise<TrendSourceTab> {
        return new Promise((resolve, reject) => {
            const targetUrl = contextualTrendUrl(config, contextQuery)
            chrome.tabs.query({}, (tabs) => {
                const existing = tabs.find((tab) => tab.id && isTrendSourceUrl(tab.url, config.id))
                if (existing?.id) {
                    if (targetUrl !== config.url && existing.url !== targetUrl) {
                        chrome.tabs.update(existing.id, { url: targetUrl, active: false }, (tab) => {
                            if (chrome.runtime.lastError || !tab?.id) {
                                reject(new Error(chrome.runtime.lastError?.message || 'トレンドページを更新できませんでした。'))
                                return
                            }
                            resolve({ tabId: tab.id, created: false })
                        })
                        return
                    }
                    resolve({ tabId: existing.id, created: false })
                    return
                }

                chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
                    if (chrome.runtime.lastError || !tab?.id) {
                        reject(new Error(chrome.runtime.lastError?.message || 'ページを開けませんでした。'))
                        return
                    }
                    resolve({ tabId: tab.id, created: true })
                })
            })
        })
    }

    function isTrendSourceUrl(value: string | undefined, sourceId: TrendSourceId) {
        if (!value) return false
        try {
            const url = new URL(value)
            if (sourceId === 'erank') return /(^|\.)erank\.com$/i.test(url.hostname) && /trend|monthly|buzz/i.test(url.pathname)
            if (sourceId === 'etsy') return /(^|\.)etsy\.com$/i.test(url.hostname) && /stats|insights|shops\/me/i.test(url.pathname)
            if (sourceId === 'pinterest') return /(^|\.)pinterest\.com$/i.test(url.hostname) && /trend/i.test(url.hostname + url.pathname)
            if (sourceId === 'google') return /^trends\.google\./i.test(url.hostname)
            return false
        } catch {
            return false
        }
    }

    async function extractTrendsFromTab(tabId: number, config: TrendSourceConfig, limit: number): Promise<TrendCandidate[]> {
        const injection = await chrome.scripting.executeScript({
            target: { tabId },
            func: extractTrendCandidatesInPage,
            args: [config.label, config.url, limit],
        })

        const result = injection[0]?.result
        return Array.isArray(result) ? result : []
    }

    function closeTabQuietly(tabId: number) {
        chrome.tabs.remove(tabId, () => {
            const _message = chrome.runtime.lastError?.message
            // The tab may have been closed by the user. Nothing else to do.
        })
    }

    function delay(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    function stopMarketResearch() {
        marketRunId += 1
        marketActive = false
        marketQueue = []
        marketCurrentKeyword = ''
        if (marketTimerId) {
            clearTimeout(marketTimerId)
            marketTimerId = null
        }
        saveMarketState()
    }

    function withTimeout<T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
            task
                .then((value) => {
                    clearTimeout(timeoutId)
                    resolve(value)
                })
                .catch((error) => {
                    clearTimeout(timeoutId)
                    reject(error)
                })
        })
    }

    function extractTrendCandidatesInPage(source: string, sourceUrl: string, limit: number): TrendCandidate[] {
        const ignoredExact = new Set([
            'home',
            'login',
            'log in',
            'sign in',
            'sign up',
            'settings',
            'privacy',
            'terms',
            'help',
            'feedback',
            'search',
            'filter',
            'filters',
            'columns',
            'export',
            'keyword',
            'keywords',
            'trend',
            'trends',
            'trending',
            'competition',
            'clicks',
            'ctr',
            'avg searches',
            'avg clicks',
            'etsy competition',
            'marketplace insights',
            'google trends',
            'pinterest trends',
            'erank',
            'keyword tool',
            'bulk keyword tool',
            'keyword lists',
            'rank checker',
            'listing audit',
            'listing helper',
            'competitor sales',
            'profit calculator',
            'plans and pricing',
        ])
        const ignoredPattern = /\b(?:cookie|privacy|terms|feedback|subscribe|account|dashboard|analytics|settings|download|export|column|filter|average|search volume|past 24 hours|started|trend breakdown|unknown|ranked by|view all|learn more|create campaign|contact sales|seller handbook|shop manager|keyword tool|bulk keyword|keyword lists?|rank checker|listing audit|listing helper|competitor|profit calculator|pricing|plans|blog|resources|academy|support|newsletter)\b/i
        const result: TrendCandidate[] = []
        const seen = new Set<string>()

        function isVisible(element: Element) {
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        }

        function isNavigationElement(element: Element) {
            return Boolean(element.closest('nav, header, footer, aside, [role="navigation"], [aria-label*="navigation" i], [aria-label*="menu" i], [class*="sidebar" i], [class*="navbar" i], [class*="footer" i], [class*="header" i]'))
        }

        function cleanCandidate(value: string) {
            return String(value ?? '')
                .replace(/\u00a0/g, ' ')
                .replace(/^[#\s]*\d+[\).\-\s]+/, '')
                .replace(/\b(?:breakout|rising|top|popular|searches|clicks|views|pins)\b$/i, '')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/^[^\w]+|[^\w\s'&-]+$/g, '')
                .trim()
        }

        function isDateAxisNoise(value: string) {
            const monthWords = new Set([
                'jan', 'january', 'feb', 'february', 'mar', 'march', 'apr', 'april',
                'may', 'jun', 'june', 'jul', 'july', 'aug', 'august', 'sep', 'sept',
                'september', 'oct', 'october', 'nov', 'november', 'dec', 'december',
            ])
            const genericWords = new Set([
                'shirt', 'shirts', 'tee', 'tshirt', 'tshirts', 'gift', 'gifts',
                'mug', 'tote', 'bag', 'sticker', 'searches', 'clicks', 'views', 'pins',
            ])
            const words = value.toLowerCase().split(/\s+/).filter(Boolean)
            const hasMonth = words.some((word) => monthWords.has(word))
            const hasYearish = words.some((word) => /^(?:20\d{2}|\d{2})$/.test(word))
            const specificWords = words.filter((word) => (
                !monthWords.has(word)
                && !genericWords.has(word)
                && !/^(?:20\d{2}|\d{2}|[\d,]+)$/.test(word)
            ))
            return hasMonth && hasYearish && specificWords.length === 0
        }

        function addCandidate(raw: string, note?: string) {
            const keyword = cleanCandidate(raw)
            const normalized = keyword.toLowerCase()
            if (!keyword || seen.has(normalized)) return
            if (keyword.length < 3 || keyword.length > 60) return
            if (!/[a-z]/i.test(keyword)) return
            if (isDateAxisNoise(keyword)) return
            if (/https?:|www\.|@/.test(keyword)) return
            if (/^[\d\s,.$%+-]+$/.test(keyword)) return
            if (ignoredExact.has(normalized) || ignoredPattern.test(keyword)) return

            const words = keyword.split(/\s+/).filter(Boolean)
            if (words.length > 7) return
            if (words.length === 1 && keyword.length < 4) return
            if (words.some((word) => word.length > 24)) return

            seen.add(normalized)
            result.push({ keyword, source, sourceUrl, note })
        }

        function addSplitText(text: string, note: string) {
            String(text ?? '')
                .split(/\n|\t|\||•|·|, {2,}/)
                .map((part) => part.trim())
                .filter(Boolean)
                .forEach((part) => addCandidate(part, note))
        }

        const selectorGroups = [
            [
                'main table tbody tr',
                'main [role="row"]',
                'main [role="gridcell"]',
                'main [role="cell"]',
                'table tbody tr',
                '[role="row"]',
            ],
            [
                'main [data-testid*="trend" i]',
                'main [class*="trend" i]',
                'main [class*="keyword" i]',
                'main [class*="card" i]',
                '[data-testid*="trend" i]',
                '[class*="trend" i]',
                '[class*="keyword" i]',
                '[class*="card" i]',
            ],
            [
                'main li',
                'main h1',
                'main h2',
                'main h3',
                'main h4',
            ],
        ]

        selectorGroups.forEach((selectors) => {
            if (result.length >= limit) return
            document.querySelectorAll(selectors.join(',')).forEach((element) => {
                if (result.length >= limit) return
                if (!isVisible(element) || isNavigationElement(element)) return

                const text = (element as HTMLElement).innerText || element.textContent || ''
                addSplitText(text, element.tagName.toLowerCase())

                const ariaLabel = element.getAttribute('aria-label')
                if (ariaLabel) addSplitText(ariaLabel, 'aria-label')
                const title = element.getAttribute('title')
                if (title) addSplitText(title, 'title')
            })
        })

        return result.slice(0, limit)
    }

    function isUsableResearchUrl(value?: string, allowEtsy = false) {
        if (!value) return false
        try {
            const url = new URL(value)
            return /(^|\.)everbee\.io$/i.test(url.hostname) || (allowEtsy && /(^|\.)etsy\.com$/i.test(url.hostname))
        } catch {
            return false
        }
    }

    function isUsableErankUrl(value?: string) {
        if (!value) return false
        try {
            const url = new URL(value)
            return /(^|\.)erank\.com$/i.test(url.hostname)
        } catch {
            return false
        }
    }

    function getMarketState(): MarketState {
        return {
            active: marketActive,
            mode: marketMode,
            currentKeyword: marketCurrentKeyword,
            remaining: marketQueue.length,
            results: marketResults,
            error: marketError,
        }
    }

    function saveMarketState() {
        chrome.storage.local.set({ marketState: getMarketState() })
    }

    async function startCaptureProcess() {
        isProcessingImages = true

        try {
            const url = new URL(currentApiUrl)
            url.searchParams.append('projectId', currentProjectId)

            const response = await fetch(url.toString())
            if (!response.ok) {
                throw new Error(`API fetch failed: ${response.statusText}`)
            }

            const data = await response.json()
            if (!data.listings || data.listings.length === 0) {
                isProcessingImages = false
                return
            }

            imageQueue = data.listings
            processNextImage()
        } catch (error) {
            isProcessingImages = false
            throw error
        }
    }

    function processNextImage() {
        if (imageQueue.length === 0) {
            isProcessingImages = false
            return
        }

        const item = imageQueue.shift()
        if (!item) return

        chrome.tabs.create({ url: item.product_link, active: false }, (tab) => {
            const createError = chrome.runtime.lastError?.message
            if (createError || !tab?.id) {
                scheduleNextImage()
                return
            }

            activeImageTabId = tab.id
            tabTimeoutId = setTimeout(() => closeCurrentImageTabAndContinue(), 15000)
        })
    }

    async function handleContentResponse(request: { action: string; imageUrl?: string; listingId?: string; error?: string }) {
        if (tabTimeoutId) {
            clearTimeout(tabTimeoutId)
            tabTimeoutId = null
        }

        if (request.action === 'IMAGE_FOUND') {
            try {
                await fetch(currentApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project_id: currentProjectId,
                        listing_id: request.listingId,
                        image_url: request.imageUrl,
                    }),
                })
            } catch (error) {
                console.error('[Etsy Image Capture] API error', error)
            }
        }

        closeCurrentImageTabAndContinue()
    }

    function closeCurrentImageTabAndContinue() {
        if (activeImageTabId) {
            chrome.tabs.remove(activeImageTabId, () => {
                const _message = chrome.runtime.lastError?.message
                activeImageTabId = null
                scheduleNextImage()
            })
        } else {
            scheduleNextImage()
        }
    }

    function scheduleNextImage() {
        const delayMs = Math.floor(Math.random() * 4000) + 3000
        setTimeout(processNextImage, delayMs)
    }

    async function processNextMarketKeyword(runId = marketRunId) {
        marketTimerId = null
        if (!marketActive || runId !== marketRunId) return

        const keyword = marketQueue.shift()
        if (!keyword) {
            if (runId !== marketRunId) return
            marketActive = false
            marketCurrentKeyword = ''
            saveMarketState()
            focusMarketFinderTab()
            return
        }

        marketCurrentKeyword = keyword
        saveMarketState()

        try {
            const response = await withTimeout(
                marketMode === 'erank'
                    ? runKeywordInErankTab(await ensureErankTab(), keyword)
                    : runEverbeeKeyword(keyword),
                MARKET_KEYWORD_TIMEOUT_MS,
                `${marketMode === 'erank' ? 'eRank' : 'EverBee'} timed out for "${keyword}". Skipped this keyword.`
            )
            if (!marketActive || runId !== marketRunId) return
            if (response.ok && response.result) {
                const result = sanitizeMarketResult(response.result)
                if (marketMode === 'erank' && !result.erankAttemptedAt) {
                    result.erankAttemptedAt = result.erankCheckedAt || new Date().toISOString()
                }
                marketResults.push(result)
            } else {
                marketResults.push(buildFailedMarketResult(keyword, response.error || `${marketMode === 'erank' ? 'eRank' : 'EverBee'}調査に失敗しました。`))
            }
        } catch (error) {
            if (!marketActive || runId !== marketRunId) return
            const message = error instanceof Error ? error.message : 'Unexpected Market Finder extension error.'
            marketError = message
            marketResults.push(buildFailedMarketResult(keyword, message))
        }

        saveMarketState()
        if (!marketActive || runId !== marketRunId) return
        marketTimerId = setTimeout(() => processNextMarketKeyword(runId), marketDelayMs)
    }

    async function runEverbeeKeyword(keyword: string) {
        const tabId = await ensureEverbeeTab()
        await navigateEverbeeProductAnalytics(tabId, keyword)
        return runKeywordInEverbeeTab(tabId, keyword)
    }

    function buildFailedMarketResult(keyword: string, error: string): MarketResult {
        const attemptedAt = new Date().toISOString()
        return {
            keyword,
            listingsAnalyzed: '',
            topMonthlySales: '',
            topRevenue: '',
            averagePrice: '',
            listingAge: '',
            visibleListingCount: '',
            sellingListingCount: '',
            recentSellingListingCount: '',
            medianMonthlySales: '',
            medianMonthlyRevenue: '',
            totalVisibleMonthlySales: '',
            topSalesShare: '',
            medianListingAgeMonths: '',
            everbeeCheckedAt: '',
            productRows: [],
            erankSearchVolume: '',
            erankClicks: '',
            erankCtr: '',
            erankCompetition: '',
            erankKeywordDifficulty: '',
            erankTrend: '',
            erankCheckedAt: '',
            erankAttemptedAt: marketMode === 'erank' ? attemptedAt : '',
            notes: error,
            error,
        }
    }

    function sanitizeMarketResult(result: MarketResult): MarketResult {
        const next = { ...result }
        const hasYearPoison = isKeywordYear(next.averagePrice, next.keyword) || isKeywordYear(next.listingAge, next.keyword)
        if (!hasYearPoison) return next

        if (isKeywordYear(next.topRevenue, next.keyword)) {
            next.topRevenue = normalizeMetricNumber(next.topMonthlySales) === '0' ? '0' : ''
        }
        next.averagePrice = ''
        next.listingAge = ''
        next.notes = next.notes.includes('year-like fields ignored')
            ? next.notes
            : `${next.notes} / year-like fields ignored`
        return next
    }

    function isKeywordYear(value: string, keyword: string) {
        const normalizedValue = normalizeMetricNumber(value)
        if (!/^(?:19|20)\d{2}$/.test(normalizedValue)) return false

        const keywordYears: string[] = keyword.match(/\b(?:19|20)\d{2}\b/g) ?? []
        return keywordYears.includes(normalizedValue)
    }

    function normalizeMetricNumber(value: string) {
        return String(value ?? '').replace(/[$,%\s,]/g, '')
    }

    function ensureEverbeeTab(): Promise<number> {
        return new Promise((resolve, reject) => {
            if (marketTabId !== null) {
                chrome.tabs.get(marketTabId, (tab) => {
                    if (!chrome.runtime.lastError && tab?.id) {
                        resolve(tab.id)
                        return
                    }

                    marketTabId = null
                    createEverbeeTab(resolve, reject)
                })
                return
            }

            findOpenResearchTab()
                .then((tabId) => {
                    if (tabId !== null) {
                        marketTabId = tabId
                        resolve(tabId)
                        return
                    }

                    createEverbeeTab(resolve, reject)
                })
                .catch(() => createEverbeeTab(resolve, reject))
        })
    }

    function navigateEverbeeProductAnalytics(tabId: number, keyword: string) {
        return new Promise<void>((resolve, reject) => {
            const url = `https://app.everbee.io/product-analytics?search_term=${encodeURIComponent(keyword)}`
            updateTabUrlAndActivate(tabId, url)
                .then(() => waitForTabComplete(tabId))
                .then(() => setTimeout(resolve, 3500))
                .catch(reject)
        })
    }

    function updateTabUrlAndActivate(tabId: number, url: string, attempt = 0): Promise<chrome.tabs.Tab> {
        return new Promise((resolve, reject) => {
            chrome.tabs.update(tabId, { url, active: true }, (tab) => {
                const updateError = chrome.runtime.lastError?.message
                if (updateError) {
                    if (shouldRetryTabEditError(updateError) && attempt < 2) {
                        setTimeout(() => {
                            updateTabUrlAndActivate(tabId, url, attempt + 1).then(resolve).catch(reject)
                        }, 800)
                        return
                    }
                    reject(new Error(updateError || 'EverBee Product Analyticsを開けませんでした。'))
                    return
                }
                if (!tab?.id) {
                    reject(new Error('EverBee Product Analyticsを開けませんでした。'))
                    return
                }

                if (tab.windowId !== undefined) focusWindowQuietly(tab.windowId)
                resolve(tab)
            })
        })
    }

    function findOpenResearchTab(): Promise<number | null> {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
                const activeTab = activeTabs[0]
                if (activeTab?.id && isUsableResearchUrl(activeTab.url, true)) {
                    resolve(activeTab.id)
                    return
                }

                chrome.tabs.query({}, (tabs) => {
                    const tab = tabs.find((item) => item.id && isUsableResearchUrl(item.url))
                    resolve(tab?.id ?? null)
                })
            })
        })
    }

    function createEverbeeTab(resolve: (tabId: number) => void, reject: (error: Error) => void) {
        chrome.tabs.create({ url: marketEverbeeUrl, active: true }, async (tab) => {
            const createError = chrome.runtime.lastError?.message
            if (createError || !tab?.id) {
                reject(new Error(createError || 'EverBeeタブを開けませんでした。'))
                return
            }

            marketTabId = tab.id
            try {
                await activateTab(tab.id)
                await waitForTabComplete(tab.id)
                resolve(tab.id)
            } catch (error) {
                reject(error instanceof Error ? error : new Error('EverBeeタブの読み込みに失敗しました。'))
            }
        })
    }

    function ensureErankTab(): Promise<number> {
        return new Promise((resolve, reject) => {
            if (erankTabId !== null) {
                chrome.tabs.get(erankTabId, (tab) => {
                    if (!chrome.runtime.lastError && tab?.id) {
                        activateTab(tab.id).then(() => resolve(tab.id as number))
                        return
                    }

                    erankTabId = null
                    createErankTab(resolve, reject)
                })
                return
            }

            findOpenErankTab()
                .then((tabId) => {
                    if (tabId !== null) {
                        erankTabId = tabId
                        activateTab(tabId).then(() => resolve(tabId))
                        return
                    }

                    createErankTab(resolve, reject)
                })
                .catch(() => createErankTab(resolve, reject))
        })
    }

    function findOpenErankTab(): Promise<number | null> {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
                const activeTab = activeTabs[0]
                if (activeTab?.id && isUsableErankUrl(activeTab.url)) {
                    resolve(activeTab.id)
                    return
                }

                chrome.tabs.query({}, (tabs) => {
                    const tab = tabs.find((item) => item.id && isUsableErankUrl(item.url))
                    resolve(tab?.id ?? null)
                })
            })
        })
    }

    function createErankTab(resolve: (tabId: number) => void, reject: (error: Error) => void) {
        chrome.tabs.create({ url: marketErankUrl, active: true }, async (tab) => {
            const createError = chrome.runtime.lastError?.message
            if (createError || !tab?.id) {
                reject(new Error(createError || 'eRankタブを開けませんでした。'))
                return
            }

            erankTabId = tab.id
            try {
                await activateTab(tab.id)
                await waitForTabComplete(tab.id)
                resolve(tab.id)
            } catch (error) {
                reject(error instanceof Error ? error : new Error('eRankタブの読み込みに失敗しました。'))
            }
        })
    }

    function waitForTabComplete(tabId: number) {
        return new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener)
                reject(new Error('ページの読み込みがタイムアウトしました。'))
            }, 30000)

            const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    clearTimeout(timeoutId)
                    chrome.tabs.onUpdated.removeListener(listener)
                    setTimeout(() => resolve(), 1500)
                }
            }

            chrome.tabs.onUpdated.addListener(listener)
            chrome.tabs.get(tabId, (tab) => {
                if (tab?.status === 'complete') {
                    clearTimeout(timeoutId)
                    chrome.tabs.onUpdated.removeListener(listener)
                    setTimeout(() => resolve(), 1500)
                }
            })
        })
    }

    type EverbeeTabResponse = {
        ok: boolean
        result?: MarketResult
        error?: string
    }

    type ErankTabResponse = {
        ok: boolean
        result?: MarketResult
        error?: string
    }

    async function runKeywordInEverbeeTab(tabId: number, keyword: string): Promise<EverbeeTabResponse> {
        await activateTab(tabId)
        const firstTry = await sendEverbeeMessage(tabId, keyword)
        if (firstTry.ok || !firstTry.error?.includes('Receiving end does not exist')) return firstTry

        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['dist/everbeeContent.js'],
        })

        await activateTab(tabId)
        return sendEverbeeMessage(tabId, keyword)
    }

    async function runKeywordInErankTab(tabId: number, keyword: string): Promise<ErankTabResponse> {
        await activateTab(tabId)
        const firstTry = await sendErankMessage(tabId, keyword)
        if (firstTry.ok || !firstTry.error?.includes('Receiving end does not exist')) return firstTry

        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['dist/erankContent.js'],
        })

        await activateTab(tabId)
        return sendErankMessage(tabId, keyword)
    }

    function sendEverbeeMessage(tabId: number, keyword: string): Promise<EverbeeTabResponse> {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: 'EVERBEE_RUN_KEYWORD', keyword }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: chrome.runtime.lastError.message })
                    return
                }
                resolve(response as EverbeeTabResponse)
            })
        })
    }

    function sendErankMessage(tabId: number, keyword: string): Promise<ErankTabResponse> {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: 'ERANK_RUN_KEYWORD', keyword }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: chrome.runtime.lastError.message })
                    return
                }
                resolve(response as ErankTabResponse)
            })
        })
    }
})()
