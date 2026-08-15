import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_VIDEO_SLIDE_PROMPT,
  buildVideoSlideMarkdown,
  buildVideoSlideOutputs,
  buildVideoSlideSnapshot,
  selectVideoSlideCandidates,
  videoSlideFilename,
} from '../src/video-slide-prompts.js'

const CONTEXT = {
  eventId: 'halloween',
  eventLabel: 'ハロウィン',
  categoryId: 'shirt',
  categoryLabel: 'シャツ',
}

function makeRow(keyword, score, opportunityLabel, overrides = {}) {
  const riskTerms = overrides.riskTerms ?? []
  return {
    keyword,
    evidenceState: { status: overrides.status ?? 'verified' },
    scoreState: { score, type: 'overall' },
    opportunityLabel,
    queryEligibility: overrides.queryEligibility ?? { eligible: true },
    confidenceLabel: overrides.confidenceLabel ?? 'High',
    decisionReasons: overrides.decisionReasons ?? ['需要と販売実績を確認'],
    raw: {
      researchEventId: overrides.eventId ?? 'halloween',
      researchCategoryId: overrides.categoryId ?? 'shirt',
      everbeeCheckedAt: overrides.checkedAt ?? '2026-08-12T12:00:00.000Z',
      etsySearches30d: 99999,
      erankSearchVolume: 88888,
    },
    normalized: {
      keyword,
      medianMonthlySales: 77777,
      revenue: 66666,
    },
    everbeeRow: {
      score: { riskTerms },
      productRoute: {
        decision: overrides.productDecision ?? 'Test',
        primary: { label: overrides.productLabel ?? 'Tシャツ' },
      },
      idea: {
        target: overrides.target ?? '教師へのギフトを探す人',
        theme: overrides.theme ?? '季節の職業ギフト',
        nounBrief: {
          heroNouns: overrides.heroNouns ?? ['ghost', 'apple'],
          relatedNouns: overrides.relatedNouns ?? ['pencil'],
          unsafeNouns: overrides.unsafeNouns ?? [],
        },
      },
    },
  }
}

test('selects the ten highest verified safe A/B rows and never mixes C', () => {
  const rows = [
    makeRow('c-only', 100, 'C'),
    ...Array.from({ length: 11 }, (_, index) => makeRow(`ab-${index}`, index, index % 2 ? 'A' : 'B')),
  ]

  const result = selectVideoSlideCandidates(rows, CONTEXT)

  assert.equal(result.mode, 'ab')
  assert.deepEqual(result.candidates.map((row) => row.keyword), [
    'ab-10', 'ab-9', 'ab-8', 'ab-7', 'ab-6', 'ab-5', 'ab-4', 'ab-3', 'ab-2', 'ab-1',
  ])
})

test('does not reject an A/B candidate because its design noun brief contains unsafe nouns', () => {
  const result = selectVideoSlideCandidates([
    makeRow('halloween running shirt', 78, 'B', { unsafeNouns: ['pumpkin face'] }),
  ], CONTEXT)

  assert.equal(result.mode, 'ab')
  assert.deepEqual(result.candidates.map((row) => row.keyword), ['halloween running shirt'])
  assert.equal(result.ipReviewCount, 0)
  assert.equal(result.blockedCandidateCount, 0)
})

test('excludes title-like historical evidence from slide candidates', () => {
  const result = selectVideoSlideCandidates([
    makeRow('halloween running shirt', 78, 'B'),
    makeRow('seven word listing title that should not become shirt', 99, 'A', {
      queryEligibility: { eligible: false, status: 'title-like' },
    }),
  ], CONTEXT)

  assert.deepEqual(result.candidates.map((row) => row.keyword), ['halloween running shirt'])
})

test('keeps risk-term A/B candidates visible for IP review', () => {
  const snapshot = buildVideoSlideSnapshot({
    rows: [makeRow('possible trademark shirt', 74, 'B', { riskTerms: ['possible trademark'] })],
    context: CONTEXT,
    generatedAt: '2026-08-13T00:00:00.000Z',
  })

  assert.equal(snapshot.candidates.length, 1)
  assert.equal(snapshot.ipReviewCount, 1)
  assert.equal(snapshot.candidates[0].ipReviewRequired, true)
  assert.deepEqual(snapshot.candidates[0].ipRiskTerms, ['possible trademark'])

  const outputs = buildVideoSlideOutputs(snapshot, DEFAULT_VIDEO_SLIDE_PROMPT)
  assert.match(outputs.slides[2].prompt, /IP・商標: 要確認/)
  assert.match(outputs.slides[2].prompt, /possible trademark shirt/)
})

test('uses at most three verified C rows only when every A/B row is explicitly blocked', () => {
  const result = selectVideoSlideCandidates([
    makeRow('blocked-a', 100, 'A', { productDecision: 'Do not use' }),
    makeRow('c-1', 90, 'C'),
    makeRow('c-2', 80, 'C'),
    makeRow('c-3', 70, 'C'),
    makeRow('c-4', 60, 'C'),
  ], CONTEXT)

  assert.equal(result.mode, 'trial-c')
  assert.deepEqual(result.candidates.map((row) => row.keyword), ['c-1', 'c-2', 'c-3'])
  assert.equal(result.ipReviewCount, 0)
  assert.equal(result.blockedCandidateCount, 1)
})

test('ignores unverified rows and rows from another research context', () => {
  const contextless = makeRow('contextless-a', 97, 'A')
  delete contextless.raw.researchEventId
  delete contextless.raw.researchCategoryId
  const result = selectVideoSlideCandidates([
    makeRow('pending-a', 100, 'A', { status: 'pending' }),
    makeRow('christmas-a', 99, 'A', { eventId: 'christmas' }),
    makeRow('mug-a', 98, 'A', { categoryId: 'mug' }),
    contextless,
    makeRow('current-b', 70, 'B'),
  ], CONTEXT)

  assert.deepEqual(result.candidates.map((row) => row.keyword), ['current-b'])
})

