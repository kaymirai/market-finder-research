import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const [rawHtml, rawApp, rawCss] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
])
const html = rawHtml.replace(/\r\n/g, '\n')
const app = rawApp.replace(/\r\n/g, '\n')
const css = rawCss.replace(/\r\n/g, '\n')

test('shows production timing and requires explicit override outside 45-75 days', () => {
  assert.match(html, /id="marketTimingGate"/)
  assert.match(html, /id="marketTimingStatus"/)
  assert.match(html, /id="marketTimingOverrideBtn"/)
  assert.match(app, /function renderMarketTimingGate\(/)
  assert.match(app, /timingOverrideConfirmed:\s*false/)
  assert.match(app, /timingOverrideConfirmed\s*=\s*true/)
  assert.match(app, /timingOverrideConfirmed\s*=\s*false/)
  assert.match(app, /if \(\['early', 'late'\]\.includes\(timing\.status\) && !state\.timingOverrideConfirmed\)/)
  for (const functionName of [
    'startMultiAngleSearch',
    'startNewMultiAngleCycle',
    'resumeMultiAngleSearch',
    'resumePersistedEvidenceAutomationIfReady',
  ]) {
    const body = app.match(new RegExp(`(?:async )?function ${functionName}\\(\\) \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
    assert.match(body, /\['early', 'late'\]\.includes\(timing\.status\) && !state\.timingOverrideConfirmed/)
  }
})

test('shows the selected event peak date and remaining days in the timing gate', () => {
  const timingBody = app.slice(
    app.indexOf('function renderMarketTimingGate()'),
    app.indexOf('\nfunction ', app.indexOf('function renderMarketTimingGate()') + 1),
  )
  assert.match(timingBody, /timing\.peakDate/)
  assert.match(timingBody, /timing\.daysUntil/)
  assert.match(timingBody, /需要ピーク/)
})

test('shows the six exploration angles as one horizontal research route', () => {
  assert.match(html, /id="multiAngleRail"/)
  assert.match(html, /id="explorationAngleStatus"/)
  assert.match(app, /function renderExplorationAngleRail\(/)
  assert.match(app, /data-exploration-angle/)
  for (const label of ['需要周辺', '属性組み合わせ', '新着販売', '別商品種', '市場の空白', '大市場・通年']) {
    assert.match(app, new RegExp(label))
  }
  for (const status of ['未開始', '調査中', '完了', '候補なし']) {
    assert.match(app, new RegExp(status))
  }
  assert.match(css, /\.multi-angle-rail\s*\{[\s\S]*grid-template-columns:\s*repeat\(6,/)
})

test('keeps event, evergreen, and seasonal-reference results in separate lanes', () => {
  assert.match(html, /id="multiAngleResultLanes"/)
  assert.match(html, /id="activeEventResultLane"/)
  assert.match(html, /id="evergreenResultLane"/)
  assert.match(html, /id="seasonalReferenceLane"/)
  assert.match(html, /今回のA\/B目標には含みません/)
  assert.match(app, /function renderExplorationResultLanes\(/)
  assert.match(app, /buildTimelySeasonalSuggestions\(/)
})

test('seasonal references can only be saved for a later run', () => {
  const seasonalLane = html.match(/<article id="seasonalReferenceLane"[\s\S]*?<\/article>/)?.[0] ?? ''
  assert.doesNotMatch(seasonalLane, /自動検索|調査を開始|探索を開始/)
  assert.match(app, /次回候補に保存/)
  assert.match(app, /data-save-seasonal-reference/)
  assert.doesNotMatch(app, /data-(?:start|search)-seasonal-reference/)
})

test('desktop route and result lanes protect readable Japanese columns', () => {
  assert.match(css, /\.exploration-angle-step\s*\{[\s\S]*min-width:\s*\d+px/)
  assert.match(css, /\.exploration-angle-status\s*\{[\s\S]*min-width:\s*\d+px/)
  assert.match(css, /\.exploration-result-lanes\s*\{[\s\S]*display:\s*grid/)
  assert.match(css, /\.exploration-result-item\s*\{[\s\S]*min-width:\s*\d+px/)
})

test('a blocked event change pauses scheduled verification without losing its targets', () => {
  const pauseBody = app.slice(
    app.indexOf('function pauseMultiAngleForBlockedTimingChange()'),
    app.indexOf('\nfunction ', app.indexOf('function pauseMultiAngleForBlockedTimingChange()') + 1),
  )
  const scheduleBody = app.slice(
    app.indexOf('function schedulePendingEvidenceAutomation('),
    app.indexOf('\nfunction ', app.indexOf('function schedulePendingEvidenceAutomation(') + 1),
  )
  const eventChangeBody = app.slice(
    app.indexOf("elements.eventSelect.addEventListener('change'"),
    app.indexOf("elements.customEventInput.addEventListener('input'"),
  )

  assert.match(pauseBody, /state\.pendingEvidenceAutomation\.active = false/)
  assert.match(pauseBody, /state\.pendingEvidenceAutomation\.scheduled = false/)
  assert.match(pauseBody, /pauseMultiAngleExploration\(/)
  assert.doesNotMatch(pauseBody, /targetKeywords\s*=\s*\[\]/)
  assert.match(eventChangeBody, /pauseMultiAngleForBlockedTimingChange\(\)/)
  assert.match(eventChangeBody, /const pausedForTiming = pauseMultiAngleForBlockedTimingChange\(\)/)
  assert.match(eventChangeBody, /if \(!pausedForTiming\) resetCandidatesForInputChange\(\)/)
  assert.ok(
    scheduleBody.indexOf('pauseMultiAngleForBlockedTimingChange()')
      < scheduleBody.indexOf("verifyPendingEvidence('', '',"),
  )
})

test('keeps Stop available while blocked work is still active', () => {
  const automationBody = app.slice(
    app.indexOf('function renderWinningNicheAutomation()'),
    app.indexOf('\nfunction ', app.indexOf('function renderWinningNicheAutomation()') + 1),
  )
  const timingBody = app.slice(
    app.indexOf('function renderMarketTimingGate()'),
    app.indexOf('\nfunction ', app.indexOf('function renderMarketTimingGate()') + 1),
  )
  assert.match(automationBody, /state\.marketplaceInsightAutoRunning/)
  assert.match(automationBody, /state\.marketplaceInsightBusy/)
  assert.match(timingBody, /const canStopActiveResearch/)
  assert.match(timingBody, /disabled = blocked && !canStopActiveResearch/)
})

test('a blocked event change stops the Marketplace Insights loop without clearing targets', () => {
  const pauseBody = app.slice(
    app.indexOf('function pauseMultiAngleForBlockedTimingChange()'),
    app.indexOf('\nfunction ', app.indexOf('function pauseMultiAngleForBlockedTimingChange()') + 1),
  )
  assert.match(pauseBody, /const marketplaceWasActive/)
  assert.match(pauseBody, /stopMarketplaceInsightAutomation\(\)/)
  assert.doesNotMatch(pauseBody, /targetKeywords\s*=\s*\[\]/)
})

test('derives angle completion from the exploration cursor rather than shared provenance', () => {
  const angleStateBody = app.slice(
    app.indexOf('function explorationAngleState('),
    app.indexOf('\nfunction ', app.indexOf('function explorationAngleState(') + 1),
  )
  assert.match(angleStateBody, /automation\.angleIndex/)
  assert.match(angleStateBody, /automation\.currentAngleId/)
  assert.match(angleStateBody, /automation\.exhaustedAngles/)
  assert.doesNotMatch(angleStateBody, /automation\.provenance|automation\.evidenceKeys/)
})

test('has no hidden all-seasonal save control or dead all-handler branch', () => {
  assert.doesNotMatch(html, /data-save-seasonal-reference="all"/)
  assert.doesNotMatch(app, /saveSeasonalReference === 'all'/)
})
