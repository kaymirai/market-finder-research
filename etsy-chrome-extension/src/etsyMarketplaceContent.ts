(() => {
    type EtsyMarketplaceCaptureRequest = {
        action: 'ETSY_MARKETPLACE_CAPTURE'
        query: string
    }

    type EtsyMarketplaceRelatedKeywordMetric = {
        keyword: string
        etsySearches30d: number | null
        etsyListings: number | null
        conversionLabel: string
    }

    type EtsyMarketplaceInsightResult = {
        ok: boolean
        keyword: string
        etsySearches30d: number | null
        etsyListings: number | null
        etsySearchTrendPercent?: number | null
        etsyRelatedTerms: string[]
        etsyRelatedKeywordMetrics: EtsyMarketplaceRelatedKeywordMetric[]
        etsyCheckedAt: string | null
        remainingSearches: number | null
        error: string
    }

    function normalize(value: string) {
        return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    }

    function isDateAxisLabel(value: string) {
        const label = String(value ?? '').replace(/\s+/g, ' ').trim()
        return /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?$/i.test(label)
            || /^\d{1,2}月\d{1,2}日$/.test(label)
    }

    function parseCompactNumber(value: string): number | null {
        const match = String(value ?? '')
            .replace(/\u00a0/g, ' ')
            .match(/(\d[\d,]*(?:\.\d+)?)\s*(千|万|百万|億|[kmb])?/i)
        if (!match) return null

        const suffix = String(match[2] ?? '').toLowerCase()
        let multiplier = 1
        if (suffix === 'k' || suffix === '千') multiplier = 1_000
        else if (suffix === '万') multiplier = 10_000
        else if (suffix === 'm' || suffix === '百万') multiplier = 1_000_000
        else if (suffix === '億') multiplier = 100_000_000
        else if (suffix === 'b') multiplier = 1_000_000_000

        const numeric = Number(match[1].replace(/,/g, ''))
        return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : null
    }

    function extractVisibleResult(expectedQuery: string): EtsyMarketplaceInsightResult {
        const root = document.querySelector('main, [role="main"]') ?? document.body
        const pageText = (root as HTMLElement)?.innerText ?? ''
        if (/slow down,\s*buddy|uh oh!|あらら|まあまあ、そう焦らずに/i.test(pageText)) {
            return {
                ok: false,
                keyword: expectedQuery,
                etsySearches30d: null,
                etsyListings: null,
                etsyRelatedTerms: [],
                etsyRelatedKeywordMetrics: [],
                etsyCheckedAt: null,
                remainingSearches: null,
                error: 'ETSY_MARKETPLACE_RATE_LIMITED: Etsy側の連続検索制限に達しました。',
            }
        }

        const inputs = root.querySelectorAll<HTMLInputElement>([
            'input[type="search"]',
            'input[name*="keyword" i]',
            'input[placeholder*="keyword" i]',
            'input[aria-label*="keyword" i]',
        ].join(','))
        const actualQuery = String(Array.from(inputs)[0]?.value ?? expectedQuery).trim()
        const expectedKey = normalize(expectedQuery)
        const actualKey = normalize(actualQuery)
        if (expectedKey && actualKey && expectedKey !== actualKey) {
            return {
                ok: false,
                keyword: actualQuery,
                etsySearches30d: null,
                etsyListings: null,
                etsyRelatedTerms: [],
                etsyRelatedKeywordMetrics: [],
                etsyCheckedAt: null,
                remainingSearches: null,
                error: `表示中の語句は「${actualQuery}」です。「${expectedQuery}」の結果を待っています。`,
            }
        }

        let etsySearches30d: number | null = null
        let etsyListings: number | null = null
        const etsyRelatedTerms: string[] = []
        const etsyRelatedKeywordMetrics: EtsyMarketplaceRelatedKeywordMetric[] = []
        const seenRelatedKeys = new Set<string>()

        for (const row of Array.from(root.querySelectorAll<HTMLElement>('tr, [role="row"]'))) {
            const cells = Array.from(row.querySelectorAll<HTMLElement>('th, td, [role="cell"], [role="rowheader"]'))
                .map((cell) => String(cell.innerText ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
                .filter(Boolean)
            if (cells.length < 3) continue

            const keyword = cells[0]
            const keywordKey = normalize(keyword)
            if (!keywordKey) continue
            const searches = parseCompactNumber(cells[1])
            const listings = parseCompactNumber(cells[2])

            if (keywordKey === (actualKey || expectedKey)) {
                etsySearches30d = searches
                etsyListings = listings
                continue
            }
            if (!/[a-z]/i.test(keyword) || isDateAxisLabel(keyword) || searches === null || listings === null) continue
            if (seenRelatedKeys.has(keywordKey) || etsyRelatedTerms.length >= 100) continue

            seenRelatedKeys.add(keywordKey)
            etsyRelatedTerms.push(keyword)
            etsyRelatedKeywordMetrics.push({
                keyword,
                etsySearches30d: searches,
                etsyListings: listings,
                conversionLabel: String(cells[3] ?? '').trim(),
            })
        }

        const remainingMatch = pageText.match(/(\d+)\s+(?:free\s+)?search(?:es)?\s+(?:remaining|left)/i)
            ?? pageText.match(/(?:残り|あと)\s*(\d+)\s*(?:回|件)?/)
        const remainingSearches = remainingMatch ? Number(remainingMatch[1]) : null
        const ok = etsySearches30d !== null || etsyListings !== null

        return {
            ok,
            keyword: actualQuery || expectedQuery,
            etsySearches30d,
            etsyListings,
            etsySearchTrendPercent: null,
            etsyRelatedTerms,
            etsyRelatedKeywordMetrics,
            etsyCheckedAt: ok ? new Date().toISOString() : null,
            remainingSearches: Number.isFinite(remainingSearches) ? remainingSearches : null,
            error: ok ? '' : 'Etsyの表示中の結果行から検索数と検索結果を読み取れませんでした。',
        }
    }

    chrome.runtime.onMessage.addListener((request: EtsyMarketplaceCaptureRequest, _sender, sendResponse) => {
        if (request.action !== 'ETSY_MARKETPLACE_CAPTURE') return false

        try {
            sendResponse({ ok: true, result: extractVisibleResult(String(request.query ?? '')) })
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : String((error as { message?: unknown })?.message ?? error)
            sendResponse({
                ok: false,
                error: `ETSY_CONTENT_EXTRACT: ${message || 'Etsy Marketplace Insightsの取得に失敗しました。'}`,
            })
        }
        return true
    })
})()
