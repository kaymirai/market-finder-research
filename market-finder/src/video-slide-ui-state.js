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
  const ipMigrated = String(value ?? '').replace(
    '- 商標・著作権リスクがある言葉を商品案やデザイン案に使用しない',
    [
      '- 候補キーワードは入力どおり表示する',
      '- IP・商標の要確認候補は除外せず、オレンジで「IP・商標 要確認」と明示する',
      '- 要確認候補に、保護対象を連想させる追加の固有名詞やキャラクター要素を足さない',
    ].join('\n'),
  )
  const keywordFirstCandidateBlock = [
    '【候補別スライド】',
    '- キーワードを画面中央へ配置し、画面の70〜80％を使って120〜180ptで最大3行に収める',
    '- キーワードは入力どおりの綴りと語順で表示し、省略・言い換えをしない',
    '- 画面に残す補助情報はMarket Finder総合点とA/B評価だけとし、キーワードより十分小さく表示する',
    '- IP・商標が要確認の場合だけ、オレンジの注意表示を追加する',
    '- 理由、商品、購入者、使用場面、テーマ、デザイン要素、通常の注意点はスライドに置かず、発表者ノートへ移す',
    '- Etsy公式値、EverBee推定値、eRank値の細かな数値を並べない',
  ].join('\n')
  return ipMigrated
    .replace(
      /\n?- 最終：商品案を1つに絞る、Etsy上で最新状況を再確認する、1商品を出品して反応を記録する(?=\n|$)/,
      '',
    )
    .replace(
      /\n?最後のスライドに小さく「この調査結果は売上を保証するものではありません(?:。調査時点のデータを基に、商品化の優先順位を判断したものです)?」と記載してください。?(?=\n|$)/,
      '',
    )
    .replace(
      /【候補別スライド】[\s\S]*?(?=\n\n【動画用デザインルール】)/,
      keywordFirstCandidateBlock,
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
