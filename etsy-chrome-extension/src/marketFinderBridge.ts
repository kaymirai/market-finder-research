(() => {
    type PageRequest = {
        source?: string
        action?: string
        requestId?: string
        keywords?: string[]
        sources?: string[]
        everbeeUrl?: string
        erankUrl?: string
        limit?: number
        delayMs?: number
        durationSec?: number
        intervalMs?: number
        maxKeywords?: number
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

    async function handlePageRequest(request: PageRequest) {
        if (request.action === 'PING') {
            postToPage({ action: 'BRIDGE_READY' })
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
                })
                postToPage({ action: 'TREND_RESULTS', requestId: request.requestId, ok: true, response })
                return
            }

            if (request.action === 'CAPTURE_YOUTUBE_OCR') {
                const response = await sendRuntimeMessage('CAPTURE_YOUTUBE_OCR', {
                    durationSec: request.durationSec,
                    intervalMs: request.intervalMs,
                    maxKeywords: request.maxKeywords,
                })
                postToPage({ action: 'YOUTUBE_OCR_RESULTS', requestId: request.requestId, ok: true, response })
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

    postToPage({ action: 'BRIDGE_READY' })
})()
