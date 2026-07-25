#!/usr/bin/env node
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/erankContent.ts', import.meta.url), 'utf8')
const marketFinderSource = await readFile(new URL('../../market-finder/src/app.js', import.meta.url), 'utf8')

test('prefers direct Keyword Statistics competition metrics', () => {
  assert.match(source, /const erankCompetition = statisticsMetrics\.erankCompetition\s*\|\|/)
})

test('counts the four direct eRank metrics when deriving capture status', () => {
  assert.match(source, /\[erankSearchVolume, erankClicks, erankCompetition, erankKeywordDifficulty\]/)
})

test('shows checked eRank no-data results as Unknown', () => {
  assert.match(marketFinderSource, /'no-data': 'Unknown'/)
})

test('recognizes the current eRank no-data result before waiting for metric columns', () => {
  assert.match(source, /could not find data for/i)
  assert.match(source, /if \(pageHasNoDataMessage\(\)\) return extractMetrics\(keyword\)/)
})

test('waits for Competition and treats KD as optional after a short grace period', () => {
  const readiness = source.match(/async function waitForKeywordIdeasMetricsReady[\s\S]*?(?=\n    function describeElement)/)?.[0] ?? ''
  const targetReady = readiness.match(/const targetReady = ([\s\S]*?)(?=\n\s*const competitionReady)/)?.[1] ?? ''

  assert.match(source, /ERANK_KD_GRACE_AFTER_COMPETITION_MS/)
  assert.match(readiness, /competitionReadyAt/)
  assert.match(readiness, /targetCompetitionResolved/)
  assert.match(readiness, /kdGraceElapsed/)
  assert.match(readiness, /const partialLoadResolved = snapshot\.targetFound/)
  assert.match(readiness, /\? !snapshot\.targetPartial/)
  assert.doesNotMatch(targetReady, /targetKdResolved/)
})

test('selects the visual keyword row that covers the Competition and KD columns', () => {
  const rowFinder = source.match(/function findVisualRowForKeyword[\s\S]*?(?=\n    function textLooksLikeKeywordCell)/)?.[0] ?? ''

  assert.match(source, /function visualColumnCoverageCount/)
  assert.match(rowFinder, /visualColumnCoverageCount/)
  assert.match(rowFinder, /coverage/)
})
