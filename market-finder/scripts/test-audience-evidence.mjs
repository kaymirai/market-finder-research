import assert from 'node:assert/strict'
import test from 'node:test'
import {
  analyzeAudienceEvidence,
  buildAudienceContextKey,
  extractAudienceRoleSignals,
  generateAudienceIntentCandidates,
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
  assert.deepEqual(
    extractAudienceRoleSignals('memorial pet ornament', { categoryId: 'ornament' })
      .map(({ phrase, role, subjectType }) => ({ phrase, role, subjectType })),
    [{ phrase: 'pet', role: 'subject', subjectType: 'pet' }],
  )
  assert.deepEqual(
    extractAudienceRoleSignals('memorial mom ornament', { categoryId: 'ornament' })
      .map(({ phrase, role, subjectType }) => ({ phrase, role, subjectType })),
    [{ phrase: 'mom', role: 'subject', subjectType: 'person' }],
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

test('confirms an audience only from current-context Etsy and selling EverBee evidence', () => {
  const context = { categoryId: 'mug', eventId: '', rootKeyword: 'teacher mug' }
  const analysis = analyzeAudienceEvidence([
    {
      runId: 'mug-1',
      capturedAt: '2026-08-27T00:00:00Z',
      categoryId: 'mug',
      eventId: '',
      rootKeyword: 'teacher mug',
      demandKeywords: [{ keyword: 'teacher mug', etsySearches30d: 1200 }],
      supplyListings: [{ title: 'Teacher Mug Gift', monthlySales: 8 }],
    },
  ], context, { now: '2026-08-27T12:00:00Z' })

  assert.equal(analysis.contextKey, buildAudienceContextKey(context))
  assert.deepEqual(
    analysis.signals.map(({ phrase, role, status, autoSelectable }) => ({ phrase, role, status, autoSelectable })),
    [{ phrase: 'teacher', role: 'recipient', status: 'confirmed', autoSelectable: true }],
  )
})

test('keeps one-source and different-theme audience evidence unselected', () => {
  const analysis = analyzeAudienceEvidence([
    {
      runId: 'teacher-ornament',
      capturedAt: '2026-08-27T00:00:00Z',
      categoryId: 'ornament',
      eventId: '',
      rootKeyword: 'teacher ornament',
      demandKeywords: [{ keyword: 'teacher ornament', etsySearches30d: 400 }],
      supplyListings: [],
    },
    {
      runId: 'shirt-history',
      capturedAt: '2026-08-27T00:00:00Z',
      categoryId: 'shirt',
      eventId: '',
      rootKeyword: 'mom shirt',
      demandKeywords: [{ keyword: 'mom shirt', etsySearches30d: 9000 }],
      supplyListings: [{ title: 'Mom Shirt', monthlySales: 20 }],
    },
  ], {
    categoryId: 'ornament',
    eventId: '',
    rootKeyword: 'memorial ornament',
  }, { now: '2026-08-27T12:00:00Z' })

  assert.deepEqual(
    analysis.signals.map(({ phrase, status, autoSelectable }) => ({ phrase, status, autoSelectable })),
    [{ phrase: 'teacher', status: 'reference', autoSelectable: false }],
  )
  assert.equal(analysis.signals.some((signal) => signal.phrase === 'mom'), false)
})

test('generates recipient giver and subject phrases without crossing their grammar', () => {
  const candidates = generateAudienceIntentCandidates({
    categoryId: 'ornament',
    baseKeywords: ['memorial ornament'],
    audienceSelections: [
      { phrase: 'pet', role: 'subject', subjectType: 'pet', status: 'confirmed' },
      { phrase: 'students', role: 'giver', subjectType: '', status: 'confirmed' },
    ],
    limit: 20,
  })
  const keywords = candidates.map((candidate) => candidate.keyword)

  assert.ok(keywords.includes('pet memorial ornament'))
  assert.equal(keywords.some((keyword) => keyword.includes('gift for pet memorial')), false)
  assert.equal(keywords.some((keyword) => keyword === 'students ornament'), false)
})

test('keeps theme discovery active when audience is empty', () => {
  assert.deepEqual(generateAudienceIntentCandidates({
    categoryId: 'wall-art',
    baseKeywords: ['landscape wall art'],
    audienceSelections: [],
  }), [])
})

test('uses confirmed and manual audience selections while keeping verify and reference visible only', () => {
  const candidates = generateAudienceIntentCandidates({
    categoryId: 'ornament',
    baseKeywords: ['memorial ornament'],
    audienceSelections: [
      { phrase: 'mom', role: 'subject', subjectType: 'person', status: 'confirmed', contextKey: 'ornament::::memorial ornament' },
      { phrase: 'daughter', role: 'giver', status: 'manual', contextKey: 'ornament::::memorial ornament' },
      { phrase: 'teacher', role: 'recipient', status: 'verify' },
      { phrase: 'pet', role: 'subject', subjectType: 'pet', status: 'reference' },
    ],
  })

  assert.ok(candidates.some((candidate) => candidate.keyword === 'mom memorial ornament'))
  assert.ok(candidates.some((candidate) => candidate.keyword === 'mom memorial ornament from daughter'))
  assert.equal(candidates.some((candidate) => candidate.keyword.includes('teacher')), false)
  assert.equal(candidates.some((candidate) => candidate.keyword.includes('pet')), false)
  assert.ok(candidates.every((candidate) => candidate.audienceStatus === 'confirmed' || candidate.audienceStatus === 'manual'))
  assert.ok(candidates.every((candidate) => candidate.audienceContextKey === 'ornament::::memorial ornament'))
})

test('reuses a recipient already present in the base phrase before attaching a confirmed giver', () => {
  const candidates = generateAudienceIntentCandidates({
    categoryId: 'ornament',
    baseKeywords: ['teacher ornament'],
    audienceSelections: [
      { phrase: 'teacher', role: 'recipient', status: 'confirmed' },
      { phrase: 'students', role: 'giver', status: 'confirmed' },
    ],
  })

  assert.ok(candidates.some((candidate) => candidate.keyword === 'teacher ornament'))
  assert.ok(candidates.some((candidate) => candidate.keyword === 'teacher ornament from students'))
})

test('does not count a static demand seed as audience evidence', () => {
  const analysis = analyzeAudienceEvidence([], {
    categoryId: 'ornament',
    eventId: '',
    rootKeyword: 'memorial ornament',
    staticSeedKeywords: ['memorial ornament'],
  }, { now: '2026-08-27T12:00:00Z' })
  assert.deepEqual(analysis.signals, [])
})

test('excludes configured static demand observations but keeps returned related terms', () => {
  const context = {
    categoryId: 'mug',
    eventId: '',
    rootKeyword: 'teacher mug',
    staticSeedKeywords: ['Teacher Mug'],
  }
  const onlyStaticSeed = analyzeAudienceEvidence([{
    runId: 'static-seed-only',
    capturedAt: '2026-08-27T00:00:00Z',
    categoryId: 'mug',
    eventId: '',
    rootKeyword: 'teacher mug',
    demandKeywords: [{ keyword: 'teacher mug', etsySearches30d: 1200 }],
    supplyListings: [],
  }], context, { now: '2026-08-27T12:00:00Z' })
  assert.deepEqual(onlyStaticSeed.signals, [])
  assert.equal(onlyStaticSeed.totals.etsyRelatedTermCount, 0)

  const returnedRelatedTerm = analyzeAudienceEvidence([{
    runId: 'returned-related-term',
    capturedAt: '2026-08-27T00:00:00Z',
    categoryId: 'mug',
    eventId: '',
    rootKeyword: 'teacher mug',
    demandKeywords: [{ keyword: 'teacher appreciation mug', etsySearches30d: 400 }],
    supplyListings: [],
  }], context, { now: '2026-08-27T12:00:00Z' })
  assert.deepEqual(
    returnedRelatedTerm.signals.map(({ phrase, status, evidence }) => ({ phrase, status, etsyRelatedTermCount: evidence.etsyRelatedTermCount })),
    [{ phrase: 'teacher', status: 'verify', etsyRelatedTermCount: 1 }],
  )
})

test('keeps exact-context Etsy-only evidence at verify', () => {
  const analysis = analyzeAudienceEvidence([{
    runId: 'etsy-only',
    capturedAt: '2026-08-27T00:00:00Z',
    categoryId: 'mug',
    eventId: '',
    rootKeyword: 'teacher mug',
    demandKeywords: [{ keyword: 'teacher mug', etsySearches30d: 1200 }],
    supplyListings: [],
  }], { categoryId: 'mug', eventId: '', rootKeyword: 'teacher mug' }, {
    now: '2026-08-27T12:00:00Z',
  })
  assert.deepEqual(
    analysis.signals.map(({ phrase, status, autoSelectable }) => ({ phrase, status, autoSelectable })),
    [{ phrase: 'teacher', status: 'verify', autoSelectable: false }],
  )
})

test('confirms repeated selling-title evidence without Etsy related terms', () => {
  const analysis = analyzeAudienceEvidence([{
    runId: 'everbee-two',
    capturedAt: '2026-08-27T00:00:00Z',
    categoryId: 'mug',
    eventId: '',
    rootKeyword: 'teacher mug',
    demandKeywords: [],
    supplyListings: [
      { title: 'Teacher Mug Gift', monthlySales: 8 },
      { title: 'Personalized Teacher Mug', monthlySales: 5 },
    ],
  }], { categoryId: 'mug', eventId: '', rootKeyword: 'teacher mug' }, {
    now: '2026-08-27T12:00:00Z',
  })
  assert.equal(analysis.signals[0].status, 'confirmed')
  assert.equal(analysis.signals[0].autoSelectable, true)
})

test('keeps repeated captures of one selling title at verify', () => {
  const analysis = analyzeAudienceEvidence([
    {
      runId: 'everbee-run-1',
      capturedAt: '2026-08-27T00:00:00Z',
      categoryId: 'mug',
      eventId: '',
      rootKeyword: 'teacher mug',
      demandKeywords: [],
      supplyListings: [{ title: 'Teacher Mug Gift', monthlySales: 8 }],
    },
    {
      runId: 'everbee-run-2',
      capturedAt: '2026-08-27T01:00:00Z',
      categoryId: 'mug',
      eventId: '',
      rootKeyword: 'teacher mug',
      demandKeywords: [],
      supplyListings: [{ title: 'Teacher Mug Gift', monthlySales: 8 }],
    },
  ], { categoryId: 'mug', eventId: '', rootKeyword: 'teacher mug' }, {
    now: '2026-08-27T12:00:00Z',
  })

  assert.deepEqual(
    analysis.signals.map(({ phrase, status, autoSelectable, evidence }) => ({
      phrase,
      status,
      autoSelectable,
      everbeeSellingListingCount: evidence.everbeeSellingListingCount,
      everbeeDistinctSellingTitleCount: evidence.everbeeDistinctSellingTitleCount,
      observationRuns: evidence.observationRuns,
    })),
    [{
      phrase: 'teacher',
      status: 'verify',
      autoSelectable: false,
      everbeeSellingListingCount: 2,
      everbeeDistinctSellingTitleCount: 1,
      observationRuns: 2,
    }],
  )
})

test('does not create a reference signal from a non-selling EverBee title', () => {
  const analysis = analyzeAudienceEvidence([{
    runId: 'everbee-no-sales',
    capturedAt: '2026-08-27T00:00:00Z',
    categoryId: 'mug',
    eventId: '',
    rootKeyword: 'teacher mug',
    demandKeywords: [],
    supplyListings: [{ title: 'Teacher Mug', monthlySales: 0 }],
  }], { categoryId: 'mug', eventId: '', rootKeyword: 'teacher mug' }, {
    now: '2026-08-27T12:00:00Z',
  })
  assert.deepEqual(analysis.signals, [])
})
