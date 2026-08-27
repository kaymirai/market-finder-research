import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractAudienceRoleSignals,
  getAudienceCategoryProfile,
} from '../../shared/market-keyword-engine/index.js'

test('defines audience roles for every product category without requiring a person', () => {
  const expected = {
    shirt: ['recipient'],
    sweatshirt: ['recipient'],
    mug: ['recipient'],
    ornament: ['subject'],
    'wall-art': ['subject'],
    tote: ['recipient'],
    sticker: ['recipient', 'subject'],
  }
  for (const [categoryId, primaryRoles] of Object.entries(expected)) {
    const profile = getAudienceCategoryProfile(categoryId)
    assert.deepEqual(profile.primaryRoles, primaryRoles)
    assert.equal(profile.allowsNoAudience, true)
  }
})

test('classifies recipient giver and memorial subject from the complete phrase', () => {
  for (const categoryId of ['shirt', 'sweatshirt']) {
    assert.deepEqual(
      extractAudienceRoleSignals(`teacher ${categoryId}`, { categoryId })
        .map(({ phrase, role }) => ({ phrase, role })),
      [{ phrase: 'teacher', role: 'recipient' }],
    )
  }
  assert.deepEqual(
    extractAudienceRoleSignals('teacher ornament from students', { categoryId: 'ornament' })
      .map(({ phrase, role }) => ({ phrase, role })),
    [
      { phrase: 'teacher', role: 'recipient' },
      { phrase: 'students', role: 'giver' },
    ],
  )
  assert.deepEqual(
    extractAudienceRoleSignals('memorial ornament for mom', { categoryId: 'ornament' })
      .map(({ phrase, role, subjectType }) => ({ phrase, role, subjectType })),
    [{ phrase: 'mom', role: 'subject', subjectType: 'person' }],
  )
  assert.deepEqual(
    extractAudienceRoleSignals('pet memorial ornament', { categoryId: 'ornament' })
      .map(({ phrase, role, subjectType }) => ({ phrase, role, subjectType })),
    [{ phrase: 'pet', role: 'subject', subjectType: 'pet' }],
  )
})

test('does not invent an audience from product style or format words', () => {
  assert.deepEqual(extractAudienceRoleSignals('custom tote bag', { categoryId: 'tote' }), [])
  assert.deepEqual(extractAudienceRoleSignals('bumper sticker', { categoryId: 'sticker' }), [])
  assert.deepEqual(
    extractAudienceRoleSignals('landscape wall art', { categoryId: 'wall-art' })
      .map(({ phrase, role, subjectType }) => ({ phrase, role, subjectType })),
    [{ phrase: 'landscape', role: 'subject', subjectType: 'interest' }],
  )
})
