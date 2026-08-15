import assert from 'node:assert/strict'
import test from 'node:test'

import {
  RESULT_SUBVIEW_IDS,
  createResultSubviewUi,
  restoreResultSubviewUiFromPayload,
  selectResultSubview,
} from '../src/result-subview-ui.js'

test('defines the seven result destinations', () => {
  assert.deepEqual(RESULT_SUBVIEW_IDS, [
    'shortlist',
    'all-results',
    'failures',
    'video-slides',
    'profit',
    'erank',
    'exploration',
  ])
})

test('defaults invalid saved state to the production shortlist', () => {
  assert.deepEqual(createResultSubviewUi(), { activeView: 'shortlist' })
  assert.deepEqual(createResultSubviewUi({ activeView: 'unknown' }), { activeView: 'shortlist' })
})

test('selects and restores a valid result destination', () => {
  assert.deepEqual(selectResultSubview({ activeView: 'shortlist' }, 'profit'), { activeView: 'profit' })
  assert.deepEqual(
    restoreResultSubviewUiFromPayload({ resultSubviewUi: { activeView: 'failures' } }),
    { activeView: 'failures' },
  )
})

test('selects and restores the video slides destination', () => {
  assert.deepEqual(
    selectResultSubview({ activeView: 'shortlist' }, 'video-slides'),
    { activeView: 'video-slides' },
  )
  assert.deepEqual(
    restoreResultSubviewUiFromPayload({ resultSubviewUi: { activeView: 'video-slides' } }),
    { activeView: 'video-slides' },
  )
})

test('ignores an invalid result destination without losing the current view', () => {
  assert.deepEqual(
    selectResultSubview({ activeView: 'all-results' }, 'unknown'),
    { activeView: 'all-results' },
  )
})
