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
    type ErankColumnGeometry = { left: number, right: number, center: number, top: number }
    type ErankColumnMap = Map<ErankColumnKey, ErankColumnGeometry>

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
        if (/\bunknown\b|n\/a|no data/i.test(normalized)) return ''
        const textValue = metricValueFromText(normalized, key)
        if (textValue) return textValue
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

    function metricBetweenLabels(bodyText: string, labelPattern: string, nextLabelPattern: string) {
        const regex = new RegExp(`(?:${labelPattern})[\\s\\S]*?(-?\\d[\\d,.]*(?:\\.\\d+)?%?)[\\s\\S]*?(?=(?:${nextLabelPattern}))`, 'i')
        const match = bodyText.match(regex)
        return match?.[1] ? normalizeMetric(match[1]) : ''
    }

    function keywordStatisticsSection(bodyText: string) {
        const start = bodyText.search(/keyword\s+statistics/i)
        if (start < 0) return bodyText

        const rest = bodyText.slice(start)
        const next = rest.search(/\b(keyword\s+ideas|related\s+keywords|near\s+matches|broad\s+matches|search\s+trend|trend\s+buzz)\b/i)
        return next > 0 ? rest.slice(0, next) : rest
    }

    function extractKeywordStatisticsMetrics(bodyText: string): ErankMetrics {
        const result = emptyErankMetrics()
        const statisticsText = keywordStatisticsSection(bodyText)
        const searchesLabel = 'Avg\\.?\\s*Searches|Average\\s*Searches'
        const clicksLabel = 'Avg\\.?\\s*Clicks|Average\\s*Clicks'
        const ctrLabel = 'CTR|Avg\\.?\\s*CTR|Average\\s*CTR'
        const competitionLabel = 'Competition|Etsy\\s*Competition'

        result.erankSearchVolume = metricBetweenLabels(statisticsText, searchesLabel, clicksLabel)
            || metricByRegex(['Avg. Searches', 'Avg Searches', 'Average Searches', 'Searches'], statisticsText)
        result.erankClicks = metricBetweenLabels(statisticsText, clicksLabel, ctrLabel)
            || metricByRegex(['Avg. Clicks', 'Avg Clicks', 'Average Clicks', 'Clicks'], statisticsText)
        result.erankCtr = metricBetweenLabels(statisticsText, ctrLabel, competitionLabel)
            || metricByRegex(['CTR', 'Avg. CTR', 'Avg CTR', 'Average CTR'], statisticsText)
        result.erankCompetition = metricBetweenLabels(statisticsText, competitionLabel, 'Keyword\\s*Ideas|Related\\s*Keywords|Search\\s*Trend|Trend|$')
            || metricByRegex(['Competition', 'Etsy Competition'], statisticsText)

        return result
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

    type MetricToken = {
        value: string
        number: number
        hasPercent: boolean
        raw: string
    }

    function metricTokens(value: string): MetricToken[] {
        return (normalizeText(value).match(/-?\d[\d,.]*%?/g) ?? [])
            .map((token) => {
                const cleaned = token.replace(/[,%]/g, '')
                return {
                    value: cleaned,
                    number: Number(cleaned),
                    hasPercent: token.includes('%'),
                    raw: token,
                }
            })
            .filter((token) => token.value !== '' && Number.isFinite(token.number))
    }

    function metricNumberTokens(value: string) {
        return metricTokens(value).map((token) => token.value)
    }

    function pushMetricCandidate(candidates: MetricToken[], raw: string) {
        const trimmed = normalizeText(raw)
        if (!trimmed) return

        const hasPercent = trimmed.includes('%')
        const compact = trimmed
            .replace(/%/g, '')
            .replace(/,/g, '')
            .replace(/\s+/g, '')
            .trim()
        const suffix = compact.match(/[kKmM]$/)?.[0].toLowerCase()
        const numberText = suffix ? compact.slice(0, -1) : compact
        const parsed = Number(numberText)
        if (!Number.isFinite(parsed)) return

        const scaled = suffix === 'm'
            ? parsed * 1000000
            : suffix === 'k'
                ? parsed * 1000
                : parsed
        const number = Math.round(scaled)
        const value = String(number)
        if (candidates.some((candidate) => candidate.value === value && candidate.hasPercent === hasPercent)) return
        candidates.push({ value, number, hasPercent, raw: trimmed })
    }

    function metricCandidatesFromText(value: string): MetricToken[] {
        const text = normalizeText(value)
        const candidates: MetricToken[] = []
        const usedRanges: Array<[number, number]> = []
        const overlapsUsedRange = (start: number, end: number) => usedRanges.some(([usedStart, usedEnd]) => start < usedEnd && end > usedStart)

        const groupedRegex = /-?\d{1,3}(?:[,\s]\d{3})+(?:\.\d+)?\s*[kKmM]?%?/g
        let groupedMatch: RegExpExecArray | null
        while ((groupedMatch = groupedRegex.exec(text)) !== null) {
            const start = groupedMatch.index
            const end = start + groupedMatch[0].length
            usedRanges.push([start, end])
            pushMetricCandidate(candidates, groupedMatch[0])
        }

        const compactRegex = /-?\d+(?:\.\d+)?\s*[kKmM]?%?/g
        let compactMatch: RegExpExecArray | null
        while ((compactMatch = compactRegex.exec(text)) !== null) {
            const start = compactMatch.index
            const end = start + compactMatch[0].length
            if (overlapsUsedRange(start, end)) continue
            pushMetricCandidate(candidates, compactMatch[0])
        }

        return candidates
    }

    function metricValueFromText(value: string, key: ErankMetricKey) {
        const candidates = metricCandidatesFromText(value)
        if (key === 'erankKeywordDifficulty') {
            const kdCandidates = candidates.filter((candidate) => candidate.number >= 0 && candidate.number <= 100)
            const splitKd = normalizeText(value).match(/\b(\d{1,2})\s+(\d)\b/)
            if (splitKd) pushMetricCandidate(kdCandidates, `${splitKd[1]}${splitKd[2]}`)
            return kdCandidates.sort((a, b) => b.number - a.number)[0]?.value ?? ''
        }

        if (key === 'erankCtr') {
            const ctrCandidates = candidates.filter((candidate) => candidate.number >= 0 && candidate.number <= 500)
            return (ctrCandidates.find((candidate) => candidate.hasPercent) ?? ctrCandidates[0])?.value ?? ''
        }

        if (key === 'erankCompetition') {
            return candidates
                .filter((candidate) => candidate.number > 0)
                .sort((a, b) => b.number - a.number)[0]?.value ?? ''
        }

        if (key === 'erankTrend') return candidates[candidates.length - 1]?.value ?? ''
        return candidates[0]?.value ?? ''
    }

    function orderedMetricsFromText(rowText: string, keyword: string): ErankMetrics {
        const result = emptyErankMetrics()
        const keywordIndex = rowText.toLowerCase().indexOf(keyword.toLowerCase())
        const metricText = keywordIndex >= 0 ? rowText.slice(keywordIndex + keyword.length) : rowText
        const tokens = metricTokens(metricText)
        if (tokens.length < 5) return result

        let bestMatch: { index: number, score: number } | null = null
        for (let index = 2; index <= tokens.length - 3; index += 1) {
            const search = tokens[index - 2]
            const clicks = tokens[index - 1]
            const ctr = tokens[index]
            const competition = tokens[index + 1]
            const kd = tokens[index + 2]
            if (search.number <= 0 || clicks.number <= 0) continue
            if (ctr.number < 0 || ctr.number > 500) continue
            if (competition.number <= 0) continue
            if (kd.number < 0 || kd.number > 100) continue

            const score = (ctr.hasPercent ? 20 : 0)
                + (competition.number >= 1000 ? 12 : 0)
                + (search.number >= 100 ? 4 : 0)
                + (clicks.number >= 100 ? 4 : 0)
                + (kd.number >= 0 && kd.number <= 100 ? 4 : 0)
                - index * 0.01
            if (!bestMatch || score > bestMatch.score) bestMatch = { index, score }
        }

        if (!bestMatch) return result

        const ctrIndex = bestMatch.index
        const trend = tokens[ctrIndex - 3]
        const assignments: Array<[ErankMetricKey, string | undefined]> = [
            ['erankTrend', trend?.value],
            ['erankSearchVolume', tokens[ctrIndex - 2]?.value],
            ['erankClicks', tokens[ctrIndex - 1]?.value],
            ['erankCtr', tokens[ctrIndex]?.value],
            ['erankCompetition', tokens[ctrIndex + 1]?.value],
            ['erankKeywordDifficulty', tokens[ctrIndex + 2]?.value],
        ]

        for (const [key, value] of assignments) {
            if (value && metricValueLooksUsable(value, key)) result[key] = value
        }

        return result
    }

    function extractKeywordDifficultyFromRowText(rowText: string, keyword: string) {
        return orderedMetricsFromText(rowText, keyword).erankKeywordDifficulty
    }

    function orderedMetricsFromRowText(row: HTMLElement, keyword: string): ErankMetrics {
        return orderedMetricsFromText(elementText(row), keyword)
    }

    function hasUnknownDemandLabels(rawText: string) {
        const text = normalizeText(rawText).toLowerCase()
        const unknownCount = (text.match(/\b(?:unknown|n\/a|no data|-)\b/g) ?? []).length
        return /(avg\.?\s*searches?|average\s*searches?|searches?)\s*(unknown|n\/a|no data|-)\b/.test(text)
            || /(avg\.?\s*clicks?|average\s*clicks?|clicks?)\s*(unknown|n\/a|no data|-)\b/.test(text)
            || /\b(?:avg\.?\s*)?ctr\s*(unknown|n\/a|no data|-)\b/.test(text)
            || unknownCount >= 3
    }

    function sanitizeCompetitionLeak<T extends ErankMetrics>(metrics: T, rawText: string): T {
        const competition = metrics.erankCompetition
        if (!competition) return metrics

        const demandKeys: ErankMetricKey[] = ['erankSearchVolume', 'erankClicks', 'erankCtr']
        const leakedKeys = demandKeys.filter((key) => metrics[key] && metrics[key] === competition)
        const allDemandMatchesCompetition = leakedKeys.length === demandKeys.length

        if (!allDemandMatchesCompetition && !(leakedKeys.length > 0 && hasUnknownDemandLabels(rawText))) return metrics

        for (const key of leakedKeys) {
            metrics[key] = ''
        }

        return metrics
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
            const rect = candidate.getBoundingClientRect()
            const center = rect.left + rect.width / 2
            const distance = Math.abs(center - columnCenter)
            if (rect.width > 180 || distance > 90) continue
            const text = elementText(candidate)
            if (!text || text.length > 80) continue
            if (/\bunknown\b|n\/a|no data/i.test(text)) continue
            if (metricNumberTokens(text).length > 1) continue
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

        const columns: ErankColumnMap = new Map()
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

    function inferredColumnBounds(columns: ErankColumnMap, key: ErankColumnKey, rowRect: DOMRect) {
        const column = columns.get(key)
        if (!column) return null

        const sorted = Array.from(columns.entries())
            .sort((a, b) => a[1].center - b[1].center)
        const index = sorted.findIndex(([columnKey]) => columnKey === key)
        const previous = index > 0 ? sorted[index - 1][1] : null
        const next = index >= 0 && index < sorted.length - 1 ? sorted[index + 1][1] : null

        return {
            left: previous ? (previous.center + column.center) / 2 : Math.max(rowRect.left, column.left - 80),
            right: next ? (column.center + next.center) / 2 : Math.min(rowRect.right, column.right + 120),
            center: column.center,
        }
    }

    function metricTextSources(element: HTMLElement) {
        const sources = [
            element.innerText,
            element.textContent,
            element.getAttribute('aria-label'),
            element.getAttribute('title'),
            element.getAttribute('data-value'),
            element.getAttribute('data-tooltip'),
            element.getAttribute('data-original-title'),
        ]
        const seen = new Set<string>()
        return sources
            .map((source) => normalizeText(source ?? ''))
            .filter((source) => {
                if (!source || seen.has(source)) return false
                seen.add(source)
                return true
            })
    }

    function metricValueFromColumn(row: HTMLElement, key: ErankMetricKey, columns: ErankColumnMap) {
        const rowRect = row.getBoundingClientRect()
        const bounds = inferredColumnBounds(columns, key, rowRect)
        if (!bounds) return ''

        const candidates: MetricToken[] = []
        const fragments: Array<{ text: string, left: number }> = []
        const elements = Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"], span, strong, div, a, button')) as HTMLElement[]

        for (const element of elements.filter(isVisibleElement)) {
            const rect = element.getBoundingClientRect()
            const center = rect.left + rect.width / 2
            const overlap = Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left)
            const columnWidth = bounds.right - bounds.left
            if (rect.top < rowRect.top - 2 || rect.bottom > rowRect.bottom + 2) continue
            if (center < bounds.left || center > bounds.right || overlap <= 0) continue
            if (rect.width > Math.max(columnWidth + 24, 220)) continue

            for (const source of metricTextSources(element)) {
                if (source.length > 100 || /\bunknown\b|n\/a|no data/i.test(source)) continue
                metricCandidatesFromText(source).forEach((candidate) => {
                    if (!candidates.some((item) => item.value === candidate.value && item.hasPercent === candidate.hasPercent)) {
                        candidates.push(candidate)
                    }
                })
                if (/^\d{1,3}$/.test(source) && !hasSameTextChild(element, source)) {
                    const duplicateFragment = fragments.some((fragment) => fragment.text === source && Math.abs(fragment.left - rect.left) <= 2)
                    if (!duplicateFragment) fragments.push({ text: source, left: rect.left })
                }
            }
        }

        const joinedFragments = fragments
            .sort((a, b) => a.left - b.left)
            .map((fragment) => fragment.text)
            .join('')

        if (key === 'erankCompetition' && joinedFragments.length >= 4) {
            pushMetricCandidate(candidates, joinedFragments)
        }
        if (key === 'erankKeywordDifficulty' && joinedFragments.length >= 2 && joinedFragments.length <= 3) {
            pushMetricCandidate(candidates, joinedFragments)
        }

        const values = candidates.filter((candidate) => metricValueLooksUsable(candidate.value, key))
        if (key === 'erankCompetition') {
            return values
                .filter((candidate) => candidate.number > 0)
                .sort((a, b) => b.number - a.number)[0]?.value ?? ''
        }
        if (key === 'erankKeywordDifficulty') {
            return values
                .filter((candidate) => candidate.number >= 0 && candidate.number <= 100)
                .sort((a, b) => b.number - a.number)[0]?.value ?? ''
        }
        if (key === 'erankCtr') {
            return (values.find((candidate) => candidate.hasPercent) ?? values[0])?.value ?? ''
        }
        if (key === 'erankTrend') return values[values.length - 1]?.value ?? ''
        return values[0]?.value ?? ''
    }

    function closestMetricValue(row: HTMLElement, key: ErankMetricKey, columnCenter: number) {
        if (key === 'erankCompetition' || key === 'erankKeywordDifficulty') return ''

        const pointedValue = metricValueFromPoint(row, key, columnCenter)
        if (pointedValue) return pointedValue

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
                if (/\bunknown\b|n\/a|no data/i.test(item.text)) return false
                if (metricNumberTokens(item.text).length > 1) return false
                if (!metricValueLooksUsable(item.value, key)) return false
                return /\d|unknown|n\/a|no data|-/i.test(item.text)
            })
            .sort((a, b) => Math.abs((a.rect.left + a.rect.width / 2) - columnCenter) - Math.abs((b.rect.left + b.rect.width / 2) - columnCenter))

        const maxDistance = 90
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
            const columnMetric = metricValueFromColumn(row, key, columns)
            if (key === 'erankCompetition' || key === 'erankKeywordDifficulty') {
                result[key] = columnMetric
            } else {
                result[key] = orderedMetrics[key] || columnMetric || (column ? closestMetricValue(row, key, column.center) : '')
            }
        }
        const rowText = elementText(row)

        return sanitizeCompetitionLeak(result, rowText)
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
                rawText: elementText(row),
            }

            const orderedMetrics = orderedMetricsFromRowText(row, keyword)
            for (const metricKey of ERANK_METRIC_KEYS) {
                const column = columns.get(metricKey)
                const columnMetric = metricValueFromColumn(row, metricKey, columns)
                if (metricKey === 'erankCompetition' || metricKey === 'erankKeywordDifficulty') {
                    result[metricKey] = columnMetric
                } else {
                    result[metricKey] = orderedMetrics[metricKey] || columnMetric || (column ? closestMetricValue(row, metricKey, column.center) : '')
                }
            }
            sanitizeCompetitionLeak(result, result.rawText)

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
                const cellMetric = normalizeMetricForKey(cells[index], metricKey)
                result[metricKey] = metricKey === 'erankCompetition' || metricKey === 'erankKeywordDifficulty'
                    ? cellMetric
                    : orderedMetrics[metricKey] || cellMetric
            })
            sanitizeCompetitionLeak(result, cells.join(' '))

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
                    rawText: cells.join(' '),
                }

                const orderedMetrics = orderedMetricsFromText(cells.join(' '), keyword)
                headerMap.forEach((field, index) => {
                    if (!field || field === 'keyword' || !cells[index]) return
                    if (field in result) {
                        const metricKey = field as ErankMetricKey
                        const cellMetric = normalizeMetricForKey(cells[index], metricKey)
                        ;(result as unknown as Record<string, string>)[field] = metricKey === 'erankCompetition' || metricKey === 'erankKeywordDifficulty'
                            ? cellMetric
                            : orderedMetrics[metricKey] || cellMetric
                    }
                })
                sanitizeCompetitionLeak(result, result.rawText)

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
        const statisticsMetrics = extractKeywordStatisticsMetrics(bodyText)
        const visualMetrics = extractFromVisualGrid(keyword)
        const tableMetrics = extractFromTables(keyword)
        const erankSearchVolume = statisticsMetrics.erankSearchVolume || visualMetrics.erankSearchVolume || tableMetrics.erankSearchVolume
        const erankClicks = statisticsMetrics.erankClicks || visualMetrics.erankClicks || tableMetrics.erankClicks
        const erankCtr = statisticsMetrics.erankCtr || visualMetrics.erankCtr || tableMetrics.erankCtr
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
