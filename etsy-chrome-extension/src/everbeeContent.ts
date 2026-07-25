(() => {
    type EverbeeRunRequest = {
        action: 'EVERBEE_RUN_KEYWORD'
        keyword: string
    }

    type EverbeeResult = {
        keyword: string
        listingsAnalyzed: string
        topMonthlySales: string
        topRevenue: string
        averagePrice: string
        listingAge: string
        visibleListingCount: string
        sellingListingCount: string
        recentSellingListingCount: string
        medianMonthlySales: string
        medianMonthlyRevenue: string
        totalVisibleMonthlySales: string
        topSalesShare: string
        medianListingAgeMonths: string
        everbeeCheckedAt: string
        notes: string
        listingSnippets: string[]
        productRows: EverbeeProductRow[]
        rawText: string
    }

    type EverbeeProductRow = {
        listingId: string
        title: string
        totalSales: number
        monthlySales: number
        monthlyRevenue: number
        listingAge: string
        listingAgeMonths: number | null
        price: number
        shopName: string
        reviews: number | null
    }

    // EverBee has renamed this column before, and a listing with no reviews is still a
    // usable row, so reviews are read from any of these and never gate the row.
    const REVIEW_FIELD_KEYS = ['reviews', 'totalReviews', 'reviewCount', 'numReviews', 'reviewsCount']

    type EditableSearchField = HTMLInputElement | HTMLTextAreaElement | HTMLElement

    const SEARCH_SELECTORS = [
        'input[type="search"]',
        'input[placeholder*="search" i]',
        'input[placeholder*="keyword" i]',
        'input[placeholder*="product" i]',
        'input[placeholder*="listing" i]',
        'input[aria-label*="search" i]',
        'input[aria-label*="keyword" i]',
        'textarea[placeholder*="search" i]',
        'textarea[placeholder*="keyword" i]',
        '[role="searchbox"]',
        '[role="combobox"] input',
        '[role="textbox"]',
        '[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"]',
    ]

    const SEARCH_BUTTON_WORDS = ['search', 'analyze', 'database', 'submit', 'go', 'run']

    function wait(ms: number) {
        return new Promise((resolve) => window.setTimeout(resolve, ms))
    }

    function normalizeText(value: string) {
        return value.replace(/\s+/g, ' ').trim()
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
        return `Search field not found. Open the EverBee Product Analytics/database search screen first. URL=${location.href} candidates=${candidates.join(' || ')} pageText=${text}`
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

        return /(search|keyword|query|product|listing|database|analytics|find|etsy)/.test(text)
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

        while (Date.now() - startedAt < 15000) {
            await wait(900)
            const text = normalizeText(document.body.innerText || '')
            const hasMetric = /(listings analyzed|monthly sales|top revenue|average price|listing age|revenue|sales|estimated sales)/i.test(text)
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

    function numberLike(pattern: RegExp, text: string) {
        const match = text.match(pattern)
        return match?.[1]?.trim() ?? ''
    }

    function findElementTextByLabels(labels: string[]) {
        const elements = Array.from(document.querySelectorAll('div, section, article, span, p, td, th, li'))
        const normalizedLabels = labels.map((label) => label.toLowerCase())

        for (const element of elements) {
            const ownText = normalizeText((element as HTMLElement).innerText ?? '')
            if (!ownText || ownText.length > 320) continue
            const lower = ownText.toLowerCase()
            if (!normalizedLabels.some((label) => lower.includes(label))) continue

            const direct = ownText.match(/([$]?\d[\d,]*(?:\.\d+)?\s*(?:k|m|mo\.|months?|years?|yrs?)?)/i)?.[1]
            if (direct && !normalizedLabels.some((label) => direct.toLowerCase().includes(label))) return direct.trim()

            const parentText = normalizeText((element.parentElement as HTMLElement | null)?.innerText ?? '')
            const parentValue = parentText.match(/([$]?\d[\d,]*(?:\.\d+)?\s*(?:k|m|mo\.|months?|years?|yrs?)?)/i)?.[1]
            if (parentValue) return parentValue.trim()
        }

        return ''
    }

    function metric(labels: string[], regexes: RegExp[], bodyText: string) {
        const elementValue = findElementTextByLabels(labels)
        if (elementValue) return elementValue

        for (const regex of regexes) {
            const value = numberLike(regex, bodyText)
            if (value) return value
        }

        return ''
    }

    function parseDisplayNumber(value: string) {
        const cleaned = value.replace(/[$,%\s,]/g, '')
        if (!cleaned) return null
        const parsed = Number(cleaned)
        return Number.isFinite(parsed) ? parsed : null
    }

    function parseTopSalesFromVisibleRows() {
        const candidates: number[] = []
        const rows = Array.from(document.querySelectorAll('[role="row"], tr'))

        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('[role="cell"], [role="gridcell"], td'))
                .map((cell) => normalizeText((cell as HTMLElement).innerText ?? ''))
                .filter(Boolean)

            if (cells.length < 2) continue

            const numbers = cells
                .map((cell) => cell.match(/^[$]?\d[\d,.]*$/)?.[0] ?? '')
                .filter(Boolean)
                .map(parseDisplayNumber)
                .filter((value): value is number => value !== null)

            if (numbers.length >= 2) {
                candidates.push(numbers[1])
            }
        }

        if (candidates.length === 0) return ''
        return String(Math.max(...candidates))
    }

    function isIntegerCell(value: string) {
        return /^\d[\d,]*$/.test(value)
    }

    function isCurrencyCell(value: string) {
        return /^\$[\d,.]+$/.test(value)
    }

    function isAgeCell(value: string) {
        return /^\d+\s*(?:Mo\.|Yr\.|Yrs\.|months?|years?|yrs?|days?)$/i.test(value)
    }

    function isPercentCell(value: string) {
        return /^[-+]?\d[\d,.]*%$/.test(value)
    }

    type VisibleAnalyticsRow = {
        totalSales: number
        monthlySales: number
        revenue: number
        listingAge: string
        price: number
    }

    type HarvestedRow = {
        listingId: string
        rowIndex: number
        fields: Record<string, string>
    }

    function harvestVisibleCells(rowsById: Map<string, HarvestedRow>) {
        const visibleRows = Array.from(document.querySelectorAll('[role="row"][data-id]')) as HTMLElement[]

        for (const row of visibleRows) {
            const listingId = normalizeText(row.getAttribute('data-id') ?? '')
            if (!listingId) continue

            const current = rowsById.get(listingId) ?? {
                listingId,
                rowIndex: Number(row.getAttribute('data-rowindex') ?? Number.MAX_SAFE_INTEGER),
                fields: {},
            }
            const cells = Array.from(row.querySelectorAll('[role="cell"][data-field]')) as HTMLElement[]
            for (const cell of cells) {
                const field = cell.getAttribute('data-field') ?? ''
                const value = normalizeText(cell.innerText || cell.textContent || '')
                if (field && value && !current.fields[field]) current.fields[field] = value
            }
            rowsById.set(listingId, current)
        }
    }

    // EverBee's grid virtualises columns: anything right of the viewport is not in the DOM,
    // and scrolling back removes it again. Cells are therefore harvested during the sweep
    // rather than read once at the end.
    async function collectEverbeeRowFields(): Promise<Map<string, HarvestedRow>> {
        const rowsById = new Map<string, HarvestedRow>()
        harvestVisibleCells(rowsById)

        const scroller = document.querySelector('.MuiDataGrid-virtualScroller') as HTMLElement | null
        if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return rowsById

        const originalLeft = scroller.scrollLeft
        for (let offset = 0; offset <= scroller.scrollWidth; offset += 400) {
            scroller.scrollLeft = offset
            await wait(200)
            harvestVisibleCells(rowsById)
        }
        scroller.scrollLeft = originalLeft
        await wait(250)
        harvestVisibleCells(rowsById)

        return rowsById
    }

    function buildEverbeeProductRows(rowsById: Map<string, HarvestedRow>): EverbeeProductRow[] {
        return Array.from(rowsById.values())
            .map((row) => {
                const title = normalizeText(row.fields.product ?? '')
                const totalSales = parseDisplayNumber(row.fields.totalSales)
                const monthlySales = parseDisplayNumber(row.fields.sales)
                const monthlyRevenue = parseDisplayNumber(row.fields.revenue)
                const listingAge = normalizeText(row.fields.listingAge ?? '')
                const price = parseDisplayNumber(row.fields.price)
                if (!title || totalSales === null || monthlySales === null || monthlyRevenue === null || !isAgeCell(listingAge) || price === null) {
                    return null
                }

                const reviewField = REVIEW_FIELD_KEYS.find((key) => row.fields[key] !== undefined)

                return {
                    listingId: row.listingId,
                    title,
                    totalSales,
                    monthlySales,
                    monthlyRevenue,
                    listingAge,
                    listingAgeMonths: parseAgeMonths(listingAge),
                    price,
                    shopName: normalizeText(row.fields.shopName ?? ''),
                    reviews: reviewField ? parseDisplayNumber(row.fields[reviewField]) : null,
                    rowIndex: row.rowIndex,
                }
            })
            .filter((row): row is EverbeeProductRow & { rowIndex: number } => row !== null)
            .sort((a, b) => b.monthlySales - a.monthlySales
                || b.monthlyRevenue - a.monthlyRevenue
                || b.totalSales - a.totalSales
                || a.rowIndex - b.rowIndex)
            .slice(0, 24)
            .map(({ rowIndex: _rowIndex, ...row }) => row)
    }

    function extractEverbeeProductRows(): EverbeeProductRow[] {
        const rowsById = new Map<string, HarvestedRow>()
        harvestVisibleCells(rowsById)
        return buildEverbeeProductRows(rowsById)
    }

    async function extractEverbeeProductRowsWithHiddenColumns(): Promise<EverbeeProductRow[]> {
        return buildEverbeeProductRows(await collectEverbeeRowFields())
    }

    function parseAgeMonths(value: string) {
        const numberMatch = value.match(/\d+(?:\.\d+)?/)
        if (!numberMatch) return null
        const amount = Number(numberMatch[0])
        if (!Number.isFinite(amount)) return null
        const source = value.toLowerCase()
        if (/\b(?:yr|yrs|year|years)\b/.test(source)) return Math.round(amount * 12)
        if (/\b(?:day|days)\b/.test(source)) return Math.max(1, Math.round(amount / 30))
        return Math.round(amount)
    }

    function rowAgeMonths(row: VisibleAnalyticsRow) {
        return parseAgeMonths(row.listingAge)
    }

    function median(values: number[]) {
        if (values.length === 0) return null
        const sorted = [...values].sort((a, b) => a - b)
        const middle = Math.floor(sorted.length / 2)
        if (sorted.length % 2 === 1) return sorted[middle]
        return (sorted[middle - 1] + sorted[middle]) / 2
    }

    function opportunityScore(row: VisibleAnalyticsRow) {
        const ageMonths = rowAgeMonths(row)
        const age = ageMonths ?? 999
        const freshBonus = age >= 2 && age <= 12 ? 45 : age <= 18 ? 22 : age <= 24 ? 8 : -18
        const salesScore = Math.min(45, row.monthlySales * 2)
        const revenueScore = Math.min(20, row.revenue / 50)
        const priceScore = row.price >= 12 && row.price <= 45 ? 8 : row.price > 0 ? 2 : 0
        const totalSalesPenalty = row.totalSales >= 1000 || age > 24 ? 12 : 0
        return freshBonus + salesScore + revenueScore + priceScore - totalSalesPenalty
    }

    function pickBestRows(rows: VisibleAnalyticsRow[]) {
        const bySales = rows.reduce<VisibleAnalyticsRow | null>((best, row) => {
            if (!best || row.monthlySales > best.monthlySales) return row
            return best
        }, null)
        const byRevenue = rows.reduce<VisibleAnalyticsRow | null>((best, row) => {
            if (!best || row.revenue > best.revenue) return row
            return best
        }, null)

        const recentCandidates = rows.filter((row) => {
            const age = rowAgeMonths(row)
            return age !== null && age >= 2 && age <= 12 && row.monthlySales >= 5
        })
        const warmCandidates = rows.filter((row) => {
            const age = rowAgeMonths(row)
            return age !== null && age <= 18 && row.monthlySales > 0
        })
        const sourceRows = recentCandidates.length > 0 ? recentCandidates : warmCandidates.length > 0 ? warmCandidates : rows
        const opportunity = sourceRows.reduce<VisibleAnalyticsRow | null>((best, row) => {
            if (!best || opportunityScore(row) > opportunityScore(best)) return row
            return best
        }, null)

        const source = recentCandidates.length > 0
            ? 'recent-sales'
            : warmCandidates.length > 0
                ? 'warm-sales'
                : bySales
                    ? 'sales-leader'
                    : 'none'

        return {
            opportunity,
            bySales,
            byRevenue,
            source,
        }
    }

    function summarizeVisibleProductAnalyticsRows(rows: VisibleAnalyticsRow[]) {
        const picked = pickBestRows(rows)
        const representativeRow = picked.opportunity ?? picked.bySales ?? picked.byRevenue
        const revenues = rows.map((row) => row.revenue)
        const monthlySales = rows.map((row) => row.monthlySales)
        const listingAges = rows.map(rowAgeMonths).filter((value): value is number => value !== null)
        const sellingRows = rows.filter((row) => row.monthlySales > 0)
        const recentSellingRows = sellingRows.filter((row) => {
            const age = rowAgeMonths(row)
            return age !== null && age <= 18
        })
        const prices = rows.map((row) => row.price)
        const bestRevenue = picked.byRevenue?.revenue ?? 0
        const bestSales = picked.bySales?.monthlySales ?? 0
        const bestRevenueAge = picked.byRevenue?.listingAge ?? ''
        const bestSalesAge = picked.bySales?.listingAge ?? ''
        const totalVisibleMonthlySales = monthlySales.length > 0
            ? monthlySales.reduce((sum, value) => sum + value, 0)
            : null

        return {
            topMonthlySales: rows.length > 0 ? String(bestSales) : '',
            topRevenue: rows.length > 0 ? String(bestRevenue) : '',
            averagePrice: prices.length > 0 ? (prices.reduce((sum, value) => sum + value, 0) / prices.length).toFixed(2) : '',
            listingAge: representativeRow?.listingAge ?? rows[0]?.listingAge ?? '',
            visibleListingCount: rows.length > 0 ? String(rows.length) : '',
            sellingListingCount: rows.length > 0 ? String(sellingRows.length) : '',
            recentSellingListingCount: rows.length > 0 ? String(recentSellingRows.length) : '',
            medianMonthlySales: monthlySales.length > 0 ? String(median(monthlySales)) : '',
            medianMonthlyRevenue: revenues.length > 0 ? String(median(revenues)) : '',
            totalVisibleMonthlySales: totalVisibleMonthlySales === null ? '' : String(totalVisibleMonthlySales),
            topSalesShare: totalVisibleMonthlySales && bestSales >= 0 ? String(bestSales / totalVisibleMonthlySales) : '',
            medianListingAgeMonths: listingAges.length > 0 ? String(median(listingAges)) : '',
            notes: rows.length > 0
                ? `EverBee visible rows=${rows.length}; picked=${picked.source}; marketMaxRevenue=${bestRevenue}; marketMaxSales=${bestSales}; maxRevenueAge=${bestRevenueAge}; maxSalesAge=${bestSalesAge}`
                : '',
        }
    }

    function extractVisibleProductAnalyticsMetrics(rawBodyText: string) {
        const rows: VisibleAnalyticsRow[] = []
        const lines = rawBodyText
            .split(/\r?\n/)
            .map((line) => normalizeText(line))
            .filter(Boolean)

        const tableStart = lines.findIndex((line, index) => {
            return line.toLowerCase() === 'total sales'
                && lines[index + 1]?.toLowerCase() === 'sales'
                && lines[index + 2]?.toLowerCase() === 'revenue'
        })
        const scanStart = tableStart >= 0 ? tableStart + 3 : 0

        for (let index = scanStart; index < lines.length - 5; index += 1) {
            const totalSalesText = lines[index]
            const monthlySalesText = lines[index + 1]
            const revenueText = lines[index + 2]

            if (!isIntegerCell(totalSalesText) || !isIntegerCell(monthlySalesText) || !isCurrencyCell(revenueText)) continue

            let cursor = index + 3
            if (/^nothing to show$/i.test(lines[cursor] ?? '')) cursor += 1
            while (isPercentCell(lines[cursor] ?? '')) cursor += 1

            const listingAgeText = lines[cursor]
            const priceText = lines[cursor + 1]
            if (!isAgeCell(listingAgeText ?? '') || !isCurrencyCell(priceText ?? '')) continue

            const totalSales = parseDisplayNumber(totalSalesText)
            const monthlySales = parseDisplayNumber(monthlySalesText)
            const revenue = parseDisplayNumber(revenueText)
            const price = parseDisplayNumber(priceText)

            if (totalSales === null || monthlySales === null || revenue === null || price === null) continue

            rows.push({
                totalSales,
                monthlySales,
                revenue,
                listingAge: listingAgeText,
                price,
            })
            index = cursor + 1
        }

        return summarizeVisibleProductAnalyticsRows(rows)
    }

    function looksLikeMetricText(value: string) {
        return /(total sales|monthly sales|sales|revenue|average price|listing age|listings analyzed|estimated|favorites|views|price|shop|nothing to show)/i.test(value)
            || /^[$]?\d[\d,.]*(?:%|k|m)?$/i.test(value)
            || isCurrencyCell(value)
            || isAgeCell(value)
            || isPercentCell(value)
    }

    function keywordTokenScore(value: string, keyword: string) {
        const source = value.toLowerCase()
        const tokens = keyword.toLowerCase().split(/\s+/).filter((token) => token.length >= 3)
        return tokens.reduce((score, token) => score + (source.includes(token) ? 1 : 0), 0)
    }

    function cleanListingSnippet(rawValue: string, keyword: string) {
        const lines = rawValue
            .split(/\r?\n/)
            .map((line) => normalizeText(line))
            .filter(Boolean)
            .filter((line) => line.length >= 12 && line.length <= 150)
            .filter((line) => !looksLikeMetricText(line))

        if (lines.length === 0) return ''

        return lines
            .sort((a, b) => keywordTokenScore(b, keyword) - keywordTokenScore(a, keyword) || b.length - a.length)[0]
            .replace(/\s+/g, ' ')
            .trim()
    }

    function extractListingSnippets(keyword: string) {
        const selectors = [
            'a[href*="/listing/"]',
            'a[href*="etsy.com/listing"]',
            '[role="row"]',
            'tr',
            'article',
            '[class*="listing" i]',
            '[class*="product" i]',
            '[data-testid*="listing" i]',
            '[data-testid*="product" i]',
        ]
        const snippets: string[] = []
        const seen = new Set<string>()

        for (const selector of selectors) {
            const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[]
            for (const element of elements) {
                const text = cleanListingSnippet(element.innerText || element.getAttribute('aria-label') || element.textContent || '', keyword)
                if (!text) continue

                const key = text.toLowerCase()
                if (seen.has(key)) continue
                seen.add(key)
                snippets.push(text)
                if (snippets.length >= 24) return snippets
            }
        }

        const bodyLines = (document.body.innerText || '')
            .split(/\r?\n/)
            .map((line) => normalizeText(line))
            .filter((line) => line.length >= 18 && line.length <= 130)
            .filter((line) => !looksLikeMetricText(line))
            .sort((a, b) => keywordTokenScore(b, keyword) - keywordTokenScore(a, keyword))

        for (const line of bodyLines) {
            if (keywordTokenScore(line, keyword) === 0) continue
            const key = line.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            snippets.push(line)
            if (snippets.length >= 24) break
        }

        return snippets
    }

    async function extractMetrics(keyword: string): Promise<EverbeeResult> {
        const rawBodyText = document.body.innerText || ''
        const bodyText = normalizeText(rawBodyText)
        const productRows = await extractEverbeeProductRowsWithHiddenColumns()
        const visibleTableMetrics = productRows.length > 0
            ? summarizeVisibleProductAnalyticsRows(productRows.map((row) => ({
                totalSales: row.totalSales,
                monthlySales: row.monthlySales,
                revenue: row.monthlyRevenue,
                listingAge: row.listingAge,
                price: row.price,
            })))
            : extractVisibleProductAnalyticsMetrics(rawBodyText)
        const listingsAnalyzed = numberLike(/listings\s+analyzed\s*[:\-]?\s*(\d[\d,.]*[kKmM]?)/i, bodyText)
        const topMonthlySales = visibleTableMetrics.topMonthlySales || parseTopSalesFromVisibleRows()
        const topRevenue = visibleTableMetrics.topRevenue
        const averagePrice = visibleTableMetrics.averagePrice
        const listingAge = visibleTableMetrics.listingAge
        const everbeeCheckedAt = new Date().toISOString()

        const notes = listingsAnalyzed || topMonthlySales || topRevenue
            ? `Extracted from EverBee screen${visibleTableMetrics.notes ? ` / ${visibleTableMetrics.notes}` : ''}`
            : `Metrics not found. Check the EverBee screen manually. URL=${location.href}`

        return {
            keyword,
            listingsAnalyzed,
            topMonthlySales,
            topRevenue,
            averagePrice,
            listingAge,
            visibleListingCount: visibleTableMetrics.visibleListingCount,
            sellingListingCount: visibleTableMetrics.sellingListingCount,
            recentSellingListingCount: visibleTableMetrics.recentSellingListingCount,
            medianMonthlySales: visibleTableMetrics.medianMonthlySales,
            medianMonthlyRevenue: visibleTableMetrics.medianMonthlyRevenue,
            totalVisibleMonthlySales: visibleTableMetrics.totalVisibleMonthlySales,
            topSalesShare: visibleTableMetrics.topSalesShare,
            medianListingAgeMonths: visibleTableMetrics.medianListingAgeMonths,
            everbeeCheckedAt,
            notes,
            listingSnippets: productRows.length > 0 ? productRows.map((row) => row.title) : extractListingSnippets(keyword),
            productRows,
            rawText: bodyText.slice(0, 1500),
        }
    }

    async function runKeyword(keyword: string) {
        const currentSearchTerm = new URL(location.href).searchParams.get('search_term') ?? ''
        if (location.pathname.includes('/product-analytics') && currentSearchTerm.trim()) {
            await wait(2500)
            return await extractMetrics(keyword)
        }

        const field = findSearchField()
        if (!field) throw new Error(collectSearchDiagnostics())

        field.scrollIntoView({ block: 'center' })
        field.focus()
        setNativeValue(field, keyword)
        await wait(250)
        await submitSearch(field)

        await wait(4500)
        await waitForLikelyResults(keyword)
        return await extractMetrics(keyword)
    }

    const testHooks = (globalThis as typeof globalThis & {
        __ETSY_MIRAI_TEST_HOOKS__?: Record<string, unknown>
    }).__ETSY_MIRAI_TEST_HOOKS__
    if (testHooks) testHooks.extractEverbeeProductRows = extractEverbeeProductRows
    if (testHooks) testHooks.extractEverbeeProductRowsWithHiddenColumns = extractEverbeeProductRowsWithHiddenColumns

    chrome.runtime.onMessage.addListener((request: EverbeeRunRequest, _sender, sendResponse) => {
        if (request.action !== 'EVERBEE_RUN_KEYWORD') return false

        runKeyword(request.keyword)
            .then((result) => sendResponse({ ok: true, result }))
            .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : 'Unexpected EverBee automation error.'
                sendResponse({ ok: false, error: message })
            })

        return true
    })
})()
