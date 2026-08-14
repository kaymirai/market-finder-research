export const RESULT_SUBVIEW_IDS = Object.freeze([
  'shortlist',
  'all-results',
  'failures',
  'video-slides',
  'profit',
  'erank',
  'exploration',
])

export function createResultSubviewUi(saved = {}) {
  return {
    activeView: RESULT_SUBVIEW_IDS.includes(saved.activeView) ? saved.activeView : 'shortlist',
  }
}

export function selectResultSubview(ui, activeView) {
  return RESULT_SUBVIEW_IDS.includes(activeView)
    ? { ...ui, activeView }
    : { ...ui }
}

export function restoreResultSubviewUiFromPayload(savedState = {}) {
  return createResultSubviewUi(savedState.resultSubviewUi)
}
