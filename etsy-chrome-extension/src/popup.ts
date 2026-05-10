(() => {
    type MarketState = {
        active: boolean
        currentKeyword: string
        remaining: number
        results: MarketResult[]
        error: string
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
        relatedKeywords?: MarketResult[]
        notes: string
    }

    const projectIdInput = document.getElementById('projectId') as HTMLInputElement
    const apiUrlInput = document.getElementById('apiUrl') as HTMLInputElement
    const statusDiv = document.getElementById('status') as HTMLDivElement
    const everbeeUrlInput = document.getElementById('everbeeUrl') as HTMLInputElement
    const marketJobInput = document.getElementById('marketJobInput') as HTMLTextAreaElement
    const maxKeywordsInput = document.getElementById('maxKeywords') as HTMLInputElement
    const marketStatus = document.getElementById('marketStatus') as HTMLDivElement
    const marketResults = document.getElementById('marketResults') as HTMLTextAreaElement

    document.addEventListener('DOMContentLoaded', () => {
        chrome.storage.local.get(['projectId', 'apiUrl', 'everbeeUrl', 'marketJobText', 'maxKeywords', 'marketState'], (result) => {
            if (result.projectId) projectIdInput.value = result.projectId as string
            if (result.apiUrl) apiUrlInput.value = result.apiUrl as string
            if (result.everbeeUrl) everbeeUrlInput.value = result.everbeeUrl as string
            if (result.marketJobText) marketJobInput.value = result.marketJobText as string
            if (result.maxKeywords) maxKeywordsInput.value = String(result.maxKeywords)
            if (result.marketState) renderMarketState(result.marketState as MarketState)
            refreshMarketState()
        })

        bindImageCapture()
        bindMarketFinder()
        window.setInterval(refreshMarketState, 1500)
    })

    function bindImageCapture() {
        document.getElementById('saveBtn')?.addEventListener('click', () => {
            const projectId = projectIdInput.value.trim()
            const apiUrl = apiUrlInput.value.trim()
            if (!projectId || !apiUrl) {
                statusDiv.textContent = 'Project IDとAPI URLを入力してください。'
                return
            }

            chrome.storage.local.set({ projectId, apiUrl }, () => {
                statusDiv.textContent = '保存しました。'
                setTimeout(() => { statusDiv.textContent = '' }, 2500)
            })
        })

        document.getElementById('startBtn')?.addEventListener('click', () => {
            const projectId = projectIdInput.value.trim()
            const apiUrl = apiUrlInput.value.trim()
            if (!projectId || !apiUrl) {
                statusDiv.textContent = '先に設定を保存してください。'
                return
            }

            chrome.runtime.sendMessage({ action: 'START_PROCESS', projectId, apiUrl }, (response) => {
                statusDiv.textContent = response?.started ? '画像取得を開始しました。' : `開始できませんでした: ${response?.error ?? 'Unknown error'}`
            })
        })
    }

    function bindMarketFinder() {
        document.getElementById('startMarketBtn')?.addEventListener('click', () => {
            const everbeeUrl = everbeeUrlInput.value.trim() || 'https://app.everbee.io/'
            const marketJobText = marketJobInput.value.trim()
            const maxKeywords = Math.max(1, Math.min(Number(maxKeywordsInput.value) || 5, 150))
            const keywords = parseKeywords(marketJobText).slice(0, maxKeywords)

            if (keywords.length === 0) {
                marketStatus.textContent = 'キーワードJSONまたは改行リストを貼り付けてください。'
                return
            }

            chrome.storage.local.set({ everbeeUrl, marketJobText, maxKeywords })
            chrome.runtime.sendMessage({ action: 'START_MARKET_RESEARCH', everbeeUrl, keywords }, (response) => {
                marketStatus.textContent = response?.started ? `${keywords.length}件の調査を開始しました。` : `開始できませんでした: ${response?.error ?? 'Unknown error'}`
                refreshMarketState()
            })
        })

        document.getElementById('stopMarketBtn')?.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'STOP_MARKET_RESEARCH' }, () => refreshMarketState())
        })

        document.getElementById('clearResultsBtn')?.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'CLEAR_MARKET_RESULTS' }, (state) => renderMarketState(state as MarketState))
        })

        document.getElementById('copyResultsBtn')?.addEventListener('click', async () => {
            await navigator.clipboard.writeText(marketResults.value)
            marketStatus.textContent = '結果CSVをコピーしました。'
        })
    }

    function parseKeywords(value: string) {
        if (!value.trim()) return []

        try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed?.keywords)) return cleanKeywords(parsed.keywords)
            if (Array.isArray(parsed)) return cleanKeywords(parsed)
        } catch {
            // Plain-text keyword list is handled below.
        }

        return cleanKeywords(value.split(/\r?\n|,/))
    }

    function cleanKeywords(values: unknown[]) {
        const seen = new Set<string>()
        return values
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)
            .filter((keyword) => {
                const key = keyword.toLowerCase()
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
            .slice(0, 150)
    }

    function refreshMarketState() {
        chrome.runtime.sendMessage({ action: 'GET_MARKET_STATE' }, (state) => {
            if (chrome.runtime.lastError || !state) return
            renderMarketState(state as MarketState)
        })
    }

    function renderMarketState(state: MarketState) {
        const done = state.results.length
        const status = state.active
            ? `調査中: ${state.currentKeyword || '-'} / 完了 ${done}件 / 残り ${state.remaining}件`
            : `待機中 / 完了 ${done}件`
        marketStatus.textContent = state.error ? `${status} / ${state.error}` : status
        marketResults.value = toCsv(state.results)
    }

    function csvEscape(value: string) {
        const source = String(value ?? '')
        if (!/[",\n\r]/.test(source)) return source
        return `"${source.replace(/"/g, '""')}"`
    }

    function toCsv(rows: MarketResult[]) {
        const header = ['Keyword', 'Listings Analyzed', 'Top Monthly Sales', 'Top Revenue', 'Average Price', 'Listing Age', 'eRank Search Volume', 'eRank Clicks', 'eRank CTR', 'eRank Competition', 'eRank KD', 'eRank Trend', 'Notes']
        const flatRows: MarketResult[] = []
        rows.forEach((row) => {
            flatRows.push(row)
            if (Array.isArray(row.relatedKeywords)) {
                row.relatedKeywords.forEach((related) => flatRows.push(related))
            }
        })
        const lines = flatRows.map((row: MarketResult) => {
            const safeRow = sanitizeMarketResult(row)
            return [
                safeRow.keyword,
                safeRow.listingsAnalyzed,
                safeRow.topMonthlySales,
                safeRow.topRevenue,
                safeRow.averagePrice,
                safeRow.listingAge,
                safeRow.erankSearchVolume ?? '',
                safeRow.erankClicks ?? '',
                safeRow.erankCtr ?? '',
                safeRow.erankCompetition ?? '',
                safeRow.erankKeywordDifficulty ?? '',
                safeRow.erankTrend ?? '',
                safeRow.notes,
            ].map(csvEscape).join(',')
        })

        return [header.join(','), ...lines].join('\n')
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
})()
