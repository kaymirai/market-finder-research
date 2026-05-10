(() => {
    type ErankRunRequest = {
        action: 'ERANK_RUN_KEYWORD'
        keyword: string
    }

    type ErankResult = {
        keyword: string
        listingsAnalyzed: string
        topMonthlySales: string
        topRevenue: string
        averagePrice: string
        listingAge: string
        erankSearchVolume: string
        erankClicks: string
        erankCtr: string
        erankCompetition: string
        erankKeywordDifficulty: string
        erankTrend: string
        notes: string
        rawText: string
        relatedKeywords?: ErankResult[]
    }

    type EditableSearchField = HTMLInputElement | HTMLTextAreaElement | HTMLElement

    const SEARCH_SELECTORS = [
        'input[type="search"]',
        'input[placeholder*="keyword" i]',
        'input[placeholder*="search" i]',
        'input[aria-label*="keyword" i]',
        'input[aria-label*="search" i]',
        'input[name*="keyword" i]',
        'input[id*="keyword" i]',
        'textarea[placeholder*="keyword" i]',
        '[role="searchbox"]',
        '[role="combobox"] input',
        '[contenteditable="true"]',
    ]

    const SEARCH_BUTTON_WORDS = ['search', 'lookup', 'submit', 'go', 'find', 'analyze']

    function wait(ms: number) {
        return new Promise((resolve) => window.setTimeout(resolve, ms))
    }

    function normalizeText(value: string) {
        return value.replace(/\s+/g, ' ').trim()
    }

    function normalizeMetric(value: string) {
        const normalized = normalizeText(value)
        if (/^(unknown|n\/a|no data|-)$/i.test(normalized)) return ''
        const numberMatch = normalized.match(/-?\d[\d,.]*/)
        if (numberMatch) return numberMatch[0].replace(/,/g, '')
        return normalized.replace(/[$,%]/g, '').trim()
    }

    function isTextInput(element: EditableSearchField): element is HTMLInputElement | HTMLTextAreaElement {
        return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    }

    function setNativeValue(element: EditableSearchField, value: string) {
        if (!isTextInput(element)) {
            element.focus()
            document.execCommand('selectAll', false)
            document.execCommand('insertText', false, value)
            element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
            element.dispatchEvent(new Event('change', { bubbles: true }))
            return
        }

        const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')

        if (descriptor?.set) {
            descriptor.set.call(element, value)
        } else {
            element.value = value
        }

        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
    }

    function elementLooksSearchable(element: EditableSearchField) {
        if (isTextInput(element)) {
            if (element.disabled || element.readOnly) return false
            const type = element instanceof HTMLInputElement ? element.type.toLowerCase() : 'textarea'
            if (['hidden', 'checkbox', 'radio', 'submit', 'button', 'file', 'range'].includes(type)) return false
        }

        const text = [
            (element as HTMLInputElement).placeholder ?? '',
            element.getAttribute('aria-label') ?? '',
            element.getAttribute('role') ?? '',
            (element as HTMLInputElement).name ?? '',
            (element as HTMLInputElement).id ?? '',
            (element as HTMLElement).innerText ?? '',
            element.className ? String(element.className) : '',
        ].join(' ').toLowerCase()

        return /(keyword|search|query|etsy|phrase|term)/.test(text)
    }

    function findSearchField(): EditableSearchField | null {
        for (const selector of SEARCH_SELECTORS) {
            const element = document.querySelector(selector) as EditableSearchField | null
            if (element && elementLooksSearchable(element)) return element
        }

        const fields = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="searchbox"]')) as EditableSearchField[]
        return fields.find((element) => elementLooksSearchable(element)) ?? null
    }

    async function submitSearch(field: EditableSearchField) {
        const form = field.closest('form')
        const formButton = form?.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement | null
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')) as HTMLElement[]
        const button = buttons.find((item) => {
            const text = `${item.innerText ?? ''} ${(item as HTMLInputElement).value ?? ''} ${item.getAttribute('aria-label') ?? ''}`.toLowerCase()
            return SEARCH_BUTTON_WORDS.some((word) => text.includes(word))
        })

        field.focus()
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
        field.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }))
        field.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
        await wait(500)

        if (formButton) {
            formButton.click()
            return
        }

        if (button) button.click()
    }

    async function waitForLikelyResults(keyword: string) {
        const startedAt = Date.now()
        let lastText = ''
        let stableCount = 0

        while (Date.now() - startedAt < 18000) {
            await wait(900)
            const text = normalizeText(document.body.innerText || '')
            const hasMetric = /(average searches|avg searches|average clicks|avg clicks|etsy competition|search trend|competition|ctr)/i.test(text)
            const hasKeyword = text.toLowerCase().includes(keyword.toLowerCase().slice(0, 16))

            if (text === lastText) {
                stableCount += 1
            } else {
                stableCount = 0
                lastText = text
            }

            if (hasMetric && (stableCount >= 1 || hasKeyword)) return
        }
    }

    function describeElement(element: Element) {
        const html = element as HTMLElement
        const input = element as HTMLInputElement
        return [
            element.tagName.toLowerCase(),
            input.type ? `type=${input.type}` : '',
            input.placeholder ? `placeholder=${input.placeholder}` : '',
            input.name ? `name=${input.name}` : '',
            input.id ? `id=${input.id}` : '',
            element.getAttribute('role') ? `role=${element.getAttribute('role')}` : '',
            element.getAttribute('aria-label') ? `aria-label=${element.getAttribute('aria-label')}` : '',
            normalizeText(html.innerText ?? '').slice(0, 80),
        ].filter(Boolean).join(' | ')
    }

    function collectSearchDiagnostics() {
        const candidates = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="searchbox"], button, [role="button"]'))
            .map(describeElement)
            .filter(Boolean)
            .slice(0, 30)

        const text = normalizeText(document.body.innerText || '').slice(0, 700)
        return `eRankの検索欄を見つけられませんでした。eRank Keyword Toolを開いてから再実行してください。URL=${location.href} candidates=${candidates.join(' || ')} pageText=${text}`
    }

    function metricByRegex(labels: string[], bodyText: string) {
        for (const label of labels) {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(`${escaped}\\s*[:\\-]?\\s*([$]?\\d[\\d,.]*(?:\\.\\d+)?\\s*(?:%|k|m)?)`, 'i')
            const match = bodyText.match(regex)
            if (match?.[1]) return normalizeMetric(match[1])
        }

        return ''
    }

    function headerKey(value: string) {
        const text = value.toLowerCase()
        if (/keywords?|keyword ideas?|search term/.test(text)) return 'keyword'
        if (/search\s*trend|trend/.test(text)) return 'erankTrend'
        if (/avg|average/.test(text) && /search/.test(text)) return 'erankSearchVolume'
        if (/searches/.test(text) && !/google/.test(text)) return 'erankSearchVolume'
        if (/avg|average/.test(text) && /click/.test(text)) return 'erankClicks'
        if (/clicks/.test(text)) return 'erankClicks'
        if (/ctr|click.*through/.test(text)) return 'erankCtr'
        if (/etsy/.test(text) && /competition/.test(text)) return 'erankCompetition'
        if (/competition/.test(text)) return 'erankCompetition'
        if (/\bkd\b|keyword difficulty|difficulty/.test(text)) return 'erankKeywordDifficulty'
        return ''
    }

    function keywordTokenScore(value: string, keyword: string) {
        const source = value.toLowerCase()
        const tokens = keyword.toLowerCase().split(/\s+/).filter((token) => token.length >= 3)
        return tokens.reduce((score, token) => score + (source.includes(token) ? 1 : 0), 0)
    }

    function extractFromTables(keyword: string) {
        const tables = Array.from(document.querySelectorAll('table, [role="table"], [role="grid"]')) as HTMLElement[]
        const empty = {
            erankSearchVolume: '',
            erankClicks: '',
            erankCtr: '',
            erankCompetition: '',
            erankKeywordDifficulty: '',
            erankTrend: '',
        }

        for (const table of tables) {
            const headerCells = Array.from(table.querySelectorAll('th, [role="columnheader"]')) as HTMLElement[]
            let headers = headerCells.map((cell) => normalizeText(cell.innerText || cell.textContent || ''))

            if (headers.length === 0) {
                const firstRow = table.querySelector('tr, [role="row"]')
                headers = Array.from(firstRow?.querySelectorAll('td, th, [role="cell"], [role="gridcell"], [role="columnheader"]') ?? [])
                    .map((cell) => normalizeText((cell as HTMLElement).innerText || cell.textContent || ''))
            }

            const headerMap = headers.map(headerKey)
            if (!headerMap.some(Boolean)) continue

            const rows = Array.from(table.querySelectorAll('tr, [role="row"]')) as HTMLElement[]
            const dataRows = rows
                .map((row) => Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"]')) as HTMLElement[])
                .filter((cells) => cells.length > 0)
                .map((cells) => cells.map((cell) => normalizeText(cell.innerText || cell.textContent || '')))
                .filter((cells) => keywordTokenScore(cells.join(' '), keyword) > 0)
                .sort((a, b) => keywordTokenScore(b.join(' '), keyword) - keywordTokenScore(a.join(' '), keyword))

            const cells = dataRows[0]
            if (!cells) continue

            const result = { ...empty }
            headerMap.forEach((key, index) => {
                if (!key || !cells[index]) return
                if (key === 'keyword') return
                result[key as keyof typeof result] = normalizeMetric(cells[index])
            })

            if (Object.values(result).some(Boolean)) return result
        }

        return empty
    }

    function meaningfulKeyword(value: string) {
        const cleaned = normalizeText(value)
            .replace(/^[★☆⋮\s]+/, '')
            .replace(/\s+/g, ' ')
            .trim()
        if (!cleaned || cleaned.length < 3 || cleaned.length > 120) return ''
        if (/^(keywords?|search trend|avg\.?|average|competition|kd)$/i.test(cleaned)) return ''
        if (/unknown|no data to show/i.test(cleaned)) return ''
        return cleaned
    }

    function extractRelatedKeywordRows(sourceKeyword: string): ErankResult[] {
        const tables = Array.from(document.querySelectorAll('table, [role="table"], [role="grid"]')) as HTMLElement[]
        const results: ErankResult[] = []
        const seen = new Set<string>()

        for (const table of tables) {
            const headerCells = Array.from(table.querySelectorAll('th, [role="columnheader"]')) as HTMLElement[]
            let headers = headerCells.map((cell) => normalizeText(cell.innerText || cell.textContent || ''))

            if (headers.length === 0) {
                const firstRow = table.querySelector('tr, [role="row"]')
                headers = Array.from(firstRow?.querySelectorAll('td, th, [role="cell"], [role="gridcell"], [role="columnheader"]') ?? [])
                    .map((cell) => normalizeText((cell as HTMLElement).innerText || cell.textContent || ''))
            }

            const headerMap = headers.map(headerKey)
            const keywordIndex = headerMap.findIndex((key) => key === 'keyword')
            const hasErankMetric = headerMap.some((key) => ['erankSearchVolume', 'erankClicks', 'erankCtr', 'erankCompetition', 'erankKeywordDifficulty', 'erankTrend'].includes(key))
            if (keywordIndex < 0 || !hasErankMetric) continue

            const rows = Array.from(table.querySelectorAll('tr, [role="row"]')) as HTMLElement[]
            for (const row of rows) {
                const cells = (Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"]')) as HTMLElement[])
                    .map((cell) => normalizeText(cell.innerText || cell.textContent || ''))
                if (cells.length <= keywordIndex) continue

                const keyword = meaningfulKeyword(cells[keywordIndex])
                const key = keyword.toLowerCase()
                if (!keyword || seen.has(key)) continue

                const result: ErankResult = {
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
                    notes: `Extracted from eRank related keywords for ${sourceKeyword}`,
                    rawText: '',
                }

                headerMap.forEach((field, index) => {
                    if (!field || field === 'keyword' || !cells[index]) return
                    if (field in result) {
                        ;(result as unknown as Record<string, string>)[field] = normalizeMetric(cells[index])
                    }
                })

                const hasUsefulMetric = result.erankSearchVolume || result.erankClicks || result.erankCompetition || result.erankKeywordDifficulty
                if (!hasUsefulMetric) continue

                seen.add(key)
                results.push(result)
                if (results.length >= 40) return results
            }
        }

        return results
    }

    function extractMetrics(keyword: string): ErankResult {
        const rawBodyText = document.body.innerText || ''
        const bodyText = normalizeText(rawBodyText)
        const tableMetrics = extractFromTables(keyword)
        const erankSearchVolume = tableMetrics.erankSearchVolume || metricByRegex(['Average Searches', 'Avg Searches', 'Searches'], bodyText)
        const erankClicks = tableMetrics.erankClicks || metricByRegex(['Average Clicks', 'Avg Clicks', 'Clicks'], bodyText)
        const erankCtr = tableMetrics.erankCtr || metricByRegex(['Average CTR', 'Avg CTR', 'CTR'], bodyText)
        const erankCompetition = tableMetrics.erankCompetition || metricByRegex(['Etsy Competition', 'Competition'], bodyText)
        const erankKeywordDifficulty = tableMetrics.erankKeywordDifficulty || metricByRegex(['Keyword Difficulty', 'KD'], bodyText)
        const erankTrend = tableMetrics.erankTrend || metricByRegex(['Search Trend', 'Trend'], bodyText)
        const relatedKeywords = extractRelatedKeywordRows(keyword)

        const notes = erankSearchVolume || erankClicks || erankCompetition || erankKeywordDifficulty || relatedKeywords.length > 0
            ? `Extracted from eRank screen${relatedKeywords.length > 0 ? ` / related ${relatedKeywords.length}` : ''}`
            : `eRank metrics not found. Check the eRank screen manually. URL=${location.href}`

        return {
            keyword,
            listingsAnalyzed: '',
            topMonthlySales: '',
            topRevenue: '',
            averagePrice: '',
            listingAge: '',
            erankSearchVolume,
            erankClicks,
            erankCtr,
            erankCompetition,
            erankKeywordDifficulty,
            erankTrend,
            notes,
            rawText: bodyText.slice(0, 1500),
            relatedKeywords,
        }
    }

    async function runKeyword(keyword: string) {
        const field = findSearchField()
        if (!field) throw new Error(collectSearchDiagnostics())

        field.scrollIntoView({ block: 'center' })
        field.focus()
        setNativeValue(field, keyword)
        await wait(250)
        await submitSearch(field)
        await wait(4500)
        await waitForLikelyResults(keyword)
        return extractMetrics(keyword)
    }

    chrome.runtime.onMessage.addListener((request: ErankRunRequest, _sender, sendResponse) => {
        if (request.action !== 'ERANK_RUN_KEYWORD') return false

        runKeyword(request.keyword)
            .then((result) => sendResponse({ ok: true, result }))
            .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : 'Unexpected eRank automation error.'
                sendResponse({ ok: false, error: message })
            })

        return true
    })
})()
