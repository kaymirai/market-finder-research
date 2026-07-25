"use strict";
(() => {
    let isProcessingImages = false;
    let imageQueue = [];
    let currentProjectId = '';
    let currentApiUrl = '';
    let activeImageTabId = null;
    let tabTimeoutId = null;
    let marketActive = false;
    let marketMode = 'everbee';
    let marketQueue = [];
    let marketResults = [];
    let marketTabId = null;
    let erankTabId = null;
    let etsyMarketplaceTabId = null;
    let marketFinderTabId = null;
    let marketEverbeeUrl = 'https://app.everbee.io/';
    let marketErankUrl = 'https://erank.com/tools/keyword-tool';
    let marketCurrentKeyword = '';
    let marketError = '';
    let marketDelayMs = 4500;
    let marketTimerId = null;
    let marketRunId = 0;
    const MARKET_KEYWORD_TIMEOUT_MS = 360000;
    const ERANK_DAILY_LOOKUP_LIMIT_ERROR = 'ERANK_DAILY_LOOKUP_LIMIT_REACHED: eRankの1日あたりの検索上限に達しました。翌日のリセット後に再開してください（Basic 100件/日、Pro 200件/日）。';
    const trendSourceConfigs = {
        erank: {
            id: 'erank',
            label: 'eRank Trend Buzz',
            url: 'https://members.erank.com/trend-buzz',
        },
        etsy: {
            id: 'etsy',
            label: 'Etsy Marketplace Insights',
            url: 'https://www.etsy.com/your/shops/me/marketplace-insights',
        },
        pinterest: {
            id: 'pinterest',
            label: 'Pinterest Trends',
            url: 'https://trends.pinterest.com/',
        },
        google: {
            id: 'google',
            label: 'Google Trends',
            url: 'https://trends.google.com/trending?geo=US',
        },
    };
    const extensionWorkflowUrlPatterns = [
        'http://localhost/*',
        'http://127.0.0.1/*',
        'https://erank.com/*',
        'https://*.erank.com/*',
        'https://*.everbee.io/*',
    ];
    chrome.runtime.onInstalled.addListener((details) => {
        if (details.reason !== 'install' && details.reason !== 'update')
            return;
        reloadOpenExtensionWorkflowTabs();
    });
    function reloadOpenExtensionWorkflowTabs() {
        chrome.tabs.query({ url: extensionWorkflowUrlPatterns }, (tabs) => {
            if (chrome.runtime.lastError)
                return;
            tabs.forEach((tab) => {
                if (!tab.id)
                    return;
                chrome.tabs.reload(tab.id, {}, () => {
                    var _a;
                    // Reading lastError keeps a closed-tab race from surfacing as an extension error.
                    const _message = (_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message;
                });
            });
        });
    }
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        var _a, _b, _c;
        if (request.action === 'START_PROCESS') {
            if (isProcessingImages) {
                sendResponse({ started: false, error: '画像取得はすでに実行中です。' });
                return true;
            }
            currentProjectId = request.projectId;
            currentApiUrl = request.apiUrl;
            startCaptureProcess()
                .then(() => sendResponse({ started: true }))
                .catch((error) => sendResponse({ started: false, error: error.message }));
            return true;
        }
        if (request.action === 'IMAGE_FOUND' || request.action === 'IMAGE_ERROR') {
            handleContentResponse(request);
            return true;
        }
        if (request.action === 'START_MARKET_RESEARCH') {
            rememberMarketFinderTab(sender);
            const keywords = normalizeKeywordList(request.keywords);
            if (marketActive) {
                sendResponse({ started: false, error: 'Market Finder調査はすでに実行中です。' });
                return true;
            }
            if (keywords.length === 0) {
                sendResponse({ started: false, error: '調査キーワードがありません。' });
                return true;
            }
            marketEverbeeUrl = normalizeUrl(request.everbeeUrl || marketEverbeeUrl);
            marketDelayMs = Math.max(2500, Math.min(Number(request.delayMs) || 4500, 20000));
            marketMode = 'everbee';
            marketQueue = keywords;
            marketResults = [];
            marketError = '';
            marketActive = true;
            marketCurrentKeyword = '';
            const runId = ++marketRunId;
            saveMarketState();
            processNextMarketKeyword(runId);
            sendResponse({ started: true });
            return true;
        }
        if (request.action === 'START_ERANK_RESEARCH') {
            rememberMarketFinderTab(sender);
            const keywords = normalizeKeywordList(request.keywords);
            if (marketActive) {
                sendResponse({ started: false, error: 'Market Finder調査はすでに実行中です。' });
                return true;
            }
            if (keywords.length === 0) {
                sendResponse({ started: false, error: 'eRankで調べるキーワードがありません。' });
                return true;
            }
            marketErankUrl = normalizeErankUrl(request.erankUrl || marketErankUrl);
            marketDelayMs = Math.max(2500, Math.min(Number(request.delayMs) || 4500, 20000));
            marketMode = 'erank';
            marketQueue = keywords;
            marketResults = [];
            marketError = '';
            marketActive = true;
            marketCurrentKeyword = '';
            const runId = ++marketRunId;
            saveMarketState();
            processNextMarketKeyword(runId);
            sendResponse({ started: true });
            return true;
        }
        if (request.action === 'COLLECT_TRENDS') {
            rememberMarketFinderTab(sender);
            collectTrendSources(request.sources, request.limit, request.contextQuery)
                .then((response) => sendResponse(response))
                .catch((error) => sendResponse({
                ok: false,
                trends: [],
                errors: [error.message],
            }));
            return true;
        }
        if (request.action === 'RUN_ETSY_MARKETPLACE_INSIGHT') {
            rememberMarketFinderTab(sender);
            runEtsyMarketplaceInsight(String((_a = request.query) !== null && _a !== void 0 ? _a : ''))
                .then((response) => sendResponse(response))
                .catch((error) => sendResponse({ started: false, ok: false, error: error.message }));
            return true;
        }
        if (request.action === 'RUN_AND_CAPTURE_ETSY_MARKETPLACE_INSIGHT') {
            rememberMarketFinderTab(sender);
            runAndCaptureEtsyMarketplaceInsight(String((_b = request.query) !== null && _b !== void 0 ? _b : ''))
                .then((response) => sendResponse(response))
                .catch((error) => sendResponse({ started: false, ok: false, error: error.message }));
            return true;
        }
        if (request.action === 'CAPTURE_ETSY_MARKETPLACE_INSIGHT') {
            rememberMarketFinderTab(sender);
            captureEtsyMarketplaceInsight(String((_c = request.query) !== null && _c !== void 0 ? _c : ''))
                .then((result) => sendResponse({ ok: result.ok, result, error: result.error }))
                .catch((error) => sendResponse({ ok: false, error: error.message }));
            return true;
        }
        if (request.action === 'STOP_MARKET_RESEARCH') {
            stopMarketResearch();
            sendResponse({ stopped: true, state: getMarketState() });
            return true;
        }
        if (request.action === 'GET_MARKET_STATE') {
            sendResponse(getMarketState());
            return true;
        }
        if (request.action === 'CLEAR_MARKET_RESULTS') {
            marketResults = [];
            marketError = '';
            saveMarketState();
            sendResponse(getMarketState());
            return true;
        }
        return false;
    });
    function rememberMarketFinderTab(sender) {
        var _a;
        if ((_a = sender.tab) === null || _a === void 0 ? void 0 : _a.id)
            marketFinderTabId = sender.tab.id;
    }
    function shouldRetryTabEditError(message) {
        return /tabs cannot be edited right now/i.test(message);
    }
    function focusWindowQuietly(windowId) {
        chrome.windows.update(windowId, { focused: true }, () => {
            var _a;
            // Reading lastError prevents harmless focus failures from surfacing in chrome://extensions.
            const _message = (_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message;
        });
    }
    function focusMarketFinderTab() {
        if (marketFinderTabId === null)
            return;
        chrome.tabs.get(marketFinderTabId, (tab) => {
            if (chrome.runtime.lastError || !(tab === null || tab === void 0 ? void 0 : tab.id)) {
                marketFinderTabId = null;
                return;
            }
            activateTab(tab.id);
        });
    }
    function activateTab(tabId, attempt = 0) {
        return new Promise((resolve) => {
            chrome.tabs.get(tabId, (tab) => {
                var _a;
                const getError = (_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message;
                if (getError || !(tab === null || tab === void 0 ? void 0 : tab.id)) {
                    resolve();
                    return;
                }
                if (tab.windowId !== undefined) {
                    focusWindowQuietly(tab.windowId);
                }
                chrome.tabs.update(tabId, { active: true }, () => {
                    var _a;
                    const updateError = (_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message;
                    if (updateError && shouldRetryTabEditError(updateError) && attempt < 2) {
                        setTimeout(() => {
                            activateTab(tabId, attempt + 1).then(resolve);
                        }, 800);
                        return;
                    }
                    setTimeout(resolve, 500);
                });
            });
        });
    }
    function normalizeKeywordList(value) {
        if (!Array.isArray(value))
            return [];
        const seen = new Set();
        return value
            .map((item) => String(item !== null && item !== void 0 ? item : '').trim())
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
    function normalizeUrl(value) {
        try {
            const url = new URL(value);
            return url.toString();
        }
        catch (_a) {
            return 'https://app.everbee.io/';
        }
    }
    function normalizeErankUrl(value) {
        try {
            const url = new URL(value);
            if (isErankKeywordToolUrl(url.toString()))
                return url.toString();
            return 'https://erank.com/tools/keyword-tool';
        }
        catch (_a) {
            return 'https://erank.com/tools/keyword-tool';
        }
    }
    function findEtsyMarketplaceTab() {
        return new Promise((resolve) => {
            if (etsyMarketplaceTabId !== null) {
                chrome.tabs.get(etsyMarketplaceTabId, (tab) => {
                    if (!chrome.runtime.lastError && (tab === null || tab === void 0 ? void 0 : tab.id) && isEtsyMarketplaceInsightUrl(tab.url)) {
                        resolve(tab.id);
                        return;
                    }
                    etsyMarketplaceTabId = null;
                    findOpenTab();
                });
                return;
            }
            findOpenTab();
            function findOpenTab() {
                chrome.tabs.query({}, (tabs) => {
                    var _a;
                    const tab = tabs.find((candidate) => candidate.id && isEtsyMarketplaceInsightUrl(candidate.url));
                    resolve((_a = tab === null || tab === void 0 ? void 0 : tab.id) !== null && _a !== void 0 ? _a : null);
                });
            }
        });
    }
    function isEtsyMarketplaceInsightUrl(value) {
        if (!value)
            return false;
        try {
            const url = new URL(value);
            return /(^|\.)etsy\.com$/i.test(url.hostname) && /marketplace-insights/i.test(url.pathname);
        }
        catch (_a) {
            return false;
        }
    }
    async function openEtsyMarketplaceInsightTab(activate = true) {
        const existingTabId = await findEtsyMarketplaceTab();
        if (existingTabId !== null) {
            etsyMarketplaceTabId = existingTabId;
            if (activate)
                await activateTab(existingTabId);
            return existingTabId;
        }
        const tabId = await new Promise((resolve, reject) => {
            chrome.tabs.create({
                url: trendSourceConfigs.etsy.url,
                active: activate,
            }, (tab) => {
                var _a;
                if (chrome.runtime.lastError || !(tab === null || tab === void 0 ? void 0 : tab.id)) {
                    reject(new Error(((_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message) || 'Etsy Marketplace Insightsを開けませんでした。'));
                    return;
                }
                resolve(tab.id);
            });
        });
        etsyMarketplaceTabId = tabId;
        await waitForTabComplete(tabId);
        await delay(2200);
        return tabId;
    }
    async function runEtsyMarketplaceInsight(rawQuery, activate = true) {
        var _a;
        const query = rawQuery.trim().replace(/\s+/g, ' ');
        if (!query)
            return { started: false, ok: false, error: 'Marketplace Insightsで調べる語句がありません。' };
        const tabId = await openEtsyMarketplaceInsightTab(activate);
        const injection = await chrome.scripting.executeScript({
            target: { tabId },
            func: submitEtsyMarketplaceInsightQueryInPage,
            args: [query],
        });
        const result = (_a = injection[0]) === null || _a === void 0 ? void 0 : _a.result;
        if (!(result === null || result === void 0 ? void 0 : result.submitted)) {
            return {
                started: false,
                ok: false,
                error: (result === null || result === void 0 ? void 0 : result.error) || '検索欄が見つかりません。Etsyへログインし、Shop Manager > Stats > Marketplace Insightsを表示してください。',
            };
        }
        return { started: true, ok: true, query, tabId };
    }
    async function waitForEtsyMarketplaceInsightResult(capture, wait = delay, options = {}) {
        const attempts = Math.max(1, Number(options.attempts) || 12);
        const initialDelayMs = Math.max(0, Number(options.initialDelayMs) || 1800);
        const retryDelayMs = Math.max(0, Number(options.retryDelayMs) || 1200);
        let latest = null;
        let latestError = '';
        if (initialDelayMs > 0)
            await wait(initialDelayMs);
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
                latest = await capture();
                if (latest === null || latest === void 0 ? void 0 : latest.ok)
                    return latest;
                latestError = (latest === null || latest === void 0 ? void 0 : latest.error) || latestError;
            }
            catch (error) {
                latestError = error instanceof Error ? error.message : String(error);
            }
            if (attempt < attempts - 1 && retryDelayMs > 0)
                await wait(retryDelayMs);
        }
        throw new Error((latest === null || latest === void 0 ? void 0 : latest.error) || latestError || 'Etsy Marketplace Insightsの結果待ちがタイムアウトしました。');
    }
    async function runAndCaptureEtsyMarketplaceInsight(rawQuery) {
        var _a;
        const opened = await runEtsyMarketplaceInsight(rawQuery, false);
        if (!opened.started || !opened.ok)
            return opened;
        const query = String((_a = opened.query) !== null && _a !== void 0 ? _a : '').trim();
        if (!query)
            return { started: false, ok: false, error: 'Marketplace Insightsで調べる語句がありません。' };
        const result = await waitForEtsyMarketplaceInsightResult(() => captureEtsyMarketplaceInsight(query, false));
        return { started: true, ok: true, query, result };
    }
    async function captureEtsyMarketplaceInsight(rawQuery, restoreMarketFinderFocus = true) {
        var _a, _b, _c, _d, _e, _f, _g;
        const query = rawQuery.trim().replace(/\s+/g, ' ');
        const tabId = await findEtsyMarketplaceTab();
        if (tabId === null) {
            return {
                ok: false,
                keyword: query,
                etsySearches30d: null,
                etsyListings: null,
                etsyRelatedTerms: [],
                etsyRelatedKeywordMetrics: [],
                etsyCheckedAt: null,
                remainingSearches: null,
                error: 'Marketplace Insightsのタブが見つかりません。先に「Etsy公式確認を自動実行」を押してください。',
            };
        }
        const captures = [];
        let initialMode = 'unknown';
        try {
            const currentModeInjection = await chrome.scripting.executeScript({
                target: { tabId },
                func: switchEtsyMarketplaceRelatedModeInPage,
                args: ['current'],
            });
            initialMode = String((_c = (_b = (_a = currentModeInjection[0]) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b.mode) !== null && _c !== void 0 ? _c : 'unknown');
            for (const mode of ['similar', 'explore']) {
                try {
                    const switchInjection = await chrome.scripting.executeScript({
                        target: { tabId },
                        func: switchEtsyMarketplaceRelatedModeInPage,
                        args: [mode],
                    });
                    if (!((_e = (_d = switchInjection[0]) === null || _d === void 0 ? void 0 : _d.result) === null || _e === void 0 ? void 0 : _e.found))
                        continue;
                    const extraction = await chrome.scripting.executeScript({
                        target: { tabId },
                        func: extractEtsyMarketplaceInsightInPage,
                        args: [query],
                    });
                    const result = (_f = extraction[0]) === null || _f === void 0 ? void 0 : _f.result;
                    if (result)
                        captures.push({ mode, result });
                }
                catch (_h) {
                    // A single related view should not block capture of the other view.
                }
            }
            if (captures.length === 0) {
                const extraction = await chrome.scripting.executeScript({
                    target: { tabId },
                    func: extractEtsyMarketplaceInsightInPage,
                    args: [query],
                });
                const result = (_g = extraction[0]) === null || _g === void 0 ? void 0 : _g.result;
                if (result)
                    captures.push({ mode: 'visible', result });
            }
        }
        finally {
            if (initialMode === 'similar' || initialMode === 'explore') {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId },
                        func: switchEtsyMarketplaceRelatedModeInPage,
                        args: [initialMode],
                    });
                }
                catch (_j) {
                    // Restoring the selected view is best-effort only.
                }
            }
        }
        if (restoreMarketFinderFocus)
            focusMarketFinderTab();
        if (captures.length === 0)
            throw new Error('Marketplace Insightsの画面から結果を取得できませんでした。');
        return mergeEtsyMarketplaceInsightResults(captures);
    }
    function mergeEtsyMarketplaceInsightResults(captures) {
        var _a, _b, _c;
        const usable = captures.filter((capture) => capture === null || capture === void 0 ? void 0 : capture.result);
        const base = (_b = (_a = usable.find((capture) => capture.result.ok)) === null || _a === void 0 ? void 0 : _a.result) !== null && _b !== void 0 ? _b : (_c = usable[0]) === null || _c === void 0 ? void 0 : _c.result;
        if (!base)
            throw new Error('Marketplace Insightsの結果が空です。');
        const relatedTerms = new Map();
        const relatedMetrics = new Map();
        const relatedModes = [];
        const normalizeKey = (value) => String(value !== null && value !== void 0 ? value : '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        usable.forEach(({ mode, result }) => {
            if (mode && !relatedModes.includes(mode))
                relatedModes.push(mode);
            result.etsyRelatedTerms.forEach((term) => {
                const key = normalizeKey(term);
                if (key && !relatedTerms.has(key))
                    relatedTerms.set(key, term);
            });
            result.etsyRelatedKeywordMetrics.forEach((metric) => {
                var _a, _b, _c, _d, _e, _f;
                const key = normalizeKey(metric.keyword);
                if (!key)
                    return;
                const previous = relatedMetrics.get(key);
                const sourceModes = Array.from(new Set([
                    ...((_a = previous === null || previous === void 0 ? void 0 : previous.sourceModes) !== null && _a !== void 0 ? _a : []),
                    ...((_b = metric.sourceModes) !== null && _b !== void 0 ? _b : []),
                    mode,
                ].filter(Boolean)));
                relatedMetrics.set(key, Object.assign(Object.assign(Object.assign({}, previous), metric), { keyword: metric.keyword || (previous === null || previous === void 0 ? void 0 : previous.keyword) || '', etsySearches30d: (_d = (_c = metric.etsySearches30d) !== null && _c !== void 0 ? _c : previous === null || previous === void 0 ? void 0 : previous.etsySearches30d) !== null && _d !== void 0 ? _d : null, etsyListings: (_f = (_e = metric.etsyListings) !== null && _e !== void 0 ? _e : previous === null || previous === void 0 ? void 0 : previous.etsyListings) !== null && _f !== void 0 ? _f : null, conversionLabel: metric.conversionLabel || (previous === null || previous === void 0 ? void 0 : previous.conversionLabel) || '', sourceModes }));
            });
        });
        return Object.assign(Object.assign({}, base), { ok: usable.some((capture) => capture.result.ok), etsyRelatedTerms: Array.from(relatedTerms.values()).slice(0, 200), etsyRelatedKeywordMetrics: Array.from(relatedMetrics.values()).slice(0, 200), etsyRelatedModes: relatedModes });
    }
    async function switchEtsyMarketplaceRelatedModeInPage(requestedMode) {
        var _a;
        function visible(element) {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        }
        function labelText(element) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const labelledBy = ((_a = element.getAttribute('aria-labelledby')) !== null && _a !== void 0 ? _a : '')
                .split(/\s+/)
                .map((id) => { var _a, _b; return (_b = (_a = document.getElementById(id)) === null || _a === void 0 ? void 0 : _a.textContent) !== null && _b !== void 0 ? _b : ''; })
                .join(' ');
            return [
                (_b = element.getAttribute('aria-label')) !== null && _b !== void 0 ? _b : '',
                labelledBy,
                (_d = (_c = element.closest('label')) === null || _c === void 0 ? void 0 : _c.textContent) !== null && _d !== void 0 ? _d : '',
                (_f = (_e = element.previousElementSibling) === null || _e === void 0 ? void 0 : _e.textContent) !== null && _f !== void 0 ? _f : '',
                (_h = (_g = element.nextElementSibling) === null || _g === void 0 ? void 0 : _g.textContent) !== null && _h !== void 0 ? _h : '',
            ].join(' ').replace(/\s+/g, ' ').trim();
        }
        function identifyMode(element) {
            const label = labelText(element);
            if (/explor|discover|idea|探索|アイデア/i.test(label))
                return 'explore';
            if (/similar|related|似たような|関連/i.test(label))
                return 'similar';
            return 'unknown';
        }
        function checked(element) {
            return (element instanceof HTMLInputElement && element.checked)
                || element.getAttribute('aria-checked') === 'true';
        }
        const radios = Array.from(document.querySelectorAll('input[type="radio"], [role="radio"]'))
            .filter((element) => visible(element) || Boolean(element.closest('label')));
        const current = radios.find((element) => checked(element));
        const currentMode = current ? identifyMode(current) : 'unknown';
        if (requestedMode === 'current')
            return { found: radios.length > 0, mode: currentMode, changed: false };
        const target = radios.find((element) => identifyMode(element) === requestedMode);
        if (!target)
            return { found: false, mode: currentMode, changed: false };
        if (checked(target))
            return { found: true, mode: requestedMode, changed: false };
        const clickTarget = (_a = target.closest('label')) !== null && _a !== void 0 ? _a : target;
        clickTarget.click();
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        return { found: true, mode: requestedMode, changed: true };
    }
    async function submitEtsyMarketplaceInsightQueryInPage(query) {
        var _a, _b, _c, _d;
        function visible(element) {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        }
        const inputs = Array.from(document.querySelectorAll([
            'main input[type="search"]',
            'main input[name*="keyword" i]',
            'main input[placeholder*="keyword" i]',
            'main input[aria-label*="keyword" i]',
            'main input[placeholder*="search" i]',
            'main input[aria-label*="search" i]',
            'input[type="search"]',
        ].join(','))).filter((input) => visible(input) && !input.disabled && !input.readOnly);
        const input = inputs[0];
        if (!input) {
            return { submitted: false, error: 'Marketplace Insightsの検索欄が見つかりません。Etsyへのログイン状態を確認してください。' };
        }
        input.focus();
        const setter = (_a = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')) === null || _a === void 0 ? void 0 : _a.set;
        if (setter)
            setter.call(input, query);
        else
            input.value = query;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        const form = input.closest('form');
        const scope = (_b = form !== null && form !== void 0 ? form : input.closest('main, section, article, [role="main"]')) !== null && _b !== void 0 ? _b : document;
        const buttons = Array.from(scope.querySelectorAll('button, [role="button"]'))
            .filter((button) => visible(button) && !button.hasAttribute('disabled'));
        const submitButton = (_c = buttons.find((button) => {
            var _a, _b;
            const label = `${(_a = button.textContent) !== null && _a !== void 0 ? _a : ''} ${(_b = button.getAttribute('aria-label')) !== null && _b !== void 0 ? _b : ''}`.trim();
            return /^(?:search|explore|view insights|show results|検索)$/i.test(label);
        })) !== null && _c !== void 0 ? _c : ((_d = form === null || form === void 0 ? void 0 : form.querySelector('button[type="submit"], input[type="submit"]')) !== null && _d !== void 0 ? _d : null);
        if (submitButton) {
            submitButton.click();
        }
        else if (form) {
            form.requestSubmit();
        }
        else {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        }
        return { submitted: true };
    }
    function extractEtsyMarketplaceInsightInPage(expectedQuery) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        function visible(element) {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        }
        function normalize(value) {
            return String(value !== null && value !== void 0 ? value : '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        }
        function parseCompactNumber(value) {
            var _a;
            const match = String(value !== null && value !== void 0 ? value : '')
                .replace(/\u00a0/g, ' ')
                .match(/(\d[\d,]*(?:\.\d+)?)\s*(百万|千|万|億|[kmb])?/i);
            if (!match)
                return null;
            const suffix = ((_a = match[2]) !== null && _a !== void 0 ? _a : '').toLowerCase();
            const multiplier = suffix === 'k' || suffix === '千'
                ? 1000
                : suffix === '万'
                    ? 10000
                    : suffix === 'm' || suffix === '百万'
                        ? 1000000
                        : suffix === '億'
                            ? 100000000
                            : suffix === 'b'
                                ? 1000000000
                                : 1;
            const numeric = Number(match[1].replace(/,/g, ''));
            return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : null;
        }
        const root = (_a = document.querySelector('main, [role="main"]')) !== null && _a !== void 0 ? _a : document.body;
        const input = Array.from(root.querySelectorAll('input[type="search"], input[name*="keyword" i], input[placeholder*="keyword" i]'))
            .find((candidate) => visible(candidate));
        const actualQuery = String((_b = input === null || input === void 0 ? void 0 : input.value) !== null && _b !== void 0 ? _b : '').trim();
        if (expectedQuery && actualQuery && normalize(expectedQuery) !== normalize(actualQuery)) {
            return {
                ok: false,
                keyword: actualQuery,
                etsySearches30d: null,
                etsyListings: null,
                etsyRelatedTerms: [],
                etsyRelatedKeywordMetrics: [],
                etsyCheckedAt: null,
                remainingSearches: null,
                error: `表示中の語句は「${actualQuery}」です。「${expectedQuery}」の結果を表示してから取り込んでください。`,
            };
        }
        const texts = Array.from(root.querySelectorAll('section, article, [role="row"], [role="cell"], [data-testid], h1, h2, h3, h4, p, span, div'))
            .filter((element) => visible(element))
            .map((element) => { var _a, _b; return (_b = (_a = element.innerText) === null || _a === void 0 ? void 0 : _a.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim()) !== null && _b !== void 0 ? _b : ''; })
            .filter((text, index, all) => text && text.length <= 500 && all.indexOf(text) === index)
            .sort((left, right) => left.length - right.length);
        function extractMetric(labelPattern, excludePattern) {
            const numberPattern = '(\\d[\\d,]*(?:\\.\\d+)?\\s*(?:百万|千|万|億|[kmb])?)';
            const after = new RegExp(`${labelPattern}[^\\d]{0,45}${numberPattern}`, 'i');
            const before = new RegExp(`${numberPattern}[^a-z0-9]{0,30}${labelPattern}`, 'i');
            for (const text of texts) {
                if (excludePattern === null || excludePattern === void 0 ? void 0 : excludePattern.test(text))
                    continue;
                const match = text.match(after);
                if (match)
                    return parseCompactNumber(match[1]);
                const reverseMatch = text.match(before);
                if (reverseMatch)
                    return parseCompactNumber(reverseMatch[1]);
            }
            return null;
        }
        const searchLabel = '(?:searches?(?:\\s+in\\s+(?:the\\s+)?last\\s+30\\s+days)?|30[- ]day searches|search volume|buyer searches|検索(?:数)?(?!結果))';
        const listingLabel = '(?:listings|items available|available listings|competition|search results?|掲載数|出品数|検索結果(?:数)?)';
        const etsySearches30d = extractMetric(searchLabel, /remaining|left|free searches|per week|残り|無料検索|週/i);
        const etsyListings = extractMetric(listingLabel);
        const normalizedQuery = normalize(actualQuery || expectedQuery);
        const searchTrendPercent = (_d = (_c = Array.from(root.querySelectorAll('tr, [role="row"]'))
            .filter((row) => visible(row))
            .map((row) => { var _a, _b; return (_b = (_a = row.innerText) === null || _a === void 0 ? void 0 : _a.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()) !== null && _b !== void 0 ? _b : ''; })
            .find((rowText) => normalizedQuery && normalize(rowText).includes(normalizedQuery) && /[+-]?\d+(?:\.\d+)?\s*%/.test(rowText))) === null || _c === void 0 ? void 0 : _c.match(/([+-]?\d+(?:\.\d+)?)\s*%/)) === null || _d === void 0 ? void 0 : _d[1];
        const etsySearchTrendPercent = searchTrendPercent === undefined ? null : Number(searchTrendPercent);
        const relatedTerms = [];
        const relatedTermByKey = new Map();
        const relatedMetricsByKey = new Map();
        const ignoredTerm = /^(?:searches?|search results?|listings?|competition|search volume|related searches?|related terms?|similar search terms?|exploration ideas?|explore ideas?|marketplace insights|conversion rate|very low|low|medium|high|very high|trend|last 30 days|your search|検索|検索数|検索結果|掲載数|出品数|似たような検索ワード|探索のアイデア|関連検索|関連キーワード|コンバージョン率|とても低い|低い|普通|高い|とても高い)$/i;
        const relatedColumnHeader = /^(?:searches?|search results?|listings?|competition|search volume|conversion rate|検索|検索数|検索結果|掲載数|出品数|コンバージョン率)$/i;
        function addRelatedTerm(rawValue) {
            var _a;
            const value = String(rawValue !== null && rawValue !== void 0 ? rawValue : '').replace(/\s+/g, ' ').trim();
            const key = normalize(value);
            if (!key || key === normalize(expectedQuery || actualQuery))
                return null;
            if (relatedTermByKey.has(key))
                return (_a = relatedTermByKey.get(key)) !== null && _a !== void 0 ? _a : null;
            if (value.length < 3 || value.length > 80 || !/[a-z]/i.test(value) || ignoredTerm.test(value))
                return null;
            const words = value.split(/\s+/).filter(Boolean);
            if (words.length > 9 || /^[-+\d,.%$\s]+$/.test(value))
                return null;
            relatedTermByKey.set(key, value);
            relatedTerms.push(value);
            return value;
        }
        function addRelatedMetric(rawKeyword, searches, listings, conversionLabel) {
            const keyword = addRelatedTerm(rawKeyword);
            if (!keyword || (searches === null && listings === null))
                return;
            const key = normalize(keyword);
            relatedMetricsByKey.set(key, {
                keyword,
                etsySearches30d: searches,
                etsyListings: listings,
                conversionLabel: String(conversionLabel !== null && conversionLabel !== void 0 ? conversionLabel : '').replace(/\s+/g, ' ').trim(),
            });
        }
        const relatedHeading = Array.from(root.querySelectorAll('h2, h3, h4, [role="heading"]'))
            .find((heading) => { var _a; return /related|similar search|exploration ideas?|explore ideas?|似たような検索ワード|探索のアイデア|関連(?:する)?検索|関連キーワード/i.test((_a = heading.innerText) !== null && _a !== void 0 ? _a : ''); });
        const relatedScopes = [
            (_e = relatedHeading === null || relatedHeading === void 0 ? void 0 : relatedHeading.closest) === null || _e === void 0 ? void 0 : _e.call(relatedHeading, 'table, section, article, [role="region"]'),
            relatedHeading === null || relatedHeading === void 0 ? void 0 : relatedHeading.parentElement,
            relatedHeading === null || relatedHeading === void 0 ? void 0 : relatedHeading.nextElementSibling,
        ].filter((scope, index, scopes) => Boolean(scope) && scopes.indexOf(scope) === index);
        if (relatedScopes.length === 0)
            relatedScopes.push(root);
        const relatedRows = new Set();
        relatedScopes.forEach((scope) => {
            scope.querySelectorAll('table tbody tr, tbody tr, tr, [role="row"]').forEach((row) => relatedRows.add(row));
        });
        relatedRows.forEach((row) => {
            var _a, _b, _c;
            if (!visible(row))
                return;
            const rowText = (_a = row.innerText) !== null && _a !== void 0 ? _a : '';
            const cellElements = Array.from(row.querySelectorAll('th, td, [role="cell"], [role="rowheader"]'));
            const cells = (cellElements.length > 0
                ? cellElements.map((cell) => { var _a; return (_a = cell.innerText) !== null && _a !== void 0 ? _a : ''; })
                : rowText.split(/\r?\n/))
                .map((cell) => cell.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
                .filter(Boolean);
            const termIndex = cells.findIndex((cell) => /[a-z]/i.test(cell)
                && !ignoredTerm.test(cell)
                && !/^[-+\d,.%$\s]+$/.test(cell));
            if (termIndex < 0)
                return;
            const trailingCells = cells.slice(termIndex + 1);
            const numericValues = [];
            let conversionLabel = '';
            trailingCells.forEach((cell) => {
                const parsed = parseCompactNumber(cell);
                if (parsed !== null && numericValues.length < 2) {
                    numericValues.push(parsed);
                }
                else if (!conversionLabel && !relatedColumnHeader.test(cell)) {
                    conversionLabel = cell;
                }
            });
            addRelatedMetric(cells[termIndex], (_b = numericValues[0]) !== null && _b !== void 0 ? _b : null, (_c = numericValues[1]) !== null && _c !== void 0 ? _c : null, conversionLabel);
        });
        relatedScopes.forEach((scope) => {
            scope.querySelectorAll('a, button, [role="rowheader"], [data-testid*="keyword" i]').forEach((element) => {
                var _a;
                if (visible(element))
                    addRelatedTerm((_a = element.innerText) !== null && _a !== void 0 ? _a : '');
            });
        });
        const pageText = (_g = (_f = root.innerText) === null || _f === void 0 ? void 0 : _f.replace(/\u00a0/g, ' ')) !== null && _g !== void 0 ? _g : '';
        const remainingMatch = (_j = (_h = pageText.match(/(\d+)\s+(?:free\s+)?search(?:es)?\s+(?:remaining|left)/i)) !== null && _h !== void 0 ? _h : pageText.match(/(?:remaining|left)[^\d]{0,20}(\d+)\s+(?:search(?:es)?)?/i)) !== null && _j !== void 0 ? _j : pageText.match(/(?:残り|あと)\s*(\d+)\s*(?:回|件)?/);
        const remainingSearches = remainingMatch ? Number(remainingMatch[1]) : null;
        const ok = etsySearches30d !== null || etsyListings !== null;
        const limitedRelatedTerms = relatedTerms.slice(0, 100);
        const limitedRelatedKeys = new Set(limitedRelatedTerms.map((term) => normalize(term)));
        return {
            ok,
            keyword: actualQuery || expectedQuery,
            etsySearches30d,
            etsyListings,
            etsySearchTrendPercent: Number.isFinite(etsySearchTrendPercent) ? etsySearchTrendPercent : null,
            etsyRelatedTerms: limitedRelatedTerms,
            etsyRelatedKeywordMetrics: Array.from(relatedMetricsByKey.entries())
                .filter(([key]) => limitedRelatedKeys.has(key))
                .map(([, metric]) => metric),
            etsyCheckedAt: ok ? new Date().toISOString() : null,
            remainingSearches: Number.isFinite(remainingSearches) ? remainingSearches : null,
            error: ok ? undefined : '30日検索数と掲載数が見つかりません。Etsyの検索結果が表示されているか確認してください。',
        };
    }
    const testHooks = globalThis.__ETSY_MIRAI_TEST_HOOKS__;
    if (testHooks)
        testHooks.extractEtsyMarketplaceInsightInPage = extractEtsyMarketplaceInsightInPage;
    if (testHooks)
        testHooks.mergeEtsyMarketplaceInsightResults = mergeEtsyMarketplaceInsightResults;
    if (testHooks)
        testHooks.switchEtsyMarketplaceRelatedModeInPage = switchEtsyMarketplaceRelatedModeInPage;
    if (testHooks)
        testHooks.waitForEtsyMarketplaceInsightResult = waitForEtsyMarketplaceInsightResult;
    function normalizeTrendSources(value) {
        const requested = Array.isArray(value) && value.length > 0
            ? value.map((item) => String(item).toLowerCase())
            : ['erank', 'pinterest', 'google'];
        const seen = new Set();
        return requested
            .map((id) => trendSourceConfigs[id])
            .filter((config) => Boolean(config))
            .filter((config) => {
            if (seen.has(config.id))
                return false;
            seen.add(config.id);
            return true;
        });
    }
    async function collectTrendSources(sources, limit, rawContextQuery) {
        const configs = normalizeTrendSources(sources);
        const perSourceLimit = Math.max(6, Math.min(Number(limit) || 18, 40));
        const contextQuery = String(rawContextQuery !== null && rawContextQuery !== void 0 ? rawContextQuery : '').trim().replace(/\s+/g, ' ');
        const trends = [];
        const errors = [];
        const seen = new Set();
        for (const config of configs) {
            try {
                const sourceTrends = await collectTrendSource(config, perSourceLimit, contextQuery);
                sourceTrends.forEach((trend) => {
                    const key = trend.keyword.toLowerCase();
                    if (!key || seen.has(key))
                        return;
                    seen.add(key);
                    trends.push(trend);
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : '取得に失敗しました。';
                errors.push(`${config.label}: ${message}`);
            }
        }
        focusMarketFinderTab();
        return { ok: errors.length === 0 || trends.length > 0, trends, errors };
    }
    async function collectTrendSource(config, limit, contextQuery) {
        const tab = await openTrendSourceTab(config, contextQuery);
        await waitForTabComplete(tab.tabId);
        await delay(4500);
        const trends = await extractTrendsFromTab(tab.tabId, config, limit);
        if (trends.length > 0) {
            if (tab.created)
                closeTabQuietly(tab.tabId);
            return trends;
        }
        throw new Error('候補語が見つかりませんでした。ログイン後、ページを表示してから再実行してください。');
    }
    function contextualTrendUrl(config, contextQuery) {
        if (!contextQuery)
            return config.url;
        if (config.id === 'google') {
            return `https://trends.google.com/trends/explore?geo=US&q=${encodeURIComponent(contextQuery)}`;
        }
        if (config.id === 'pinterest') {
            return `https://trends.pinterest.com/?country=US&q=${encodeURIComponent(contextQuery)}`;
        }
        return config.url;
    }
    function openTrendSourceTab(config, contextQuery) {
        return new Promise((resolve, reject) => {
            const targetUrl = contextualTrendUrl(config, contextQuery);
            chrome.tabs.query({}, (tabs) => {
                const existing = tabs.find((tab) => tab.id && isTrendSourceUrl(tab.url, config.id));
                if (existing === null || existing === void 0 ? void 0 : existing.id) {
                    if (targetUrl !== config.url && existing.url !== targetUrl) {
                        chrome.tabs.update(existing.id, { url: targetUrl, active: false }, (tab) => {
                            var _a;
                            if (chrome.runtime.lastError || !(tab === null || tab === void 0 ? void 0 : tab.id)) {
                                reject(new Error(((_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message) || 'トレンドページを更新できませんでした。'));
                                return;
                            }
                            resolve({ tabId: tab.id, created: false });
                        });
                        return;
                    }
                    resolve({ tabId: existing.id, created: false });
                    return;
                }
                chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
                    var _a;
                    if (chrome.runtime.lastError || !(tab === null || tab === void 0 ? void 0 : tab.id)) {
                        reject(new Error(((_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message) || 'ページを開けませんでした。'));
                        return;
                    }
                    resolve({ tabId: tab.id, created: true });
                });
            });
        });
    }
    function isTrendSourceUrl(value, sourceId) {
        if (!value)
            return false;
        try {
            const url = new URL(value);
            if (sourceId === 'erank')
                return /(^|\.)erank\.com$/i.test(url.hostname) && /trend|monthly|buzz/i.test(url.pathname);
            if (sourceId === 'etsy')
                return /(^|\.)etsy\.com$/i.test(url.hostname) && /stats|insights|shops\/me/i.test(url.pathname);
            if (sourceId === 'pinterest')
                return /(^|\.)pinterest\.com$/i.test(url.hostname) && /trend/i.test(url.hostname + url.pathname);
            if (sourceId === 'google')
                return /^trends\.google\./i.test(url.hostname);
            return false;
        }
        catch (_a) {
            return false;
        }
    }
    async function extractTrendsFromTab(tabId, config, limit) {
        var _a;
        const injection = await chrome.scripting.executeScript({
            target: { tabId },
            func: extractTrendCandidatesInPage,
            args: [config.label, config.url, limit],
        });
        const result = (_a = injection[0]) === null || _a === void 0 ? void 0 : _a.result;
        return Array.isArray(result) ? result : [];
    }
    function closeTabQuietly(tabId) {
        chrome.tabs.remove(tabId, () => {
            var _a;
            const _message = (_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message;
            // The tab may have been closed by the user. Nothing else to do.
        });
    }
    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    function stopMarketResearch() {
        marketRunId += 1;
        marketActive = false;
        marketQueue = [];
        marketCurrentKeyword = '';
        if (marketTimerId) {
            clearTimeout(marketTimerId);
            marketTimerId = null;
        }
        saveMarketState();
    }
    function withTimeout(task, timeoutMs, message) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
            task
                .then((value) => {
                clearTimeout(timeoutId);
                resolve(value);
            })
                .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }
    function extractTrendCandidatesInPage(source, sourceUrl, limit) {
        const ignoredExact = new Set([
            'home',
            'login',
            'log in',
            'sign in',
            'sign up',
            'settings',
            'privacy',
            'terms',
            'help',
            'feedback',
            'search',
            'filter',
            'filters',
            'columns',
            'export',
            'keyword',
            'keywords',
            'trend',
            'trends',
            'trending',
            'competition',
            'clicks',
            'ctr',
            'avg searches',
            'avg clicks',
            'etsy competition',
            'marketplace insights',
            'google trends',
            'pinterest trends',
            'erank',
            'keyword tool',
            'bulk keyword tool',
            'keyword lists',
            'rank checker',
            'listing audit',
            'listing helper',
            'competitor sales',
            'profit calculator',
            'plans and pricing',
        ]);
        const ignoredPattern = /\b(?:cookie|privacy|terms|feedback|subscribe|account|dashboard|analytics|settings|download|export|column|filter|average|search volume|past 24 hours|started|trend breakdown|unknown|ranked by|view all|learn more|create campaign|contact sales|seller handbook|shop manager|keyword tool|bulk keyword|keyword lists?|rank checker|listing audit|listing helper|competitor|profit calculator|pricing|plans|blog|resources|academy|support|newsletter)\b/i;
        const result = [];
        const seen = new Set();
        function isVisible(element) {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        }
        function isNavigationElement(element) {
            return Boolean(element.closest('nav, header, footer, aside, [role="navigation"], [aria-label*="navigation" i], [aria-label*="menu" i], [class*="sidebar" i], [class*="navbar" i], [class*="footer" i], [class*="header" i]'));
        }
        function cleanCandidate(value) {
            return String(value !== null && value !== void 0 ? value : '')
                .replace(/\u00a0/g, ' ')
                .replace(/^[#\s]*\d+[\).\-\s]+/, '')
                .replace(/\b(?:breakout|rising|top|popular|searches|clicks|views|pins)\b$/i, '')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/^[^\w]+|[^\w\s'&-]+$/g, '')
                .trim();
        }
        function isDateAxisNoise(value) {
            const monthWords = new Set([
                'jan', 'january', 'feb', 'february', 'mar', 'march', 'apr', 'april',
                'may', 'jun', 'june', 'jul', 'july', 'aug', 'august', 'sep', 'sept',
                'september', 'oct', 'october', 'nov', 'november', 'dec', 'december',
            ]);
            const genericWords = new Set([
                'shirt', 'shirts', 'tee', 'tshirt', 'tshirts', 'gift', 'gifts',
                'mug', 'tote', 'bag', 'sticker', 'searches', 'clicks', 'views', 'pins',
            ]);
            const words = value.toLowerCase().split(/\s+/).filter(Boolean);
            const hasMonth = words.some((word) => monthWords.has(word));
            const hasYearish = words.some((word) => /^(?:20\d{2}|\d{2})$/.test(word));
            const specificWords = words.filter((word) => (!monthWords.has(word)
                && !genericWords.has(word)
                && !/^(?:20\d{2}|\d{2}|[\d,]+)$/.test(word)));
            return hasMonth && hasYearish && specificWords.length === 0;
        }
        function addCandidate(raw, note) {
            const keyword = cleanCandidate(raw);
            const normalized = keyword.toLowerCase();
            if (!keyword || seen.has(normalized))
                return;
            if (keyword.length < 3 || keyword.length > 60)
                return;
            if (!/[a-z]/i.test(keyword))
                return;
            if (isDateAxisNoise(keyword))
                return;
            if (/https?:|www\.|@/.test(keyword))
                return;
            if (/^[\d\s,.$%+-]+$/.test(keyword))
                return;
            if (ignoredExact.has(normalized) || ignoredPattern.test(keyword))
                return;
            const words = keyword.split(/\s+/).filter(Boolean);
            if (words.length > 7)
                return;
            if (words.length === 1 && keyword.length < 4)
                return;
            if (words.some((word) => word.length > 24))
                return;
            seen.add(normalized);
            result.push({ keyword, source, sourceUrl, note });
        }
        function addSplitText(text, note) {
            String(text !== null && text !== void 0 ? text : '')
                .split(/\n|\t|\||•|·|, {2,}/)
                .map((part) => part.trim())
                .filter(Boolean)
                .forEach((part) => addCandidate(part, note));
        }
        const selectorGroups = [
            [
                'main table tbody tr',
                'main [role="row"]',
                'main [role="gridcell"]',
                'main [role="cell"]',
                'table tbody tr',
                '[role="row"]',
            ],
            [
                'main [data-testid*="trend" i]',
                'main [class*="trend" i]',
                'main [class*="keyword" i]',
                'main [class*="card" i]',
                '[data-testid*="trend" i]',
                '[class*="trend" i]',
                '[class*="keyword" i]',
                '[class*="card" i]',
            ],
            [
                'main li',
                'main h1',
                'main h2',
                'main h3',
                'main h4',
            ],
        ];
        selectorGroups.forEach((selectors) => {
            if (result.length >= limit)
                return;
            document.querySelectorAll(selectors.join(',')).forEach((element) => {
                if (result.length >= limit)
                    return;
                if (!isVisible(element) || isNavigationElement(element))
                    return;
                const text = element.innerText || element.textContent || '';
                addSplitText(text, element.tagName.toLowerCase());
                const ariaLabel = element.getAttribute('aria-label');
                if (ariaLabel)
                    addSplitText(ariaLabel, 'aria-label');
                const title = element.getAttribute('title');
                if (title)
                    addSplitText(title, 'title');
            });
        });
        return result.slice(0, limit);
    }
    function isUsableResearchUrl(value, allowEtsy = false) {
        if (!value)
            return false;
        try {
            const url = new URL(value);
            return /(^|\.)everbee\.io$/i.test(url.hostname) || (allowEtsy && /(^|\.)etsy\.com$/i.test(url.hostname));
        }
        catch (_a) {
            return false;
        }
    }
    function isUsableErankUrl(value) {
        if (!value)
            return false;
        try {
            const url = new URL(value);
            return /(^|\.)erank\.com$/i.test(url.hostname);
        }
        catch (_a) {
            return false;
        }
    }
    function isErankKeywordToolUrl(value) {
        if (!isUsableErankUrl(value))
            return false;
        try {
            const url = new URL(value);
            return /keyword[-_]?tool/i.test(url.pathname);
        }
        catch (_a) {
            return false;
        }
    }
    function isErankDailyLimitError(value) {
        return /ERANK_DAILY_LOOKUP_LIMIT_REACHED|1日あたりの検索上限|keyword lookup limit/i.test(String(value !== null && value !== void 0 ? value : ''));
    }
    function tabShowsErankPlan(tabId) {
        return new Promise((resolve) => {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError || !(tab === null || tab === void 0 ? void 0 : tab.url)) {
                    resolve(false);
                    return;
                }
                resolve(/\/(?:plans?|pricing|upgrade)(?:\/|$|\?)/i.test(tab.url));
            });
        });
    }
    function getMarketState() {
        return {
            active: marketActive,
            mode: marketMode,
            currentKeyword: marketCurrentKeyword,
            remaining: marketQueue.length,
            results: marketResults,
            error: marketError,
        };
    }
    function saveMarketState() {
        chrome.storage.local.set({ marketState: getMarketState() });
    }
    async function startCaptureProcess() {
        isProcessingImages = true;
        try {
            const url = new URL(currentApiUrl);
            url.searchParams.append('projectId', currentProjectId);
            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`API fetch failed: ${response.statusText}`);
            }
            const data = await response.json();
            if (!data.listings || data.listings.length === 0) {
                isProcessingImages = false;
                return;
            }
            imageQueue = data.listings;
            processNextImage();
        }
        catch (error) {
            isProcessingImages = false;
            throw error;
        }
    }
    function processNextImage() {
        if (imageQueue.length === 0) {
            isProcessingImages = false;
            return;
        }
        const item = imageQueue.shift();
        if (!item)
            return;
        chrome.tabs.create({ url: item.product_link, active: false }, (tab) => {
            var _a;
            const createError = (_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message;
            if (createError || !(tab === null || tab === void 0 ? void 0 : tab.id)) {
                scheduleNextImage();
                return;
            }
            activeImageTabId = tab.id;
            tabTimeoutId = setTimeout(() => closeCurrentImageTabAndContinue(), 15000);
        });
    }
    async function handleContentResponse(request) {
        if (tabTimeoutId) {
            clearTimeout(tabTimeoutId);
            tabTimeoutId = null;
        }
        if (request.action === 'IMAGE_FOUND') {
            try {
                await fetch(currentApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project_id: currentProjectId,
                        listing_id: request.listingId,
                        image_url: request.imageUrl,
                    }),
                });
            }
            catch (error) {
                console.error('[Etsy Image Capture] API error', error);
            }
        }
        closeCurrentImageTabAndContinue();
    }
    function closeCurrentImageTabAndContinue() {
        if (activeImageTabId) {
            chrome.tabs.remove(activeImageTabId, () => {
                var _a;
                const _message = (_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message;
                activeImageTabId = null;
                scheduleNextImage();
            });
        }
        else {
            scheduleNextImage();
        }
    }
    function scheduleNextImage() {
        const delayMs = Math.floor(Math.random() * 4000) + 3000;
        setTimeout(processNextImage, delayMs);
    }
    async function processNextMarketKeyword(runId = marketRunId) {
        marketTimerId = null;
        if (!marketActive || runId !== marketRunId)
            return;
        const keyword = marketQueue.shift();
        if (!keyword) {
            if (runId !== marketRunId)
                return;
            marketActive = false;
            marketCurrentKeyword = '';
            saveMarketState();
            focusMarketFinderTab();
            return;
        }
        marketCurrentKeyword = keyword;
        saveMarketState();
        try {
            let response;
            if (marketMode === 'erank') {
                const tabId = await ensureErankTab();
                response = await runKeywordInErankTab(tabId, keyword);
            }
            else {
                response = await withTimeout(runEverbeeKeyword(keyword), MARKET_KEYWORD_TIMEOUT_MS, `EverBee timed out for "${keyword}". Skipped this keyword.`);
            }
            if (!marketActive || runId !== marketRunId)
                return;
            if (response.ok && response.result) {
                const result = sanitizeMarketResult(response.result);
                if (marketMode === 'erank' && !result.erankAttemptedAt) {
                    result.erankAttemptedAt = result.erankCheckedAt || new Date().toISOString();
                }
                marketResults.push(result);
            }
            else {
                const message = response.error || `${marketMode === 'erank' ? 'eRank' : 'EverBee'}調査に失敗しました。`;
                if (marketMode === 'erank' && isErankDailyLimitError(message)) {
                    marketError = ERANK_DAILY_LOOKUP_LIMIT_ERROR;
                    marketActive = false;
                    marketCurrentKeyword = '';
                    marketQueue.unshift(keyword);
                    saveMarketState();
                    focusMarketFinderTab();
                    return;
                }
                marketResults.push(buildFailedMarketResult(keyword, message));
            }
        }
        catch (error) {
            if (!marketActive || runId !== marketRunId)
                return;
            const message = error instanceof Error ? error.message : 'Unexpected Market Finder extension error.';
            if (marketMode === 'erank' && isErankDailyLimitError(message)) {
                marketError = ERANK_DAILY_LOOKUP_LIMIT_ERROR;
                marketActive = false;
                marketCurrentKeyword = '';
                marketQueue.unshift(keyword);
                saveMarketState();
                focusMarketFinderTab();
                return;
            }
            marketError = message;
            marketResults.push(buildFailedMarketResult(keyword, message));
        }
        saveMarketState();
        if (!marketActive || runId !== marketRunId)
            return;
        marketTimerId = setTimeout(() => processNextMarketKeyword(runId), marketDelayMs);
    }
    async function runEverbeeKeyword(keyword) {
        const tabId = await ensureEverbeeTab();
        await navigateEverbeeProductAnalytics(tabId, keyword);
        return runKeywordInEverbeeTab(tabId, keyword);
    }
    function buildFailedMarketResult(keyword, error) {
        const attemptedAt = new Date().toISOString();
        return {
            keyword,
            listingsAnalyzed: '',
            topMonthlySales: '',
            topRevenue: '',
            averagePrice: '',
            listingAge: '',
            visibleListingCount: '',
            sellingListingCount: '',
            recentSellingListingCount: '',
            medianMonthlySales: '',
            medianMonthlyRevenue: '',
            totalVisibleMonthlySales: '',
            topSalesShare: '',
            medianListingAgeMonths: '',
            everbeeCheckedAt: '',
            productRows: [],
            erankSearchVolume: '',
            erankClicks: '',
            erankCtr: '',
            erankCompetition: '',
            erankKeywordDifficulty: '',
            erankTrend: '',
            erankCheckedAt: '',
            erankAttemptedAt: marketMode === 'erank' ? attemptedAt : '',
            erankCaptureStatus: marketMode === 'erank' ? 'failed' : undefined,
            notes: error,
            error,
        };
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
    function ensureEverbeeTab() {
        return new Promise((resolve, reject) => {
            if (marketTabId !== null) {
                chrome.tabs.get(marketTabId, (tab) => {
                    if (!chrome.runtime.lastError && (tab === null || tab === void 0 ? void 0 : tab.id)) {
                        resolve(tab.id);
                        return;
                    }
                    marketTabId = null;
                    createEverbeeTab(resolve, reject);
                });
                return;
            }
            findOpenResearchTab()
                .then((tabId) => {
                if (tabId !== null) {
                    marketTabId = tabId;
                    resolve(tabId);
                    return;
                }
                createEverbeeTab(resolve, reject);
            })
                .catch(() => createEverbeeTab(resolve, reject));
        });
    }
    function navigateEverbeeProductAnalytics(tabId, keyword) {
        return new Promise((resolve, reject) => {
            const url = `https://app.everbee.io/product-analytics?search_term=${encodeURIComponent(keyword)}`;
            updateTabUrlAndActivate(tabId, url)
                .then(() => waitForTabComplete(tabId))
                .then(() => setTimeout(resolve, 3500))
                .catch(reject);
        });
    }
    function updateTabUrlAndActivate(tabId, url, attempt = 0) {
        return new Promise((resolve, reject) => {
            chrome.tabs.update(tabId, { url, active: true }, (tab) => {
                var _a;
                const updateError = (_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message;
                if (updateError) {
                    if (shouldRetryTabEditError(updateError) && attempt < 2) {
                        setTimeout(() => {
                            updateTabUrlAndActivate(tabId, url, attempt + 1).then(resolve).catch(reject);
                        }, 800);
                        return;
                    }
                    reject(new Error(updateError || 'EverBee Product Analyticsを開けませんでした。'));
                    return;
                }
                if (!(tab === null || tab === void 0 ? void 0 : tab.id)) {
                    reject(new Error('EverBee Product Analyticsを開けませんでした。'));
                    return;
                }
                if (tab.windowId !== undefined)
                    focusWindowQuietly(tab.windowId);
                resolve(tab);
            });
        });
    }
    function findOpenResearchTab() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
                const activeTab = activeTabs[0];
                if ((activeTab === null || activeTab === void 0 ? void 0 : activeTab.id) && isUsableResearchUrl(activeTab.url, true)) {
                    resolve(activeTab.id);
                    return;
                }
                chrome.tabs.query({}, (tabs) => {
                    var _a;
                    const tab = tabs.find((item) => item.id && isUsableResearchUrl(item.url));
                    resolve((_a = tab === null || tab === void 0 ? void 0 : tab.id) !== null && _a !== void 0 ? _a : null);
                });
            });
        });
    }
    function createEverbeeTab(resolve, reject) {
        chrome.tabs.create({ url: marketEverbeeUrl, active: true }, async (tab) => {
            var _a;
            const createError = (_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message;
            if (createError || !(tab === null || tab === void 0 ? void 0 : tab.id)) {
                reject(new Error(createError || 'EverBeeタブを開けませんでした。'));
                return;
            }
            marketTabId = tab.id;
            try {
                await activateTab(tab.id);
                await waitForTabComplete(tab.id);
                resolve(tab.id);
            }
            catch (error) {
                reject(error instanceof Error ? error : new Error('EverBeeタブの読み込みに失敗しました。'));
            }
        });
    }
    function ensureErankTab() {
        return new Promise((resolve, reject) => {
            if (erankTabId !== null) {
                chrome.tabs.get(erankTabId, (tab) => {
                    if (!chrome.runtime.lastError && (tab === null || tab === void 0 ? void 0 : tab.id)) {
                        prepareErankTab(tab.id).then(resolve).catch(reject);
                        return;
                    }
                    erankTabId = null;
                    createErankTab(resolve, reject);
                });
                return;
            }
            findOpenErankTab()
                .then((tabId) => {
                if (tabId !== null) {
                    erankTabId = tabId;
                    prepareErankTab(tabId).then(resolve).catch(reject);
                    return;
                }
                createErankTab(resolve, reject);
            })
                .catch(() => createErankTab(resolve, reject));
        });
    }
    async function prepareErankTab(tabId) {
        const tab = await new Promise((resolve) => {
            chrome.tabs.get(tabId, (currentTab) => {
                if (chrome.runtime.lastError || !(currentTab === null || currentTab === void 0 ? void 0 : currentTab.id)) {
                    resolve(null);
                    return;
                }
                resolve(currentTab);
            });
        });
        if (!(tab === null || tab === void 0 ? void 0 : tab.id))
            throw new Error('eRankタブを確認できませんでした。');
        if (isErankKeywordToolUrl(tab.url)) {
            await activateTab(tab.id);
            return tab.id;
        }
        await updateTabUrlAndActivate(tabId, marketErankUrl);
        await waitForTabComplete(tabId);
        return tabId;
    }
    function findOpenErankTab() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
                const activeTab = activeTabs[0];
                if ((activeTab === null || activeTab === void 0 ? void 0 : activeTab.id) && isErankKeywordToolUrl(activeTab.url)) {
                    resolve(activeTab.id);
                    return;
                }
                chrome.tabs.query({}, (tabs) => {
                    var _a;
                    const keywordToolTab = tabs.find((item) => item.id && isErankKeywordToolUrl(item.url));
                    if (keywordToolTab === null || keywordToolTab === void 0 ? void 0 : keywordToolTab.id) {
                        resolve(keywordToolTab.id);
                        return;
                    }
                    if ((activeTab === null || activeTab === void 0 ? void 0 : activeTab.id) && isUsableErankUrl(activeTab.url)) {
                        resolve(activeTab.id);
                        return;
                    }
                    const anyErankTab = tabs.find((item) => item.id && isUsableErankUrl(item.url));
                    resolve((_a = anyErankTab === null || anyErankTab === void 0 ? void 0 : anyErankTab.id) !== null && _a !== void 0 ? _a : null);
                });
            });
        });
    }
    function createErankTab(resolve, reject) {
        chrome.tabs.create({ url: marketErankUrl, active: true }, async (tab) => {
            var _a;
            const createError = (_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message;
            if (createError || !(tab === null || tab === void 0 ? void 0 : tab.id)) {
                reject(new Error(createError || 'eRankタブを開けませんでした。'));
                return;
            }
            erankTabId = tab.id;
            try {
                await activateTab(tab.id);
                await waitForTabComplete(tab.id);
                resolve(tab.id);
            }
            catch (error) {
                reject(error instanceof Error ? error : new Error('eRankタブの読み込みに失敗しました。'));
            }
        });
    }
    function waitForTabComplete(tabId) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                reject(new Error('ページの読み込みがタイムアウトしました。'));
            }, 30000);
            const listener = (updatedTabId, changeInfo) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    clearTimeout(timeoutId);
                    chrome.tabs.onUpdated.removeListener(listener);
                    setTimeout(() => resolve(), 500);
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
            chrome.tabs.get(tabId, (tab) => {
                if ((tab === null || tab === void 0 ? void 0 : tab.status) === 'complete') {
                    clearTimeout(timeoutId);
                    chrome.tabs.onUpdated.removeListener(listener);
                    setTimeout(() => resolve(), 1500);
                }
            });
        });
    }
    async function runKeywordInEverbeeTab(tabId, keyword) {
        var _a;
        await activateTab(tabId);
        const firstTry = await sendEverbeeMessage(tabId, keyword);
        if (firstTry.ok || !((_a = firstTry.error) === null || _a === void 0 ? void 0 : _a.includes('Receiving end does not exist')))
            return firstTry;
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['dist/everbeeContent.js'],
        });
        await activateTab(tabId);
        return sendEverbeeMessage(tabId, keyword);
    }
    async function runKeywordInErankTab(tabId, keyword) {
        var _a;
        const timeoutMessage = `eRank timed out for "${keyword}". Skipped this keyword.`;
        const firstTry = await withTimeout(sendErankMessage(tabId, keyword), MARKET_KEYWORD_TIMEOUT_MS, timeoutMessage);
        if (!firstTry.ok && await tabShowsErankPlan(tabId)) {
            return { ok: false, error: ERANK_DAILY_LOOKUP_LIMIT_ERROR };
        }
        if (firstTry.ok || !((_a = firstTry.error) === null || _a === void 0 ? void 0 : _a.includes('Receiving end does not exist')))
            return firstTry;
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['dist/erankContent.js'],
        });
        await activateTab(tabId);
        const secondTry = await withTimeout(sendErankMessage(tabId, keyword), MARKET_KEYWORD_TIMEOUT_MS, timeoutMessage);
        if (!secondTry.ok && await tabShowsErankPlan(tabId)) {
            return { ok: false, error: ERANK_DAILY_LOOKUP_LIMIT_ERROR };
        }
        return secondTry;
    }
    function sendEverbeeMessage(tabId, keyword) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: 'EVERBEE_RUN_KEYWORD', keyword }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                    return;
                }
                resolve(response);
            });
        });
    }
    function sendErankMessage(tabId, keyword) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: 'ERANK_RUN_KEYWORD', keyword }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                    return;
                }
                resolve(response);
            });
        });
    }
})();
