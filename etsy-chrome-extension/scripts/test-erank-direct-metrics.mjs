#!/usr/bin/env node
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../src/erankContent.ts', import.meta.url), 'utf8')
const marketFinderSource = await readFile(new URL('../../market-finder/src/app.js', import.meta.url), 'utf8')

async function loadMetricPolicy() {
  const source = await readFile(new URL('../src/erankMetricPolicy.ts', import.meta.url), 'utf8')
  const javascript = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.None },
  }).outputText
  const sandbox = {}
  vm.runInNewContext(javascript, sandbox)
  return sandbox.EtsyMiraiErankMetricPolicy
}

test('does not replace direct Unknown demand with related-table metrics', async () => {
  const policy = await loadMetricPolicy()
  const result = policy.mergeErankMetrics({
    statisticsText: 'Keyword Statistics Avg. Searches Unknown Avg. Clicks Unknown CTR Unknown Competition 186',
    statisticsMetrics: { erankSearchVolume: '', erankClicks: '', erankCtr: '', erankCompetition: '186' },
    visualMetrics: { erankSearchVolume: '260', erankClicks: '260', erankCtr: '100', erankCompetition: '190', erankKeywordDifficulty: '32' },
    tableMetrics: { erankSearchVolume: '260', erankClicks: '260', erankCtr: '100', erankCompetition: '190', erankKeywordDifficulty: '32' },
  })

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    erankSearchVolume: '',
    erankClicks: '',
    erankCtr: '',
    erankCompetition: '186',
    erankKeywordDifficulty: '32',
  })
})

test('still uses the target table when no direct Keyword Statistics value exists', async () => {
  const policy = await loadMetricPolicy()
  const result = policy.mergeErankMetrics({
    statisticsText: '',
    statisticsMetrics: {},
    visualMetrics: { erankSearchVolume: '90', erankClicks: '40', erankCtr: '44', erankCompetition: '900' },
    tableMetrics: {},
  })

  assert.equal(result.erankSearchVolume, '90')
  assert.equal(result.erankClicks, '40')
})

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
