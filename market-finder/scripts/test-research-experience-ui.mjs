import assert from 'node:assert/strict'
import test from 'node:test'

import {
  deriveResearchActionFeedback,
  deriveResearchExperienceUi,
  researchAutomationIdleReason,
  researchPauseRecovery,
} from '../src/research-experience-ui.js'

test('shows immediate feedback while a research action is starting', () => {
  assert.deepEqual(deriveResearchActionFeedback({ actionPending: 'automation' }), {
    mode: 'starting',
    buttonAction: 'pending',
    buttonLabel: '探索を開始しています…',
    buttonDisabled: true,
    headline: '開始処理中',
    detail: 'ブラウザ接続と未調査候補を確認しています。',
  })
})

test('keeps a visible stop control while research is active', () => {
  assert.deepEqual(deriveResearchActionFeedback({ isRunning: true }), {
    mode: 'running',
    buttonAction: 'stop-active',
    buttonLabel: '調査を停止（稼働中）',
    buttonDisabled: false,
    headline: '調査中',
    detail: '調査は動いています。進捗件数が順番に更新されます。',
  })
})

test('explains why a resume button is shown after research stops', () => {
  assert.equal(
    researchAutomationIdleReason('exhausted'),
    '現在は停止中です。今回の未調査候補は確認済みです。押すと条件を広げて再探索します。',
  )
  assert.equal(
    researchAutomationIdleReason('stopped'),
    '現在は停止中です。押すと続きから再開します。',
  )
  assert.equal(
    researchAutomationIdleReason('paused'),
    '現在は一時停止中です。押すと続きから再開します。',
  )
  assert.equal(researchAutomationIdleReason('running'), '')
})

test('shows setup before research has produced rows', () => {
  const ui = deriveResearchExperienceUi({
    hasResearchRows: false,
    targetWinnerCount: 5,
    winnerCount: 0,
  })

  assert.deepEqual(ui, {
    phase: 'setup',
    stage: 'conditions',
    headline: '調査を始める',
    description: '',
    action: '',
    targetLabel: 'A/B候補 0 / 5件',
  })
})

test('shows running at the active evidence stage', () => {
  const ui = deriveResearchExperienceUi({
    isRunning: true,
    activeStage: 'etsy',
    targetWinnerCount: 5,
    winnerCount: 2,
  })

  assert.equal(ui.phase, 'running')
  assert.equal(ui.stage, 'etsy')
  assert.equal(ui.headline, '調査中')
  assert.equal(ui.targetLabel, 'A/B候補 2 / 5件')
})

test('shows terminal results after completed evidence exists', () => {
  for (const decisionStatus of ['ready', 'none', 'retry']) {
    const ui = deriveResearchExperienceUi({
      hasResearchRows: true,
      decisionStatus,
      targetWinnerCount: 5,
      winnerCount: 0,
    })

    assert.equal(ui.phase, 'result', decisionStatus)
    assert.equal(ui.stage, 'results', decisionStatus)
    assert.equal(ui.headline, '最終結果', decisionStatus)
  }
})

test('keeps incomplete evidence in the running view', () => {
  const ui = deriveResearchExperienceUi({
    hasResearchRows: true,
    decisionStatus: 'pending',
    activeStage: 'everbee',
  })

  assert.equal(ui.phase, 'running')
  assert.equal(ui.stage, 'everbee')
})

test('normalizes unknown stages and invalid target counts', () => {
  const ui = deriveResearchExperienceUi({
    isRunning: true,
    activeStage: 'unknown',
    targetWinnerCount: -2,
    winnerCount: Number.NaN,
  })

  assert.equal(ui.stage, 'conditions')
  assert.equal(ui.targetLabel, 'A/B候補 0 / 0件')
})

test('explains that an EverBee login is required before a paused search can resume', () => {
  assert.deepEqual(researchPauseRecovery('login-required'), {
    actionLabel: 'EverBeeにログイン後、探索を再開',
    reason: 'EverBeeのログインが切れています。開いているEverBee SSOタブでログインしてから、このボタンを押してください。',
  })
  assert.deepEqual(researchPauseRecovery('page-timeout'), {
    actionLabel: '',
    reason: '',
  })
})
