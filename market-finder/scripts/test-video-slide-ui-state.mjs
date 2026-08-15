import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createVideoSlideUiState,
  formatVideoSlideNarrationForCopy,
  formatVideoSlidePromptsForCopy,
  migrateVideoSlidePromptTemplate,
  normalizeVideoSlidePromptTemplate,
  selectVideoSlideOutputView,
} from '../src/video-slide-ui-state.js'

test('defaults the video slide output to the full prompt view', () => {
  assert.deepEqual(createVideoSlideUiState(), { activeOutputView: 'full' })
})

test('selects only a supported output view', () => {
  assert.deepEqual(selectVideoSlideOutputView({ activeOutputView: 'full' }, 'slides'), {
    activeOutputView: 'slides',
  })
  assert.deepEqual(selectVideoSlideOutputView({ activeOutputView: 'slides' }, 'unknown'), {
    activeOutputView: 'slides',
  })
})

test('restores the default prompt only for empty saved input', () => {
  assert.equal(normalizeVideoSlidePromptTemplate('  custom prompt  ', 'default'), '  custom prompt  ')
  assert.equal(normalizeVideoSlidePromptTemplate('   ', 'default'), 'default')
})

test('migrates only the legacy IP exclusion rule while preserving prompt edits', () => {
  const saved = [
    'CUSTOM INTRO',
    '- 商標・著作権リスクがある言葉を商品案やデザイン案に使用しない',
    'CUSTOM END',
  ].join('\n')

  assert.equal(migrateVideoSlidePromptTemplate(saved), [
    'CUSTOM INTRO',
    '- 候補キーワードは入力どおり表示する',
    '- IP・商標の要確認候補は除外せず、オレンジで「IP・商標 要確認」と明示する',
    '- 要確認候補に、保護対象を連想させる追加の固有名詞やキャラクター要素を足さない',
    'CUSTOM END',
  ].join('\n'))
})

test('migrates the legacy candidate block to keyword-first slides while preserving surrounding edits', () => {
  const saved = [
    'CUSTOM INTRO',
    '【基本構成】',
    '- 表紙：調査テーマ',
    '- 最終：商品案を1つに絞る、Etsy上で最新状況を再確認する、1商品を出品して反応を記録する',
    '',
    '【候補別スライド】',
    '- キーワードを最も大きく表示する',
    '- Market Finder総合点、Opportunity評価、Confidence、商品化判断を表示する',
    '- 向いている商品、想定購入者、使用場面を簡潔に表示する',
    '- 安全に使用できるHero NounsやRelated Nounsは最大3件',
    '',
    '【動画用デザインルール】',
    'CUSTOM END',
    '最後のスライドに小さく「この調査結果は売上を保証するものではありません」と記載してください。',
  ].join('\n')

  const migrated = migrateVideoSlidePromptTemplate(saved)

  assert.match(migrated, /CUSTOM INTRO/)
  assert.match(migrated, /画面の70〜80％/)
  assert.match(migrated, /120〜180pt/)
  assert.match(migrated, /最大3行/)
  assert.doesNotMatch(migrated, /- 最終：商品案を1つに絞る/)
  assert.doesNotMatch(migrated, /想定購入者、使用場面/)
  assert.doesNotMatch(migrated, /最後のスライドに小さく/)
  assert.match(migrated, /CUSTOM END/)
})

test('formats all slide prompts as numbered copyable sections', () => {
  assert.equal(formatVideoSlidePromptsForCopy([
    { title: '表紙', prompt: 'cover prompt' },
    { title: '候補', prompt: 'candidate prompt' },
  ]), '1. 表紙\ncover prompt\n\n2. 候補\ncandidate prompt')
})

test('formats narration as numbered speaker notes', () => {
  assert.equal(formatVideoSlideNarrationForCopy([
    { title: '表紙', text: 'cover note' },
    { title: '候補', text: 'candidate note' },
  ]), '1. 表紙\ncover note\n\n2. 候補\ncandidate note')
})
