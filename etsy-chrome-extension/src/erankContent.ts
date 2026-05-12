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

    type ErankMetricKey = 'erankSearchVolume' | 'erankClicks' | 'erankCtr' | 'erankCompetition' | 'erankKeywordDifficulty' | 'erankTrend'
    type ErankColumnKey = ErankMetricKey | 'keyword'
    type ErankMetrics = Record<ErankMetricKey, string>

    const ERANK_METRIC_KEYS: ErankMetricKey[] = [
        'erankSearchVolume',
        'erankClicks',
        'erankCtr',
        'erankCompetition',
        'erankKeywordDifficulty',
        'erankTrend',
    ]

    function emptyErankMetrics(): ErankMetrics {
        return {
            erankSearchVolume: '',
            erankClicks: '',
            erankCtr: '',
            erankCompetition: '',
            erankKeywordDifficulty: '',
            erankTrend: '',
        }
    }

    function normalizeMetricForKey(value: string, key: ErankMetricKey) {
        const normalized = normalizeText(value)
        if (/^(unknown|n\/a|no data|-)$/i.test(normalized)) return ''
        const numbers = (normalized.match(/-?\d[\d,.]*/g) ?? []).map((match) => match.replace(/,/g, ''))
        if (numbers.length === 0) return normalizeMetric(normalized)

        if (key === 'erankKeywordDifficulty') {
            const kdValue = numbers.find((number) => {
                const parsed = Number(number)
                return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
            })
            return kdValue ?? numbers[numbers.length - 1]
        }

        if (key === 'erankTrend') return numbers[numbers.length - 1]
        return numbers[0]
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

    async function revealKeywordIdeasTable() {
        const elements = Array.from(document.querySelectorAll('button, [role="tab"], a, h1, h2, h3, div, span')) as HTMLElement[]
        const keywordIdeasTab = elements.find((element) => /^keyword ideas$/i.test(elementText(element)))
        if (keywordIdeasTab) {
            keywordIdeasTab.click()
            await wait(300)
        }

        const tableAnchor = elements.find((element) => /keywords related to|keyword ideas|near matches/i.test(elementText(element)))
        if (tableAnchor) {
            tableAnchor.scrollIntoView({ block: 'center' })
            await wait(700)
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

    function headerColumnKey(value: string): ErankColumnKey | '' {
        const text = normalizeText(value)
            .toLowerCase()
            .replace(/[^\w\s.]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        if (/^keywords?\b|^keyword ideas?\b|^search term\b/.test(text)) return 'keyword'
        if (/^search\s*trend\b|^trend\b/.test(text)) return 'erankTrend'
        if (/^(avg\.?|average)\s*searches?\b/.test(text)) return 'erankSearchVolume'
        if (/^(avg\.?|average)\s*clicks?\b/.test(text)) return 'erankClicks'
        if (/^(avg\.?|average)\s*ctr\b|^ctr\b|^click.*through\b/.test(text)) return 'erankCtr'
        if (/^etsy\s*competition\b|^competition\b/.test(text)) return 'erankCompetition'
        if (/^kd\b|^keyword difficulty\b|^difficulty\b/.test(text)) return 'erankKeywordDifficulty'
        return ''
    }

    function isVisibleElement(element: HTMLElement) {
        const rect = element.getBoundingClientRect()
        if (rect.width <= 1 || rect.height <= 1) return false
        const style = window.getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0
    }

    function elementText(element: Element) {
        const html = element as HTMLElement
        return normalizeText(html.innerText || element.textContent || '')
    }

    function hasSameTextChild(element: HTMLElement, text: string) {
        return Array.from(element.children).some((child) => elementText(child) === text)
    }

    function normalizeKeywordText(value: string) {
        return normalizeText(value).toLowerCase().replace(/[^\w\s'-]/g, '').replace(/\s+/g, ' ').trim()
    }

    function metricValueLooksUsable(value: string, key: ErankMetricKey) {
        if (!value) return false
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return true
        if (key === 'erankKeywordDifficulty') return parsed >= 0 && parsed <= 100
        if (key === 'erankCtr') return parsed >= 0 && parsed <= 500
        return true
    }

    function metricNumberTokens(value: string) {
        return (normalizeText(value).match(/-?\d[\d,.]*%?/g) ?? [])
            .map((token) => token.replace(/[,%]/g, ''))
            .filter((token) => token !== '')
    }

    function orderedMetricsFromText(rowText: string, keyword: string): ErankMetrics {
        const result = emptyErankMetrics()
        const keywordIndex = rowText.toLowerCase().indexOf(keyword.toLowerCase())
        const metricText = keywordIndex >= 0 ? rowText.slice(keywordIndex + keyword.length) : rowText
        const numbers = metricNumberTokens(metricText)
        if (numbers.length < 5) return result

        const ordered = numbers.length >= 6 ? numbers.slice(-6) : ['', ...numbers.slice(-5)]
        const [trend, searches, clicks, ctr, competition, kd] = ordered
        const assignments: Array<[ErankMetricKey, string]> = [
            ['erankTrend', trend],
            ['erankSearchVolume', searches],
            ['erankClicks', clicks],
            ['erankCtr', ctr],
            ['erankCompetition', competition],
            ['erankKeywordDifficulty', kd],
        ]

        for (const [key, value] of assignments) {
            if (metricValueLooksUsable(value, key)) result[key] = value
        }

        return result
    }

    function orderedMetricsFromRowText(row: HTMLElement, keyword: string): ErankMetrics {
        return orderedMetricsFromText(elementText(row), keyword)
    }

    function metricValueFromPoint(row: HTMLElement, key: ErankMetricKey, columnCenter: number) {
        const rowRect = row.getBoundingClientRect()
        const y = Math.max(rowRect.top + 4, Math.min(rowRect.bottom - 4, rowRect.top + rowRect.height / 2))
        const candidates: HTMLElement[] = []

        for (const element of document.elementsFromPoint(columnCenter, y)) {
            let current = element as HTMLElement | null
            while (current && current !== row) {
                if (row.contains(current)) candidates.push(current)
                current = current.parentElement
            }
        }

        for (const candidate of candidates) {
            const text = elementText(candidate)
            if (!text || text.length > 80) continue
            const value = normalizeMetricForKey(text, key)
            if (metricValueLooksUsable(value, key)) return value
        }

        return ''
    }

    function collectVisualColumns() {
        const candidates = (Array.from(document.querySelectorAll('th, [role="columnheader"], span, div, button')) as HTMLElement[])
            .filter(isVisibleElement)
            .map((element) => {
                const text = elementText(element)
                const key = headerColumnKey(text)
                const rect = element.getBoundingClientRect()
                return { element, text, key, rect }
            })
            .filter((item): item is { element: HTMLElement, text: string, key: ErankColumnKey, rect: DOMRect } => {
                if (!item.key || item.text.length > 45 || hasSameTextChild(item.element, item.text)) return false
                return item.rect.width > 5 && item.rect.height > 5
            })

        let bestGroup: typeof candidates = []
        let bestScore = -1

        for (const candidate of candidates) {
            const group = candidates.filter((item) => Math.abs(item.rect.top - candidate.rect.top) <= 28)
            const keys = new Set(group.map((item) => item.key))
            const metricCount = ERANK_METRIC_KEYS.filter((key) => keys.has(key)).length
            const score = metricCount * 10 + (keys.has('keyword') ? 5 : 0) + candidate.rect.top / 1000
            if (score > bestScore) {
                bestScore = score
                bestGroup = group
            }
        }

        const columns = new Map<ErankColumnKey, { left: number, right: number, center: number, top: number }>()
        for (const key of ['keyword', ...ERANK_METRIC_KEYS] as ErankColumnKey[]) {
            const matches = bestGroup
                .filter((item) => item.key === key)
                .sort((a, b) => a.rect.width - b.rect.width || a.rect.left - b.rect.left)
            const match = matches[0]
            if (!match) continue
            columns.set(key, {
                left: match.rect.left,
                right: match.rect.right,
                center: match.rect.left + match.rect.width / 2,
                top: match.rect.top,
            })
        }

        return columns
    }

    function closestMetricValue(row: HTMLElement, key: ErankMetricKey, columnCenter: number) {
        const pointedValue = metricValueFromPoint(row, key, columnCenter)
        if (pointedValue) return pointedValue

        if (key === 'erankCompetition' || key === 'erankKeywordDifficulty') return ''

        const rowRect = row.getBoundingClientRect()
        const cells = (Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"], span, strong, div, a')) as HTMLElement[])
            .filter(isVisibleElement)
            .map((element) => {
                const text = elementText(element)
                const rect = element.getBoundingClientRect()
                const value = normalizeMetricForKey(text, key)
                return { element, text, rect, value }
            })
            .filter((item) => {
                if (!item.text || item.text.length > 80 || hasSameTextChild(item.element, item.text)) return false
                if (item.rect.top < rowRect.top - 2 || item.rect.bottom > rowRect.bottom + 2) return false
                if (!metricValueLooksUsable(item.value, key)) return false
                return /\d|unknown|n\/a|no data|-/i.test(item.text)
            })
            .sort((a, b) => Math.abs((a.rect.left + a.rect.width / 2) - columnCenter) - Math.abs((b.rect.left + b.rect.width / 2) - columnCenter))

        const maxDistance = 145
        const match = cells.find((item) => Math.abs((item.rect.left + item.rect.width / 2) - columnCenter) <= maxDistance)
        return match?.value ?? ''
    }

    function findVisualRowForKeyword(keyword: string, columns: Map<ErankColumnKey, { left: number, right: number, center: number, top: number }>) {
        const target = normalizeKeywordText(keyword)
        const headerTop = columns.get('keyword')?.top ?? 0
        const keywordCenter = columns.get('keyword')?.center
        const exactKeywordElements = (Array.from(document.querySelectorAll('a, span, strong, td, [role="cell"], [role="gridcell"], div')) as HTMLElement[])
            .filter(isVisibleElement)
            .filter((element) => normalizeKeywordText(elementText(element)) === target)
            .filter((element) => {
                if (keywordCenter === undefined) return true
                const rect = element.getBoundingClientRect()
                return Math.abs((rect.left + rect.width / 2) - keywordCenter) <= 220
            })

        const rows: HTMLElement[] = []
        for (const element of exactKeywordElements) {
            let current: HTMLElement | null = element
            for (let depth = 0; current && depth < 9; depth += 1) {
                const rect = current.getBoundingClientRect()
                const text = elementText(current)
                const numericCount = (text.match(/\d[\d,.]*/g) ?? []).length
                const looksLikeRow = rect.top > headerTop
                    && rect.width >= 500
                    && rect.height >= 28
                    && rect.height <= 150
                    && numericCount >= 3
                    && !/avg\.?\s*searches|avg\.?\s*clicks|etsy competition/i.test(text)
                if (looksLikeRow) {
                    rows.push(current)
                    break
                }
                current = current.parentElement
            }
        }

        return rows.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0] ?? null
    }

    function textLooksLikeKeywordCell(text: string) {
        const keyword = meaningfulKeyword(text)
        if (!keyword || !/[a-z]/i.test(keyword)) return false
        if (/^\d[\d,.]*%?$/.test(keyword)) return false
        if (/avg\.?|average|competition|clicks?|searches?|ctr|^kd$/i.test(keyword)) return false
        return true
    }

    function closestKeywordValue(row: HTMLElement, columnCenter: number) {
        const rowRect = row.getBoundingClientRect()
        const cells = (Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"], span, strong, div, a')) as HTMLElement[])
            .filter(isVisibleElement)
            .map((element) => {
                const text = elementText(element)
                const rect = element.getBoundingClientRect()
                return { element, text, rect }
            })
            .filter((item) => {
                if (!textLooksLikeKeywordCell(item.text) || item.text.length > 120 || hasSameTextChild(item.element, item.text)) return false
                if (item.rect.top < rowRect.top - 2 || item.rect.bottom > rowRect.bottom + 2) return false
                return true
            })
            .sort((a, b) => Math.abs((a.rect.left + a.rect.width / 2) - columnCenter) - Math.abs((b.rect.left + b.rect.width / 2) - columnCenter))

        return meaningfulKeyword(cells[0]?.text ?? '')
    }

    function collectVisualRows(columns: Map<ErankColumnKey, { left: number, right: number, center: number, top: number }>) {
        const headerTop = columns.get('keyword')?.top ?? 0
        const keywordCenter = columns.get('keyword')?.center
        const seen = new Set<HTMLElement>()
        const rows: HTMLElement[] = []

        function addRow(row: HTMLElement) {
            if (seen.has(row) || !isVisibleElement(row)) return
            const rect = row.getBoundingClientRect()
            const text = elementText(row)
            const numericCount = (text.match(/\d[\d,.]*/g) ?? []).length
            const looksLikeRow = rect.top > headerTop
                && rect.width >= 500
                && rect.height >= 28
                && rect.height <= 150
                && numericCount >= 3
                && !/avg\.?\s*searches|avg\.?\s*clicks|etsy competition/i.test(text)
            if (!looksLikeRow) return
            seen.add(row)
            rows.push(row)
        }

        ;(Array.from(document.querySelectorAll('tr, [role="row"]')) as HTMLElement[]).forEach(addRow)

        const keywordCells = (Array.from(document.querySelectorAll('a, span, strong, td, [role="cell"], [role="gridcell"], div')) as HTMLElement[])
            .filter(isVisibleElement)
            .filter((element) => textLooksLikeKeywordCell(elementText(element)))
            .filter((element) => {
                if (keywordCenter === undefined) return true
                const rect = element.getBoundingClientRect()
                return Math.abs((rect.left + rect.width / 2) - keywordCenter) <= 240
            })

        for (const element of keywordCells) {
            let current: HTMLElement | null = element
            for (let depth = 0; current && depth < 9; depth += 1) {
                addRow(current)
                if (seen.has(current)) break
                current = current.parentElement
            }
        }

        return rows.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
    }

    function extractFromVisualGrid(keyword: string): ErankMetrics {
        const columns = collectVisualColumns()
        if (!columns.has('erankSearchVolume') || !columns.has('erankClicks')) return emptyErankMetrics()

        const row = findVisualRowForKeyword(keyword, columns)
        if (!row) return emptyErankMetrics()

        const result = emptyErankMetrics()
        const orderedMetrics = orderedMetricsFromRowText(row, keyword)
        for (const key of ERANK_METRIC_KEYS) {
            const column = columns.get(key)
            result[key] = orderedMetrics[key] || (column ? closestMetricValue(row, key, column.center) : '')
        }

        return result
    }

    function extractVisualRelatedKeywordRows(sourceKeyword: string): ErankResult[] {
        const columns = collectVisualColumns()
        const keywordColumn = columns.get('keyword')
        if (!keywordColumn || !columns.has('erankSearchVolume') || !columns.has('erankClicks')) return []

        const results: ErankResult[] = []
        const seen = new Set<string>()
        const sourceKey = normalizeKeywordText(sourceKeyword)

        for (const row of collectVisualRows(columns)) {
            const keyword = closestKeywordValue(row, keywordColumn.center)
            const key = normalizeKeywordText(keyword)
            if (!keyword || !key || key === sourceKey || seen.has(key)) continue

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

            const orderedMetrics = orderedMetricsFromRowText(row, keyword)
            for (const metricKey of ERANK_METRIC_KEYS) {
                const column = columns.get(metricKey)
                result[metricKey] = orderedMetrics[metricKey] || (column ? closestMetricValue(row, metricKey, column.center) : '')
            }

            const hasUsefulMetric = result.erankSearchVolume || result.erankClicks || result.erankCompetition || result.erankKeywordDifficulty
            if (!hasUsefulMetric) continue

            seen.add(key)
            results.push(result)
            if (results.length >= 40) return results
        }

        return results
    }

    function keywordTokenScore(value: string, keyword: string) {
        const source = value.toLowerCase()
        const tokens = keyword.toLowerCase().split(/\s+/).filter((token) => token.length >= 3)
        return tokens.reduce((score, token) => score + (source.includes(token) ? 1 : 0), 0)
    }

    function extractFromTables(keyword: string) {
        const tables = Array.from(document.querySelectorAll('table, [role="table"], [role="grid"]')) as HTMLElement[]
        const empty = emptyErankMetrics()

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
            const orderedMetrics = orderedMetricsFromText(cells.join(' '), keyword)
            headerMap.forEach((key, index) => {
                if (!key || !cells[index]) return
                if (key === 'keyword') return
                const metricKey = key as ErankMetricKey
                result[metricKey] = orderedMetrics[metricKey] || normalizeMetricForKey(cells[index], metricKey)
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
        const visualResults = extractVisualRelatedKeywordRows(sourceKeyword)
        if (visualResults.length > 0) return visualResults

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

                const orderedMetrics = orderedMetricsFromText(cells.join(' '), keyword)
                headerMap.forEach((field, index) => {
                    if (!field || field === 'keyword' || !cells[index]) return
                    if (field in result) {
                        const metricKey = field as ErankMetricKey
                        ;(result as unknown as Record<string, string>)[field] = orderedMetrics[metricKey] || normalizeMetricForKey(cells[index], metricKey)
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
        const visualMetrics = extractFromVisualGrid(keyword)
        const tableMetrics = extractFromTables(keyword)
        const erankSearchVolume = visualMetrics.erankSearchVolume || tableMetrics.erankSearchVolume || metricByRegex(['Average Searches', 'Avg Searches', 'Searches'], bodyText)
        const erankClicks = visualMetrics.erankClicks || tableMetrics.erankClicks || metricByRegex(['Average Clicks', 'Avg Clicks', 'Clicks'], bodyText)
        const erankCtr = visualMetrics.erankCtr || tableMetrics.erankCtr || metricByRegex(['Average CTR', 'Avg CTR', 'CTR'], bodyText)
        const erankCompetition = visualMetrics.erankCompetition || tableMetrics.erankCompetition
        const erankKeywordDifficulty = visualMetrics.erankKeywordDifficulty || tableMetrics.erankKeywordDifficulty
        const erankTrend = visualMetrics.erankTrend || tableMetrics.erankTrend || metricByRegex(['Search Trend', 'Trend'], bodyText)
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
        await revealKeywordIdeasTable()
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
