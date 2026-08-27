import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PERSISTENCE_VERSION,
  audienceSelectionsForContext,
  clearCurrentAudienceSelection,
  deriveAudienceUiStatus,
  migrateLegacyAudienceState,
  normalizeAudienceSelectionsByContext,
  setAudienceSelectionsForContext,
} from '../src/audience-selection-state.js'
import { prepareFreshStartWorkspace } from '../src/multi-angle-exploration.js'

test('migrates old automatic buyer identities as unselected legacy recipients', () => {
  const migrated = migrateLegacyAudienceState({
    buyerIdentitySeeds: 'teacher\nnew mom',
    buyerIdentitySelectionMode: 'auto',
  }, 'ornament||memorial')

  assert.deepEqual(migrated['ornament||memorial'].selections, [
    { phrase: 'teacher', role: 'recipient', subjectType: '', status: 'legacy', source: 'legacy', selected: false },
    { phrase: 'new mom', role: 'recipient', subjectType: '', status: 'legacy', source: 'legacy', selected: false },
  ])
})

test('migrates old manual buyer identities as selected manual hypotheses', () => {
  const migrated = migrateLegacyAudienceState({
    buyerIdentitySeeds: 'teacher',
    buyerIdentitySelectionMode: 'manual',
  }, 'shirt||teacher')

  assert.deepEqual(migrated['shirt||teacher'].selections, [
    { phrase: 'teacher', role: 'recipient', subjectType: '', status: 'manual', source: 'legacy', selected: true },
  ])
})

test('keeps version one persisted context selections without destructive migration', () => {
  const form = {
    audienceSelectionsByContext: {
      'shirt||teacher': {
        selections: [{ phrase: 'teacher', role: 'recipient', status: 'manual', selected: true }],
        updatedAt: '2026-08-27T00:00:00.000Z',
      },
    },
    buyerIdentitySeeds: 'new mom',
    buyerIdentitySelectionMode: 'auto',
  }

  assert.equal(PERSISTENCE_VERSION, 1)
  assert.deepEqual(migrateLegacyAudienceState(form, 'ornament||memorial'), {
    'shirt||teacher': {
      selections: [{ phrase: 'teacher', role: 'recipient', subjectType: '', status: 'manual', source: 'manual', selected: true }],
      updatedAt: '2026-08-27T00:00:00.000Z',
    },
  })
})

test('normalizes malformed selections without mutating the saved state', () => {
  const saved = {
    'shirt||teacher': {
      selections: [
        { phrase: ' Teacher ', role: 'recipient', status: 'manual', selected: 1 },
        { phrase: 'teacher', role: 'recipient', status: 'confirmed', selected: false },
        { phrase: 'students', role: 'giver', status: 'unknown', selected: true },
        { phrase: '', role: 'subject', status: 'manual', selected: true },
        { phrase: 'pet', role: 'unsupported', status: 'manual', selected: true },
      ],
      updatedAt: 'not-a-date',
    },
  }
  const original = JSON.parse(JSON.stringify(saved))

  const normalized = normalizeAudienceSelectionsByContext(saved, '2026-08-27T01:00:00.000Z')

  assert.deepEqual(saved, original)
  assert.deepEqual(normalized['shirt||teacher'], {
    selections: [
      { phrase: 'Teacher', role: 'recipient', subjectType: '', status: 'manual', source: 'manual', selected: true },
      { phrase: 'students', role: 'giver', subjectType: '', status: 'manual', source: 'manual', selected: true },
    ],
    updatedAt: '2026-08-27T01:00:00.000Z',
  })
})

test('keeps manual selections isolated by audience context key and restores them when returning', () => {
  const first = setAudienceSelectionsForContext({}, 'shirt||teacher', [
    { phrase: 'teacher', role: 'recipient', status: 'manual', selected: true },
  ], '2026-08-27T00:00:00Z')
  const second = setAudienceSelectionsForContext(first, 'ornament||memorial', [], '2026-08-27T00:01:00Z')

  assert.equal(audienceSelectionsForContext(second, 'shirt||teacher')[0].phrase, 'teacher')
  assert.equal(audienceSelectionsForContext(second, 'shirt||teacher')[0].status, 'manual')
  assert.deepEqual(audienceSelectionsForContext(second, 'ornament||memorial'), [])
})

test('clears only the current audience context for a fresh start', () => {
  const saved = setAudienceSelectionsForContext({
    'shirt||teacher': {
      selections: [{ phrase: 'teacher', role: 'recipient', status: 'manual', selected: true }],
      updatedAt: '2026-08-27T00:00:00.000Z',
    },
  }, 'ornament||memorial', [
    { phrase: 'pet', role: 'subject', subjectType: 'pet', status: 'confirmed', selected: true },
  ], '2026-08-27T00:01:00.000Z')

  const cleared = clearCurrentAudienceSelection(saved, 'ornament||memorial')

  assert.deepEqual(audienceSelectionsForContext(cleared, 'ornament||memorial'), [])
  assert.deepEqual(audienceSelectionsForContext(cleared, 'shirt||teacher'), [
    { phrase: 'teacher', role: 'recipient', subjectType: '', status: 'manual', source: 'manual', selected: true },
  ])
})

test('prepares a fresh active workspace without leaking audience selections or clearing archives', () => {
  const evidenceArchives = [{ capturedAt: '2026-08-27T00:00:00.000Z', records: [{ keyword: 'teacher mug' }] }]
  const researchedMarketHistory = [{ keyword: 'teacher mug', eventId: '', categoryId: 'mug' }]

  const prepared = prepareFreshStartWorkspace({
    evidenceArchives,
    researchedMarketHistory,
    researchRows: [{ keyword: 'teacher mug' }],
    candidates: [{ keyword: 'teacher mug' }],
    audienceSelectionsByContext: {
      'mug||teacher': {
        selections: [{ phrase: 'teacher', role: 'recipient', status: 'manual', selected: true }],
        updatedAt: '2026-08-27T00:00:00.000Z',
      },
    },
  })

  assert.deepEqual(prepared.freshStartAudienceState, {
    activeContextKey: '',
    audienceSelectionsByContext: {},
  })
  assert.equal(prepared.freshStartForm.buyerIdentitySeeds, '')
  assert.deepEqual(prepared.evidenceArchives, evidenceArchives)
  assert.deepEqual(prepared.researchedMarketHistory, researchedMarketHistory)
  assert.deepEqual(prepared.researchRows, [])
  assert.deepEqual(prepared.candidates, [])
})

test('distinguishes no evidence from a provider failure and does not verify manual hypotheses', () => {
  assert.equal(deriveAudienceUiStatus({ signals: [], providerFailed: false }).label, 'まだ実績がないため未選択')
  assert.equal(deriveAudienceUiStatus({ signals: [], providerFailed: true }).label, '取得失敗のため未判定')
  assert.equal(deriveAudienceUiStatus({
    signals: [{ phrase: 'teacher', role: 'recipient', status: 'manual', selected: true }],
  }).label, '手動仮説を使用中')
  assert.equal(deriveAudienceUiStatus({
    signals: [{ phrase: 'teacher', role: 'recipient', status: 'manual', selected: true }],
  }).verified, false)
})
