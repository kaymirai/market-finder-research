"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
(() => {
    // EverBee has renamed this column before, and a listing with no reviews is still a
    // usable row, so reviews are read from any of these and never gate the row.
    const REVIEW_FIELD_KEYS = ['reviews', 'totalReviews', 'reviewCount', 'numReviews', 'reviewsCount'];
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
    function extractEverbeeProductRows() {
        var _a, _b, _c, _d;
        const rowsById = new Map();
        const visibleRows = Array.from(document.querySelectorAll('[role="row"][data-id]'));
        for (const row of visibleRows) {
            const listingId = normalizeText((_a = row.getAttribute('data-id')) !== null && _a !== void 0 ? _a : '');
            if (!listingId)
                continue;
            const current = (_b = rowsById.get(listingId)) !== null && _b !== void 0 ? _b : {
                listingId,
                rowIndex: Number((_c = row.getAttribute('data-rowindex')) !== null && _c !== void 0 ? _c : Number.MAX_SAFE_INTEGER),
                fields: {},
            };
            const cells = Array.from(row.querySelectorAll('[role="cell"][data-field]'));
            for (const cell of cells) {
                const field = (_d = cell.getAttribute('data-field')) !== null && _d !== void 0 ? _d : '';
                const value = normalizeText(cell.innerText || cell.textContent || '');
                if (field && value && !current.fields[field])
                    current.fields[field] = value;
            }
            rowsById.set(listingId, current);
        }
        return Array.from(rowsById.values())
            .map((row) => {
            var _a, _b, _c;
            const title = normalizeText((_a = row.fields.product) !== null && _a !== void 0 ? _a : '');
            const totalSales = parseDisplayNumber(row.fields.totalSales);
            const monthlySales = parseDisplayNumber(row.fields.sales);
            const monthlyRevenue = parseDisplayNumber(row.fields.revenue);
            const listingAge = normalizeText((_b = row.fields.listingAge) !== null && _b !== void 0 ? _b : '');
            const price = parseDisplayNumber(row.fields.price);
            if (!title || totalSales === null || monthlySales === null || monthlyRevenue === null || !isAgeCell(listingAge) || price === null) {
                return null;
            }
            const reviewField = REVIEW_FIELD_KEYS.find((key) => row.fields[key] !== undefined);
            return {
                listingId: row.listingId,
                title,
                totalSales,
                monthlySales,
                monthlyRevenue,
                listingAge,
                listingAgeMonths: parseAgeMonths(listingAge),
                price,
                shopName: normalizeText((_c = row.fields.shopName) !== null && _c !== void 0 ? _c : ''),
                reviews: reviewField ? parseDisplayNumber(row.fields[reviewField]) : null,
                rowIndex: row.rowIndex,
            };
        })
            .filter((row) => row !== null)
            .sort((a, b) => b.monthlySales - a.monthlySales
            || b.monthlyRevenue - a.monthlyRevenue
            || b.totalSales - a.totalSales
            || a.rowIndex - b.rowIndex)
            .slice(0, 24)
            .map((_a) => {
            var { rowIndex: _rowIndex } = _a, row = __rest(_a, ["rowIndex"]);
            return row;
        });
    }
    function parseAgeMonths(value) {
        const numberMatch = value.match(/\d+(?:\.\d+)?/);
        if (!numberMatch)
            return null;
        const amount = Number(numberMatch[0]);
        if (!Number.isFinite(amount))
            return null;
        const source = value.toLowerCase();
        if (/\b(?:yr|yrs|year|years)\b/.test(source))
            return Math.round(amount * 12);
        if (/\b(?:day|days)\b/.test(source))
            return Math.max(1, Math.round(amount / 30));
        return Math.round(amount);
    }
    function rowAgeMonths(row) {
        return parseAgeMonths(row.listingAge);
    }
    function median(values) {
        if (values.length === 0)
            return null;
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 1)
            return sorted[middle];
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    function opportunityScore(row) {
        const ageMonths = rowAgeMonths(row);
        const age = ageMonths !== null && ageMonths !== void 0 ? ageMonths : 999;
        const freshBonus = age >= 2 && age <= 12 ? 45 : age <= 18 ? 22 : age <= 24 ? 8 : -18;
        const salesScore = Math.min(45, row.monthlySales * 2);
        const revenueScore = Math.min(20, row.revenue / 50);
        const priceScore = row.price >= 12 && row.price <= 45 ? 8 : row.price > 0 ? 2 : 0;
        const totalSalesPenalty = row.totalSales >= 1000 || age > 24 ? 12 : 0;
        return freshBonus + salesScore + revenueScore + priceScore - totalSalesPenalty;
    }
    function pickBestRows(rows) {
        const bySales = rows.reduce((best, row) => {
            if (!best || row.monthlySales > best.monthlySales)
                return row;
            return best;
        }, null);
        const byRevenue = rows.reduce((best, row) => {
            if (!best || row.revenue > best.revenue)
                return row;
            return best;
        }, null);
        const recentCandidates = rows.filter((row) => {
            const age = rowAgeMonths(row);
            return age !== null && age >= 2 && age <= 12 && row.monthlySales >= 5;
        });
        const warmCandidates = rows.filter((row) => {
            const age = rowAgeMonths(row);
            return age !== null && age <= 18 && row.monthlySales > 0;
        });
        const sourceRows = recentCandidates.length > 0 ? recentCandidates : warmCandidates.length > 0 ? warmCandidates : rows;
        const opportunity = sourceRows.reduce((best, row) => {
            if (!best || opportunityScore(row) > opportunityScore(best))
                return row;
            return best;
        }, null);
        const source = recentCandidates.length > 0
            ? 'recent-sales'
            : warmCandidates.length > 0
                ? 'warm-sales'
                : bySales
                    ? 'sales-leader'
                    : 'none';
        return {
            opportunity,
            bySales,
            byRevenue,
            source,
        };
    }
    function summarizeVisibleProductAnalyticsRows(rows) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const picked = pickBestRows(rows);
        const representativeRow = (_b = (_a = picked.opportunity) !== null && _a !== void 0 ? _a : picked.bySales) !== null && _b !== void 0 ? _b : picked.byRevenue;
        const revenues = rows.map((row) => row.revenue);
        const monthlySales = rows.map((row) => row.monthlySales);
        const listingAges = rows.map(rowAgeMonths).filter((value) => value !== null);
        const sellingRows = rows.filter((row) => row.monthlySales > 0);
        const recentSellingRows = sellingRows.filter((row) => {
            const age = rowAgeMonths(row);
            return age !== null && age <= 18;
        });
        const prices = rows.map((row) => row.price);
        const bestRevenue = (_d = (_c = picked.byRevenue) === null || _c === void 0 ? void 0 : _c.revenue) !== null && _d !== void 0 ? _d : 0;
        const bestSales = (_f = (_e = picked.bySales) === null || _e === void 0 ? void 0 : _e.monthlySales) !== null && _f !== void 0 ? _f : 0;
        const bestRevenueAge = (_h = (_g = picked.byRevenue) === null || _g === void 0 ? void 0 : _g.listingAge) !== null && _h !== void 0 ? _h : '';
        const bestSalesAge = (_k = (_j = picked.bySales) === null || _j === void 0 ? void 0 : _j.listingAge) !== null && _k !== void 0 ? _k : '';
        const totalVisibleMonthlySales = monthlySales.length > 0
            ? monthlySales.reduce((sum, value) => sum + value, 0)
            : null;
        return {
            topMonthlySales: rows.length > 0 ? String(bestSales) : '',
            topRevenue: rows.length > 0 ? String(bestRevenue) : '',
            averagePrice: prices.length > 0 ? (prices.reduce((sum, value) => sum + value, 0) / prices.length).toFixed(2) : '',
            listingAge: (_o = (_l = representativeRow === null || representativeRow === void 0 ? void 0 : representativeRow.listingAge) !== null && _l !== void 0 ? _l : (_m = rows[0]) === null || _m === void 0 ? void 0 : _m.listingAge) !== null && _o !== void 0 ? _o : '',
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
        };
    }
    function extractVisibleProductAnalyticsMetrics(rawBodyText) {
        var _a, _b;
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
        return summarizeVisibleProductAnalyticsRows(rows);
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
        const productRows = extractEverbeeProductRows();
        const visibleTableMetrics = productRows.length > 0
            ? summarizeVisibleProductAnalyticsRows(productRows.map((row) => ({
                totalSales: row.totalSales,
                monthlySales: row.monthlySales,
                revenue: row.monthlyRevenue,
                listingAge: row.listingAge,
                price: row.price,
            })))
            : extractVisibleProductAnalyticsMetrics(rawBodyText);
        const listingsAnalyzed = numberLike(/listings\s+analyzed\s*[:\-]?\s*(\d[\d,.]*[kKmM]?)/i, bodyText);
        const topMonthlySales = visibleTableMetrics.topMonthlySales || parseTopSalesFromVisibleRows();
        const topRevenue = visibleTableMetrics.topRevenue;
        const averagePrice = visibleTableMetrics.averagePrice;
        const listingAge = visibleTableMetrics.listingAge;
        const everbeeCheckedAt = new Date().toISOString();
        const notes = listingsAnalyzed || topMonthlySales || topRevenue
            ? `Extracted from EverBee screen${visibleTableMetrics.notes ? ` / ${visibleTableMetrics.notes}` : ''}`
            : `Metrics not found. Check the EverBee screen manually. URL=${location.href}`;
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
    const testHooks = globalThis.__ETSY_MIRAI_TEST_HOOKS__;
    if (testHooks)
        testHooks.extractEverbeeProductRows = extractEverbeeProductRows;
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
