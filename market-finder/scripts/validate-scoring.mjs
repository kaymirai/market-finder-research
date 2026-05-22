#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  explainEverbeeScore,
  parseEverbeeRows,
  rankResearchRows,
} from '../../shared/market-keyword-engine/index.js'

const inputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve('market-finder/validation/scoring-regression-cases.csv')

const text = readFileSync(inputPath, 'utf8')
const rows = parseEverbeeRows(text)
const ranked = rankResearchRows(rows, { categoryId: 'shirt', eventId: '' })

const counts = ranked.reduce((acc, row) => {
  const grade = row.score.label.slice(0, 1)
  acc[grade] = (acc[grade] ?? 0) + 1
  return acc
}, {})

const riskyPromotions = ranked.filter((row) => (
  /^[AB]/.test(row.score.label)
  && (
    (row.score.label.startsWith('A') && (row.score.normalized.listingsAnalyzed ?? 0) > 5000)
    || (row.score.label.startsWith('B') && (row.score.normalized.listingsAnalyzed ?? 0) >= 10000)
    || row.score.riskTerms.length > 0
    || (row.score.normalized.salesDensity !== null && row.score.normalized.salesDensity < 3)
  )
))

const crowdedAsA = ranked.filter((row) => (
  row.score.label.startsWith('A')
  && (row.score.normalized.listingsAnalyzed ?? 0) > 5000
))

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
    `sales/1000=${normalized.salesDensity === null ? '-' : normalized.salesDensity.toFixed(2)}`,
    evidence.summary,
  ].join(' | '))
})

if (ranked.length < 20) {
  lines.push('')
  lines.push(`WARN: 初版ローンチ検証は20〜50件推奨です。現在は${ranked.length}件です。`)
}

if (riskyPromotions.length > 0 || crowdedAsA.length > 0) {
  lines.push('')
  lines.push('FAIL: 判定が甘い可能性があります。')
  riskyPromotions.slice(0, 10).forEach((row) => {
    lines.push(`- ${row.keyword}: ${row.score.label} / listings=${row.score.normalized.listingsAnalyzed ?? '-'} / salesDensity=${row.score.normalized.salesDensity?.toFixed?.(2) ?? '-'}`)
  })
  process.exitCode = 1
} else {
  lines.push('')
  lines.push('PASS: A/Bに危険な高競合・IP・低販売密度の昇格はありません。')
}

console.log(lines.join('\n'))
