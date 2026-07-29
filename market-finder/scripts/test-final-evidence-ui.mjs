import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  createMultiAngleExplorationState,
  nextMultiAngleBatch,
  recordMultiAngleBatch,
} from '../src/multi-angle-exploration.js'
import * as multiAngleApi from '../src/multi-angle-exploration.js'
import * as candidateApi from '../src/multi-angle-candidates.js'
import {
  restorePendingEvidenceAutomation,
} from '../src/persistent-evidence-automation.js'

const [rawHtml, rawApp, rawCss] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
])
const html = rawHtml.replace(/\r\n/g, '\n')
const app = rawApp.replace(/\r\n/g, '\n')
const css = rawCss.replace(/\r\n/g, '\n')

test('provides a single final evidence matrix with filters and bulk verification', () => {
  assert.match(html, /id="finalEvidenceFilters"/)
  assert.match(html, /id="finalEvidenceScopeStatus"/)
  assert.match(html, /id="verifyPendingEvidenceBtn"/)
  assert.match(html, /id="finalEvidenceTable"/)
  assert.match(app, /function finalEvidenceRows\(/)
  assert.match(app, /function renderFinalEvidenceMatrix\(/)
  assert.match(app, /async function verifyPendingEvidence\(/)
})

test('keeps eRank as an optional advanced panel inside the final stage', () => {
  const finalStage = html.match(/data-research-panel="results"[\s\S]*?(?=<section class="seo-section)/)?.[0] ?? ''

  assert.match(finalStage, /<details[^>]*class="[^"]*erank-advanced-panel[^"]*"/)
  assert.match(finalStage, /<summary>eRankで追加確認<\/summary>/)
  assert.match(finalStage, /id="candidateErankBtn"/)
  assert.match(finalStage, /id="erankResultsList"/)
  assert.match(app, /elements\.candidateErankBtn\.addEventListener\('click', simpleStartErankResearch\)/)
  assert.match(app, /elements\.erankResultsList\.addEventListener\('click'/)
})

test('edits profit evidence for the selected final row without replacing its market score', () => {
  assert.match(html, /id="profitStrategyPanel"/)
  assert.match(html, /市場機会スコア/)
  assert.match(html, /商品化・利益スコア/)
  assert.match(app, /function renderProfitStrategyAssessment\(/)
  assert.match(app, /function deriveProfitStrategyInput\(/)
  assert.match(app, /state\.profitInputsByKeyword/)
  assert.match(app, /data-profit-input/)
  assert.match(app, /deriveProfitStrategyAssessment/)
  assert.match(app, /selectVisibleProfitRow/)
})

test('labels bulk verification as a selected shortlist instead of every generated idea', () => {
  assert.match(app, /buildFinalEvidenceKeywordPool/)
  assert.match(app, /analysis\.scoredRows\.filter\(hasCollectedEvidence\)/)
  assert.match(app, /selectedResearchRoundKeywords\(state\.researchRounds\.rounds/)
  assert.match(app, /選抜済みを自動検証/)
  assert.match(app, /候補アイデア[\s\S]*選抜外/)
  assert.doesNotMatch(app, /未検証をすべて自動検証/)
})

test('starts a fresh selected round when a new candidate search replaces the current plan', () => {
  assert.match(
    app,
    /if \(!preserveMarketplacePlan\) \{\s*state\.researchRounds = createResearchRoundsState\(\)\s*beginInitialResearchRound\(\)\s*\}/,
  )
})

test('continues fifty-row verification batches automatically until stopped or complete', () => {
  assert.match(app, /FINAL_EVIDENCE_BATCH_SIZE\s*=\s*50/)
  assert.match(app, /pendingEvidenceAutomation:\s*\{[\s\S]*?active:\s*false/)
  assert.match(app, /function schedulePendingEvidenceAutomation\(/)
  assert.match(app, /function stopPendingEvidenceAutomation\(/)
  assert.match(app, /candidateLimit:\s*batchLimit/)
  assert.match(app, /wasActive\s*&&\s*!data\.state\?\.active[\s\S]*schedulePendingEvidenceAutomation/)
  assert.match(app, /選抜済みを自動検証/)
  assert.match(app, /自動検証を停止/)
})

test('continues with the next evidence angle after a completed no-winner verification', () => {
  assert.match(app, /from '\.\/winning-niche-automation\.js\?v=/)
  assert.match(app, /winningNicheAutomation:\s*createWinningNicheAutomation\(\)/)
  assert.match(app, /multiAngleExploration:\s*createMultiAngleExplorationState\(\)/)
  assert.match(app, /function queueNextMultiAngleBatch\(/)
  assert.match(app, /function startMultiAngleSearch\(/)
  assert.match(app, /function pauseMultiAngleSearch\(/)
  assert.match(app, /function stopMultiAngleSearch\(/)
  assert.match(app, /function resumeMultiAngleSearch\(/)
  assert.match(app, /recordMultiAngleBatch\(/)
  assert.match(app, /return queueNextMultiAngleBatch\(\)/)
})

test('prefers a later normal candidate without completing its retained retry angle', () => {
  const nextAppBody = app.slice(
    app.indexOf('function nextAppMultiAngleBatch()'),
    app.indexOf('\nfunction ', app.indexOf('function nextAppMultiAngleBatch()') + 1),
  )
  const pools = {
    'demand-neighborhood': [{
      keyword: 'spooky nurse shirt',
      categoryId: 'shirt',
      eventId: 'halloween',
      angleId: 'demand-neighborhood',
    }],
    'recent-sales': [{
      keyword: 'ghost gardener shirt',
      categoryId: 'shirt',
      eventId: 'halloween',
      angleId: 'recent-sales',
    }],
  }
  const appState = {
    multiAngleExploration: createMultiAngleExplorationState({
      status: 'running',
      activeEventId: 'halloween',
      categoryId: 'shirt',
      currentAngleId: 'demand-neighborhood',
      angleIndex: 0,
      attemptedAngles: ['demand-neighborhood'],
      retryQueue: [{
        evidenceKey: 'spooky nurse shirt|shirt|halloween',
        candidate: pools['demand-neighborhood'][0],
        attempts: 1,
        retryAt: '1970-01-01T00:00:00.000Z',
      }],
    }),
  }
  const nextAppMultiAngleBatch = new Function(
    'state',
    'currentMultiAnglePools',
    'nextMultiAngleBatch',
    `${nextAppBody}; return nextAppMultiAngleBatch`,
  )(appState, () => pools, nextMultiAngleBatch)

  const normal = nextAppMultiAngleBatch()
  assert.deepEqual(normal.candidates.map((candidate) => candidate.keyword), [
    'ghost gardener shirt',
  ])
  assert.equal(normal.state.retryQueue.length, 1)
  assert.doesNotMatch(
    [...normal.state.completedAngles, ...normal.state.emptyAngles].join(','),
    /demand-neighborhood/,
  )

  appState.multiAngleExploration = recordMultiAngleBatch(normal.state, [{
    ...normal.candidates[0],
    evidenceState: { status: 'verified' },
    opportunityLabel: 'C',
  }])
  const retry = nextAppMultiAngleBatch()
  assert.equal(retry.reason, 'retry-ready')
  assert.deepEqual(retry.candidates.map((candidate) => candidate.keyword), [
    'spooky nurse shirt',
  ])
  assert.doesNotMatch(retry.state.completedAngles.join(','), /demand-neighborhood/)

  appState.multiAngleExploration = recordMultiAngleBatch(retry.state, [{
    ...retry.candidates[0],
    evidenceState: { status: 'verified' },
    opportunityLabel: 'C',
  }])
  const finished = nextAppMultiAngleBatch()
  assert.match(finished.state.completedAngles.join(','), /demand-neighborhood/)
})

test('keeps unresolved targets when a global batch failure pauses exploration', () => {
  const completeBody = app.match(/function completeMultiAngleBatch\(\) \{([\s\S]*?)\n\}\n\nfunction renderPendingEvidenceAutomationButton/)?.[1] ?? ''
  assert.match(completeBody, /const unresolvedTargetKeywords/)
  assert.match(completeBody, /if \(state\.multiAngleExploration\.status === 'paused'\)/)
  assert.match(completeBody, /targetKeywords = unresolvedTargetKeywords/)
  assert.ok(
    completeBody.indexOf("if (state.multiAngleExploration.status === 'paused')")
      < completeBody.indexOf('targetKeywords = []'),
  )
})

test('routes multi-angle batches through the existing evidence providers', () => {
  assert.match(app, /sanitizeLegacyMarketplaceInsightRow/)
  assert.match(app, /isEtsyEvidenceChecked/)
  assert.match(app, /selectEtsyConfirmationKeywords/)
  assert.match(app, /verificationStageForRow/)
  assert.match(app, /etsyMetricCaptureVersion:\s*2/)
  assert.match(
    app,
    /type:\s*'multi-angle'[\s\S]*status:\s*'pending-everbee'/,
  )
  assert.match(
    app,
    /state\.researchRows = Array\.isArray\(savedState\.researchRows\)[\s\S]*sanitizeLegacyMarketplaceInsightRow/,
  )
})

test('persists multi-angle progress and reconstructs legacy pending targets', () => {
  assert.match(app, /winningNicheAutomation:\s*state\.winningNicheAutomation/)
  assert.match(app, /multiAngleExploration:\s*state\.multiAngleExploration/)
  assert.match(
    app,
    /createWinningNicheAutomation\(\{[\s\S]*savedState\.winningNicheAutomation[\s\S]*targetWinnerCount:\s*restoredWinnerTarget/,
  )
  assert.match(app, /const legacyRestoreAutomation = restoringMultiAngleWork/)
  assert.match(app, /queuedKeywords:\s*state\.winningNicheAutomation\.queuedKeywords/)
  assert.match(app, /winningNicheAutomation:\s*legacyRestoreAutomation/)
})

test('reload waits through extension connection and explicit resume dispatches once', async () => {
  assert.equal(typeof multiAngleApi.pauseMultiAngleWorkAfterReload, 'function')
  const restored = multiAngleApi.pauseMultiAngleWorkAfterReload({
    exploration: createMultiAngleExplorationState({
      status: 'running',
      activeEventId: 'halloween',
      categoryId: 'shirt',
      currentBatchCandidates: [{
        keyword: 'spooky nurse shirt',
        eventId: 'halloween',
        categoryId: 'shirt',
      }],
    }),
    pendingEvidenceAutomation: {
      active: true,
      scheduled: true,
      initialCount: 1,
      completedBatches: 0,
      currentStage: 'pending-etsy',
      targetKeywords: ['spooky nurse shirt'],
    },
  })
  const appState = {
    multiAngleExploration: restored.exploration,
    pendingEvidenceAutomation: restored.pendingEvidenceAutomation,
    restoredAutomationPending: false,
    extensionConnected: true,
    timingOverrideConfirmed: true,
  }
  let dispatchCount = 0
  const resumePersistedBody = app.slice(
    app.indexOf('function resumePersistedEvidenceAutomationIfReady()'),
    app.indexOf('\nasync function ', app.indexOf('function resumePersistedEvidenceAutomationIfReady()') + 1),
  )
  const resumePersisted = new Function(
    'state',
    `${resumePersistedBody}; return resumePersistedEvidenceAutomationIfReady`,
  )(appState)

  assert.equal(resumePersisted(), false)
  assert.equal(dispatchCount, 0)

  const resumeBody = app.slice(
    app.indexOf('async function resumeMultiAngleSearch()'),
    app.indexOf('\nfunction ', app.indexOf('async function resumeMultiAngleSearch()') + 1),
  )
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const resume = await new AsyncFunction(
    'state',
    'activeResearchContext',
    'classifyProductionWindow',
    'confirmExtensionConnection',
    'resumeMultiAngleExploration',
    'setSimpleStatus',
    'renderAll',
    'persistMarketFinderState',
    'schedulePendingEvidenceAutomation',
    'queueNextMultiAngleBatch',
    `${resumeBody}; return resumeMultiAngleSearch`,
  )(
    appState,
    () => ({
      event: { id: 'halloween' },
      category: { id: 'shirt' },
    }),
    () => ({ status: 'timely' }),
    async () => true,
    multiAngleApi.resumeMultiAngleExploration,
    () => {},
    () => {},
    () => {},
    () => {
      dispatchCount += 1
    },
    () => {
      dispatchCount += 1
      return true
    },
  )

  assert.equal(await resume(), true)
  assert.equal(dispatchCount, 1)
})

test('reload ignores an old Marketplace plan before restoring and resumes the current context once', async () => {
  assert.equal(typeof candidateApi.marketplaceInsightPlanForContext, 'function')
  assert.equal(typeof multiAngleApi.restoredMultiAngleTargetKeywords, 'function')
  const exploration = createMultiAngleExplorationState({
    status: 'running',
    activeEventId: 'christmas',
    categoryId: 'shirt',
    eventSnapshot: {
      id: 'christmas',
      label: 'Christmas',
      searchTerm: 'christmas',
    },
    categorySnapshot: {
      id: 'shirt',
      label: 'Shirt',
      searchTerm: 'shirt',
    },
    currentBatchCandidates: [{
      keyword: 'christmas nurse shirt',
      eventId: 'christmas',
      categoryId: 'shirt',
    }],
  })
  const oldPlan = {
    eventId: 'halloween',
    categoryId: 'mug',
    items: [{
      query: 'halloween nurse mug',
      status: 'planned',
    }],
  }
  const compatiblePlan = {
    eventId: 'christmas',
    categoryId: 'shirt',
    items: [{
      query: 'christmas teacher shirt',
      status: 'planned',
    }],
  }
  const oldSavedPending = {
    active: false,
    scheduled: true,
    targetKeywords: ['halloween nurse mug'],
  }
  const queuedKeywords = multiAngleApi.restoredMultiAngleTargetKeywords(
    exploration,
    oldSavedPending.targetKeywords,
  )
  const gatedOldPlan = candidateApi.marketplaceInsightPlanForContext(
    oldPlan,
    exploration,
  )
  const restoredPending = restorePendingEvidenceAutomation({
    saved: oldSavedPending,
    winningNicheAutomation: {
      status: exploration.status,
      queuedKeywords,
    },
    marketplaceInsightPlan: gatedOldPlan,
  })
  const restored = multiAngleApi.pauseMultiAngleWorkAfterReload({
    exploration,
    pendingEvidenceAutomation: restoredPending,
  })

  assert.equal(gatedOldPlan, null)
  assert.equal(restored.exploration.status, 'paused')
  assert.equal(restored.exploration.pauseReason, 'reload-required')
  assert.deepEqual(
    restored.pendingEvidenceAutomation.targetKeywords,
    ['christmas nurse shirt'],
  )
  assert.equal(restored.pendingEvidenceAutomation.active, false)
  assert.equal(restored.pendingEvidenceAutomation.scheduled, false)

  const compatiblePending = restorePendingEvidenceAutomation({
    saved: { active: false, targetKeywords: [] },
    winningNicheAutomation: {
      status: exploration.status,
      queuedKeywords,
    },
    marketplaceInsightPlan: candidateApi.marketplaceInsightPlanForContext(
      compatiblePlan,
      exploration,
    ),
  })
  assert.deepEqual(compatiblePending.targetKeywords, ['christmas teacher shirt'])

  const restoreBody = app.match(/function restorePersistedState\(\) \{([\s\S]*?)\n\}\n\nfunction migrateLegacyResearchRounds/)?.[1] ?? ''
  assert.ok(
    restoreBody.indexOf('marketplaceInsightPlanForContext(')
      < restoreBody.indexOf('restorePendingEvidenceAutomation({'),
  )

  const appState = {
    multiAngleExploration: restored.exploration,
    pendingEvidenceAutomation: restored.pendingEvidenceAutomation,
    extensionConnected: true,
    timingOverrideConfirmed: true,
  }
  let dispatchCount = 0
  const resumeBody = app.slice(
    app.indexOf('async function resumeMultiAngleSearch()'),
    app.indexOf('\nfunction ', app.indexOf('async function resumeMultiAngleSearch()') + 1),
  )
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const resume = await new AsyncFunction(
    'state',
    'activeResearchContext',
    'classifyProductionWindow',
    'confirmExtensionConnection',
    'resumeMultiAngleExploration',
    'setSimpleStatus',
    'renderAll',
    'persistMarketFinderState',
    'schedulePendingEvidenceAutomation',
    'queueNextMultiAngleBatch',
    `${resumeBody}; return resumeMultiAngleSearch`,
  )(
    appState,
    () => ({
      event: { id: 'christmas' },
      category: { id: 'shirt' },
    }),
    () => ({ status: 'timely' }),
    async () => true,
    multiAngleApi.resumeMultiAngleExploration,
    () => {},
    () => {},
    () => {},
    () => {
      dispatchCount += 1
    },
    () => {
      dispatchCount += 1
      return true
    },
  )

  assert.equal(await resume(), true)
  assert.equal(dispatchCount, 1)
})

test('ordinary Marketplace reload keeps compatible and legacy plans outside multi-angle pausing', () => {
  assert.equal(typeof multiAngleApi.restoreMarketplaceInsightPlanForResearchFlow, 'function')
  const exploration = createMultiAngleExplorationState({ status: 'idle' })
  const ordinaryContext = {
    eventId: 'halloween',
    categoryId: 'shirt',
    eventSnapshot: {
      id: 'halloween',
      label: 'Halloween',
      searchTerm: 'halloween',
    },
  }
  const matchingPlan = {
    eventId: 'halloween',
    categoryId: 'shirt',
    items: [{
      query: 'halloween nurse shirt',
      status: 'planned',
    }],
  }
  const legacyPlan = {
    items: [{
      query: 'legacy halloween shirt',
      status: 'planned',
    }],
  }
  const restorePlan = (plan) => (
    multiAngleApi.restoreMarketplaceInsightPlanForResearchFlow(plan, {
      exploration,
      ordinaryContext,
    })
  )
  const pendingFor = (plan) => restorePendingEvidenceAutomation({
    saved: {
      active: false,
      scheduled: false,
      targetKeywords: [],
    },
    winningNicheAutomation: {
      status: 'running',
      queuedKeywords: [],
    },
    marketplaceInsightPlan: restorePlan(plan),
  })

  assert.deepEqual(
    pendingFor(matchingPlan).targetKeywords,
    ['halloween nurse shirt'],
  )
  assert.deepEqual(
    pendingFor(legacyPlan).targetKeywords,
    ['legacy halloween shirt'],
  )
  assert.equal(exploration.status, 'idle')

  const restoreBody = app.match(/function restorePersistedState\(\) \{([\s\S]*?)\n\}\n\nfunction migrateLegacyResearchRounds/)?.[1] ?? ''
  assert.match(restoreBody, /const restoringMultiAngleWork = hasMeaningfulMultiAngleContext\(/)
  assert.match(
    restoreBody,
    /if \(restoringMultiAngleWork\) \{[\s\S]*pauseMultiAngleWorkAfterReload\(/,
  )
  assert.match(
    restoreBody,
    /else \{[\s\S]*shouldAutoResumeEvidenceAutomation\(/,
  )
})

test('explicit normal candidate discovery persists terminal work before resetting its fixed context', () => {
  const preserveBody = app.match(/async function preserveTerminalMultiAngleEvidenceForNewDiscovery\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const prepareBody = app.match(/async function prepareForNewCandidateDiscovery\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const autoBody = app.match(/async function collectTrendScoutTerms\(\) \{([\s\S]*?)\n\}\n\nfunction/)?.[1] ?? ''
  const applyBody = app.match(/async function applyTrendScoutTerms\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(preserveBody, /persistTerminalMultiAngleEvidenceBeforeReset\(/)
  assert.match(preserveBody, /saveEvidenceArchive\(\{[\s\S]*record/)
  assert.match(prepareBody, /await preserveTerminalMultiAngleEvidenceForNewDiscovery\(\)/)
  assert.match(prepareBody, /if \(!terminalEvidencePersisted\) return false/)
  assert.match(prepareBody, /prepareNewMultiAngleCycle\(/)
  assert.ok(
    prepareBody.indexOf('await preserveTerminalMultiAngleEvidenceForNewDiscovery()')
      < prepareBody.indexOf('clearResearchResults'),
  )
  assert.ok(
    prepareBody.indexOf('if (!terminalEvidencePersisted) return false')
      < prepareBody.indexOf('prepareNewMultiAngleCycle('),
  )
  assert.ok(
    autoBody.indexOf('await prepareForNewCandidateDiscovery()')
      < autoBody.indexOf('generateCandidates()'),
  )
  assert.match(applyBody, /await prepareForNewCandidateDiscovery\(\)/)
})

test('new-cycle button persists terminal evidence before resetting or starting work', () => {
  const newCycleBody = app.match(/async function startNewMultiAngleCycle\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const clickBody = app.match(/elements\.winningNicheAutomationToggle\?\.addEventListener\('click', async \(event\) => \{([\s\S]*?)\n  \}\)/)?.[1] ?? ''

  assert.match(newCycleBody, /await preserveTerminalMultiAngleEvidenceForNewDiscovery\(\)/)
  assert.match(newCycleBody, /if \(!terminalEvidencePersisted\) return false/)
  assert.ok(
    newCycleBody.indexOf('await preserveTerminalMultiAngleEvidenceForNewDiscovery()')
      < newCycleBody.indexOf('prepareNewMultiAngleCycle('),
  )
  assert.ok(
    newCycleBody.indexOf('if (!terminalEvidencePersisted) return false')
      < newCycleBody.indexOf('state.multiAngleExploration = prepared.exploration'),
  )
  assert.match(clickBody, /await startNewMultiAngleCycle\(\)/)
})

test('completes a restored batch from persisted multi-angle candidates', () => {
  const completeBody = app.match(/function completeMultiAngleBatch\(\) \{([\s\S]*?)\n\}\n\nfunction renderPendingEvidenceAutomationButton/)?.[1] ?? ''
  const timeoutBody = app.match(/function continueAfterMultiAnglePageTimeout\(message = ''\) \{([\s\S]*?)\n\}\n\nfunction completeMultiAngleBatch/)?.[1] ?? ''
  assert.match(app, /function currentMultiAngleBatchCandidates\(/)
  assert.match(app, /state\.multiAngleExploration\.currentBatchCandidates/)
  assert.match(app, /const restoredMultiAngleTargets = restoredMultiAngleTargetKeywords\(/)
  assert.match(app, /queuedKeywords:\s*restoredMultiAngleTargets/)
  assert.match(completeBody, /currentMultiAngleBatchCandidates\(\)/)
  assert.match(completeBody, /researchRowForMultiAngleCandidate\(/)
  assert.match(timeoutBody, /currentMultiAngleBatchCandidates\(\)/)
})

test('scopes current multi-angle evidence rows before pending and completion decisions', () => {
  const finalRowsBody = app.match(/function finalEvidenceRows\(\) \{([\s\S]*?)\n\}\n\nfunction finalEvidenceMetric/)?.[1] ?? ''
  const completeBody = app.match(/function completeMultiAngleBatch\(\) \{([\s\S]*?)\n\}\n\nfunction renderPendingEvidenceAutomationButton/)?.[1] ?? ''

  assert.match(finalRowsBody, /currentMultiAngleBatchCandidates\(\)/)
  assert.match(finalRowsBody, /researchRowForMultiAngleCandidate\(/)
  assert.match(completeBody, /researchRowForMultiAngleCandidate\(/)
})

test('keeps final evidence and CSV metadata indexed by research context instead of keyword alone', () => {
  const finalRowsBody = app.match(/function finalEvidenceRows\(\) \{([\s\S]*?)\n\}\n\nfunction finalEvidenceMetric/)?.[1] ?? ''
  const erankExportBody = app.match(/function exportErankCsv\(\) \{([\s\S]*?)\n\}\n\nfunction exportStep4Csv/)?.[1] ?? ''
  const resultExportBody = app.match(/function exportResultRowsCsv\([^)]*\) \{([\s\S]*?)\n\}\n\nfunction exportAvailableResearchCsv/)?.[1] ?? ''

  assert.match(finalRowsBody, /researchRowContextKey\(/)
  assert.match(finalRowsBody, /key:\s*contextKey/)
  assert.doesNotMatch(finalRowsBody, /const scoredByKeyword = new Map/)
  assert.match(erankExportBody, /evidenceByContext/)
  assert.match(resultExportBody, /evidenceByContext/)
  assert.doesNotMatch(erankExportBody, /const evidenceByKeyword = new Map/)
  assert.doesNotMatch(resultExportBody, /const evidenceByKeyword = new Map/)
})

test('assigns imported batch context before merging research rows', () => {
  const addRowsBody = app.match(/function addResearchRows\(rows\) \{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(addRowsBody, /mergeResearchRowsByContext\(/)
  assert.match(addRowsBody, /contextualize:\s*\(row\)\s*=>\s*buildMergedResearchRow\(null,\s*row/)
  assert.match(addRowsBody, /keyOf:\s*researchRowContextKey/)
})

test('archives learning rows only from the active research context', () => {
  const modifierBody = app.match(/function modifierEvidenceInput\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const archiveBody = app.match(/function evidenceArchiveRecord\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(modifierBody, /candidateMatchesResearchContext\(/)
  assert.match(modifierBody, /requireContext:\s*true/)
  assert.match(archiveBody, /contextualResearchRows/)
  assert.match(archiveBody, /rows:\s*contextualResearchRows/)
})

test('uses one fixed research context for gates pools resume results and archives', () => {
  const activeContext = app.match(/function activeResearchContext\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(app, /function activeResearchContext\(/)
  assert.match(app, /resolveMultiAngleResearchContext\(/)
  assert.match(activeContext, /eventSnapshot/)
  assert.match(activeContext, /categorySnapshot/)
  assert.match(app, /eventSnapshot:\s*researchContext\.event/)
  assert.match(app, /categorySnapshot:\s*researchContext\.category/)
  for (const functionName of [
    'evidenceArchiveRecord',
    'renderMarketTimingGate',
    'renderExplorationResultLanes',
    'currentMultiAnglePools',
    'resumeMultiAngleSearch',
    'schedulePendingEvidenceAutomation',
  ]) {
    const body = app.match(new RegExp(`function ${functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
    assert.match(body, /activeResearchContext\(\)/, `${functionName} must use the fixed context`)
  }
  assert.match(app, /pauseMultiAngleForContextChange\(/)
})

test('routes analysis Marketplace planning and Etsy row metadata through fixed research options', () => {
  const analysis = app.match(/function currentResearchAnalysis\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const plan = app.match(/function rebuildMarketplaceInsightPlan\([^)]*\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const mergedRow = app.match(/function buildMergedResearchRow\([^)]*\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(app, /function activeResearchOptions\(/)
  assert.match(analysis, /activeResearchOptions\(\)/)
  assert.match(plan, /activeResearchOptions\(\)/)
  assert.match(plan, /eventId:\s*researchOptions\.eventId/)
  assert.match(plan, /categoryId:\s*researchOptions\.categoryId/)
  assert.match(mergedRow, /activeResearchContext\(\)/)
  assert.match(mergedRow, /activeResearchOptions\(\)/)
})

test('keeps multi-angle candidate conversion and imported metadata on the frozen context', () => {
  const candidate = app.match(/function multiAngleCandidateForResearch\([^)]*\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const mergedRow = app.match(/function buildMergedResearchRow\([^)]*\) \{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(candidate, /resolveMultiAngleCandidateResearchContext\(/)
  assert.match(candidate, /eventSearchTerm/)
  assert.match(candidate, /categorySearchTerm/)
  assert.match(mergedRow, /resolveMultiAngleImportedResearchContext\(/)
  assert.match(mergedRow, /researchEventSearchTerm/)
  assert.match(mergedRow, /researchCategorySearchTerm/)
})

test('uses frozen options for round summaries drilldown archives and next-batch scoring', () => {
  for (const functionName of [
    'selectedRoundEverbeeRows',
    'renderResearchRoundControls',
    'currentCrossNicheDrilldown',
    'currentNicheDrilldownNodes',
    'applyCrossNicheProposal',
    'crossNicheCandidateForResearch',
    'researchMetadataCsvValues',
  ]) {
    const body = app.match(new RegExp(`function ${functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
    assert.match(
      body,
      /activeResearchOptions\(\)|activeResearchContext\(\)/,
      `${functionName} must use the frozen research context`,
    )
    assert.doesNotMatch(
      body,
      /currentOptions\(\)|selectedEvent\(\)|selectedCategory\(\)/,
      `${functionName} must not rescore current work from live selectors`,
    )
  }

  const completion = app.match(/if \(round\?\.type === 'initial'[\s\S]*?syncActiveRoundStatus\('complete', \{([\s\S]*?)\n\s*\}\)/)?.[0] ?? ''
  assert.match(completion, /activeResearchOptions\(\)/)
  assert.doesNotMatch(completion, /currentOptions\(\)/)
})

test('keeps eRank narrowing query plans and the EverBee handoff on the active research context', () => {
  for (const functionName of [
    'erankProbeKeyword',
    'erankSpecificTokens',
    'buildCurrentErankQueryPlan',
    'buildErankFollowUpQueryPlan',
    'buildEverbeeKeywordsFromErankRows',
  ]) {
    const body = app.match(new RegExp(`function ${functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
    assert.match(
      body,
      /activeResearchContext\(\)|activeResearchOptions\(\)/,
      `${functionName} must use the active research context`,
    )
    assert.doesNotMatch(
      body,
      /selectedEvent\(\)|selectedCategory\(\)|keywordClass\(/,
      `${functionName} must not narrow the active run from live selectors`,
    )
  }
})

test('exports row research metadata through the active-context fallback resolver', () => {
  const erankExport = app.match(/function exportErankCsv\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const resultsExport = app.match(/function exportResultRowsCsv\([^)]*\) \{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(app, /function researchExportContextForRow\(/)
  assert.match(erankExport, /researchExportContextForRow\(/)
  assert.match(resultsExport, /researchExportContextForRow\(/)
  assert.doesNotMatch(erankExport, /elements\.categorySelect\.value/)
  assert.doesNotMatch(resultsExport, /elements\.categorySelect\.value/)
})

test('routes marketplace extension and global stop controls through multi-angle orchestration', () => {
  const hasWork = app.match(/function multiAngleWorkHasCurrentBatch\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const marketplaceStop = app.match(/function stopMarketplaceInsightAutomation\([^)]*\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const extensionStop = app.match(/async function stopExtensionResearch\([^)]*\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const globalStop = app.match(/function stopActiveResearch\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(app, /async function stopMultiAngleOrchestration\(/)
  assert.match(app, /stopMultiAngleWork\(/)
  assert.match(hasWork, /status === 'running'/)
  assert.match(marketplaceStop, /stopMultiAngleOrchestration\('marketplace'\)/)
  assert.match(extensionStop, /stopMultiAngleOrchestration\('extension'\)/)
  assert.match(globalStop, /stopMultiAngleOrchestration\('global'\)/)
})

test('global research Stop receives multi-angle state including between-batch running work', () => {
  const header = app.match(/function researchHeaderState\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const render = app.match(/function renderGlobalResearchStatus\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(header, /multiAngleStatus:\s*state\.multiAngleExploration\.status/)
  assert.match(render, /headerState\.canStop/)
})

test('persists seasonal reference objects and feeds compatible later cycles', () => {
  assert.match(app, /savedSeasonalReferences:\s*\[\]/)
  assert.match(app, /savedSeasonalReferences:\s*state\.savedSeasonalReferences/)
  assert.match(app, /restoreSavedSeasonalReferences\(/)
  assert.match(app, /savedNextCycleCandidates:\s*state\.savedSeasonalReferences/)
  assert.match(app, /state\.savedSeasonalReferences = \[\.\.\.state\.savedSeasonalReferences,\s*reference\]/)
})

test('legacy seasonal migration can reconstruct the event currently selected for a later cycle', () => {
  const restorable = app.match(/function restorableSeasonalReferenceCandidates\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.doesNotMatch(restorable, /\.filter\(\(event\) => event\.id !== context\.eventId\)/)
  assert.match(restorable, /allowActiveEvent:\s*true/)
  assert.match(app, /originEventId:\s*context\.eventId/)
  assert.match(app, /originCategoryId:\s*context\.categoryId/)
})

test('keeps manual cross-niche confirmation while using drilldown evidence in multi-angle pools', () => {
  assert.match(app, /drilldownCandidates:\s*currentCrossNicheDrilldown\(\)\.candidates/)
  assert.match(app, /data-cross-niche-apply/)
  assert.match(app, /data-cross-niche-dismiss/)
})

test('feeds unresearched fixed-context winning-niche candidates into attribute combinations', () => {
  const taxonomy = app.match(/function nextTaxonomyCandidates\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(taxonomy, /activeResearchContext\(\)/)
  assert.match(taxonomy, /startWinningNicheAutomation\(/)
  assert.match(taxonomy, /buildNextWinningNicheBatch\(/)
  assert.match(taxonomy, /state\.multiAngleExploration\.evidenceKeys/)
  assert.match(taxonomy, /state\.multiAngleExploration\.queuedEvidenceKeys/)
  assert.match(taxonomy, /candidateEvidenceKey\(/)
  assert.match(taxonomy, /source:\s*candidate\.source/)
  assert.doesNotMatch(taxonomy, /finalEvidenceRows\(\)/)
})

test('shows a desktop exploration rail with one stop or resume control', () => {
  assert.match(html, /id="winningNicheAutomationPanel"/)
  assert.match(html, /id="winningNicheAutomationRail"/)
  assert.match(html, /id="winningNicheAutomationStatus"/)
  assert.match(html, /id="winningNicheAutomationToggle"/)
  assert.match(app, /function renderWinningNicheAutomation\(/)
  assert.match(app, /data-winning-niche-axis/)
  assert.match(app, /stopMultiAngleSearch/)
  assert.match(app, /resumeMultiAngleSearch/)
  assert.match(css, /\.winning-niche-automation-panel/)
  assert.match(css, /\.winning-niche-rail/)
})

test('keeps seasonal references outside the verified A/B result target', () => {
  assert.match(html, /id="activeEventResultLane"/)
  assert.match(html, /id="evergreenResultLane"/)
  assert.match(html, /id="seasonalReferenceLane"/)
  assert.match(html, /今回のA\/B目標には含みません/)
  assert.match(app, /resultLanes\.seasonalReference/)
  assert.match(app, /data-save-seasonal-reference/)
  assert.doesNotMatch(app, /data-(?:start|search)-seasonal-reference/)
})

test('treats extension bridge silence as a global service failure, not a page timeout', () => {
  const body = app.match(/function multiAngleFailureCode\(value = ''\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(body, /isExtensionResponseTimeout\(message\)[\s\S]*return 'service-unavailable'/)
  assert.match(body, /EverBee|page/i)
  assert.ok(body.indexOf("return 'service-unavailable'") < body.indexOf("return 'page-timeout'"))
})

test('stopping automatic verification stops multi-angle state without dropping current targets', () => {
  const toggleBody = app.match(/async function togglePendingEvidenceAutomation\(\) \{([\s\S]*?)\n\}\n\nasync function verifyPendingEvidence/)?.[1] ?? ''
  const stopBody = app.match(/async function stopMultiAngleSearch\(\) \{([\s\S]*?)\n\}\n\nasync function resumeMultiAngleSearch/)?.[1] ?? ''
  assert.match(toggleBody, /multiAngleSearchIsRunning\(\)[\s\S]*stopMultiAngleSearch\(\)/)
  assert.doesNotMatch(stopBody, /targetKeywords\s*=\s*\[\]/)
  assert.match(stopBody, /stopMultiAngleOrchestration\('global'\)/)
})

test('keeps continuous exploration visible outside every stage-specific panel', () => {
  const automationPanelIndex = html.indexOf('id="winningNicheAutomationPanel"')
  const researchConsoleIndex = html.indexOf('id="researchConsole"')

  assert.ok(automationPanelIndex >= 0)
  assert.ok(researchConsoleIndex >= 0)
  assert.ok(
    automationPanelIndex < researchConsoleIndex,
    'continuous exploration must remain visible while Conditions, Etsy, or EverBee is active',
  )
  assert.match(app, /function renderAll\(\)\s*\{\s*renderGlobalResearchStatus\(\)\s*renderWinningNicheAutomation\(\)/)
})

test('turns the completed no-winner state into continuous-search guidance', () => {
  assert.match(app, /勝ち候補を探索中/)
  assert.match(app, /次の未調査カテゴリ/)
  assert.doesNotMatch(app, /<h3>今回は採用できるキーワードなし<\/h3>/)
})

test('updates the automation button without rebuilding the final evidence table', () => {
  const toggleBody = app.match(/async function togglePendingEvidenceAutomation\(\) \{([\s\S]*?)\n\}\n\nasync function verifyPendingEvidence/)?.[1] ?? ''
  const stopBody = app.match(/function stopPendingEvidenceAutomation\(message = ''\) \{([\s\S]*?)\n\}\n\nfunction schedulePendingEvidenceAutomation/)?.[1] ?? ''

  assert.match(app, /function renderPendingEvidenceAutomationButton\(/)
  assert.match(toggleBody, /renderPendingEvidenceAutomationButton\(/)
  assert.match(stopBody, /renderPendingEvidenceAutomationButton\(/)
  assert.doesNotMatch(toggleBody, /renderResultsTable\(/)
  assert.doesNotMatch(stopBody, /renderResultsTable\(/)
})

test('reschedules automatic verification while another external task is still active', () => {
  assert.match(
    app,
    /if \(state\.extensionState\?\.active \|\| state\.marketplaceInsightAutoRunning \|\| state\.marketplaceInsightBusy\) \{\s*schedulePendingEvidenceAutomation\(2000\)\s*return\s*\}/,
  )
})

test('freezes the selected verification scope when automation starts', () => {
  assert.match(app, /targetKeywords:\s*initialPendingRows\.map\(\(row\) => row\.keyword\)/)
  assert.match(app, /allowedKeywords:\s*state\.pendingEvidenceAutomation\.targetKeywords/)
  assert.match(app, /const allowedKeywordSet = new Set/)
})

test('checks the extension background before starting selected verification', () => {
  const confirmBody = app.match(/async function confirmExtensionConnection\(\) \{([\s\S]*?)\n\}\n\nfunction handleExtensionMessage/)?.[1] ?? ''

  assert.match(app, /async function confirmExtensionConnection\(/)
  assert.match(app, /requestExtension\('GET_MARKET_STATE', \{\}, 5000\)/)
  assert.match(
    confirmBody,
    /if \(state\.extensionConnected && state\.extensionVersion === REQUIRED_EXTENSION_VERSION\) return true/,
  )
  assert.match(app, /if \(!await confirmExtensionConnection\(\)\) return/)
  assert.match(app, /data\.action === 'BRIDGE_UNAVAILABLE'/)
  assert.match(app, /if \(String\(data\.version \?\? ''\) !== REQUIRED_EXTENSION_VERSION\)/)
})

test('stops automatic verification without consuming pending rows at the eRank daily limit', () => {
  assert.match(app, /function isErankDailyLimitError\(/)
  assert.match(app, /isErankDailyLimitError\(data\.state\?\.error\)/)
  assert.match(app, /eRankの1日あたりの検索上限/)
  assert.match(app, /stopPendingEvidenceAutomation/)
})

test('uses the pure evidence state module instead of a second scoring model', () => {
  assert.match(app, /from '\.\/final-evidence-matrix\.js\?v=/)
  assert.match(app, /deriveFinalEvidenceState/)
  assert.match(app, /deriveFinalScoreState/)
  assert.match(app, /formatEvidenceMetric/)
  assert.match(app, /pendingEvidenceBatch/)
  assert.doesNotMatch(app, /function scoreFinalEvidence/)
})

test('keeps headers and the first three comparison columns visible on desktop', () => {
  assert.match(css, /\.final-evidence-table-shell\s*\{[^}]*overflow:\s*auto/s)
  assert.match(css, /\.final-evidence-table\s+thead\s+th\s*\{[^}]*position:\s*sticky/s)
  assert.match(css, /\.final-evidence-table\s+\.is-sticky-column\s*\{[^}]*position:\s*sticky/s)
  assert.match(css, /min-width:\s*3500px/)
})

test('shows an explicit keyword decision before the comparison table', () => {
  assert.match(html, /id="finalKeywordDecision"/)
  assert.match(app, /function renderFinalKeywordDecision\(/)
  assert.match(app, /deriveFinalKeywordDecision/)
  assert.match(app, /まず使うキーワード/)
  assert.match(app, /勝ち候補を探索中/)
})

test('provides an always-accessible horizontal scrollbar synchronized with the table', () => {
  assert.match(html, /id="finalEvidenceScrollProxy"/)
  assert.match(html, /id="finalEvidenceScrollProxyTrack"/)
  assert.match(css, /\.final-evidence-scroll-proxy\s*\{[^}]*position:\s*sticky/s)
  assert.match(css, /\.final-evidence-scroll-proxy\s*\{[^}]*overflow-x:\s*auto/s)
  assert.match(app, /function syncFinalEvidenceScrollbars\(/)
  assert.match(app, /finalEvidenceScrollProxy\.scrollLeft/)
  assert.match(app, /finalEvidenceTable\.scrollLeft/)
})

test('shows every designed evidence field in the comparison table', () => {
  for (const header of ['Trend', 'Etsy Conversion', '関連語', 'Median Revenue', '判定理由']) {
    assert.match(app, new RegExp(`<th>${header}</th>`))
  }
  assert.match(app, /normalized\.etsyRelatedTerms/)
  assert.match(app, /data\.medianMonthlyRevenue/)
  assert.match(app, /decisionReasons/)
})

test('does not rebuild the large evidence table when its HTML is unchanged', () => {
  assert.match(app, /renderHtmlIfChanged\(elements\.finalEvidenceTable,\s*tableHtml\)/)
  assert.match(app, /renderHtmlIfChanged\(elements\.resultsList,\s*detailHtml\)/)
})

test('limits Etsy bulk verification to the selected evidence batch', () => {
  assert.match(app, /function rebuildMarketplaceInsightPlan\(\{\s*preserveExisting = false,\s*keywords = \[\]/)
  assert.match(app, /rebuildMarketplaceInsightPlan\(\{\s*preserveExisting:\s*true,\s*keywords\s*\}\)/)
  assert.match(app, /requestedKeywordKeys/)
  assert.match(app, /'targeted-batch':\s*'指定した候補の確認完了'/)
})

test('routes EverBee failures to a retryable failed state', () => {
  assert.match(app, /const everbeeFailed =/)
  assert.match(app, /everbeeFailed\s*\?\s*'pending-everbee'/)
})

test('labels eRank provider no-data as Unknown for users', () => {
  assert.match(app, /'no-data':\s*'Unknown'/)
  assert.doesNotMatch(app, /'no-data':\s*'eRankデータなし'/)
})

test('exports verification metadata with both result CSVs', () => {
  for (const header of ['Verification Status', 'Missing Stages', 'Score Type', 'eRank Capture Status']) {
    assert.ok(app.split(header).length >= 3, `${header} must exist in both CSV exports`)
  }
  assert.match(app, /Unknown/)
  assert.match(app, /const unknownMetric = row\.status === 'no-data' \? 'Unknown' : ''/)
})

test('hands the design step a few themes as series, not a flat keyword list', () => {
  assert.match(html, /id="designShortlistPanel"/)
  assert.match(html, /id="downloadDesignShortlistBtn"/)
  assert.match(html, /id="designShortlistMoreBtn"/)
  assert.match(html, /id="designShortlistResetBtn"/)
  assert.match(html, /次に作る4テーマ/)
  assert.match(html, /1テーマ＝1シリーズとして5〜8商品/)
  assert.ok(html.indexOf('id="designShortlistPanel"') > html.indexOf('id="finalKeywordDecision"'))
  assert.match(app, /function renderDesignShortlist\(\)/)
  assert.match(app, /function currentDesignClusterPlan\(\)/)
  assert.match(app, /function exportDesignShortlistCsv\(\)/)
  assert.match(app, /selectDesignClusters/)
  assert.match(app, /class="design-cluster"/)
  // One listing serves one buyer intent, so the handoff must not flatten the clusters away.
  assert.doesNotMatch(app, /selectDesignShortlist/)
  // Only verified rows may reach the design handoff.
  assert.match(app, /row\.evidenceState\.status === 'verified'\)\s*\n\s*\.map\(\(row\) => row\.everbeeRow\)/)
  // The full export must stay available so the shortlist is a view, not a filter on the data.
  assert.match(app, /function exportStep4Csv\(\)\s*\{\s*exportResultRowsCsv\(everbeeResultRows\(\)/)
})
