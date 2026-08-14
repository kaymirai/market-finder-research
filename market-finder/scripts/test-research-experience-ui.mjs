import assert from 'node:assert/strict'
import test from 'node:test'

import {
  deriveResearchExperienceUi,
  researchPauseRecovery,
} from '../src/research-experience-ui.js'

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
