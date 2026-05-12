"use strict";
(() => {
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
    ];
    const SEARCH_BUTTON_WORDS = ['search', 'lookup', 'submit', 'go', 'find', 'analyze'];
    function wait(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }
    function normalizeText(value) {
        return value.replace(/\s+/g, ' ').trim();
    }
    function normalizeMetric(value) {
        const normalized = normalizeText(value);
        if (/^(unknown|n\/a|no data|-)$/i.test(normalized))
            return '';
        const numberMatch = normalized.match(/-?\d[\d,.]*/);
        if (numberMatch)
            return numberMatch[0].replace(/,/g, '');
        return normalized.replace(/[$,%]/g, '').trim();
    }
    const ERANK_METRIC_KEYS = [
        'erankSearchVolume',
        'erankClicks',
        'erankCtr',
        'erankCompetition',
        'erankKeywordDifficulty',
        'erankTrend',
    ];
    function emptyErankMetrics() {
        return {
            erankSearchVolume: '',
            erankClicks: '',
            erankCtr: '',
            erankCompetition: '',
            erankKeywordDifficulty: '',
            erankTrend: '',
        };
    }
    function normalizeMetricForKey(value, key) {
        var _a;
        const normalized = normalizeText(value);
        if (/^(unknown|n\/a|no data|-)$/i.test(normalized))
            return '';
        const numbers = ((_a = normalized.match(/-?\d[\d,.]*/g)) !== null && _a !== void 0 ? _a : []).map((match) => match.replace(/,/g, ''));
        if (numbers.length === 0)
            return normalizeMetric(normalized);
        if (key === 'erankKeywordDifficulty') {
            const kdValue = numbers.find((number) => {
                const parsed = Number(number);
                return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
            });
            return kdValue !== null && kdValue !== void 0 ? kdValue : numbers[numbers.length - 1];
        }
        if (key === 'erankTrend')
            return numbers[numbers.length - 1];
        return numbers[0];
    }
    function isTextInput(element) {
        return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
    }
    function setNativeValue(element, value) {
        if (!isTextInput(element)) {
            element.focus();
            document.execCommand('selectAll', false);
            document.execCommand('insertText', false, value);
            element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
        const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.set) {
            descriptor.set.call(element, value);
        }
        else {
            element.value = value;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function elementLooksSearchable(element) {
        var _a, _b, _c, _d, _e, _f;
        if (isTextInput(element)) {
            if (element.disabled || element.readOnly)
                return false;
            const type = element instanceof HTMLInputElement ? element.type.toLowerCase() : 'textarea';
            if (['hidden', 'checkbox', 'radio', 'submit', 'button', 'file', 'range'].includes(type))
                return false;
        }
        const text = [
            (_a = element.placeholder) !== null && _a !== void 0 ? _a : '',
            (_b = element.getAttribute('aria-label')) !== null && _b !== void 0 ? _b : '',
            (_c = element.getAttribute('role')) !== null && _c !== void 0 ? _c : '',
            (_d = element.name) !== null && _d !== void 0 ? _d : '',
            (_e = element.id) !== null && _e !== void 0 ? _e : '',
            (_f = element.innerText) !== null && _f !== void 0 ? _f : '',
            element.className ? String(element.className) : '',
        ].join(' ').toLowerCase();
        return /(keyword|search|query|etsy|phrase|term)/.test(text);
    }
    function findSearchField() {
        var _a;
        for (const selector of SEARCH_SELECTORS) {
            const element = document.querySelector(selector);
            if (element && elementLooksSearchable(element))
                return element;
        }
        const fields = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="searchbox"]'));
        return (_a = fields.find((element) => elementLooksSearchable(element))) !== null && _a !== void 0 ? _a : null;
    }
    async function submitSearch(field) {
        const form = field.closest('form');
        const formButton = form === null || form === void 0 ? void 0 : form.querySelector('button[type="submit"], input[type="submit"]');
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
        const button = buttons.find((item) => {
            var _a, _b, _c;
            const text = `${(_a = item.innerText) !== null && _a !== void 0 ? _a : ''} ${(_b = item.value) !== null && _b !== void 0 ? _b : ''} ${(_c = item.getAttribute('aria-label')) !== null && _c !== void 0 ? _c : ''}`.toLowerCase();
            return SEARCH_BUTTON_WORDS.some((word) => text.includes(word));
        });
        field.focus();
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        field.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }));
        field.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        await wait(500);
        if (formButton) {
            formButton.click();
            return;
        }
        if (button)
            button.click();
    }
    async function waitForLikelyResults(keyword) {
        const startedAt = Date.now();
        let lastText = '';
        let stableCount = 0;
        while (Date.now() - startedAt < 18000) {
            await wait(900);
            const text = normalizeText(document.body.innerText || '');
            const hasMetric = /(average searches|avg searches|average clicks|avg clicks|etsy competition|search trend|competition|ctr)/i.test(text);
            const hasKeyword = text.toLowerCase().includes(keyword.toLowerCase().slice(0, 16));
            if (text === lastText) {
                stableCount += 1;
            }
            else {
                stableCount = 0;
                lastText = text;
            }
            if (hasMetric && (stableCount >= 1 || hasKeyword))
                return;
        }
    }
    async function revealKeywordIdeasTable() {
        const elements = Array.from(document.querySelectorAll('button, [role="tab"], a, h1, h2, h3, div, span'));
        const keywordIdeasTab = elements.find((element) => /^keyword ideas$/i.test(elementText(element)));
        if (keywordIdeasTab) {
            keywordIdeasTab.click();
            await wait(300);
        }
        const tableAnchor = elements.find((element) => /keywords related to|keyword ideas|near matches/i.test(elementText(element)));
        if (tableAnchor) {
            tableAnchor.scrollIntoView({ block: 'center' });
            await wait(700);
        }
    }
    function describeElement(element) {
        var _a;
        const html = element;
        const input = element;
        return [
            element.tagName.toLowerCase(),
            input.type ? `type=${input.type}` : '',
            input.placeholder ? `placeholder=${input.placeholder}` : '',
            input.name ? `name=${input.name}` : '',
            input.id ? `id=${input.id}` : '',
            element.getAttribute('role') ? `role=${element.getAttribute('role')}` : '',
            element.getAttribute('aria-label') ? `aria-label=${element.getAttribute('aria-label')}` : '',
            normalizeText((_a = html.innerText) !== null && _a !== void 0 ? _a : '').slice(0, 80),
        ].filter(Boolean).join(' | ');
    }
    function collectSearchDiagnostics() {
        const candidates = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="searchbox"], button, [role="button"]'))
            .map(describeElement)
            .filter(Boolean)
            .slice(0, 30);
        const text = normalizeText(document.body.innerText || '').slice(0, 700);
        return `eRankの検索欄を見つけられませんでした。eRank Keyword Toolを開いてから再実行してください。URL=${location.href} candidates=${candidates.join(' || ')} pageText=${text}`;
    }
    function metricByRegex(labels, bodyText) {
        for (const label of labels) {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`${escaped}\\s*[:\\-]?\\s*([$]?\\d[\\d,.]*(?:\\.\\d+)?\\s*(?:%|k|m)?)`, 'i');
            const match = bodyText.match(regex);
            if (match === null || match === void 0 ? void 0 : match[1])
                return normalizeMetric(match[1]);
        }
        return '';
    }
    function headerKey(value) {
        const text = value.toLowerCase();
        if (/keywords?|keyword ideas?|search term/.test(text))
            return 'keyword';
        if (/search\s*trend|trend/.test(text))
            return 'erankTrend';
        if (/avg|average/.test(text) && /search/.test(text))
            return 'erankSearchVolume';
        if (/searches/.test(text) && !/google/.test(text))
            return 'erankSearchVolume';
        if (/avg|average/.test(text) && /click/.test(text))
            return 'erankClicks';
        if (/clicks/.test(text))
            return 'erankClicks';
        if (/ctr|click.*through/.test(text))
            return 'erankCtr';
        if (/etsy/.test(text) && /competition/.test(text))
            return 'erankCompetition';
        if (/competition/.test(text))
            return 'erankCompetition';
        if (/\bkd\b|keyword difficulty|difficulty/.test(text))
            return 'erankKeywordDifficulty';
        return '';
    }
    function headerColumnKey(value) {
        const text = normalizeText(value).toLowerCase();
        if (/^keywords?\b|^keyword ideas?\b|^search term\b/.test(text))
            return 'keyword';
        if (/^search\s*trend\b|^trend$/.test(text))
            return 'erankTrend';
        if (/^(avg\.?|average)\s*searches?$/.test(text))
            return 'erankSearchVolume';
        if (/^(avg\.?|average)\s*clicks?$/.test(text))
            return 'erankClicks';
        if (/^(avg\.?|average)\s*ctr$|^ctr$|^click.*through/.test(text))
            return 'erankCtr';
        if (/^etsy\s*competition$|^competition$/.test(text))
            return 'erankCompetition';
        if (/^kd$|^keyword difficulty$|^difficulty$/.test(text))
            return 'erankKeywordDifficulty';
        return '';
    }
    function isVisibleElement(element) {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1)
            return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0;
    }
    function elementText(element) {
        const html = element;
        return normalizeText(html.innerText || element.textContent || '');
    }
    function hasSameTextChild(element, text) {
        return Array.from(element.children).some((child) => elementText(child) === text);
    }
    function normalizeKeywordText(value) {
        return normalizeText(value).toLowerCase().replace(/[^\w\s'-]/g, '').replace(/\s+/g, ' ').trim();
    }
    function metricValueLooksUsable(value, key) {
        if (!value)
            return false;
        const parsed = Number(value);
        if (!Number.isFinite(parsed))
            return true;
        if (key === 'erankKeywordDifficulty')
            return parsed >= 0 && parsed <= 100;
        if (key === 'erankCtr')
            return parsed >= 0 && parsed <= 500;
        return true;
    }
    function collectVisualColumns() {
        const candidates = Array.from(document.querySelectorAll('th, [role="columnheader"], span, div, button'))
            .filter(isVisibleElement)
            .map((element) => {
            const text = elementText(element);
            const key = headerColumnKey(text);
            const rect = element.getBoundingClientRect();
            return { element, text, key, rect };
        })
            .filter((item) => {
            if (!item.key || item.text.length > 45 || hasSameTextChild(item.element, item.text))
                return false;
            return item.rect.width > 5 && item.rect.height > 5;
        });
        let bestGroup = [];
        let bestScore = -1;
        for (const candidate of candidates) {
            const group = candidates.filter((item) => Math.abs(item.rect.top - candidate.rect.top) <= 28);
            const keys = new Set(group.map((item) => item.key));
            const metricCount = ERANK_METRIC_KEYS.filter((key) => keys.has(key)).length;
            const score = metricCount * 10 + (keys.has('keyword') ? 5 : 0) + candidate.rect.top / 1000;
            if (score > bestScore) {
                bestScore = score;
                bestGroup = group;
            }
        }
        const columns = new Map();
        for (const key of ['keyword', ...ERANK_METRIC_KEYS]) {
            const matches = bestGroup
                .filter((item) => item.key === key)
                .sort((a, b) => a.rect.width - b.rect.width || a.rect.left - b.rect.left);
            const match = matches[0];
            if (!match)
                continue;
            columns.set(key, {
                left: match.rect.left,
                right: match.rect.right,
                center: match.rect.left + match.rect.width / 2,
                top: match.rect.top,
            });
        }
        return columns;
    }
    function closestMetricValue(row, key, columnCenter) {
        var _a;
        const rowRect = row.getBoundingClientRect();
        const cells = Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"], span, strong, div, a'))
            .filter(isVisibleElement)
            .map((element) => {
            const text = elementText(element);
            const rect = element.getBoundingClientRect();
            const value = normalizeMetricForKey(text, key);
            return { element, text, rect, value };
        })
            .filter((item) => {
            if (!item.text || item.text.length > 80 || hasSameTextChild(item.element, item.text))
                return false;
            if (item.rect.top < rowRect.top - 2 || item.rect.bottom > rowRect.bottom + 2)
                return false;
            if (!metricValueLooksUsable(item.value, key))
                return false;
            return /\d|unknown|n\/a|no data|-/i.test(item.text);
        })
            .sort((a, b) => Math.abs((a.rect.left + a.rect.width / 2) - columnCenter) - Math.abs((b.rect.left + b.rect.width / 2) - columnCenter));
        const maxDistance = key === 'erankKeywordDifficulty' ? 95 : 145;
        const match = cells.find((item) => Math.abs((item.rect.left + item.rect.width / 2) - columnCenter) <= maxDistance);
        return (_a = match === null || match === void 0 ? void 0 : match.value) !== null && _a !== void 0 ? _a : '';
    }
    function findVisualRowForKeyword(keyword, columns) {
        var _a, _b, _c, _d, _e;
        const target = normalizeKeywordText(keyword);
        const headerTop = (_b = (_a = columns.get('keyword')) === null || _a === void 0 ? void 0 : _a.top) !== null && _b !== void 0 ? _b : 0;
        const keywordCenter = (_c = columns.get('keyword')) === null || _c === void 0 ? void 0 : _c.center;
        const exactKeywordElements = Array.from(document.querySelectorAll('a, span, strong, td, [role="cell"], [role="gridcell"], div'))
            .filter(isVisibleElement)
            .filter((element) => normalizeKeywordText(elementText(element)) === target)
            .filter((element) => {
            if (keywordCenter === undefined)
                return true;
            const rect = element.getBoundingClientRect();
            return Math.abs((rect.left + rect.width / 2) - keywordCenter) <= 220;
        });
        const rows = [];
        for (const element of exactKeywordElements) {
            let current = element;
            for (let depth = 0; current && depth < 9; depth += 1) {
                const rect = current.getBoundingClientRect();
                const text = elementText(current);
                const numericCount = ((_d = text.match(/\d[\d,.]*/g)) !== null && _d !== void 0 ? _d : []).length;
                const looksLikeRow = rect.top > headerTop
                    && rect.width >= 500
                    && rect.height >= 28
                    && rect.height <= 150
                    && numericCount >= 3
                    && !/avg\.?\s*searches|avg\.?\s*clicks|etsy competition/i.test(text);
                if (looksLikeRow) {
                    rows.push(current);
                    break;
                }
                current = current.parentElement;
            }
        }
        return (_e = rows.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0]) !== null && _e !== void 0 ? _e : null;
    }
    function textLooksLikeKeywordCell(text) {
        const keyword = meaningfulKeyword(text);
        if (!keyword || !/[a-z]/i.test(keyword))
            return false;
        if (/^\d[\d,.]*%?$/.test(keyword))
            return false;
        if (/avg\.?|average|competition|clicks?|searches?|ctr|^kd$/i.test(keyword))
            return false;
        return true;
    }
    function closestKeywordValue(row, columnCenter) {
        var _a, _b;
        const rowRect = row.getBoundingClientRect();
        const cells = Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"], span, strong, div, a'))
            .filter(isVisibleElement)
            .map((element) => {
            const text = elementText(element);
            const rect = element.getBoundingClientRect();
            return { element, text, rect };
        })
            .filter((item) => {
            if (!textLooksLikeKeywordCell(item.text) || item.text.length > 120 || hasSameTextChild(item.element, item.text))
                return false;
            if (item.rect.top < rowRect.top - 2 || item.rect.bottom > rowRect.bottom + 2)
                return false;
            return true;
        })
            .sort((a, b) => Math.abs((a.rect.left + a.rect.width / 2) - columnCenter) - Math.abs((b.rect.left + b.rect.width / 2) - columnCenter));
        return meaningfulKeyword((_b = (_a = cells[0]) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : '');
    }
    function collectVisualRows(columns) {
        var _a, _b, _c;
        const headerTop = (_b = (_a = columns.get('keyword')) === null || _a === void 0 ? void 0 : _a.top) !== null && _b !== void 0 ? _b : 0;
        const keywordCenter = (_c = columns.get('keyword')) === null || _c === void 0 ? void 0 : _c.center;
        const seen = new Set();
        const rows = [];
        function addRow(row) {
            var _a;
            if (seen.has(row) || !isVisibleElement(row))
                return;
            const rect = row.getBoundingClientRect();
            const text = elementText(row);
            const numericCount = ((_a = text.match(/\d[\d,.]*/g)) !== null && _a !== void 0 ? _a : []).length;
            const looksLikeRow = rect.top > headerTop
                && rect.width >= 500
                && rect.height >= 28
                && rect.height <= 150
                && numericCount >= 3
                && !/avg\.?\s*searches|avg\.?\s*clicks|etsy competition/i.test(text);
            if (!looksLikeRow)
                return;
            seen.add(row);
            rows.push(row);
        }
        ;
        Array.from(document.querySelectorAll('tr, [role="row"]')).forEach(addRow);
        const keywordCells = Array.from(document.querySelectorAll('a, span, strong, td, [role="cell"], [role="gridcell"], div'))
            .filter(isVisibleElement)
            .filter((element) => textLooksLikeKeywordCell(elementText(element)))
            .filter((element) => {
            if (keywordCenter === undefined)
                return true;
            const rect = element.getBoundingClientRect();
            return Math.abs((rect.left + rect.width / 2) - keywordCenter) <= 240;
        });
        for (const element of keywordCells) {
            let current = element;
            for (let depth = 0; current && depth < 9; depth += 1) {
                addRow(current);
                if (seen.has(current))
                    break;
                current = current.parentElement;
            }
        }
        return rows.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    }
    function extractFromVisualGrid(keyword) {
        const columns = collectVisualColumns();
        if (!columns.has('erankSearchVolume') || !columns.has('erankClicks'))
            return emptyErankMetrics();
        const row = findVisualRowForKeyword(keyword, columns);
        if (!row)
            return emptyErankMetrics();
        const result = emptyErankMetrics();
        for (const key of ERANK_METRIC_KEYS) {
            const column = columns.get(key);
            if (!column)
                continue;
            result[key] = closestMetricValue(row, key, column.center);
        }
        return result;
    }
    function extractVisualRelatedKeywordRows(sourceKeyword) {
        const columns = collectVisualColumns();
        const keywordColumn = columns.get('keyword');
        if (!keywordColumn || !columns.has('erankSearchVolume') || !columns.has('erankClicks'))
            return [];
        const results = [];
        const seen = new Set();
        const sourceKey = normalizeKeywordText(sourceKeyword);
        for (const row of collectVisualRows(columns)) {
            const keyword = closestKeywordValue(row, keywordColumn.center);
            const key = normalizeKeywordText(keyword);
            if (!keyword || !key || key === sourceKey || seen.has(key))
                continue;
            const result = {
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
            };
            for (const metricKey of ERANK_METRIC_KEYS) {
                const column = columns.get(metricKey);
                if (!column)
                    continue;
                result[metricKey] = closestMetricValue(row, metricKey, column.center);
            }
            const hasUsefulMetric = result.erankSearchVolume || result.erankClicks || result.erankCompetition || result.erankKeywordDifficulty;
            if (!hasUsefulMetric)
                continue;
            seen.add(key);
            results.push(result);
            if (results.length >= 40)
                return results;
        }
        return results;
    }
    function keywordTokenScore(value, keyword) {
        const source = value.toLowerCase();
        const tokens = keyword.toLowerCase().split(/\s+/).filter((token) => token.length >= 3);
        return tokens.reduce((score, token) => score + (source.includes(token) ? 1 : 0), 0);
    }
    function extractFromTables(keyword) {
        var _a;
        const tables = Array.from(document.querySelectorAll('table, [role="table"], [role="grid"]'));
        const empty = emptyErankMetrics();
        for (const table of tables) {
            const headerCells = Array.from(table.querySelectorAll('th, [role="columnheader"]'));
            let headers = headerCells.map((cell) => normalizeText(cell.innerText || cell.textContent || ''));
            if (headers.length === 0) {
                const firstRow = table.querySelector('tr, [role="row"]');
                headers = Array.from((_a = firstRow === null || firstRow === void 0 ? void 0 : firstRow.querySelectorAll('td, th, [role="cell"], [role="gridcell"], [role="columnheader"]')) !== null && _a !== void 0 ? _a : [])
                    .map((cell) => normalizeText(cell.innerText || cell.textContent || ''));
            }
            const headerMap = headers.map(headerKey);
            if (!headerMap.some(Boolean))
                continue;
            const rows = Array.from(table.querySelectorAll('tr, [role="row"]'));
            const dataRows = rows
                .map((row) => Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"]')))
                .filter((cells) => cells.length > 0)
                .map((cells) => cells.map((cell) => normalizeText(cell.innerText || cell.textContent || '')))
                .filter((cells) => keywordTokenScore(cells.join(' '), keyword) > 0)
                .sort((a, b) => keywordTokenScore(b.join(' '), keyword) - keywordTokenScore(a.join(' '), keyword));
            const cells = dataRows[0];
            if (!cells)
                continue;
            const result = Object.assign({}, empty);
            headerMap.forEach((key, index) => {
                if (!key || !cells[index])
                    return;
                if (key === 'keyword')
                    return;
                result[key] = normalizeMetricForKey(cells[index], key);
            });
            if (Object.values(result).some(Boolean))
                return result;
        }
        return empty;
    }
    function meaningfulKeyword(value) {
        const cleaned = normalizeText(value)
            .replace(/^[★☆⋮\s]+/, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!cleaned || cleaned.length < 3 || cleaned.length > 120)
            return '';
        if (/^(keywords?|search trend|avg\.?|average|competition|kd)$/i.test(cleaned))
            return '';
        if (/unknown|no data to show/i.test(cleaned))
            return '';
        return cleaned;
    }
    function extractRelatedKeywordRows(sourceKeyword) {
        var _a;
        const visualResults = extractVisualRelatedKeywordRows(sourceKeyword);
        if (visualResults.length > 0)
            return visualResults;
        const tables = Array.from(document.querySelectorAll('table, [role="table"], [role="grid"]'));
        const results = [];
        const seen = new Set();
        for (const table of tables) {
            const headerCells = Array.from(table.querySelectorAll('th, [role="columnheader"]'));
            let headers = headerCells.map((cell) => normalizeText(cell.innerText || cell.textContent || ''));
            if (headers.length === 0) {
                const firstRow = table.querySelector('tr, [role="row"]');
                headers = Array.from((_a = firstRow === null || firstRow === void 0 ? void 0 : firstRow.querySelectorAll('td, th, [role="cell"], [role="gridcell"], [role="columnheader"]')) !== null && _a !== void 0 ? _a : [])
                    .map((cell) => normalizeText(cell.innerText || cell.textContent || ''));
            }
            const headerMap = headers.map(headerKey);
            const keywordIndex = headerMap.findIndex((key) => key === 'keyword');
            const hasErankMetric = headerMap.some((key) => ['erankSearchVolume', 'erankClicks', 'erankCtr', 'erankCompetition', 'erankKeywordDifficulty', 'erankTrend'].includes(key));
            if (keywordIndex < 0 || !hasErankMetric)
                continue;
            const rows = Array.from(table.querySelectorAll('tr, [role="row"]'));
            for (const row of rows) {
                const cells = Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"]'))
                    .map((cell) => normalizeText(cell.innerText || cell.textContent || ''));
                if (cells.length <= keywordIndex)
                    continue;
                const keyword = meaningfulKeyword(cells[keywordIndex]);
                const key = keyword.toLowerCase();
                if (!keyword || seen.has(key))
                    continue;
                const result = {
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
                };
                headerMap.forEach((field, index) => {
                    if (!field || field === 'keyword' || !cells[index])
                        return;
                    if (field in result) {
                        ;
                        result[field] = normalizeMetricForKey(cells[index], field);
                    }
                });
                const hasUsefulMetric = result.erankSearchVolume || result.erankClicks || result.erankCompetition || result.erankKeywordDifficulty;
                if (!hasUsefulMetric)
                    continue;
                seen.add(key);
                results.push(result);
                if (results.length >= 40)
                    return results;
            }
        }
        return results;
    }
    function extractMetrics(keyword) {
        const rawBodyText = document.body.innerText || '';
        const bodyText = normalizeText(rawBodyText);
        const visualMetrics = extractFromVisualGrid(keyword);
        const tableMetrics = extractFromTables(keyword);
        const erankSearchVolume = visualMetrics.erankSearchVolume || tableMetrics.erankSearchVolume || metricByRegex(['Average Searches', 'Avg Searches', 'Searches'], bodyText);
        const erankClicks = visualMetrics.erankClicks || tableMetrics.erankClicks || metricByRegex(['Average Clicks', 'Avg Clicks', 'Clicks'], bodyText);
        const erankCtr = visualMetrics.erankCtr || tableMetrics.erankCtr || metricByRegex(['Average CTR', 'Avg CTR', 'CTR'], bodyText);
        const erankCompetition = visualMetrics.erankCompetition || tableMetrics.erankCompetition || metricByRegex(['Etsy Competition', 'Competition'], bodyText);
        const erankKeywordDifficulty = visualMetrics.erankKeywordDifficulty || tableMetrics.erankKeywordDifficulty || metricByRegex(['Keyword Difficulty', 'KD'], bodyText);
        const erankTrend = visualMetrics.erankTrend || tableMetrics.erankTrend || metricByRegex(['Search Trend', 'Trend'], bodyText);
        const relatedKeywords = extractRelatedKeywordRows(keyword);
        const notes = erankSearchVolume || erankClicks || erankCompetition || erankKeywordDifficulty || relatedKeywords.length > 0
            ? `Extracted from eRank screen${relatedKeywords.length > 0 ? ` / related ${relatedKeywords.length}` : ''}`
            : `eRank metrics not found. Check the eRank screen manually. URL=${location.href}`;
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
        };
    }
    async function runKeyword(keyword) {
        const field = findSearchField();
        if (!field)
            throw new Error(collectSearchDiagnostics());
        field.scrollIntoView({ block: 'center' });
        field.focus();
        setNativeValue(field, keyword);
        await wait(250);
        await submitSearch(field);
        await wait(4500);
        await waitForLikelyResults(keyword);
        await revealKeywordIdeasTable();
        return extractMetrics(keyword);
    }
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        if (request.action !== 'ERANK_RUN_KEYWORD')
            return false;
        runKeyword(request.keyword)
            .then((result) => sendResponse({ ok: true, result }))
            .catch((error) => {
            const message = error instanceof Error ? error.message : 'Unexpected eRank automation error.';
            sendResponse({ ok: false, error: message });
        });
        return true;
    });
})();
