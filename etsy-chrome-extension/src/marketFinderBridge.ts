(() => {
    type PageRequest = {
        source?: string
        action?: string
        requestId?: string
        query?: string
        contextQuery?: string
        keywords?: string[]
        sources?: string[]
        everbeeUrl?: string
        erankUrl?: string
        limit?: number
        delayMs?: number
    }

    const PAGE_SOURCE = 'market-finder-page'
    const EXTENSION_SOURCE = 'market-finder-extension'

    function postToPage(payload: Record<string, unknown>) {
        window.postMessage({ source: EXTENSION_SOURCE, ...payload }, window.location.origin)
    }

    function sendRuntimeMessage(action: string, payload: Record<string, unknown> = {}) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action, ...payload }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message))
                    return
                }
                resolve(response)
            })
        })
    }

    async function announceBridge() {
        try {
            const response = await sendRuntimeMessage('PING_MARKET_FINDER') as {
                ok?: boolean
                version?: string
            }
            if (response?.ok === false) throw new Error('Chrome extension background is unavailable.')
            postToPage({
                action: 'BRIDGE_READY',
                version: response?.version ?? '',
            })
        } catch (error) {
            postToPage({
                action: 'BRIDGE_UNAVAILABLE',
                error: error instanceof Error ? error.message : 'Chrome extension background is unavailable.',
            })
        }
    }

    async function handlePageRequest(request: PageRequest) {
        if (request.action === 'PING') {
            await announceBridge()
            return
        }

        if (!request.requestId || !request.action) return

        try {
            if (request.action === 'GET_MARKET_STATE') {
                const state = await sendRuntimeMessage('GET_MARKET_STATE')
                postToPage({ action: 'MARKET_STATE', requestId: request.requestId, ok: true, state })
                return
            }

            if (request.action === 'CLEAR_MARKET_RESULTS') {
                const state = await sendRuntimeMessage('CLEAR_MARKET_RESULTS')
                postToPage({ action: 'MARKET_STATE', requestId: request.requestId, ok: true, state })
                return
            }

            if (request.action === 'STOP_MARKET_RESEARCH') {
                const response = await sendRuntimeMessage('STOP_MARKET_RESEARCH')
                const state = await sendRuntimeMessage('GET_MARKET_STATE')
                postToPage({ action: 'MARKET_STATE', requestId: request.requestId, ok: true, response, state })
                return
            }

            if (request.action === 'START_MARKET_RESEARCH') {
                const response = await sendRuntimeMessage('START_MARKET_RESEARCH', {
                    keywords: request.keywords ?? [],
                    everbeeUrl: request.everbeeUrl,
                    delayMs: request.delayMs,
                })
                const state = await sendRuntimeMessage('GET_MARKET_STATE')
                postToPage({ action: 'MARKET_STATE', requestId: request.requestId, ok: true, response, state })
                return
            }

            if (request.action === 'START_ERANK_RESEARCH') {
                const response = await sendRuntimeMessage('START_ERANK_RESEARCH', {
                    keywords: request.keywords ?? [],
                    erankUrl: request.erankUrl,
                    delayMs: request.delayMs,
                })
                const state = await sendRuntimeMessage('GET_MARKET_STATE')
                postToPage({ action: 'MARKET_STATE', requestId: request.requestId, ok: true, response, state })
                return
            }

            if (request.action === 'COLLECT_TRENDS') {
                const response = await sendRuntimeMessage('COLLECT_TRENDS', {
                    sources: request.sources ?? [],
                    limit: request.limit,
                    contextQuery: request.contextQuery ?? '',
                })
                postToPage({ action: 'TREND_RESULTS', requestId: request.requestId, ok: true, response })
                return
            }

            if (request.action === 'RUN_ETSY_MARKETPLACE_INSIGHT') {
                const response = await sendRuntimeMessage('RUN_ETSY_MARKETPLACE_INSIGHT', {
                    query: request.query ?? '',
                })
                postToPage({ action: 'ETSY_MARKETPLACE_OPENED', requestId: request.requestId, ok: true, response })
                return
            }

            if (request.action === 'RUN_AND_CAPTURE_ETSY_MARKETPLACE_INSIGHT') {
                const response = await sendRuntimeMessage('RUN_AND_CAPTURE_ETSY_MARKETPLACE_INSIGHT', {
                    query: request.query ?? '',
                })
                postToPage({ action: 'ETSY_MARKETPLACE_RESULT', requestId: request.requestId, ok: true, response })
                return
            }

            if (request.action === 'CAPTURE_ETSY_MARKETPLACE_INSIGHT') {
                const response = await sendRuntimeMessage('CAPTURE_ETSY_MARKETPLACE_INSIGHT', {
                    query: request.query ?? '',
                })
                postToPage({ action: 'ETSY_MARKETPLACE_RESULT', requestId: request.requestId, ok: true, response })
                return
            }

        } catch (error) {
            postToPage({
                action: 'MARKET_ERROR',
                requestId: request.requestId,
                ok: false,
                error: error instanceof Error ? error.message : 'Chrome extension bridge error.',
            })
        }
    }

    window.addEventListener('message', (event) => {
        if (event.source !== window) return
        const request = event.data as PageRequest
        if (!request || request.source !== PAGE_SOURCE) return
        handlePageRequest(request)
    })

    announceBridge()
})()
