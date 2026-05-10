"use strict";
(() => {
    const projectIdInput = document.getElementById('projectId');
    const apiUrlInput = document.getElementById('apiUrl');
    const statusDiv = document.getElementById('status');
    const everbeeUrlInput = document.getElementById('everbeeUrl');
    const marketJobInput = document.getElementById('marketJobInput');
    const maxKeywordsInput = document.getElementById('maxKeywords');
    const marketStatus = document.getElementById('marketStatus');
    const marketResults = document.getElementById('marketResults');
    document.addEventListener('DOMContentLoaded', () => {
        chrome.storage.local.get(['projectId', 'apiUrl', 'everbeeUrl', 'marketJobText', 'maxKeywords', 'marketState'], (result) => {
            if (result.projectId)
                projectIdInput.value = result.projectId;
            if (result.apiUrl)
                apiUrlInput.value = result.apiUrl;
            if (result.everbeeUrl)
                everbeeUrlInput.value = result.everbeeUrl;
            if (result.marketJobText)
                marketJobInput.value = result.marketJobText;
            if (result.maxKeywords)
                maxKeywordsInput.value = String(result.maxKeywords);
            if (result.marketState)
                renderMarketState(result.marketState);
            refreshMarketState();
        });
        bindImageCapture();
        bindMarketFinder();
        window.setInterval(refreshMarketState, 1500);
    });
    function bindImageCapture() {
        var _a, _b;
        (_a = document.getElementById('saveBtn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            const projectId = projectIdInput.value.trim();
            const apiUrl = apiUrlInput.value.trim();
            if (!projectId || !apiUrl) {
                statusDiv.textContent = 'Project IDとAPI URLを入力してください。';
                return;
            }
            chrome.storage.local.set({ projectId, apiUrl }, () => {
                statusDiv.textContent = '保存しました。';
                setTimeout(() => { statusDiv.textContent = ''; }, 2500);
            });
        });
        (_b = document.getElementById('startBtn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            const projectId = projectIdInput.value.trim();
            const apiUrl = apiUrlInput.value.trim();
            if (!projectId || !apiUrl) {
                statusDiv.textContent = '先に設定を保存してください。';
                return;
            }
            chrome.runtime.sendMessage({ action: 'START_PROCESS', projectId, apiUrl }, (response) => {
                var _a;
                statusDiv.textContent = (response === null || response === void 0 ? void 0 : response.started) ? '画像取得を開始しました。' : `開始できませんでした: ${(_a = response === null || response === void 0 ? void 0 : response.error) !== null && _a !== void 0 ? _a : 'Unknown error'}`;
            });
        });
    }
    function bindMarketFinder() {
        var _a, _b, _c, _d;
        (_a = document.getElementById('startMarketBtn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            const everbeeUrl = everbeeUrlInput.value.trim() || 'https://app.everbee.io/';
            const marketJobText = marketJobInput.value.trim();
            const maxKeywords = Math.max(1, Math.min(Number(maxKeywordsInput.value) || 5, 150));
            const keywords = parseKeywords(marketJobText).slice(0, maxKeywords);
            if (keywords.length === 0) {
                marketStatus.textContent = 'キーワードJSONまたは改行リストを貼り付けてください。';
                return;
            }
            chrome.storage.local.set({ everbeeUrl, marketJobText, maxKeywords });
            chrome.runtime.sendMessage({ action: 'START_MARKET_RESEARCH', everbeeUrl, keywords }, (response) => {
                var _a;
                marketStatus.textContent = (response === null || response === void 0 ? void 0 : response.started) ? `${keywords.length}件の調査を開始しました。` : `開始できませんでした: ${(_a = response === null || response === void 0 ? void 0 : response.error) !== null && _a !== void 0 ? _a : 'Unknown error'}`;
                refreshMarketState();
            });
        });
        (_b = document.getElementById('stopMarketBtn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'STOP_MARKET_RESEARCH' }, () => refreshMarketState());
        });
        (_c = document.getElementById('clearResultsBtn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'CLEAR_MARKET_RESULTS' }, (state) => renderMarketState(state));
        });
        (_d = document.getElementById('copyResultsBtn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', async () => {
            await navigator.clipboard.writeText(marketResults.value);
            marketStatus.textContent = '結果CSVをコピーしました。';
        });
    }
    function parseKeywords(value) {
        if (!value.trim())
            return [];
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.keywords))
                return cleanKeywords(parsed.keywords);
            if (Array.isArray(parsed))
                return cleanKeywords(parsed);
        }
        catch (_a) {
            // Plain-text keyword list is handled below.
        }
        return cleanKeywords(value.split(/\r?\n|,/));
    }
    function cleanKeywords(values) {
        const seen = new Set();
        return values
            .map((value) => String(value !== null && value !== void 0 ? value : '').trim())
            .filter(Boolean)
            .filter((keyword) => {
            const key = keyword.toLowerCase();
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        })
            .slice(0, 150);
    }
    function refreshMarketState() {
        chrome.runtime.sendMessage({ action: 'GET_MARKET_STATE' }, (state) => {
            if (chrome.runtime.lastError || !state)
                return;
            renderMarketState(state);
        });
    }
    function renderMarketState(state) {
        const done = state.results.length;
        const status = state.active
            ? `調査中: ${state.currentKeyword || '-'} / 完了 ${done}件 / 残り ${state.remaining}件`
            : `待機中 / 完了 ${done}件`;
        marketStatus.textContent = state.error ? `${status} / ${state.error}` : status;
        marketResults.value = toCsv(state.results);
    }
    function csvEscape(value) {
        const source = String(value !== null && value !== void 0 ? value : '');
        if (!/[",\n\r]/.test(source))
            return source;
        return `"${source.replace(/"/g, '""')}"`;
    }
    function toCsv(rows) {
        const header = ['Keyword', 'Listings Analyzed', 'Top Monthly Sales', 'Top Revenue', 'Average Price', 'Listing Age', 'eRank Search Volume', 'eRank Clicks', 'eRank CTR', 'eRank Competition', 'eRank KD', 'eRank Trend', 'Notes'];
        const flatRows = [];
        rows.forEach((row) => {
            flatRows.push(row);
            if (Array.isArray(row.relatedKeywords)) {
                row.relatedKeywords.forEach((related) => flatRows.push(related));
            }
        });
        const lines = flatRows.map((row) => {
            var _a, _b, _c, _d, _e, _f;
            const safeRow = sanitizeMarketResult(row);
            return [
                safeRow.keyword,
                safeRow.listingsAnalyzed,
                safeRow.topMonthlySales,
                safeRow.topRevenue,
                safeRow.averagePrice,
                safeRow.listingAge,
                (_a = safeRow.erankSearchVolume) !== null && _a !== void 0 ? _a : '',
                (_b = safeRow.erankClicks) !== null && _b !== void 0 ? _b : '',
                (_c = safeRow.erankCtr) !== null && _c !== void 0 ? _c : '',
                (_d = safeRow.erankCompetition) !== null && _d !== void 0 ? _d : '',
                (_e = safeRow.erankKeywordDifficulty) !== null && _e !== void 0 ? _e : '',
                (_f = safeRow.erankTrend) !== null && _f !== void 0 ? _f : '',
                safeRow.notes,
            ].map(csvEscape).join(',');
        });
        return [header.join(','), ...lines].join('\n');
    }
    function sanitizeMarketResult(result) {
        const next = Object.assign({}, result);
        const hasYearPoison = isKeywordYear(next.averagePrice, next.keyword) || isKeywordYear(next.listingAge, next.keyword);
        if (!hasYearPoison)
            return next;
        if (isKeywordYear(next.topRevenue, next.keyword)) {
            next.topRevenue = normalizeMetricNumber(next.topMonthlySales) === '0' ? '0' : '';
        }
        next.averagePrice = '';
        next.listingAge = '';
        next.notes = next.notes.includes('year-like fields ignored')
            ? next.notes
            : `${next.notes} / year-like fields ignored`;
        return next;
    }
    function isKeywordYear(value, keyword) {
        var _a;
        const normalizedValue = normalizeMetricNumber(value);
        if (!/^(?:19|20)\d{2}$/.test(normalizedValue))
            return false;
        const keywordYears = (_a = keyword.match(/\b(?:19|20)\d{2}\b/g)) !== null && _a !== void 0 ? _a : [];
        return keywordYears.includes(normalizedValue);
    }
    function normalizeMetricNumber(value) {
        return String(value !== null && value !== void 0 ? value : '').replace(/[$,%\s,]/g, '');
    }
})();