test('builds a safe snapshot without detailed Etsy, EverBee, or eRank metrics', () => {
  const snapshot = buildVideoSlideSnapshot({
    rows: [makeRow('teacher ghost shirt', 82, 'A')],
    context: CONTEXT,
    generatedAt: '2026-08-13T00:00:00.000Z',
  })
  const serialized = JSON.stringify(snapshot)

  assert.equal(snapshot.candidates[0].totalScore, 82)
  assert.equal(snapshot.candidates[0].buyer, '教師へのギフトを探す人')
  assert.equal(snapshot.context.latestVerifiedAt, '2026-08-12T12:00:00.000Z')
  assert.doesNotMatch(serialized, /etsySearches30d|medianMonthlySales|erankSearchVolume|revenue/)
  assert.doesNotMatch(serialized, /99999|88888|77777|66666/)
})

test('creates keyword-first candidate slides without a final next-actions slide', () => {
  const snapshot = buildVideoSlideSnapshot({
    rows: [makeRow('teacher ghost shirt', 82, 'A')],
    context: CONTEXT,
    generatedAt: '2026-08-13T00:00:00.000Z',
  })

  const outputs = buildVideoSlideOutputs(snapshot, 'INPUT\n{{MARKET_FINDER_RESULT}}')
  const defaultOutputs = buildVideoSlideOutputs(snapshot, DEFAULT_VIDEO_SLIDE_PROMPT)

  assert.equal(outputs.slides.length, 3)
  assert.deepEqual(outputs.slides.map((slide) => slide.id), [
    'cover', 'conclusion', 'candidate-1',
  ])
  const candidatePrompt = outputs.slides[2].prompt
  assert.match(candidatePrompt, /teacher ghost shirt/)
  assert.match(candidatePrompt, /画面の70〜80％/)
  assert.match(candidatePrompt, /120〜180pt/)
  assert.match(candidatePrompt, /最大3行/)
  assert.match(candidatePrompt, /中央/)
  assert.match(candidatePrompt, /総合点: 82/)
  assert.match(candidatePrompt, /A\/B評価: A/)
  assert.doesNotMatch(
    candidatePrompt,
    /候補になった理由:|向いている商品:|想定購入者:|使用場面:|商品テーマ:|デザイン要素:|注意点:/,
  )
  assert.equal(outputs.narration.length, outputs.slides.length)
  assert.match(outputs.fullPrompt, /INPUT/)
  assert.match(outputs.fullPrompt, /teacher ghost shirt/)
  assert.doesNotMatch(defaultOutputs.fullPrompt, /最後のスライドに小さく/)
  assert.doesNotMatch(outputs.fullPrompt, /\{\{MARKET_FINDER_RESULT\}\}/)
})

test('appends result data when the editable placeholder was removed', () => {
  const snapshot = buildVideoSlideSnapshot({
    rows: [makeRow('teacher ghost shirt', 82, 'A')],
    context: CONTEXT,
  })

  const outputs = buildVideoSlideOutputs(snapshot, 'CUSTOM PROMPT')

  assert.match(outputs.fullPrompt, /CUSTOM PROMPT[\s\S]*Market Finder調査結果/)
})

test('keeps the source fingerprint stable when only generation time changes', () => {
  const first = buildVideoSlideSnapshot({
    rows: [makeRow('teacher ghost shirt', 82, 'A')],
    context: CONTEXT,
    generatedAt: '2026-08-13T00:00:00.000Z',
  })
  const second = buildVideoSlideSnapshot({
    rows: [makeRow('teacher ghost shirt', 82, 'A')],
    context: CONTEXT,
    generatedAt: '2026-08-13T01:00:00.000Z',
  })

  assert.equal(
    buildVideoSlideOutputs(first, DEFAULT_VIDEO_SLIDE_PROMPT).snapshotFingerprint,
    buildVideoSlideOutputs(second, DEFAULT_VIDEO_SLIDE_PROMPT).snapshotFingerprint,
  )
})

test('keeps detailed marketplace metrics out of every generated output', () => {
  const snapshot = buildVideoSlideSnapshot({
    rows: [makeRow('teacher ghost shirt', 82, 'A')],
    context: CONTEXT,
  })
  const text = JSON.stringify(buildVideoSlideOutputs(snapshot, DEFAULT_VIDEO_SLIDE_PROMPT))

  assert.doesNotMatch(text, /etsySearches30d|medianMonthlySales|erankSearchVolume|revenue/)
  assert.doesNotMatch(text, /99999|88888|77777|66666/)
})

test('builds a portable Markdown package and a filesystem-safe filename', () => {
  const snapshot = buildVideoSlideSnapshot({
    rows: [makeRow('teacher ghost shirt', 82, 'A')],
    context: { ...CONTEXT, eventId: 'Halloween / 2026' },
    generatedAt: '2026-08-13T00:00:00.000Z',
  })
  const outputs = buildVideoSlideOutputs(snapshot, DEFAULT_VIDEO_SLIDE_PROMPT)
  const markdown = buildVideoSlideMarkdown(outputs)

  assert.match(markdown, /# Market Finder YouTubeスライド生成パッケージ/)
  assert.match(markdown, /## スライド別プロンプト/)
  assert.match(markdown, /## ナレーション案/)
  assert.equal(videoSlideFilename(snapshot), 'market-finder-video-slides-shirt-halloween-2026-2026-08-13.md')
})
