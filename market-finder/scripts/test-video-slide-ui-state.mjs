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
