#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  aggregateEverbeeListings,
  explainEverbeeScore,
  rankResearchRows,
} from '../../shared/market-keyword-engine/index.js'

const inputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve('market-finder/validation/halloween-shirt-evidence-2026-07-20.json')
const fixture = JSON.parse(readFileSync(inputPath, 'utf8'))
const capturedAt = fixture.capturedAt

const rows = fixture.candidates.map((candidate) => {
  const aggregate = Array.isArray(candidate.everbeeListings) && candidate.everbeeListings.length > 0
    ? aggregateEverbeeListings(candidate.everbeeListings)
    : {}
  return {
    ...candidate,
    ...aggregate,
    erankCheckedAt: candidate.erankSearchVolume !== undefined
      || candidate.erankClicks !== undefined
      || candidate.erankCompetition !== undefined
      ? capturedAt
      : '',
    etsyCheckedAt: capturedAt,
    everbeeCheckedAt: candidate.everbeeListings !== undefined
      || candidate.topMonthlySales !== undefined
      ? capturedAt
      : '',
    notes: `Halloween実測 / ${fixture.market}`,
  }
})

const ranked = rankResearchRows(rows, {
  categoryId: fixture.categoryId,
  eventId: 'halloween',
  now: capturedAt,
})
const failures = []

ranked.forEach((row) => {
  if (row.expectedOpportunity && row.score.opportunityLabel !== row.expectedOpportunity) {
    failures.push(`${row.keyword}: expected ${row.expectedOpportunity}, got ${row.score.opportunityLabel}`)
  }
  if (row.expectedConfidence && row.score.confidenceLabel !== row.expectedConfidence) {
    failures.push(`${row.keyword}: expected confidence ${row.expectedConfidence}, got ${row.score.confidenceLabel}`)
  }
  if (Number.isInteger(row.expectedRank)) {
    const actualRank = ranked.findIndex((candidate) => candidate.keyword === row.keyword) + 1
    if (actualRank !== row.expectedRank) {
      failures.push(`${row.keyword}: expected rank ${row.expectedRank}, got ${actualRank}`)
    }
  }
})

console.log(`File: ${inputPath}`)
console.log(`Captured: ${capturedAt}`)
console.log(`Candidates: ${ranked.length}`)
console.log('')
console.log('Market Finder ranking')
ranked.forEach((row, index) => {
  const normalized = row.score.normalized
  const evidence = explainEverbeeScore(row.score)
  console.log([
    `${index + 1}. ${normalized.keyword}`,
    row.score.label,
    `score=${row.score.score}`,
    `Etsy=${normalized.etsySearches30d ?? '-'} / ${normalized.etsyListings ?? '-'}`,
    `eRank=${normalized.erankSearchVolume ?? '-'} / ${normalized.erankCompetition ?? '-'}`,
    `selling=${normalized.sellingListingCount ?? '-'}`,
    `sourceConflict=${row.score.validation.demandSourceConflict ? 'yes' : 'no'}`,
    evidence.summary,
  ].join(' | '))
})

if (failures.length > 0) {
  console.log('')
  console.log('FAIL: Halloween実測の期待順位または判定と一致しません。')
  failures.forEach((failure) => console.log(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log('')
  console.log('PASS: Halloween実測から期待する推奨順位と判定を再現しました。')
}
