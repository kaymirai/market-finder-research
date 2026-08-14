import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8')

function functionBody(name) {
  const start = app.indexOf(`function ${name}(`)
  const end = app.indexOf('\nfunction ', start + 1)
  assert.notEqual(start, -1, `${name} must exist`)
  return app.slice(start, end === -1 ? app.length : end)
}

test('derives short queries before Trend Scout entries become candidates', () => {
  assert.match(functionBody('trendCandidateEntries'), /deriveBuyerSearchQueriesFromTitle/)
})

test('rechecks both candidate creation and Etsy handoff with the shared gate', () => {
  assert.match(functionBody('candidateFromKeyword'), /classifyMarketplaceBuyerQuery/)
  assert.match(functionBody('etsyValidationCandidates'), /classifyMarketplaceBuyerQuery/)
})
