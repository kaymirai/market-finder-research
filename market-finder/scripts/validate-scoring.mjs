#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  detectRiskTerms,
  detectUnsupportedSearchTerms,
  explainEverbeeScore,
  parseEverbeeRows,
  rankResearchRows,
  recommendProductRoute,
} from '../../shared/market-keyword-engine/index.js'

const inputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve('market-finder/validation/scoring-regression-cases.csv')

const text = readFileSync(inputPath, 'utf8')
const rows = parseEverbeeRows(text)
const ranked = rankResearchRows(rows, { categoryId: 'shirt', eventId: '', now: '2026-07-19T00:00:00Z' })

const counts = ranked.reduce((acc, row) => {
  const grade = row.score.label.slice(0, 1)
  acc[grade] = (acc[grade] ?? 0) + 1
  return acc
}, {})

const riskyPromotions = ranked.filter((row) => (
  /^[AB]/.test(row.score.label)
  && (
    row.score.riskTerms.length > 0
    || (row.score.opportunityLabel === 'A' && row.score.gateReasons.length > 0)
    || (row.score.opportunityLabel === 'A' && row.score.confidenceLabel !== 'High')
  )
))

const regressionFailures = []

function assertRegression(condition, message) {
  if (!condition) regressionFailures.push(message)
}

assertRegression(
  detectRiskTerms('hobbits shirt').length > 0,
  'hobbits shirt should be caught as a Tolkien/Hobbit risk variant.'
)

assertRegression(
  detectUnsupportedSearchTerms('chelsea boots sticker').length === 0,
  'chelsea boots sticker should not be rejected as a sports/team query.'
)

assertRegression(
  detectUnsupportedSearchTerms('cruz azul vs pumas unam shirt').length > 0,
  'cruz azul vs pumas unam shirt should be rejected as a matchup/team query.'
)

const blockedRoute = recommendProductRoute({
  keyword: 'lord of the rings shirt',
  listingsAnalyzed: 5752,
  topMonthlySales: 115,
  topRevenue: 3395,
  averagePrice: 29.99,
  listingAge: '2 mo',
}, null, { categoryId: 'shirt' })

assertRegression(
  blockedRoute.decision === 'Do not use' && !blockedRoute.primary,
  'risk-blocked product routes should not recommend a product category.'
)

ranked.filter((row) => row.expectedOpportunity).forEach((row) => {
  assertRegression(
    row.score.opportunityLabel === row.expectedOpportunity,
    `${row.keyword}: expected Opportunity ${row.expectedOpportunity}, got ${row.score.opportunityLabel}.`
  )
})

ranked.filter((row) => row.expectedConfidence).forEach((row) => {
  assertRegression(
    row.score.confidenceLabel === row.expectedConfidence,
    `${row.keyword}: expected Confidence ${row.expectedConfidence}, got ${row.score.confidenceLabel}.`
  )
})

const lines = []
lines.push(`File: ${inputPath}`)
lines.push(`Rows: ${ranked.length}`)
lines.push(`Grades: A=${counts.A ?? 0} B=${counts.B ?? 0} C=${counts.C ?? 0} D=${counts.D ?? 0}`)
lines.push('')
lines.push('Top rows')
ranked.slice(0, 20).forEach((row, index) => {
  const normalized = row.score.normalized
  const evidence = explainEverbeeScore(row.score)
  lines.push([
    `${index + 1}. ${normalized.keyword}`,
    row.score.label,
    `score=${row.score.score}`,
    `listings=${normalized.listingsAnalyzed ?? '-'}`,
    `sales=${normalized.topMonthlySales ?? '-'}`,
    `selling=${normalized.sellingListingCount ?? '-'}`,
    `topShare=${normalized.topSalesShare === null ? '-' : normalized.topSalesShare.toFixed(2)}`,
    `confidence=${row.score.confidenceLabel}`,
    evidence.summary,
  ].join(' | '))
})

if (ranked.length < 20) {
  lines.push('')
  lines.push(`WARN: 初版ローンチ検証は20〜50件推奨です。現在は${ranked.length}件です。`)
}

if (riskyPromotions.length > 0 || regressionFailures.length > 0) {
  lines.push('')
  lines.push('FAIL: 判定が甘い可能性があります。')
  riskyPromotions.slice(0, 10).forEach((row) => {
    lines.push(`- ${row.keyword}: ${row.score.label} / confidence=${row.score.confidenceLabel} / gates=${row.score.gateReasons.join(',') || '-'}`)
  })
  regressionFailures.forEach((failure) => {
    lines.push(`- ${failure}`)
  })
  process.exitCode = 1
} else {
  lines.push('')
  lines.push('PASS: Opportunity/Confidenceの回帰条件に不一致はありません。')
}

console.log(lines.join('\n'))
