"use strict";
(() => {
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
    ];
    const SEARCH_BUTTON_WORDS = ['search', 'analyze', 'database', 'submit', 'go', 'run'];
    function wait(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }
    function normalizeText(value) {
        return value.replace(/\s+/g, ' ').trim();
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
        return `Search field not found. Open the EverBee Product Analytics/database search screen first. URL=${location.href} candidates=${candidates.join(' || ')} pageText=${text}`;
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
        return /(search|keyword|query|product|listing|database|analytics|find|etsy)/.test(text);
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
        while (Date.now() - startedAt < 15000) {
            await wait(900);
            const text = normalizeText(document.body.innerText || '');
            const hasMetric = /(listings analyzed|monthly sales|top revenue|average price|listing age|revenue|sales|estimated sales)/i.test(text);
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
    function numberLike(pattern, text) {
        var _a, _b;
        const match = text.match(pattern);
        return (_b = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
    }
    function findElementTextByLabels(labels) {
        var _a, _b, _c, _d, _e;
        const elements = Array.from(document.querySelectorAll('div, section, article, span, p, td, th, li'));
        const normalizedLabels = labels.map((label) => label.toLowerCase());
        for (const element of elements) {
            const ownText = normalizeText((_a = element.innerText) !== null && _a !== void 0 ? _a : '');
            if (!ownText || ownText.length > 320)
                continue;
            const lower = ownText.toLowerCase();
            if (!normalizedLabels.some((label) => lower.includes(label)))
                continue;
            const direct = (_b = ownText.match(/([$]?\d[\d,]*(?:\.\d+)?\s*(?:k|m|mo\.|months?|years?|yrs?)?)/i)) === null || _b === void 0 ? void 0 : _b[1];
            if (direct && !normalizedLabels.some((label) => direct.toLowerCase().includes(label)))
                return direct.trim();
            const parentText = normalizeText((_d = (_c = element.parentElement) === null || _c === void 0 ? void 0 : _c.innerText) !== null && _d !== void 0 ? _d : '');
            const parentValue = (_e = parentText.match(/([$]?\d[\d,]*(?:\.\d+)?\s*(?:k|m|mo\.|months?|years?|yrs?)?)/i)) === null || _e === void 0 ? void 0 : _e[1];
            if (parentValue)
                return parentValue.trim();
        }
        return '';
    }
    function metric(labels, regexes, bodyText) {
        const elementValue = findElementTextByLabels(labels);
        if (elementValue)
            return elementValue;
        for (const regex of regexes) {
            const value = numberLike(regex, bodyText);
            if (value)
                return value;
        }
        return '';
    }
    function parseDisplayNumber(value) {
        const cleaned = value.replace(/[$,%\s,]/g, '');
        if (!cleaned)
            return null;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
    }
    function parseTopSalesFromVisibleRows() {
        const candidates = [];
        const rows = Array.from(document.querySelectorAll('[role="row"], tr'));
        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('[role="cell"], [role="gridcell"], td'))
                .map((cell) => { var _a; return normalizeText((_a = cell.innerText) !== null && _a !== void 0 ? _a : ''); })
                .filter(Boolean);
            if (cells.length < 2)
                continue;
            const numbers = cells
                .map((cell) => { var _a, _b; return (_b = (_a = cell.match(/^[$]?\d[\d,.]*$/)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : ''; })
                .filter(Boolean)
                .map(parseDisplayNumber)
                .filter((value) => value !== null);
            if (numbers.length >= 2) {
                candidates.push(numbers[1]);
            }
        }
        if (candidates.length === 0)
            return '';
        return String(Math.max(...candidates));
    }
    function isIntegerCell(value) {
        return /^\d[\d,]*$/.test(value);
    }
    function isCurrencyCell(value) {
        return /^\$[\d,.]+$/.test(value);
    }
    function isAgeCell(value) {
        return /^\d+\s*(?:Mo\.|Yr\.|Yrs\.|months?|years?|yrs?|days?)$/i.test(value);
    }
    function isPercentCell(value) {
        return /^[-+]?\d[\d,.]*%$/.test(value);
    }
    function extractVisibleProductAnalyticsMetrics(rawBodyText) {
        var _a, _b, _c, _d, _e;
        const rows = [];
        const lines = rawBodyText
            .split(/\r?\n/)
            .map((line) => normalizeText(line))
            .filter(Boolean);
        const tableStart = lines.findIndex((line, index) => {
            var _a, _b;
            return line.toLowerCase() === 'total sales'
                && ((_a = lines[index + 1]) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'sales'
                && ((_b = lines[index + 2]) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === 'revenue';
        });
        const scanStart = tableStart >= 0 ? tableStart + 3 : 0;
        for (let index = scanStart; index < lines.length - 5; index += 1) {
            const totalSalesText = lines[index];
            const monthlySalesText = lines[index + 1];
            const revenueText = lines[index + 2];
            if (!isIntegerCell(totalSalesText) || !isIntegerCell(monthlySalesText) || !isCurrencyCell(revenueText))
                continue;
            let cursor = index + 3;
            if (/^nothing to show$/i.test((_a = lines[cursor]) !== null && _a !== void 0 ? _a : ''))
                cursor += 1;
            while (isPercentCell((_b = lines[cursor]) !== null && _b !== void 0 ? _b : ''))
                cursor += 1;
            const listingAgeText = lines[cursor];
            const priceText = lines[cursor + 1];
            if (!isAgeCell(listingAgeText !== null && listingAgeText !== void 0 ? listingAgeText : '') || !isCurrencyCell(priceText !== null && priceText !== void 0 ? priceText : ''))
                continue;
            const totalSales = parseDisplayNumber(totalSalesText);
            const monthlySales = parseDisplayNumber(monthlySalesText);
            const revenue = parseDisplayNumber(revenueText);
            const price = parseDisplayNumber(priceText);
            if (totalSales === null || monthlySales === null || revenue === null || price === null)
                continue;
            rows.push({
                totalSales,
                monthlySales,
                revenue,
                listingAge: listingAgeText,
                price,
            });
            index = cursor + 1;
        }
        const bestSalesRow = rows.reduce((best, row) => {
            if (!best || row.monthlySales > best.monthlySales)
                return row;
            return best;
        }, null);
        const revenues = rows.map((row) => row.revenue);
        const prices = rows.map((row) => row.price);
        return {
            topMonthlySales: bestSalesRow ? String(bestSalesRow.monthlySales) : '',
            topRevenue: revenues.length > 0 ? String(Math.max(...revenues)) : '',
            averagePrice: prices.length > 0 ? (prices.reduce((sum, value) => sum + value, 0) / prices.length).toFixed(2) : '',
            listingAge: (_e = (_c = bestSalesRow === null || bestSalesRow === void 0 ? void 0 : bestSalesRow.listingAge) !== null && _c !== void 0 ? _c : (_d = rows[0]) === null || _d === void 0 ? void 0 : _d.listingAge) !== null && _e !== void 0 ? _e : '',
        };
    }
    function looksLikeMetricText(value) {
        return /(total sales|monthly sales|sales|revenue|average price|listing age|listings analyzed|estimated|favorites|views|price|shop|nothing to show)/i.test(value)
            || /^[$]?\d[\d,.]*(?:%|k|m)?$/i.test(value)
            || isCurrencyCell(value)
            || isAgeCell(value)
            || isPercentCell(value);
    }
    function keywordTokenScore(value, keyword) {
        const source = value.toLowerCase();
        const tokens = keyword.toLowerCase().split(/\s+/).filter((token) => token.length >= 3);
        return tokens.reduce((score, token) => score + (source.includes(token) ? 1 : 0), 0);
    }
    function cleanListingSnippet(rawValue, keyword) {
        const lines = rawValue
            .split(/\r?\n/)
            .map((line) => normalizeText(line))
            .filter(Boolean)
            .filter((line) => line.length >= 12 && line.length <= 150)
            .filter((line) => !looksLikeMetricText(line));
        if (lines.length === 0)
            return '';
        return lines
            .sort((a, b) => keywordTokenScore(b, keyword) - keywordTokenScore(a, keyword) || b.length - a.length)[0]
            .replace(/\s+/g, ' ')
            .trim();
    }
    function extractListingSnippets(keyword) {
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
        ];
        const snippets = [];
        const seen = new Set();
        for (const selector of selectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            for (const element of elements) {
                const text = cleanListingSnippet(element.innerText || element.getAttribute('aria-label') || element.textContent || '', keyword);
                if (!text)
                    continue;
                const key = text.toLowerCase();
                if (seen.has(key))
                    continue;
                seen.add(key);
                snippets.push(text);
                if (snippets.length >= 24)
                    return snippets;
            }
        }
        const bodyLines = (document.body.innerText || '')
            .split(/\r?\n/)
            .map((line) => normalizeText(line))
            .filter((line) => line.length >= 18 && line.length <= 130)
            .filter((line) => !looksLikeMetricText(line))
            .sort((a, b) => keywordTokenScore(b, keyword) - keywordTokenScore(a, keyword));
        for (const line of bodyLines) {
            if (keywordTokenScore(line, keyword) === 0)
                continue;
            const key = line.toLowerCase();
            if (seen.has(key))
                continue;
            seen.add(key);
            snippets.push(line);
            if (snippets.length >= 24)
                break;
        }
        return snippets;
    }
    function extractMetrics(keyword) {
        const rawBodyText = document.body.innerText || '';
        const bodyText = normalizeText(rawBodyText);
        const visibleTableMetrics = extractVisibleProductAnalyticsMetrics(rawBodyText);
        const listingsAnalyzed = numberLike(/listings\s+analyzed\s*[:\-]?\s*(\d[\d,.]*[kKmM]?)/i, bodyText);
        const topMonthlySales = visibleTableMetrics.topMonthlySales || parseTopSalesFromVisibleRows();
        const topRevenue = visibleTableMetrics.topRevenue;
        const averagePrice = visibleTableMetrics.averagePrice;
        const listingAge = visibleTableMetrics.listingAge;
        const notes = listingsAnalyzed || topMonthlySales || topRevenue
            ? 'Extracted from EverBee screen'
            : `Metrics not found. Check the EverBee screen manually. URL=${location.href}`;
        return {
            keyword,
            listingsAnalyzed,
            topMonthlySales,
            topRevenue,
            averagePrice,
            listingAge,
            notes,
            listingSnippets: extractListingSnippets(keyword),
            rawText: bodyText.slice(0, 1500),
        };
    }
    async function runKeyword(keyword) {
        var _a;
        const currentSearchTerm = (_a = new URL(location.href).searchParams.get('search_term')) !== null && _a !== void 0 ? _a : '';
        if (location.pathname.includes('/product-analytics') && currentSearchTerm.trim()) {
            await wait(2500);
            return extractMetrics(keyword);
        }
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
        return extractMetrics(keyword);
    }
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        if (request.action !== 'EVERBEE_RUN_KEYWORD')
            return false;
        runKeyword(request.keyword)
            .then((result) => sendResponse({ ok: true, result }))
            .catch((error) => {
            const message = error instanceof Error ? error.message : 'Unexpected EverBee automation error.';
            sendResponse({ ok: false, error: message });
        });
        return true;
    });
})();
