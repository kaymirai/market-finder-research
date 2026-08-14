import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  completionModalBehavior,
  pendingAutomationToggleAction,
  resumePendingEvidenceAutomation,
  startSingleKeywordEvidenceAutomation,
} from '../src/progress-modal-flow.js'

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8')

test('completed chained research closes the modal automatically', () => {
  assert.deepEqual(completionModalBehavior({
    completed: true,
    automationActive: true,
  }), {
    buttonLabel: '閉じて次へ',
    autoClose: true,
  })
})

test('completed manual research presents an explicit next-step button', () => {
  assert.deepEqual(completionModalBehavior({ completed: true }), {
    buttonLabel: '閉じて次へ',
    autoClose: false,
  })
})

test('a failed or stopped run stays open for review', () => {
  assert.deepEqual(completionModalBehavior({ completed: true, failed: true, automationActive: true }), {
    buttonLabel: '閉じる',
    autoClose: false,
  })
  assert.deepEqual(completionModalBehavior({ completed: true, stopped: true, automationActive: true }), {
    buttonLabel: '閉じる',
    autoClose: false,
  })
})

test('retrying one result keeps the same keyword active through later evidence stages', () => {
  assert.deepEqual(startSingleKeywordEvidenceAutomation(' Halloween Gothic Shirt '), {
    active: true,
    scheduled: false,
    initialCount: 1,
    completedBatches: 0,
    currentStage: '',
    targetKeywords: ['halloween gothic shirt'],
  })
})


test('retrying one result reacquires the tab lease before the first evidence stage', () => {
  const body = appSource.slice(
    appSource.indexOf('async function verifyPendingEvidence('),
    appSource.indexOf('\nfunction ', appSource.indexOf('async function verifyPendingEvidence(') + 1),
  )
  assert.match(
    body,
    /if \(requested && !options\.automated && batch\.length === 1\) \{\s*if \(!await confirmExtensionConnection\(\)\) return false\s*state\.pendingEvidenceAutomation = startSingleKeywordEvidenceAutomation/,
  )
})


test('extension connection updates the mission action as well as the status header', () => {
  const body = appSource.match(/function renderExtensionStateUpdate\(\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(body, 'extension state renderer must be extractable')
  assert.match(body, /renderNextResearchAction\(\)[\s\S]*renderResearchExperience\(\)/)
})

test('saved active automation resumes when no browser work is actually running', () => {
  assert.equal(pendingAutomationToggleAction({
    automationActive: true,
    extensionActive: false,
    marketplaceActive: false,
    scheduled: false,
  }), 'resume')
})

test('the same control stops automation only while browser work is running', () => {
  assert.equal(pendingAutomationToggleAction({
    automationActive: true,
    extensionActive: true,
  }), 'stop')
  assert.equal(pendingAutomationToggleAction({ automationActive: false }), 'start')
})

test('resume replaces stale saved targets with the candidates that are pending now', () => {
  assert.deepEqual(resumePendingEvidenceAutomation({
    active: true,
    scheduled: false,
    initialCount: 1,
    completedBatches: 1,
    currentStage: 'pending-erank',
    targetKeywords: ['superhero ghost shirt'],
  }, [' Halloween Gothic Shirt ']), {
    active: true,
    scheduled: false,
    initialCount: 1,
    completedBatches: 1,
    currentStage: '',
    targetKeywords: ['halloween gothic shirt'],
  })
})