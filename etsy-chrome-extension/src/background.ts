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
        erankSearchVolume?: string
        erankClicks?: string
        erankCtr?: string
        erankCompetition?: string
        erankKeywordDifficulty?: string
        erankTrend?: string
        notes: string
        listingSnippets?: string[]
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
    let marketEverbeeUrl = 'https://app.everbee.io/'
    let marketErankUrl = 'https://erank.com/tools/keyword-tool'
    let marketCurrentKeyword = ''
    let marketError = ''
    let marketDelayMs = 4500

    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
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
            saveMarketState()
            processNextMarketKeyword()
            sendResponse({ started: true })
            return true
        }

        if (request.action === 'START_ERANK_RESEARCH') {
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
            saveMarketState()
            processNextMarketKeyword()
            sendResponse({ started: true })
            return true
        }

        if (request.action === 'STOP_MARKET_RESEARCH') {
            marketActive = false
            marketQueue = []
            marketCurrentKeyword = ''
            saveMarketState()
            sendResponse({ stopped: true })
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
            if (!tab?.id) {
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

    async function processNextMarketKeyword() {
        if (!marketActive) return

        const keyword = marketQueue.shift()
        if (!keyword) {
            marketActive = false
            marketCurrentKeyword = ''
            saveMarketState()
            return
        }

        marketCurrentKeyword = keyword
        saveMarketState()

        try {
            const response = marketMode === 'erank'
                ? await runKeywordInErankTab(await ensureErankTab(), keyword)
                : await runEverbeeKeyword(keyword)
            if (response.ok && response.result) {
                marketResults.push(sanitizeMarketResult(response.result))
            } else {
                marketResults.push(buildFailedMarketResult(keyword, response.error || `${marketMode === 'erank' ? 'eRank' : 'EverBee'}調査に失敗しました。`))
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected Market Finder extension error.'
            marketError = message
            marketResults.push(buildFailedMarketResult(keyword, message))
        }

        saveMarketState()
        setTimeout(processNextMarketKeyword, marketDelayMs)
    }

    async function runEverbeeKeyword(keyword: string) {
        const tabId = await ensureEverbeeTab()
        await navigateEverbeeProductAnalytics(tabId, keyword)
        return runKeywordInEverbeeTab(tabId, keyword)
    }

    function buildFailedMarketResult(keyword: string, error: string): MarketResult {
        return {
            keyword,
            listingsAnalyzed: '',
            topMonthlySales: '',
            topRevenue: '',
            averagePrice: '',
            listingAge: '',
            erankSearchVolume: '',
            erankClicks: '',
            erankCtr: '',
            erankCompetition: '',
            erankKeywordDifficulty: '',
            erankTrend: '',
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
            chrome.tabs.update(tabId, { url, active: true }, (tab) => {
                if (chrome.runtime.lastError || !tab?.id) {
                    reject(new Error(chrome.runtime.lastError?.message || 'EverBee Product Analyticsを開けませんでした。'))
                    return
                }

                waitForTabComplete(tabId)
                    .then(() => setTimeout(resolve, 3500))
                    .catch(reject)
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
            if (!tab?.id) {
                reject(new Error('EverBeeタブを開けませんでした。'))
                return
            }

            marketTabId = tab.id
            try {
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
                        chrome.tabs.update(tab.id, { active: true }, () => resolve(tab.id as number))
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
                        chrome.tabs.update(tabId, { active: true }, () => resolve(tabId))
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
            if (!tab?.id) {
                reject(new Error('eRankタブを開けませんでした。'))
                return
            }

            erankTabId = tab.id
            try {
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
                reject(new Error('EverBeeタブの読み込みがタイムアウトしました。'))
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
        const firstTry = await sendEverbeeMessage(tabId, keyword)
        if (firstTry.ok || !firstTry.error?.includes('Receiving end does not exist')) return firstTry

        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['dist/everbeeContent.js'],
        })

        return sendEverbeeMessage(tabId, keyword)
    }

    async function runKeywordInErankTab(tabId: number, keyword: string): Promise<ErankTabResponse> {
        const firstTry = await sendErankMessage(tabId, keyword)
        if (firstTry.ok || !firstTry.error?.includes('Receiving end does not exist')) return firstTry

        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['dist/erankContent.js'],
        })

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
