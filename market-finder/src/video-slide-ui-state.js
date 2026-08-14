const VIDEO_SLIDE_OUTPUT_VIEWS = new Set(['full', 'slides', 'narration'])

export function createVideoSlideUiState(saved = {}) {
  return {
    activeOutputView: VIDEO_SLIDE_OUTPUT_VIEWS.has(saved.activeOutputView)
      ? saved.activeOutputView
      : 'full',
  }
}

export function selectVideoSlideOutputView(ui = {}, activeOutputView = '') {
  return VIDEO_SLIDE_OUTPUT_VIEWS.has(activeOutputView)
    ? { ...ui, activeOutputView }
    : { ...ui }
}

export function normalizeVideoSlidePromptTemplate(value, fallback) {
  const prompt = String(value ?? '')
  return prompt.trim() ? prompt : String(fallback ?? '')
}

export function migrateVideoSlidePromptTemplate(value) {
  return String(value ?? '').replace(
    '- 商標・著作権リスクがある言葉を商品案やデザイン案に使用しない',
    [
      '- 候補キーワードは入力どおり表示する',
      '- IP・商標の要確認候補は除外せず、オレンジで「IP・商標 要確認」と明示する',
      '- 要確認候補に、保護対象を連想させる追加の固有名詞やキャラクター要素を足さない',
    ].join('\n'),
  )
}

export function formatVideoSlidePromptsForCopy(slides = []) {
  return (Array.isArray(slides) ? slides : [])
    .map((slide, index) => `${index + 1}. ${String(slide?.title ?? '').trim()}\n${String(slide?.prompt ?? '').trim()}`)
    .join('\n\n')
}

export function formatVideoSlideNarrationForCopy(narration = []) {
  return (Array.isArray(narration) ? narration : [])
    .map((note, index) => `${index + 1}. ${String(note?.title ?? '').trim()}\n${String(note?.text ?? '').trim()}`)
    .join('\n\n')
}
