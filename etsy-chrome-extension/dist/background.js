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
    let marketFinderTabId = null;
    let marketEverbeeUrl = 'https://app.everbee.io/';
    let marketErankUrl = 'https://erank.com/tools/keyword-tool';
    let marketCurrentKeyword = '';
    let marketError = '';
    let marketDelayMs = 4500;
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
            saveMarketState();
            processNextMarketKeyword();
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
            saveMarketState();
            processNextMarketKeyword();
            sendResponse({ started: true });
            return true;
        }
        if (request.action === 'STOP_MARKET_RESEARCH') {
            marketActive = false;
            marketQueue = [];
            marketCurrentKeyword = '';
            saveMarketState();
            sendResponse({ stopped: true });
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
    function focusMarketFinderTab() {
        if (marketFinderTabId === null)
            return;
        chrome.tabs.get(marketFinderTabId, (tab) => {
            if (chrome.runtime.lastError || !(tab === null || tab === void 0 ? void 0 : tab.id)) {
                marketFinderTabId = null;
                return;
            }
            if (tab.windowId !== undefined) {
                chrome.windows.update(tab.windowId, { focused: true });
            }
            chrome.tabs.update(tab.id, { active: true });
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
            if (/(^|\.)erank\.com$/i.test(url.hostname))
                return url.toString();
            return 'https://erank.com/tools/keyword-tool';
        }
        catch (_a) {
            return 'https://erank.com/tools/keyword-tool';
        }
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
            if (!(tab === null || tab === void 0 ? void 0 : tab.id)) {
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
    async function processNextMarketKeyword() {
        if (!marketActive)
            return;
        const keyword = marketQueue.shift();
        if (!keyword) {
            marketActive = false;
            marketCurrentKeyword = '';
            saveMarketState();
            focusMarketFinderTab();
            return;
        }
        marketCurrentKeyword = keyword;
        saveMarketState();
        try {
            const response = marketMode === 'erank'
                ? await runKeywordInErankTab(await ensureErankTab(), keyword)
                : await runEverbeeKeyword(keyword);
            if (response.ok && response.result) {
                marketResults.push(sanitizeMarketResult(response.result));
            }
            else {
                marketResults.push(buildFailedMarketResult(keyword, response.error || `${marketMode === 'erank' ? 'eRank' : 'EverBee'}調査に失敗しました。`));
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected Market Finder extension error.';
            marketError = message;
            marketResults.push(buildFailedMarketResult(keyword, message));
        }
        saveMarketState();
        setTimeout(processNextMarketKeyword, marketDelayMs);
    }
    async function runEverbeeKeyword(keyword) {
        const tabId = await ensureEverbeeTab();
        await navigateEverbeeProductAnalytics(tabId, keyword);
        return runKeywordInEverbeeTab(tabId, keyword);
    }
    function buildFailedMarketResult(keyword, error) {
        return {
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
            chrome.tabs.update(tabId, { url, active: false }, (tab) => {
                var _a;
                if (chrome.runtime.lastError || !(tab === null || tab === void 0 ? void 0 : tab.id)) {
                    reject(new Error(((_a = chrome.runtime.lastError) === null || _a === void 0 ? void 0 : _a.message) || 'EverBee Product Analyticsを開けませんでした。'));
                    return;
                }
                waitForTabComplete(tabId)
                    .then(() => setTimeout(resolve, 3500))
                    .catch(reject);
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
        chrome.tabs.create({ url: marketEverbeeUrl, active: false }, async (tab) => {
            if (!(tab === null || tab === void 0 ? void 0 : tab.id)) {
                reject(new Error('EverBeeタブを開けませんでした。'));
                return;
            }
            marketTabId = tab.id;
            try {
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
                        chrome.tabs.update(tab.id, { active: false }, () => resolve(tab.id));
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
                    chrome.tabs.update(tabId, { active: false }, () => resolve(tabId));
                    return;
                }
                createErankTab(resolve, reject);
            })
                .catch(() => createErankTab(resolve, reject));
        });
    }
    function findOpenErankTab() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
                const activeTab = activeTabs[0];
                if ((activeTab === null || activeTab === void 0 ? void 0 : activeTab.id) && isUsableErankUrl(activeTab.url)) {
                    resolve(activeTab.id);
                    return;
                }
                chrome.tabs.query({}, (tabs) => {
                    var _a;
                    const tab = tabs.find((item) => item.id && isUsableErankUrl(item.url));
                    resolve((_a = tab === null || tab === void 0 ? void 0 : tab.id) !== null && _a !== void 0 ? _a : null);
                });
            });
        });
    }
    function createErankTab(resolve, reject) {
        chrome.tabs.create({ url: marketErankUrl, active: false }, async (tab) => {
            if (!(tab === null || tab === void 0 ? void 0 : tab.id)) {
                reject(new Error('eRankタブを開けませんでした。'));
                return;
            }
            erankTabId = tab.id;
            try {
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
                reject(new Error('EverBeeタブの読み込みがタイムアウトしました。'));
            }, 30000);
            const listener = (updatedTabId, changeInfo) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    clearTimeout(timeoutId);
                    chrome.tabs.onUpdated.removeListener(listener);
                    setTimeout(() => resolve(), 1500);
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
        const firstTry = await sendEverbeeMessage(tabId, keyword);
        if (firstTry.ok || !((_a = firstTry.error) === null || _a === void 0 ? void 0 : _a.includes('Receiving end does not exist')))
            return firstTry;
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['dist/everbeeContent.js'],
        });
        return sendEverbeeMessage(tabId, keyword);
    }
    async function runKeywordInErankTab(tabId, keyword) {
        var _a;
        const firstTry = await sendErankMessage(tabId, keyword);
        if (firstTry.ok || !((_a = firstTry.error) === null || _a === void 0 ? void 0 : _a.includes('Receiving end does not exist')))
            return firstTry;
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['dist/erankContent.js'],
        });
        return sendErankMessage(tabId, keyword);
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
