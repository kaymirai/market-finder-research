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

    type YoutubeOcrKeyword = {
        keyword: string
        source: string
        timestamp: string
        confidence: number
        rawText: string
        frame: number
        note: string
    }

    type YoutubeNativeOcrResult = {
        ok: boolean
        text?: string
        error?: string
        detector?: string
        currentTime?: number
        title?: string
        crop?: {
            width: number
            height: number
        }
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
    let marketFinderTabId: number | null = null
    let marketEverbeeUrl = 'https://app.everbee.io/'
    let marketErankUrl = 'https://erank.com/tools/keyword-tool'
    let marketCurrentKeyword = ''
    let marketError = ''
    let marketDelayMs = 4500

    const trendSourceConfigs: Record<TrendSourceId, TrendSourceConfig> = {
        erank: {
            id: 'erank',
            label: 'eRank Trend Buzz',
            url: 'https://members.erank.com/trend-buzz',
        },
        etsy: {
            id: 'etsy',
            label: 'Etsy Marketplace Insights',
            url: 'https://www.etsy.com/your/shops/me/stats',
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
            saveMarketState()
            processNextMarketKeyword()
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
            saveMarketState()
            processNextMarketKeyword()
            sendResponse({ started: true })
            return true
        }

        if (request.action === 'COLLECT_TRENDS') {
            rememberMarketFinderTab(sender)
            collectTrendSources(request.sources, request.limit)
                .then((response) => sendResponse(response))
                .catch((error: Error) => sendResponse({
                    ok: false,
                    trends: [],
                    errors: [error.message],
                }))
            return true
        }

        if (request.action === 'CAPTURE_YOUTUBE_OCR') {
            rememberMarketFinderTab(sender)
            captureYoutubeOcr(request)
                .then((response) => sendResponse(response))
                .catch((error: Error) => sendResponse({
                    ok: false,
                    rows: [],
                    error: error.message,
                }))
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

    async function collectTrendSources(sources: unknown, limit: unknown) {
        const configs = normalizeTrendSources(sources)
        const perSourceLimit = Math.max(6, Math.min(Number(limit) || 18, 40))
        const trends: TrendCandidate[] = []
        const errors: string[] = []
        const seen = new Set<string>()

        for (const config of configs) {
            try {
                const sourceTrends = await collectTrendSource(config, perSourceLimit)
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

    async function collectTrendSource(config: TrendSourceConfig, limit: number): Promise<TrendCandidate[]> {
        const tab = await openTrendSourceTab(config)
        await waitForTabComplete(tab.tabId)
        await delay(4500)

        const trends = await extractTrendsFromTab(tab.tabId, config, limit)
        if (trends.length > 0) {
            if (tab.created) closeTabQuietly(tab.tabId)
            return trends
        }

        throw new Error('候補語が見つかりませんでした。ログイン後、ページを表示してから再実行してください。')
    }

    function openTrendSourceTab(config: TrendSourceConfig): Promise<TrendSourceTab> {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({}, (tabs) => {
                const existing = tabs.find((tab) => tab.id && isTrendSourceUrl(tab.url, config.id))
                if (existing?.id) {
                    resolve({ tabId: existing.id, created: false })
                    return
                }

                chrome.tabs.create({ url: config.url, active: false }, (tab) => {
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

    async function captureYoutubeOcr(request: {
        durationSec?: number
        intervalMs?: number
        maxKeywords?: number
    }) {
        const tabId = await findYoutubeTab()
        const tab = await getTabById(tabId)
        if (tab.windowId === undefined) throw new Error('YouTubeタブのウィンドウを確認できませんでした。')

        await activateTab(tabId)

        const durationSec = Math.max(5, Math.min(Number(request.durationSec) || 30, 180))
        const intervalMs = Math.max(500, Math.min(Number(request.intervalMs) || 1000, 5000))
        const maxFrames = Math.max(1, Math.min(Math.ceil((durationSec * 1000) / intervalMs), 180))
        const maxKeywords = Math.max(20, Math.min(Number(request.maxKeywords) || 300, 1000))
        const rows: YoutubeOcrKeyword[] = []
        const seen = new Set<string>()
        const rawFrames: string[] = []
        let detector = ''
        let title = ''
        let lastError = ''

        for (let frame = 1; frame <= maxFrames && rows.length < maxKeywords; frame += 1) {
            const currentTab = await getTabById(tabId)
            const dataUrl = await captureVisibleTabImage(currentTab.windowId ?? tab.windowId)
            const ocr = await ocrCapturedImageInTab(tabId, dataUrl)
            if (!ocr.ok) {
                lastError = ocr.error || 'Chromeの画面OCRが使えませんでした。'
                break
            }

            detector = ocr.detector || detector
            title = ocr.title || title
            const frameText = String(ocr.text ?? '').trim()
            if (frameText) rawFrames.push(frameText)

            const timestamp = formatOcrTimestamp(ocr.currentTime)
            extractYoutubeKeywordsFromOcrText(frameText).forEach((keyword) => {
                const key = keyword.toLowerCase()
                if (seen.has(key) || rows.length >= maxKeywords) return
                seen.add(key)
                rows.push({
                    keyword,
                    source: 'YouTube OCR',
                    timestamp,
                    confidence: detector === 'TextDetector' ? 0.65 : 0.5,
                    rawText: frameText,
                    frame,
                    note: title ? `YouTube: ${title}` : 'YouTube video OCR',
                })
            })

            if (frame < maxFrames && rows.length < maxKeywords) await delay(intervalMs)
        }

        focusMarketFinderTab()

        if (!detector && lastError) {
            return {
                ok: false,
                rows,
                frames: rawFrames.length,
                error: `${lastError} ChromeのTextDetectorが無効な環境では、動画内文字の自動OCRはできません。`,
            }
        }

        return {
            ok: rows.length > 0,
            rows,
            frames: rawFrames.length,
            detector,
            title,
            warning: rows.length === 0 ? '文字は読めましたが、キーワードらしい行を抽出できませんでした。動画を大きく表示し、キーワード表が見えている場面で再実行してください。' : '',
        }
    }

    function findYoutubeTab(): Promise<number> {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
                const activeTab = activeTabs[0]
                if (activeTab?.id && isYoutubeUrl(activeTab.url)) {
                    resolve(activeTab.id)
                    return
                }

                chrome.tabs.query({}, (tabs) => {
                    const tab = tabs.find((item) => item.id && isYoutubeUrl(item.url))
                    if (tab?.id) {
                        resolve(tab.id)
                        return
                    }
                    reject(new Error('YouTube動画タブが見つかりません。動画ページを開き、キーワード表が見える状態で再実行してください。'))
                })
            })
        })
    }

    function isYoutubeUrl(value?: string) {
        if (!value) return false
        try {
            const url = new URL(value)
            return /(^|\.)youtube\.com$/i.test(url.hostname) || /(^|\.)youtu\.be$/i.test(url.hostname)
        } catch {
            return false
        }
    }

    function getTabById(tabId: number): Promise<chrome.tabs.Tab> {
        return new Promise((resolve, reject) => {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError || !tab?.id) {
                    reject(new Error(chrome.runtime.lastError?.message || 'タブを確認できませんでした。'))
                    return
                }
                resolve(tab)
            })
        })
    }

    function captureVisibleTabImage(windowId: number): Promise<string> {
        return new Promise((resolve, reject) => {
            chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
                if (chrome.runtime.lastError || !dataUrl) {
                    reject(new Error(chrome.runtime.lastError?.message || 'YouTube画面をキャプチャできませんでした。YouTubeタブで拡張アイコンを一度クリックしてから再実行してください。'))
                    return
                }
                resolve(dataUrl)
            })
        })
    }

    async function ocrCapturedImageInTab(tabId: number, dataUrl: string): Promise<YoutubeNativeOcrResult> {
        const injection = await chrome.scripting.executeScript({
            target: { tabId },
            func: ocrCapturedImageInPage,
            args: [dataUrl],
        })

        const result = injection[0]?.result as YoutubeNativeOcrResult | undefined
        return result ?? { ok: false, error: 'OCR結果を受け取れませんでした。' }
    }

    async function ocrCapturedImageInPage(dataUrl: string): Promise<YoutubeNativeOcrResult> {
        type TextDetection = {
            rawValue?: string
        }
        type NativeTextDetector = new () => {
            detect(source: CanvasImageSource): Promise<TextDetection[]>
        }

        const detectorConstructor = (window as Window & { TextDetector?: NativeTextDetector }).TextDetector
        if (!detectorConstructor) {
            return { ok: false, error: 'ChromeのTextDetector OCRが利用できません。' }
        }

        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error('キャプチャ画像を読み込めませんでした。'))
            img.src = dataUrl
        })

        const dpr = window.devicePixelRatio || 1
        const video = document.querySelector('video')
        const rect = video?.getBoundingClientRect()
        const imageWidth = image.naturalWidth || image.width
        const imageHeight = image.naturalHeight || image.height
        let sx = Math.round(imageWidth * 0.04)
        let sy = Math.round(imageHeight * 0.08)
        let sw = Math.round(imageWidth * 0.92)
        let sh = Math.round(imageHeight * 0.78)

        if (rect && rect.width > 80 && rect.height > 80) {
            sx = Math.max(0, Math.round(rect.left * dpr))
            sy = Math.max(0, Math.round(rect.top * dpr))
            sw = Math.min(imageWidth - sx, Math.round(rect.width * dpr))
            sh = Math.min(imageHeight - sy, Math.round(rect.height * dpr))
        }

        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, sw)
        canvas.height = Math.max(1, sh)
        const context = canvas.getContext('2d')
        if (!context) return { ok: false, error: 'OCR用キャンバスを作れませんでした。' }
        context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

        const detector = new detectorConstructor()
        const detections = await detector.detect(canvas)
        const text = detections
            .map((item) => item.rawValue)
            .filter((value): value is string => Boolean(value))
            .join('\n')

        const currentTime = Number((video as HTMLVideoElement | null)?.currentTime ?? 0)
        const title = String(document.title ?? '').replace(/\s*-\s*YouTube\s*$/i, '').trim()

        return {
            ok: true,
            text,
            detector: 'TextDetector',
            currentTime: Number.isFinite(currentTime) ? currentTime : 0,
            title,
            crop: {
                width: canvas.width,
                height: canvas.height,
            },
        }
    }

    function extractYoutubeKeywordsFromOcrText(text: string) {
        const ignoredExact = new Set([
            'youtube',
            'share',
            'save',
            'subscribe',
            'subscribed',
            'like',
            'comments',
            'replay',
            'play',
            'pause',
            'settings',
            'full screen',
            'closed captions',
            'keyword',
            'keywords',
            'etsy',
            'searches',
            'competition',
            'rank',
            'volume',
        ])
        const ignoredPattern = /\b(?:youtube|subscribe|subscribed|comments?|views?|likes?|share|save|playlist|autoplay|settings|caption|transcript|sponsor|affiliate|download|template|search volume|competition|keyword tool|erank|everbee)\b/i
        const seen = new Set<string>()
        const results: string[] = []

        String(text ?? '')
            .split(/\n|\r|•|·|;|\t/)
            .map((line) => line.trim())
            .filter(Boolean)
            .forEach((line) => {
                const keyword = cleanYoutubeOcrLine(line)
                const key = keyword.toLowerCase()
                if (!keyword || seen.has(key)) return
                if (ignoredExact.has(key) || ignoredPattern.test(keyword)) return
                if (!/[a-z]/i.test(keyword)) return
                if (/^[\d\s,.$%+-]+$/.test(keyword)) return
                if (/https?:|www\.|@/.test(keyword)) return
                const words = keyword.split(/\s+/).filter(Boolean)
                if (words.length < 1 || words.length > 7) return
                if (keyword.length < 3 || keyword.length > 70) return
                if (words.some((word) => word.length > 24)) return
                seen.add(key)
                results.push(keyword)
            })

        return results
    }

    function cleanYoutubeOcrLine(value: string) {
        return String(value ?? '')
            .replace(/\u00a0/g, ' ')
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/[|_]/g, ' ')
            .replace(/^[#\s]*\d{1,4}[\).\]:\-\s]+/, '')
            .replace(/\b(?:top|rank|score|searches|clicks|competition|volume)\b\s*[:=-]?\s*\d[\d,.$%]*/gi, '')
            .replace(/\d[\d,.$%]*\s*(?:searches|clicks|views|competition|results)\b/gi, '')
            .replace(/[^a-z0-9\s'&+/-]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^[^\w]+|[^\w]+$/g, '')
            .trim()
            .toLowerCase()
    }

    function formatOcrTimestamp(seconds: number | undefined) {
        const total = Math.max(0, Math.floor(Number(seconds) || 0))
        const hours = Math.floor(total / 3600)
        const minutes = Math.floor((total % 3600) / 60)
        const secs = total % 60
        const pad = (value: number) => String(value).padStart(2, '0')
        return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`
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

    async function processNextMarketKeyword() {
        if (!marketActive) return

        const keyword = marketQueue.shift()
        if (!keyword) {
            marketActive = false
            marketCurrentKeyword = ''
            saveMarketState()
            focusMarketFinderTab()
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
