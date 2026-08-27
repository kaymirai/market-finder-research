import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { gateMarketplaceInsightPlanForDispatch } from '../src/persistent-evidence-automation.js'

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

test('keeps cache-busted multi-angle module imports current', () => {
  assert.match(app, /from '\.\/multi-angle-candidates\.js\?v=20260815-1'/)
  assert.match(app, /from '\.\/multi-angle-exploration\.js\?v=20260827-1'/)
})

test('checks automatic deep dive after idle EverBee completion', () => {
  assert.match(app, /async function maybeAutoStartMultiAngleSearch/)
  assert.match(app, /shouldAutoStartMultiAngleExploration/)
  assert.match(app, /MARKET_STATE[\s\S]*maybeAutoStartMultiAngleSearch/)
})

test('revalidates pending EverBee rows and restored Marketplace plans immediately before dispatch', () => {
  assert.match(functionBody('verifyPendingEvidence'), /queryEligibility\?\.eligible !== false/)
  assert.match(functionBody('runMarketplaceInsightAutomation'), /gateMarketplaceInsightPlanForDispatch/)
})

test('rechecks newly released Marketplace follow-ups before the next dispatch iteration', () => {
  const state = {
    marketplaceInsightMode: 'plus',
    marketplaceInsightPlan: {
      eventId: 'halloween',
      categoryId: 'shirt',
      items: [],
    },
    marketplaceInsightMessage: '',
  }
  const releasedQueries = [
    'retro biology teacher halloween gift school shirt',
    'teacher shirt tee',
    'teacher halloween mug',
    'disney teacher shirt',
    'biology teacher halloween shirt',
  ]
  const releaseMarketplaceInsightBatch = new Function(
    'state',
    'advanceMarketplaceInsightResearch',
    'activeResearchOptions',
    'gateMarketplaceInsightPlanForDispatch',
    'elements',
    'renderAll',
    'persistMarketFinderState',
    `${functionBody('releaseMarketplaceInsightBatch')}; return releaseMarketplaceInsightBatch`,
  )(
    state,
    (plan) => ({
      reason: 'batch-added',
      addedCount: releasedQueries.length,
      plan: {
        ...plan,
        researchRound: 1,
        items: releasedQueries.map((query) => ({ query, stage: 'followup', status: 'planned' })),
      },
    }),
    () => ({ eventId: 'halloween', categoryId: 'shirt' }),
    gateMarketplaceInsightPlanForDispatch,
    { riskInput: { value: 'disney' } },
    () => {},
    () => {},
  )

  releaseMarketplaceInsightBatch()

  assert.deepEqual(
    state.marketplaceInsightPlan.items.map((item) => item.queryEligibility?.status),
    ['title-like', 'duplicate-product', 'category-mismatch', 'blocked-risk', 'eligible'],
  )
  assert.deepEqual(
    state.marketplaceInsightPlan.items.map((item) => item.status),
    ['skipped', 'skipped', 'skipped', 'skipped', 'planned'],
  )
  assert.ok(state.marketplaceInsightPlan.items.slice(0, 4).every((item) => item.terminalError === true))

  assert.match(
    functionBody('runMarketplaceInsightAutomation'),
    /if \(!item && marketplaceNextBatchState\(\)\.ready\) \{\s*releaseMarketplaceInsightBatch\(\)\s*continue\s*\}/,
  )
})

test('passes current explicit exclusion terms into multi-angle selection and queue recovery', () => {
  assert.match(functionBody('currentMultiAnglePools'), /excludedRiskTerms:\s*elements\.riskInput\.value/)
  assert.match(functionBody('nextAppMultiAngleBatch'), /excludedRiskTerms:\s*elements\.riskInput\.value/)
})
