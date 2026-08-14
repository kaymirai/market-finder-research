import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')

test('provides a separate video slides sidebar destination and result panel', () => {
  assert.match(html, /data-result-subview="video-slides"/)
  assert.match(html, /data-result-view="video-slides"/)
})

test('provides the prompt generation, settings, output, copy, and download controls', () => {
  const requiredIds = [
    'videoSlideGenerateBtn',
    'videoSlidePromptTemplate',
    'videoSlideResetPromptBtn',
    'videoSlideCopyFullBtn',
    'videoSlideCopySlidesBtn',
    'videoSlideCopyNarrationBtn',
    'videoSlideDownloadBtn',
    'videoSlideTargetSummary',
    'videoSlideStatus',
    'videoSlideOutputTabs',
    'videoSlideFullPromptOutput',
    'videoSlidePromptsOutput',
    'videoSlideNarrationOutput',
  ]

  requiredIds.forEach((id) => assert.match(html, new RegExp(`id="${id}"`)))
})
