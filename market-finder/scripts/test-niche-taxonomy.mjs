import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NICHE_AXIS_ORDER,
  NICHE_TAXONOMY,
  nextTaxonomyAxis,
  taxonomyTerms,
} from '../src/niche-taxonomy.js'

test('exposes six rotating niche axes grounded in the supplied cross-niching guide', () => {
  assert.deepEqual(NICHE_AXIS_ORDER, [
    'career',
    'hobby',
    'relationship',
    'pet',
    'style',
    'buyer-context',
  ])
  assert.equal(Object.keys(NICHE_TAXONOMY).length, 6)
})

test('keeps varied concrete terms for careers hobbies recipients and pets', () => {
  assert.ok(taxonomyTerms('career').includes('teacher'))
  assert.ok(taxonomyTerms('career').includes('school counselor'))
  assert.ok(taxonomyTerms('career').includes('dental hygienist'))
  assert.ok(taxonomyTerms('hobby').includes('reading'))
  assert.ok(taxonomyTerms('hobby').includes('birdwatching'))
  assert.ok(taxonomyTerms('hobby').includes('pottery'))
  assert.ok(taxonomyTerms('relationship').includes('nana'))
  assert.ok(taxonomyTerms('relationship').includes('aunt'))
  assert.ok(taxonomyTerms('relationship').includes('granddad'))
  assert.ok(taxonomyTerms('pet').includes('dachshund'))
  assert.ok(taxonomyTerms('pet').includes('ragdoll cat'))
  assert.ok(taxonomyTerms('pet').includes('axolotl'))
})

test('adds style and buying-context axes needed by Market Finder', () => {
  assert.ok(taxonomyTerms('style').includes('retro'))
  assert.ok(taxonomyTerms('style').includes('gothic'))
  assert.ok(taxonomyTerms('style').includes('minimalist'))
  assert.ok(taxonomyTerms('buyer-context').includes('gift for'))
  assert.ok(taxonomyTerms('buyer-context').includes('gift from'))
  assert.ok(taxonomyTerms('buyer-context').includes('matching family'))
})

test('normalizes duplicate entries and omits known intellectual-property examples', () => {
  for (const axisId of NICHE_AXIS_ORDER) {
    const terms = taxonomyTerms(axisId)
    assert.equal(new Set(terms).size, terms.length)
    assert.equal(terms.some((term) => term.includes('star wars')), false)
  }
})

test('rotates through every axis and returns to careers', () => {
  assert.equal(nextTaxonomyAxis('career'), 'hobby')
  assert.equal(nextTaxonomyAxis('relationship'), 'pet')
  assert.equal(nextTaxonomyAxis('buyer-context'), 'career')
  assert.equal(nextTaxonomyAxis('unknown'), 'career')
})

test('returns a copy so callers cannot mutate the shared taxonomy', () => {
  const terms = taxonomyTerms('career')
  terms.pop()

  assert.notEqual(terms.length, taxonomyTerms('career').length)
})
