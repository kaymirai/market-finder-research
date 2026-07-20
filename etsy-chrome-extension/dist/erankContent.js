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
    let erankRunActive = false;
    function wait(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }
    function normalizeText(value) {
        return value.replace(/\s+/g, ' ').trim();
    }
    function pageHasNoDataMessage() {
        return /(?:we don't have any data|do not have any data|no data for|no data to show)/i.test(normalizeText(document.body.innerText || ''));
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
        if (/\bunknown\b|n\/a|no data/i.test(normalized))
            return '';
        const textValue = metricValueFromText(normalized, key);
        if (textValue)
            return textValue;
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
            if (pageHasNoDataMessage())
                return;
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
    function keywordIdeasMetricSnapshot(keyword = '') {
        const columns = collectVisualColumns();
        const rows = collectVisualRows(columns).slice(0, 10);
        const summary = {
            rows: rows.length,
            withDemand: 0,
            withCompetition: 0,
            withKd: 0,
            partial: 0,
            targetFound: false,
            targetHasKd: false,
            targetPartial: false,
            text: '',
        };
        const targetRow = keyword ? findVisualRowForKeyword(keyword, columns) : null;
        if (targetRow) {
            const targetMetrics = emptyErankMetrics();
            for (const key of ERANK_METRIC_KEYS) {
                targetMetrics[key] = metricValueFromColumn(targetRow, key, columns);
            }
            summary.targetFound = true;
            summary.targetHasKd = numericMetric(targetMetrics.erankKeywordDifficulty) !== null;
            summary.targetPartial = looksLikePartialCompetitionLoad(targetMetrics);
        }
        const parts = [];
        for (const row of rows) {
            const metrics = emptyErankMetrics();
            for (const key of ERANK_METRIC_KEYS) {
                metrics[key] = metricValueFromColumn(row, key, columns);
            }
            if (metrics.erankSearchVolume || metrics.erankClicks || metrics.erankCtr)
                summary.withDemand += 1;
            if (metrics.erankCompetition)
                summary.withCompetition += 1;
            if (numericMetric(metrics.erankKeywordDifficulty) !== null)
                summary.withKd += 1;
            if (looksLikePartialCompetitionLoad(metrics))
                summary.partial += 1;
            parts.push([
                metrics.erankSearchVolume,
                metrics.erankClicks,
                metrics.erankCtr,
                metrics.erankCompetition,
                metrics.erankKeywordDifficulty,
            ].join(':'));
        }
        summary.text = parts.join('|');
        return summary;
    }
    async function waitForKeywordIdeasMetricsReady(keyword) {
        const startedAt = Date.now();
        let lastText = '';
        let stableCount = 0;
        while (Date.now() - startedAt < 60000) {
            await wait(1000);
            if (pageHasNoDataMessage())
                return;
            const snapshot = keywordIdeasMetricSnapshot(keyword);
            if (snapshot.text && snapshot.text === lastText) {
                stableCount += 1;
            }
            else {
                stableCount = 0;
                lastText = snapshot.text;
            }
            const elapsed = Date.now() - startedAt;
            const waitedEnoughForLazyColumns = elapsed >= 12000;
            const requiredKdRows = Math.max(1, Math.min(snapshot.rows, 3));
            const kdReady = snapshot.targetFound
                ? snapshot.targetHasKd
                : snapshot.withKd >= requiredKdRows;
            const hasVisibleMetrics = snapshot.rows > 0
                && snapshot.withDemand > 0
                && kdReady;
            const looksReady = hasVisibleMetrics
                && snapshot.partial === 0
                && !snapshot.targetPartial
                && stableCount >= 3;
            if (waitedEnoughForLazyColumns && looksReady)
                return;
        }
        const latest = keywordIdeasMetricSnapshot(keyword);
        throw new Error(`eRankのKD表示を60秒待ちましたが、数字として確認できませんでした。CompetitionはUnknownでもOKですが、KDが未表示または読み込み途中のため、このキーワードで停止しました。rows=${latest.rows} kd=${latest.withKd} partial=${latest.partial}`);
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
    function metricBetweenLabels(bodyText, labelPattern, nextLabelPattern) {
        const regex = new RegExp(`(?:${labelPattern})[\\s\\S]*?(-?\\d[\\d,.]*(?:\\.\\d+)?%?)[\\s\\S]*?(?=(?:${nextLabelPattern}))`, 'i');
        const match = bodyText.match(regex);
        return (match === null || match === void 0 ? void 0 : match[1]) ? normalizeMetric(match[1]) : '';
    }
    function keywordStatisticsSection(bodyText) {
        const start = bodyText.search(/keyword\s+statistics/i);
        if (start < 0)
            return bodyText;
        const rest = bodyText.slice(start);
        const next = rest.search(/\b(keyword\s+ideas|related\s+keywords|near\s+matches|broad\s+matches|search\s+trend|trend\s+buzz)\b/i);
        return next > 0 ? rest.slice(0, next) : rest;
    }
    function extractKeywordStatisticsMetrics(bodyText) {
        const result = emptyErankMetrics();
        const statisticsText = keywordStatisticsSection(bodyText);
        const searchesLabel = 'Avg\\.?\\s*Searches|Average\\s*Searches';
        const clicksLabel = 'Avg\\.?\\s*Clicks|Average\\s*Clicks';
        const ctrLabel = 'CTR|Avg\\.?\\s*CTR|Average\\s*CTR';
        const competitionLabel = 'Competition|Etsy\\s*Competition';
        result.erankSearchVolume = metricBetweenLabels(statisticsText, searchesLabel, clicksLabel)
            || metricByRegex(['Avg. Searches', 'Avg Searches', 'Average Searches', 'Searches'], statisticsText);
        result.erankClicks = metricBetweenLabels(statisticsText, clicksLabel, ctrLabel)
            || metricByRegex(['Avg. Clicks', 'Avg Clicks', 'Average Clicks', 'Clicks'], statisticsText);
        result.erankCtr = metricBetweenLabels(statisticsText, ctrLabel, competitionLabel)
            || metricByRegex(['CTR', 'Avg. CTR', 'Avg CTR', 'Average CTR'], statisticsText);
        result.erankCompetition = metricBetweenLabels(statisticsText, competitionLabel, 'Keyword\\s*Ideas|Related\\s*Keywords|Search\\s*Trend|Trend|$')
            || metricByRegex(['Competition', 'Etsy Competition'], statisticsText);
        return result;
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
        const text = normalizeText(value)
            .toLowerCase()
            .replace(/[^\w\s.]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (/^keywords?\b|^keyword ideas?\b|^search term\b/.test(text))
            return 'keyword';
        if (/^search\s*trend\b|^trend\b/.test(text))
            return 'erankTrend';
        if (/^(avg\.?|average)\s*searches?\b/.test(text))
            return 'erankSearchVolume';
        if (/^(avg\.?|average)\s*clicks?\b/.test(text))
            return 'erankClicks';
        if (/^(avg\.?|average)\s*ctr\b|^ctr\b|^click.*through\b/.test(text))
            return 'erankCtr';
        if (/^etsy\s*competition\b|^competition\b/.test(text))
            return 'erankCompetition';
        if (/^kd\b|^keyword difficulty\b|^difficulty\b/.test(text))
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
    function metricTokens(value) {
        var _a;
        return ((_a = normalizeText(value).match(/-?\d[\d,.]*%?/g)) !== null && _a !== void 0 ? _a : [])
            .map((token) => {
            const cleaned = token.replace(/[,%]/g, '');
            return {
                value: cleaned,
                number: Number(cleaned),
                hasPercent: token.includes('%'),
                raw: token,
            };
        })
            .filter((token) => token.value !== '' && Number.isFinite(token.number));
    }
    function metricNumberTokens(value) {
        return metricTokens(value).map((token) => token.value);
    }
    function pushMetricCandidate(candidates, raw) {
        var _a;
        const trimmed = normalizeText(raw);
        if (!trimmed)
            return;
        const hasPercent = trimmed.includes('%');
        const compact = trimmed
            .replace(/%/g, '')
            .replace(/,/g, '')
            .replace(/\s+/g, '')
            .trim();
        const suffix = (_a = compact.match(/[kKmM]$/)) === null || _a === void 0 ? void 0 : _a[0].toLowerCase();
        const numberText = suffix ? compact.slice(0, -1) : compact;
        const parsed = Number(numberText);
        if (!Number.isFinite(parsed))
            return;
        const scaled = suffix === 'm'
            ? parsed * 1000000
            : suffix === 'k'
                ? parsed * 1000
                : parsed;
        const number = Math.round(scaled);
        const value = String(number);
        if (candidates.some((candidate) => candidate.value === value && candidate.hasPercent === hasPercent))
            return;
        candidates.push({ value, number, hasPercent, raw: trimmed });
    }
    function metricCandidatesFromText(value) {
        const text = normalizeText(value);
        const candidates = [];
        const usedRanges = [];
        const overlapsUsedRange = (start, end) => usedRanges.some(([usedStart, usedEnd]) => start < usedEnd && end > usedStart);
        const groupedRegex = /-?\d{1,3}(?:[,\s]\d{3})+(?:\.\d+)?\s*[kKmM]?%?/g;
        let groupedMatch;
        while ((groupedMatch = groupedRegex.exec(text)) !== null) {
            const start = groupedMatch.index;
            const end = start + groupedMatch[0].length;
            usedRanges.push([start, end]);
            pushMetricCandidate(candidates, groupedMatch[0]);
        }
        const compactRegex = /-?\d+(?:\.\d+)?\s*[kKmM]?%?/g;
        let compactMatch;
        while ((compactMatch = compactRegex.exec(text)) !== null) {
            const start = compactMatch.index;
            const end = start + compactMatch[0].length;
            if (overlapsUsedRange(start, end))
                continue;
            pushMetricCandidate(candidates, compactMatch[0]);
        }
        return candidates;
    }
    function metricValueFromText(value, key) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const candidates = metricCandidatesFromText(value);
        if (key === 'erankKeywordDifficulty') {
            const kdCandidates = candidates.filter((candidate) => candidate.number >= 0 && candidate.number <= 100);
            const splitKd = normalizeText(value).match(/\b(\d{1,2})\s+(\d)\b/);
            if (splitKd)
                pushMetricCandidate(kdCandidates, `${splitKd[1]}${splitKd[2]}`);
            return (_b = (_a = kdCandidates.sort((a, b) => b.number - a.number)[0]) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : '';
        }
        if (key === 'erankCtr') {
            const ctrCandidates = candidates.filter((candidate) => candidate.number >= 0 && candidate.number <= 500);
            return (_e = (_d = ((_c = ctrCandidates.find((candidate) => candidate.hasPercent)) !== null && _c !== void 0 ? _c : ctrCandidates[0])) === null || _d === void 0 ? void 0 : _d.value) !== null && _e !== void 0 ? _e : '';
        }
        if (key === 'erankCompetition') {
            return (_g = (_f = candidates
                .filter((candidate) => candidate.number > 0)
                .sort((a, b) => b.number - a.number)[0]) === null || _f === void 0 ? void 0 : _f.value) !== null && _g !== void 0 ? _g : '';
        }
        if (key === 'erankTrend')
            return (_j = (_h = candidates[candidates.length - 1]) === null || _h === void 0 ? void 0 : _h.value) !== null && _j !== void 0 ? _j : '';
        return (_l = (_k = candidates[0]) === null || _k === void 0 ? void 0 : _k.value) !== null && _l !== void 0 ? _l : '';
    }
    function orderedMetricsFromText(rowText, keyword) {
        var _a, _b, _c, _d, _e;
        const result = emptyErankMetrics();
        const keywordIndex = rowText.toLowerCase().indexOf(keyword.toLowerCase());
        const metricText = keywordIndex >= 0 ? rowText.slice(keywordIndex + keyword.length) : rowText;
        const tokens = metricTokens(metricText);
        if (tokens.length < 5)
            return result;
        let bestMatch = null;
        for (let index = 2; index <= tokens.length - 3; index += 1) {
            const search = tokens[index - 2];
            const clicks = tokens[index - 1];
            const ctr = tokens[index];
            const competition = tokens[index + 1];
            const kd = tokens[index + 2];
            if (search.number <= 0 || clicks.number <= 0)
                continue;
            if (ctr.number < 0 || ctr.number > 500)
                continue;
            if (competition.number <= 0)
                continue;
            if (kd.number < 0 || kd.number > 100)
                continue;
            const score = (ctr.hasPercent ? 20 : 0)
                + (competition.number >= 1000 ? 12 : 0)
                + (search.number >= 100 ? 4 : 0)
                + (clicks.number >= 100 ? 4 : 0)
                + (kd.number >= 0 && kd.number <= 100 ? 4 : 0)
                - index * 0.01;
            if (!bestMatch || score > bestMatch.score)
                bestMatch = { index, score };
        }
        if (!bestMatch)
            return result;
        const ctrIndex = bestMatch.index;
        const trend = tokens[ctrIndex - 3];
        const assignments = [
            ['erankTrend', trend === null || trend === void 0 ? void 0 : trend.value],
            ['erankSearchVolume', (_a = tokens[ctrIndex - 2]) === null || _a === void 0 ? void 0 : _a.value],
            ['erankClicks', (_b = tokens[ctrIndex - 1]) === null || _b === void 0 ? void 0 : _b.value],
            ['erankCtr', (_c = tokens[ctrIndex]) === null || _c === void 0 ? void 0 : _c.value],
            ['erankCompetition', (_d = tokens[ctrIndex + 1]) === null || _d === void 0 ? void 0 : _d.value],
            ['erankKeywordDifficulty', (_e = tokens[ctrIndex + 2]) === null || _e === void 0 ? void 0 : _e.value],
        ];
        for (const [key, value] of assignments) {
            if (value && metricValueLooksUsable(value, key))
                result[key] = value;
        }
        return result;
    }
    function extractKeywordDifficultyFromRowText(rowText, keyword) {
        return orderedMetricsFromText(rowText, keyword).erankKeywordDifficulty;
    }
    function orderedMetricsFromRowText(row, keyword) {
        return orderedMetricsFromText(elementText(row), keyword);
    }
    function hasUnknownDemandLabels(rawText) {
        var _a;
        const text = normalizeText(rawText).toLowerCase();
        const unknownCount = ((_a = text.match(/\b(?:unknown|n\/a|no data|-)\b/g)) !== null && _a !== void 0 ? _a : []).length;
        return /(avg\.?\s*searches?|average\s*searches?|searches?)\s*(unknown|n\/a|no data|-)\b/.test(text)
            || /(avg\.?\s*clicks?|average\s*clicks?|clicks?)\s*(unknown|n\/a|no data|-)\b/.test(text)
            || /\b(?:avg\.?\s*)?ctr\s*(unknown|n\/a|no data|-)\b/.test(text)
            || unknownCount >= 3;
    }
    function sanitizeCompetitionLeak(metrics, rawText) {
        const competition = metrics.erankCompetition;
        if (!competition)
            return metrics;
        const demandKeys = ['erankSearchVolume', 'erankClicks', 'erankCtr'];
        const leakedKeys = demandKeys.filter((key) => metrics[key] && metrics[key] === competition);
        const allDemandMatchesCompetition = leakedKeys.length === demandKeys.length;
        if (!allDemandMatchesCompetition && !(leakedKeys.length > 0 && hasUnknownDemandLabels(rawText)))
            return metrics;
        for (const key of leakedKeys) {
            metrics[key] = '';
        }
        return metrics;
    }
    function numericMetric(value) {
        if (!value)
            return null;
        const parsed = Number(String(value).replace(/[$,%\s,]/g, ''));
        return Number.isFinite(parsed) ? parsed : null;
    }
    function looksLikePartialCompetitionLoad(metrics) {
        var _a, _b;
        const search = (_a = numericMetric(metrics.erankSearchVolume)) !== null && _a !== void 0 ? _a : 0;
        const clicks = (_b = numericMetric(metrics.erankClicks)) !== null && _b !== void 0 ? _b : 0;
        const competition = numericMetric(metrics.erankCompetition);
        const kd = numericMetric(metrics.erankKeywordDifficulty);
        const demand = Math.max(search, clicks);
        const competitionLooksTiny = competition !== null && competition > 0 && competition < 100;
        return demand >= 300
            && competitionLooksTiny
            && kd !== null
            && kd > 0
            && kd < 25;
    }
    function clearLikelyPartialCompetitionLoad(metrics) {
        if (!looksLikePartialCompetitionLoad(metrics))
            return metrics;
        metrics.erankCompetition = '';
        metrics.erankKeywordDifficulty = '';
        return metrics;
    }
    function metricValueFromPoint(row, key, columnCenter) {
        const rowRect = row.getBoundingClientRect();
        const y = Math.max(rowRect.top + 4, Math.min(rowRect.bottom - 4, rowRect.top + rowRect.height / 2));
        const candidates = [];
        for (const element of document.elementsFromPoint(columnCenter, y)) {
            let current = element;
            while (current && current !== row) {
                if (row.contains(current))
                    candidates.push(current);
                current = current.parentElement;
            }
        }
        for (const candidate of candidates) {
            const rect = candidate.getBoundingClientRect();
            const center = rect.left + rect.width / 2;
            const distance = Math.abs(center - columnCenter);
            if (rect.width > 180 || distance > 90)
                continue;
            const text = elementText(candidate);
            if (!text || text.length > 80)
                continue;
            if (/\bunknown\b|n\/a|no data/i.test(text))
                continue;
            if (metricNumberTokens(text).length > 1)
                continue;
            const value = normalizeMetricForKey(text, key);
            if (metricValueLooksUsable(value, key))
                return value;
        }
        return '';
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
    function inferredColumnBounds(columns, key, rowRect) {
        const column = columns.get(key);
        if (!column)
            return null;
        const sorted = Array.from(columns.entries())
            .sort((a, b) => a[1].center - b[1].center);
        const index = sorted.findIndex(([columnKey]) => columnKey === key);
        const previous = index > 0 ? sorted[index - 1][1] : null;
        const next = index >= 0 && index < sorted.length - 1 ? sorted[index + 1][1] : null;
        return {
            left: previous ? (previous.center + column.center) / 2 : Math.max(rowRect.left, column.left - 80),
            right: next ? (column.center + next.center) / 2 : Math.min(rowRect.right, column.right + 120),
            center: column.center,
        };
    }
    function metricTextSources(element) {
        const sources = [
            element.innerText,
            element.textContent,
            element.getAttribute('aria-label'),
            element.getAttribute('title'),
            element.getAttribute('data-value'),
            element.getAttribute('data-tooltip'),
            element.getAttribute('data-original-title'),
        ];
        const seen = new Set();
        return sources
            .map((source) => normalizeText(source !== null && source !== void 0 ? source : ''))
            .filter((source) => {
            if (!source || seen.has(source))
                return false;
            seen.add(source);
            return true;
        });
    }
    function metricValueFromColumn(row, key, columns) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const rowRect = row.getBoundingClientRect();
        const bounds = inferredColumnBounds(columns, key, rowRect);
        if (!bounds)
            return '';
        const candidates = [];
        const fragments = [];
        const elements = Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"], span, strong, div, a, button'));
        for (const element of elements.filter(isVisibleElement)) {
            const rect = element.getBoundingClientRect();
            const center = rect.left + rect.width / 2;
            const overlap = Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left);
            const columnWidth = bounds.right - bounds.left;
            if (rect.top < rowRect.top - 2 || rect.bottom > rowRect.bottom + 2)
                continue;
            if (center < bounds.left || center > bounds.right || overlap <= 0)
                continue;
            if (rect.width > Math.max(columnWidth + 24, 220))
                continue;
            for (const source of metricTextSources(element)) {
                if (source.length > 100 || /\bunknown\b|n\/a|no data/i.test(source))
                    continue;
                metricCandidatesFromText(source).forEach((candidate) => {
                    if (!candidates.some((item) => item.value === candidate.value && item.hasPercent === candidate.hasPercent)) {
                        candidates.push(candidate);
                    }
                });
                if (/^\d{1,3}$/.test(source) && !hasSameTextChild(element, source)) {
                    const duplicateFragment = fragments.some((fragment) => fragment.text === source && Math.abs(fragment.left - rect.left) <= 2);
                    if (!duplicateFragment)
                        fragments.push({ text: source, left: rect.left });
                }
            }
        }
        const joinedFragments = fragments
            .sort((a, b) => a.left - b.left)
            .map((fragment) => fragment.text)
            .join('');
        if (key === 'erankCompetition' && joinedFragments.length >= 4) {
            pushMetricCandidate(candidates, joinedFragments);
        }
        if (key === 'erankKeywordDifficulty' && joinedFragments.length >= 2 && joinedFragments.length <= 3) {
            pushMetricCandidate(candidates, joinedFragments);
        }
        const values = candidates.filter((candidate) => metricValueLooksUsable(candidate.value, key));
        if (key === 'erankCompetition') {
            return (_b = (_a = values
                .filter((candidate) => candidate.number > 0)
                .sort((a, b) => b.number - a.number)[0]) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : '';
        }
        if (key === 'erankKeywordDifficulty') {
            return (_d = (_c = values
                .filter((candidate) => candidate.number >= 0 && candidate.number <= 100)
                .sort((a, b) => b.number - a.number)[0]) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : '';
        }
        if (key === 'erankCtr') {
            return (_g = (_f = ((_e = values.find((candidate) => candidate.hasPercent)) !== null && _e !== void 0 ? _e : values[0])) === null || _f === void 0 ? void 0 : _f.value) !== null && _g !== void 0 ? _g : '';
        }
        if (key === 'erankTrend')
            return (_j = (_h = values[values.length - 1]) === null || _h === void 0 ? void 0 : _h.value) !== null && _j !== void 0 ? _j : '';
        return (_l = (_k = values[0]) === null || _k === void 0 ? void 0 : _k.value) !== null && _l !== void 0 ? _l : '';
    }
    function closestMetricValue(row, key, columnCenter) {
        var _a;
        if (key === 'erankCompetition' || key === 'erankKeywordDifficulty')
            return '';
        const pointedValue = metricValueFromPoint(row, key, columnCenter);
        if (pointedValue)
            return pointedValue;
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
            if (/\bunknown\b|n\/a|no data/i.test(item.text))
                return false;
            if (metricNumberTokens(item.text).length > 1)
                return false;
            if (!metricValueLooksUsable(item.value, key))
                return false;
            return /\d|unknown|n\/a|no data|-/i.test(item.text);
        })
            .sort((a, b) => Math.abs((a.rect.left + a.rect.width / 2) - columnCenter) - Math.abs((b.rect.left + b.rect.width / 2) - columnCenter));
        const maxDistance = 90;
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
        const orderedMetrics = orderedMetricsFromRowText(row, keyword);
        for (const key of ERANK_METRIC_KEYS) {
            const column = columns.get(key);
            const columnMetric = metricValueFromColumn(row, key, columns);
            if (key === 'erankCompetition' || key === 'erankKeywordDifficulty') {
                result[key] = columnMetric;
            }
            else {
                result[key] = orderedMetrics[key] || columnMetric || (column ? closestMetricValue(row, key, column.center) : '');
            }
        }
        const rowText = elementText(row);
        return clearLikelyPartialCompetitionLoad(sanitizeCompetitionLeak(result, rowText));
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
                rawText: elementText(row),
            };
            const orderedMetrics = orderedMetricsFromRowText(row, keyword);
            for (const metricKey of ERANK_METRIC_KEYS) {
                const column = columns.get(metricKey);
                const columnMetric = metricValueFromColumn(row, metricKey, columns);
                if (metricKey === 'erankCompetition' || metricKey === 'erankKeywordDifficulty') {
                    result[metricKey] = columnMetric;
                }
                else {
                    result[metricKey] = orderedMetrics[metricKey] || columnMetric || (column ? closestMetricValue(row, metricKey, column.center) : '');
                }
            }
            clearLikelyPartialCompetitionLoad(sanitizeCompetitionLeak(result, result.rawText));
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
            const orderedMetrics = orderedMetricsFromText(cells.join(' '), keyword);
            headerMap.forEach((key, index) => {
                if (!key || !cells[index])
                    return;
                if (key === 'keyword')
                    return;
                const metricKey = key;
                const cellMetric = normalizeMetricForKey(cells[index], metricKey);
                result[metricKey] = metricKey === 'erankCompetition' || metricKey === 'erankKeywordDifficulty'
                    ? cellMetric
                    : orderedMetrics[metricKey] || cellMetric;
            });
            clearLikelyPartialCompetitionLoad(sanitizeCompetitionLeak(result, cells.join(' ')));
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
                    rawText: cells.join(' '),
                };
                const orderedMetrics = orderedMetricsFromText(cells.join(' '), keyword);
                headerMap.forEach((field, index) => {
                    if (!field || field === 'keyword' || !cells[index])
                        return;
                    if (field in result) {
                        const metricKey = field;
                        const cellMetric = normalizeMetricForKey(cells[index], metricKey);
                        result[field] = metricKey === 'erankCompetition' || metricKey === 'erankKeywordDifficulty'
                            ? cellMetric
                            : orderedMetrics[metricKey] || cellMetric;
                    }
                });
                clearLikelyPartialCompetitionLoad(sanitizeCompetitionLeak(result, result.rawText));
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
        const statisticsMetrics = extractKeywordStatisticsMetrics(bodyText);
        const visualMetrics = extractFromVisualGrid(keyword);
        const tableMetrics = extractFromTables(keyword);
        const erankSearchVolume = statisticsMetrics.erankSearchVolume || visualMetrics.erankSearchVolume || tableMetrics.erankSearchVolume;
        const erankClicks = statisticsMetrics.erankClicks || visualMetrics.erankClicks || tableMetrics.erankClicks;
        const erankCtr = statisticsMetrics.erankCtr || visualMetrics.erankCtr || tableMetrics.erankCtr;
        const erankCompetition = visualMetrics.erankCompetition || tableMetrics.erankCompetition;
        const erankKeywordDifficulty = visualMetrics.erankKeywordDifficulty || tableMetrics.erankKeywordDifficulty;
        const erankTrend = visualMetrics.erankTrend || tableMetrics.erankTrend || metricByRegex(['Search Trend', 'Trend'], bodyText);
        const relatedKeywords = extractRelatedKeywordRows(keyword);
        const erankCheckedAt = new Date().toISOString();
        const timestampedRelatedKeywords = relatedKeywords.map((row) => (Object.assign(Object.assign({}, row), { erankCheckedAt })));
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
            erankCheckedAt,
            notes,
            rawText: bodyText.slice(0, 1500),
            relatedKeywords: timestampedRelatedKeywords,
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
        await waitForKeywordIdeasMetricsReady(keyword);
        return extractMetrics(keyword);
    }
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        if (request.action !== 'ERANK_RUN_KEYWORD')
            return false;
        if (erankRunActive) {
            sendResponse({ ok: false, error: 'eRank画面は前のキーワードをまだ処理中です。少し待ってから再実行してください。' });
            return true;
        }
        erankRunActive = true;
        runKeyword(request.keyword)
            .then((result) => {
            erankRunActive = false;
            sendResponse({ ok: true, result });
        })
            .catch((error) => {
            erankRunActive = false;
            const message = error instanceof Error ? error.message : 'Unexpected eRank automation error.';
            sendResponse({ ok: false, error: message });
        });
        return true;
    });
})();
