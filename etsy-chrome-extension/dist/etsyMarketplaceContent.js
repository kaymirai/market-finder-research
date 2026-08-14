"use strict";
(() => {
    function normalize(value) {
        return String(value !== null && value !== void 0 ? value : '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }
    function isDateAxisLabel(value) {
        const label = String(value !== null && value !== void 0 ? value : '').replace(/\s+/g, ' ').trim();
        return /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?$/i.test(label)
            || /^\d{1,2}月\d{1,2}日$/.test(label);
    }
    function parseCompactNumber(value) {
        var _a;
        const match = String(value !== null && value !== void 0 ? value : '')
            .replace(/\u00a0/g, ' ')
            .match(/(\d[\d,]*(?:\.\d+)?)\s*(千|万|百万|億|[kmb])?/i);
        if (!match)
            return null;
        const suffix = String((_a = match[2]) !== null && _a !== void 0 ? _a : '').toLowerCase();
        let multiplier = 1;
        if (suffix === 'k' || suffix === '千')
            multiplier = 1000;
        else if (suffix === '万')
            multiplier = 10000;
        else if (suffix === 'm' || suffix === '百万')
            multiplier = 1000000;
        else if (suffix === '億')
            multiplier = 100000000;
        else if (suffix === 'b')
            multiplier = 1000000000;
        const numeric = Number(match[1].replace(/,/g, ''));
        return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : null;
    }
    function extractVisibleResult(expectedQuery) {
        var _a, _b, _c, _d, _e, _f;
        const root = (_a = document.querySelector('main, [role="main"]')) !== null && _a !== void 0 ? _a : document.body;
        const pageText = (_b = root === null || root === void 0 ? void 0 : root.innerText) !== null && _b !== void 0 ? _b : '';
        if (/slow down,\s*buddy|uh oh!|あらら|まあまあ、そう焦らずに/i.test(pageText)) {
            return {
                ok: false,
                keyword: expectedQuery,
                etsySearches30d: null,
                etsyListings: null,
                etsyRelatedTerms: [],
                etsyRelatedKeywordMetrics: [],
                etsyCheckedAt: null,
                remainingSearches: null,
                error: 'ETSY_MARKETPLACE_RATE_LIMITED: Etsy側の連続検索制限に達しました。',
            };
        }
        const inputs = root.querySelectorAll([
            'input[type="search"]',
            'input[name*="keyword" i]',
            'input[placeholder*="keyword" i]',
            'input[aria-label*="keyword" i]',
        ].join(','));
        const actualQuery = String((_d = (_c = Array.from(inputs)[0]) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : expectedQuery).trim();
        const expectedKey = normalize(expectedQuery);
        const actualKey = normalize(actualQuery);
        if (expectedKey && actualKey && expectedKey !== actualKey) {
            return {
                ok: false,
                keyword: actualQuery,
                etsySearches30d: null,
                etsyListings: null,
                etsyRelatedTerms: [],
                etsyRelatedKeywordMetrics: [],
                etsyCheckedAt: null,
                remainingSearches: null,
                error: `表示中の語句は「${actualQuery}」です。「${expectedQuery}」の結果を待っています。`,
            };
        }
        let etsySearches30d = null;
        let etsyListings = null;
        const etsyRelatedTerms = [];
        const etsyRelatedKeywordMetrics = [];
        const seenRelatedKeys = new Set();
        for (const row of Array.from(root.querySelectorAll('tr, [role="row"]'))) {
            const cells = Array.from(row.querySelectorAll('th, td, [role="cell"], [role="rowheader"]'))
                .map((cell) => { var _a; return String((_a = cell.innerText) !== null && _a !== void 0 ? _a : '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); })
                .filter(Boolean);
            if (cells.length < 3)
                continue;
            const keyword = cells[0];
            const keywordKey = normalize(keyword);
            if (!keywordKey)
                continue;
            const searches = parseCompactNumber(cells[1]);
            const listings = parseCompactNumber(cells[2]);
            if (keywordKey === (actualKey || expectedKey)) {
                etsySearches30d = searches;
                etsyListings = listings;
                continue;
            }
            if (!/[a-z]/i.test(keyword) || isDateAxisLabel(keyword) || searches === null || listings === null)
                continue;
            if (seenRelatedKeys.has(keywordKey) || etsyRelatedTerms.length >= 100)
                continue;
            seenRelatedKeys.add(keywordKey);
            etsyRelatedTerms.push(keyword);
            etsyRelatedKeywordMetrics.push({
                keyword,
                etsySearches30d: searches,
                etsyListings: listings,
                conversionLabel: String((_e = cells[3]) !== null && _e !== void 0 ? _e : '').trim(),
            });
        }
        const remainingMatch = (_f = pageText.match(/(\d+)\s+(?:free\s+)?search(?:es)?\s+(?:remaining|left)/i)) !== null && _f !== void 0 ? _f : pageText.match(/(?:残り|あと)\s*(\d+)\s*(?:回|件)?/);
        const remainingSearches = remainingMatch ? Number(remainingMatch[1]) : null;
        const ok = etsySearches30d !== null || etsyListings !== null;
        return {
            ok,
            keyword: actualQuery || expectedQuery,
            etsySearches30d,
            etsyListings,
            etsySearchTrendPercent: null,
            etsyRelatedTerms,
            etsyRelatedKeywordMetrics,
            etsyCheckedAt: ok ? new Date().toISOString() : null,
            remainingSearches: Number.isFinite(remainingSearches) ? remainingSearches : null,
            error: ok ? '' : 'Etsyの表示中の結果行から検索数と検索結果を読み取れませんでした。',
        };
    }
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        var _a, _b;
        if (request.action !== 'ETSY_MARKETPLACE_CAPTURE')
            return false;
        try {
            sendResponse({ ok: true, result: extractVisibleResult(String((_a = request.query) !== null && _a !== void 0 ? _a : '')) });
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : String((_b = error === null || error === void 0 ? void 0 : error.message) !== null && _b !== void 0 ? _b : error);
            sendResponse({
                ok: false,
                error: `ETSY_CONTENT_EXTRACT: ${message || 'Etsy Marketplace Insightsの取得に失敗しました。'}`,
            });
        }
        return true;
    });
})();
