type EtsyMiraiErankMetricValues = Partial<Record<
    'erankSearchVolume' | 'erankClicks' | 'erankCtr' | 'erankCompetition' | 'erankKeywordDifficulty',
    string
>>

interface EtsyMiraiErankMetricPolicyApi {
    mergeErankMetrics(input: {
        statisticsText?: string
        statisticsMetrics?: EtsyMiraiErankMetricValues
        visualMetrics?: EtsyMiraiErankMetricValues
        tableMetrics?: EtsyMiraiErankMetricValues
    }): Required<EtsyMiraiErankMetricValues>
}

function directUnknownDemandKeys(statisticsText = '') {
    const text = String(statisticsText).replace(/\s+/g, ' ').trim()
    const patterns: Array<[keyof EtsyMiraiErankMetricValues, RegExp]> = [
        ['erankSearchVolume', /(?:avg\.?|average)\s*searches?\s*(?:unknown|n\/a|no data|-)\b/i],
        ['erankClicks', /(?:avg\.?|average)\s*clicks?\s*(?:unknown|n\/a|no data|-)\b/i],
        ['erankCtr', /(?:avg\.?\s*)?ctr\s*(?:unknown|n\/a|no data|-)\b/i],
    ]
    return new Set(patterns.filter(([, pattern]) => pattern.test(text)).map(([key]) => key))
}

const metricPolicy: EtsyMiraiErankMetricPolicyApi = {
    mergeErankMetrics(input = {}) {
        const statisticsMetrics = input.statisticsMetrics ?? {}
        const visualMetrics = input.visualMetrics ?? {}
        const tableMetrics = input.tableMetrics ?? {}
        const directUnknown = directUnknownDemandKeys(input.statisticsText)
        const demandValue = (key: 'erankSearchVolume' | 'erankClicks' | 'erankCtr') => {
            if (directUnknown.has(key)) return ''
            return statisticsMetrics[key] || visualMetrics[key] || tableMetrics[key] || ''
        }

        return {
            erankSearchVolume: demandValue('erankSearchVolume'),
            erankClicks: demandValue('erankClicks'),
            erankCtr: demandValue('erankCtr'),
            erankCompetition: statisticsMetrics.erankCompetition
                || visualMetrics.erankCompetition
                || tableMetrics.erankCompetition
                || '',
            erankKeywordDifficulty: visualMetrics.erankKeywordDifficulty
                || tableMetrics.erankKeywordDifficulty
                || '',
        }
    },
}

;(globalThis as typeof globalThis & {
    EtsyMiraiErankMetricPolicy?: EtsyMiraiErankMetricPolicyApi
}).EtsyMiraiErankMetricPolicy = metricPolicy
