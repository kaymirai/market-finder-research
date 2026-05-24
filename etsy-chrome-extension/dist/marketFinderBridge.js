"use strict";
(() => {
    const PAGE_SOURCE = 'market-finder-page';
    const EXTENSION_SOURCE = 'market-finder-extension';
    function postToPage(payload) {
        window.postMessage(Object.assign({ source: EXTENSION_SOURCE }, payload), window.location.origin);
    }
    function sendRuntimeMessage(action, payload = {}) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(Object.assign({ action }, payload), (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(response);
            });
        });
    }
    async function handlePageRequest(request) {
        var _a, _b, _c;
        if (request.action === 'PING') {
            postToPage({ action: 'BRIDGE_READY' });
            return;
        }
        if (!request.requestId || !request.action)
            return;
        try {
            if (request.action === 'GET_MARKET_STATE') {
                const state = await sendRuntimeMessage('GET_MARKET_STATE');
                postToPage({ action: 'MARKET_STATE', requestId: request.requestId, ok: true, state });
                return;
            }
            if (request.action === 'CLEAR_MARKET_RESULTS') {
                const state = await sendRuntimeMessage('CLEAR_MARKET_RESULTS');
                postToPage({ action: 'MARKET_STATE', requestId: request.requestId, ok: true, state });
                return;
            }
            if (request.action === 'STOP_MARKET_RESEARCH') {
                const response = await sendRuntimeMessage('STOP_MARKET_RESEARCH');
                const state = await sendRuntimeMessage('GET_MARKET_STATE');
                postToPage({ action: 'MARKET_STATE', requestId: request.requestId, ok: true, response, state });
                return;
            }
            if (request.action === 'START_MARKET_RESEARCH') {
                const response = await sendRuntimeMessage('START_MARKET_RESEARCH', {
                    keywords: (_a = request.keywords) !== null && _a !== void 0 ? _a : [],
                    everbeeUrl: request.everbeeUrl,
                    delayMs: request.delayMs,
                });
                const state = await sendRuntimeMessage('GET_MARKET_STATE');
                postToPage({ action: 'MARKET_STATE', requestId: request.requestId, ok: true, response, state });
                return;
            }
            if (request.action === 'START_ERANK_RESEARCH') {
                const response = await sendRuntimeMessage('START_ERANK_RESEARCH', {
                    keywords: (_b = request.keywords) !== null && _b !== void 0 ? _b : [],
                    erankUrl: request.erankUrl,
                    delayMs: request.delayMs,
                });
                const state = await sendRuntimeMessage('GET_MARKET_STATE');
                postToPage({ action: 'MARKET_STATE', requestId: request.requestId, ok: true, response, state });
                return;
            }
            if (request.action === 'COLLECT_TRENDS') {
                const response = await sendRuntimeMessage('COLLECT_TRENDS', {
                    sources: (_c = request.sources) !== null && _c !== void 0 ? _c : [],
                    limit: request.limit,
                });
                postToPage({ action: 'TREND_RESULTS', requestId: request.requestId, ok: true, response });
                return;
            }
        }
        catch (error) {
            postToPage({
                action: 'MARKET_ERROR',
                requestId: request.requestId,
                ok: false,
                error: error instanceof Error ? error.message : 'Chrome extension bridge error.',
            });
        }
    }
    window.addEventListener('message', (event) => {
        if (event.source !== window)
            return;
        const request = event.data;
        if (!request || request.source !== PAGE_SOURCE)
            return;
        handlePageRequest(request);
    });
    postToPage({ action: 'BRIDGE_READY' });
})();
