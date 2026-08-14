"use strict";
function directUnknownDemandKeys(statisticsText = '') {
    const text = String(statisticsText).replace(/\s+/g, ' ').trim();
    const patterns = [
        ['erankSearchVolume', /(?:avg\.?|average)\s*searches?\s*(?:unknown|n\/a|no data|-)\b/i],
        ['erankClicks', /(?:avg\.?|average)\s*clicks?\s*(?:unknown|n\/a|no data|-)\b/i],
        ['erankCtr', /(?:avg\.?\s*)?ctr\s*(?:unknown|n\/a|no data|-)\b/i],
    ];
    return new Set(patterns.filter(([, pattern]) => pattern.test(text)).map(([key]) => key));
}
const metricPolicy = {
    mergeErankMetrics(input = {}) {
        var _a, _b, _c;
        const statisticsMetrics = (_a = input.statisticsMetrics) !== null && _a !== void 0 ? _a : {};
        const visualMetrics = (_b = input.visualMetrics) !== null && _b !== void 0 ? _b : {};
        const tableMetrics = (_c = input.tableMetrics) !== null && _c !== void 0 ? _c : {};
        const directUnknown = directUnknownDemandKeys(input.statisticsText);
        const demandValue = (key) => {
            if (directUnknown.has(key))
                return '';
            return statisticsMetrics[key] || visualMetrics[key] || tableMetrics[key] || '';
        };
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
        };
    },
};
globalThis.EtsyMiraiErankMetricPolicy = metricPolicy;
