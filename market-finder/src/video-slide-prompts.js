export const DEFAULT_VIDEO_SLIDE_PROMPT = `あなたは、Etsy・POD初心者向けYouTube動画のスライド制作者です。

以下のMarket Finder調査結果を使い、YouTube動画内で表示できる、16:9横型の解説スライドを作成してください。

【目的】
視聴者が「なぜ候補になったのか」「どんな商品に向いているのか」「何に注意すべきか」を短時間で理解できるようにします。売上を保証する表現は使わず、調査結果を商品候補の判断材料として伝えてください。

【対象視聴者】
Etsy・PODを使った副業に興味がある初心者。専門用語や英語の数値表を見慣れていない人。スマートフォンでYouTubeを見る人も想定します。

【入力データ】
{{MARKET_FINDER_RESULT}}

【基本構成】
- 表紙：調査テーマ、調査日、商品カテゴリー、Verification Status
- 全体結論：候補数、最上位キーワード、Market Finder総合点、商品化判断、最も重要な理由
- 候補別：A/B候補を総合点順で最大10件、1ワードにつき1枚。A/Bがない場合だけ上位Cを最大3件「試作検討候補」として扱う
- 最終：商品案を1つに絞る、Etsy上で最新状況を再確認する、1商品を出品して反応を記録する

【候補別スライド】
- キーワードを最も大きく表示する
- Market Finder総合点、Opportunity評価、Confidence、商品化判断を表示する
- 候補になった理由は最大3項目
- 向いている商品、想定購入者、使用場面を簡潔に表示する
- 安全に使用できるHero NounsやRelated Nounsは最大3件
- 競合、季節性、未確認データ、データの古さなどの注意点は最大2項目
- Etsy公式値、EverBee推定値、eRank値の細かな数値を並べない

【動画用デザインルール】
- 16:9、1920×1080
- メインタイトル54〜64pt、各タイトル40〜48pt、本文28〜34pt、注釈20pt以上
- 1枚につき1候補または1メッセージ。長文を置かず、箇条書きは1領域につき最大3項目
- 1行は日本語25文字前後。文字が多い場合は小さくせず文章を短くする
- 画面下部20％を字幕用に空け、左右7％以上の余白を設ける
- 背景は白または薄いグレー、文字は濃いネイビー、良い判断は青緑、注意点はオレンジ
- 色は3〜4色以内。小さな表、細かなグラフ、大量カードを使わない
- キャラクターや意味のない人物写真を使わない
- 商品画像が入力されていない場合、実在しない商品画像を作らない

【データの扱い】
- 入力にない数値や事実を作らない
- 取得できていない項目は「未確認」と表示するか省略する
- 「必ず売れる」「稼げる」「成功する」などの断定表現は禁止
- 「販売可能性を検証する候補」「調査時点で優先度が高い」などの表現を使う
- 調査日とVerification Statusを確認し、古いデータを最新情報のように見せない
- 候補キーワードは入力どおり表示する
- IP・商標の要確認候補は除外せず、オレンジで「IP・商標 要確認」と明示する
- 要確認候補に、保護対象を連想させる追加の固有名詞やキャラクター要素を足さない

【出力】
1. 完成した16:9スライド
2. 各スライドを動画編集で使えるPNG画像として書き出す
3. 可能であれば編集可能なスライドデータも残す
4. 各スライドに対応する短いナレーション案を、スライド上には表示せず発表者ノートとして作る

最後のスライドに小さく「この調査結果は売上を保証するものではありません。調査時点のデータを基に、商品化の優先順位を判断したものです」と記載してください。`

function text(value) {
  return String(value ?? '').trim()
}

function list(value, limit = Number.MAX_SAFE_INTEGER) {
  return (Array.isArray(value) ? value : [])
    .map(text)
    .filter(Boolean)
    .slice(0, limit)
}

function numericScore(row) {
  const score = Number(row?.scoreState?.score)
  return Number.isFinite(score) ? score : -1
}

function rowContext(row) {
  return {
    eventId: text(row?.raw?.researchEventId ?? row?.researchEventId),
    categoryId: text(row?.raw?.researchCategoryId ?? row?.researchCategoryId),
  }
}

function rowMatchesContext(row, context = {}) {
  const rowValue = rowContext(row)
  const eventId = text(context.eventId)
  const categoryId = text(context.categoryId)
  if (eventId && rowValue.eventId !== eventId) return false
  if (categoryId && rowValue.categoryId !== categoryId) return false
  return true
}

function ipRiskTermsForRow(row) {
  return list([
    ...(row?.score?.riskTerms ?? []),
    ...(row?.raw?.riskTerms ?? []),
    ...(row?.raw?.score?.riskTerms ?? []),
    ...(row?.normalized?.riskTerms ?? []),
    ...(row?.everbeeRow?.score?.riskTerms ?? []),
  ])
}

function isExplicitlyBlocked(row) {
  const decision = text(row?.everbeeRow?.productRoute?.decision ?? row?.raw?.productRoute?.decision).toLowerCase()
  return decision === 'do not use'
}

function latestIso(values = []) {
  return values
    .map(text)
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? ''
}

function checkedAtForRow(row) {
  return latestIso([
    row?.raw?.everbeeCheckedAt,
    row?.raw?.etsyCheckedAt,
    row?.raw?.erankCheckedAt,
    row?.raw?.checkedAt,
    row?.normalized?.everbeeCheckedAt,
  ])
}

export function selectVideoSlideCandidates(rows = [], context = {}) {
  const inContext = (Array.isArray(rows) ? rows : []).filter((row) => rowMatchesContext(row, context))
  const verified = inContext.filter((row) => (
    row?.evidenceState?.status === 'verified'
    && row?.queryEligibility?.eligible !== false
  ))
  const blockedCandidateCount = verified.filter(isExplicitlyBlocked).length
  const usable = verified.filter((row) => !isExplicitlyBlocked(row))
  const ab = usable.filter((row) => ['A', 'B'].includes(text(row.opportunityLabel).toUpperCase()))
  const mode = ab.length > 0 ? 'ab' : 'trial-c'
  const eligible = mode === 'ab'
    ? ab
    : usable.filter((row) => text(row.opportunityLabel).toUpperCase() === 'C')
  const limit = mode === 'ab' ? 10 : 3
  const candidates = [...eligible]
    .sort((left, right) => numericScore(right) - numericScore(left))
    .slice(0, limit)
  const ipReviewCount = candidates.filter((row) => ipRiskTermsForRow(row).length > 0).length
  return { mode, candidates, ipReviewCount, blockedCandidateCount }
}

function candidateCautions(row) {
  const cautions = []
  const confidence = text(row?.confidenceLabel)
  if (confidence && confidence.toLowerCase() !== 'high') cautions.push(`Confidenceは${confidence}`)
  const freshness = text(
    row?.raw?.sourceFreshness?.freshnessLabel
    ?? row?.raw?.freshnessLabel
    ?? row?.sourceFreshness?.freshnessLabel,
  ).toLowerCase()
  if (['expired', 'inspiration'].includes(freshness)) cautions.push('データが古い可能性あり')
  if (!checkedAtForRow(row)) cautions.push('確認日未確認')
  return cautions.slice(0, 2)
}

function snapshotCandidate(row, context) {
  const idea = row?.everbeeRow?.idea ?? row?.raw?.idea ?? {}
  const route = row?.everbeeRow?.productRoute ?? row?.raw?.productRoute ?? {}
  const brief = idea?.nounBrief ?? {}
  const reasons = list(row?.decisionReasons, 3)
  const ipRiskTerms = ipRiskTermsForRow(row)
  return {
    keyword: text(row.keyword),
    totalScore: numericScore(row) >= 0 ? numericScore(row) : null,
    opportunityLabel: text(row.opportunityLabel) || '未確認',
    confidenceLabel: text(row.confidenceLabel) || '未確認',
    productDecision: text(route.decision) || '未確認',
    verifiedAt: checkedAtForRow(row),
    reasons,
    productCategory: text(route?.primary?.label ?? context.categoryLabel) || '未確認',
    buyer: text(idea.target),
    occasion: text(idea.occasion ?? row?.raw?.occasion),
    theme: text(idea.theme),
    heroNouns: list(brief.heroNouns, 3),
    relatedNouns: list(brief.relatedNouns, 3),
    ipReviewRequired: ipRiskTerms.length > 0,
    ipRiskTerms,
    cautions: candidateCautions(row),
  }
}

export function buildVideoSlideSnapshot({ rows = [], context = {}, generatedAt = new Date().toISOString() } = {}) {
  const selection = selectVideoSlideCandidates(rows, context)
  const candidates = selection.candidates.map((row) => snapshotCandidate(row, context))
  const latestVerifiedAt = latestIso(candidates.map((candidate) => candidate.verifiedAt))
  return {
    generatedAt: text(generatedAt),
    context: {
      eventId: text(context.eventId),
      eventLabel: text(context.eventLabel ?? context.event?.jpLabel ?? context.event?.label),
      categoryId: text(context.categoryId),
      categoryLabel: text(context.categoryLabel ?? context.category?.label),
      latestVerifiedAt,
      verificationStatus: candidates.length > 0 ? '検証済み' : '検証済み候補なし',
    },
    candidateMode: selection.mode,
    ipReviewCount: selection.ipReviewCount,
    blockedCandidateCount: selection.blockedCandidateCount,
    candidates,
  }
}

function display(value, fallback = '未確認') {
  const normalized = text(value)
  return normalized || fallback
}

function compactLines(title, values = []) {
  const items = list(values)
  if (items.length === 0) return `${title}: 未確認`
  return `${title}: ${items.join(' / ')}`
}

function snapshotText(snapshot) {
  const modeLabel = snapshot.candidateMode === 'ab' ? 'A/B候補' : '試作検討候補'
  const candidates = snapshot.candidates.map((candidate, index) => [
    `候補${index + 1}: ${candidate.keyword}`,
    `総合点: ${candidate.totalScore ?? '未確認'}`,
    `Opportunity: ${candidate.opportunityLabel}`,
    `Confidence: ${candidate.confidenceLabel}`,
    `商品化判断: ${candidate.productDecision}`,
    compactLines('理由', candidate.reasons),
    `商品: ${display(candidate.productCategory)}`,
    `購入者: ${display(candidate.buyer)}`,
    `使用場面: ${display(candidate.occasion)}`,
    `テーマ: ${display(candidate.theme)}`,
    compactLines('Hero Nouns', candidate.heroNouns),
    compactLines('Related Nouns', candidate.relatedNouns),
    `IP・商標: ${candidate.ipReviewRequired ? '要確認' : '大きな警告なし'}`,
    ...(candidate.ipReviewRequired ? [compactLines('要確認語', candidate.ipRiskTerms)] : []),
    compactLines('注意点', candidate.cautions),
    `確認日: ${display(candidate.verifiedAt)}`,
  ].join('\n')).join('\n\n')
  return [
    '【Market Finder調査結果】',
    `テーマ: ${display(snapshot.context.eventLabel || snapshot.context.eventId)}`,
    `商品カテゴリー: ${display(snapshot.context.categoryLabel || snapshot.context.categoryId)}`,
    `最新確認日: ${display(snapshot.context.latestVerifiedAt)}`,
    `Verification Status: ${snapshot.context.verificationStatus}`,
    `候補区分: ${modeLabel}`,
    `候補数: ${snapshot.candidates.length}`,
    `IP・商標の要確認候補: ${snapshot.ipReviewCount}件`,
    `商品化判断「Do not use」による除外: ${snapshot.blockedCandidateCount}件`,
    '',
    candidates || '候補なし',
  ].join('\n')
}

function sharedSlideRules() {
  return [
    '16:9、1920×1080のYouTube解説スライドを1枚作成。',
    '背景は白または薄いグレー、文字は濃いネイビー、良い判断は青緑、注意点はオレンジ。',
    'スマートフォンで読める大きな文字を使い、画面下部20％は字幕用に空ける。',
    '入力にない数値、事実、商品画像、人物を追加しない。',
    '指定した日本語と英語を正確に表示する。',
  ].join('\n')
}

function candidateSlidePrompt(candidate, index, mode) {
  const nouns = [...candidate.heroNouns, ...candidate.relatedNouns].slice(0, 3)
  return [
    sharedSlideRules(),
    '',
    `候補別スライド ${index + 1}。1ワードだけを扱う。`,
    `区分: ${mode === 'ab' ? '販売可能性を検証するA/B候補' : '試作検討候補'}`,
    `大見出し: ${candidate.keyword}`,
    '候補キーワードは省略・言い換えをせず、入力どおりに大きく表示する。',
    `総合点: ${candidate.totalScore ?? '未確認'}`,
    `Opportunity: ${candidate.opportunityLabel}`,
    `Confidence: ${candidate.confidenceLabel}`,
    `商品化判断: ${candidate.productDecision}`,
    compactLines('候補になった理由', candidate.reasons),
    `向いている商品: ${display(candidate.productCategory)}`,
    `想定購入者: ${display(candidate.buyer)}`,
    `使用場面: ${display(candidate.occasion)}`,
    `商品テーマ: ${display(candidate.theme)}`,
    compactLines('デザイン要素', nouns),
    `IP・商標: ${candidate.ipReviewRequired ? '要確認。オレンジの注意表示を付ける' : '大きな警告なし'}`,
    ...(candidate.ipReviewRequired ? [compactLines('要確認語', candidate.ipRiskTerms)] : []),
    compactLines('注意点', candidate.cautions),
    '細かな数値表や実在しない商品画像は使わない。',
  ].join('\n')
}

function narrationForCandidate(candidate, mode) {
  const modeText = mode === 'ab' ? 'A/B候補' : '試作検討候補'
  const reason = candidate.reasons[0] || '検証済みデータを基に総合評価しました'
  const ipNote = candidate.ipReviewRequired ? 'IP・商標の要確認候補なので、出品前に最新状況を確認します。' : ''
  return `${candidate.keyword}は、今回の${modeText}です。総合点は${candidate.totalScore ?? '未確認'}点で、${reason}。${ipNote}売上を保証するものではないため、最新状況を確認して小さくテストします。`
}

function fingerprint(value) {
  const source = JSON.stringify(value)
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function videoSlideSnapshotFingerprint(snapshot = {}) {
  return fingerprint({ ...snapshot, generatedAt: '' })
}

export function buildVideoSlideOutputs(snapshot, template = DEFAULT_VIDEO_SLIDE_PROMPT) {
  const safeTemplate = text(template) || DEFAULT_VIDEO_SLIDE_PROMPT
  const resultBlock = snapshotText(snapshot)
  const fullPrompt = safeTemplate.includes('{{MARKET_FINDER_RESULT}}')
    ? safeTemplate.replace('{{MARKET_FINDER_RESULT}}', resultBlock)
    : `${safeTemplate}\n\n${resultBlock}`
  const top = snapshot.candidates[0]
  const modeLabel = snapshot.candidateMode === 'ab' ? 'A/B候補' : '試作検討候補'
  const slides = [
    {
      id: 'cover',
      title: '今回調べたテーマ',
      keyword: '',
      prompt: [
        sharedSlideRules(),
        '',
        `表紙。大見出し: ${display(snapshot.context.eventLabel || snapshot.context.eventId)}ニッチをMarket Finderで調査`,
        `調査日: ${display(snapshot.context.latestVerifiedAt)}`,
        `商品カテゴリー: ${display(snapshot.context.categoryLabel || snapshot.context.categoryId)}`,
        `Verification Status: ${snapshot.context.verificationStatus}`,
      ].join('\n'),
    },
    {
      id: 'conclusion',
      title: '全体の結論',
      keyword: top?.keyword ?? '',
      prompt: [
        sharedSlideRules(),
        '',
        '全体結論のスライド。',
        `${modeLabel}: ${snapshot.candidates.length}件`,
        `最上位キーワード: ${display(top?.keyword)}`,
        `総合点: ${top?.totalScore ?? '未確認'}`,
        `商品化判断: ${display(top?.productDecision)}`,
        `重要な理由: ${display(top?.reasons?.[0])}`,
      ].join('\n'),
    },
    ...snapshot.candidates.map((candidate, index) => ({
      id: `candidate-${index + 1}`,
      title: candidate.keyword,
      keyword: candidate.keyword,
      prompt: candidateSlidePrompt(candidate, index, snapshot.candidateMode),
    })),
    {
      id: 'next-actions',
      title: '次にやること',
      keyword: '',
      prompt: [
        sharedSlideRules(),
        '',
        '最後のスライド。次の行動を3段階で大きく表示する。',
        '1. 商品案を1つに絞る',
        '2. Etsy上で最新状況を再確認する',
        '3. 1商品を出品して反応を記録する',
        '画面下部の字幕余白より上に、小さく次の注意書きを表示する。',
        'この調査結果は売上を保証するものではありません。調査時点のデータを基に、商品化の優先順位を判断したものです',
      ].join('\n'),
    },
  ]
  const narration = [
    {
      slideId: 'cover',
      title: '今回調べたテーマ',
      text: `今回は、${display(snapshot.context.eventLabel || snapshot.context.eventId)}ニッチをMarket Finderで調べました。確認日は${display(snapshot.context.latestVerifiedAt)}です。`,
    },
    {
      slideId: 'conclusion',
      title: '全体の結論',
      text: `${modeLabel}は${snapshot.candidates.length}件です。最上位は${display(top?.keyword)}で、総合点は${top?.totalScore ?? '未確認'}点でした。`,
    },
    ...snapshot.candidates.map((candidate, index) => ({
      slideId: `candidate-${index + 1}`,
      title: candidate.keyword,
      text: narrationForCandidate(candidate, snapshot.candidateMode),
    })),
    {
      slideId: 'next-actions',
      title: '次にやること',
      text: '次は商品案を1つに絞り、Etsyの最新状況を確認してから、1商品だけ出品して反応を記録します。結果は売上を保証するものではありません。',
    },
  ]
  return {
    snapshot,
    fullPrompt,
    slides,
    narration,
    snapshotFingerprint: videoSlideSnapshotFingerprint(snapshot),
  }
}

export function buildVideoSlideMarkdown(outputs = {}) {
  const snapshot = outputs.snapshot ?? { context: {}, candidates: [] }
  const slides = Array.isArray(outputs.slides) ? outputs.slides : []
  const narration = Array.isArray(outputs.narration) ? outputs.narration : []
  return [
    '# Market Finder YouTubeスライド生成パッケージ',
    '',
    `- テーマ: ${display(snapshot.context.eventLabel || snapshot.context.eventId)}`,
    `- 商品カテゴリー: ${display(snapshot.context.categoryLabel || snapshot.context.categoryId)}`,
    `- 最新確認日: ${display(snapshot.context.latestVerifiedAt)}`,
    `- 候補数: ${snapshot.candidates.length}`,
    '',
    '## 全体プロンプト',
    '',
    '```text',
    text(outputs.fullPrompt),
    '```',
    '',
    '## スライド別プロンプト',
    '',
    ...slides.flatMap((slide, index) => [
      `### ${index + 1}. ${slide.title}`,
      '',
      '```text',
      slide.prompt,
      '```',
      '',
    ]),
    '## ナレーション案',
    '',
    ...narration.flatMap((note, index) => [
      `### ${index + 1}. ${note.title}`,
      '',
      note.text,
      '',
    ]),
    '---',
    '',
    'この調査結果は売上を保証するものではありません。調査時点のデータを基に、商品化の優先順位を判断したものです。',
    '',
  ].join('\n')
}

function slug(value, fallback) {
  const normalized = text(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

export function videoSlideFilename(snapshot = {}) {
  const date = text(snapshot.generatedAt).slice(0, 10) || new Date().toISOString().slice(0, 10)
  const category = slug(snapshot?.context?.categoryId ?? snapshot?.context?.categoryLabel, 'category')
  const event = slug(snapshot?.context?.eventId ?? snapshot?.context?.eventLabel, 'research')
  return `market-finder-video-slides-${category}-${event}-${date}.md`
}
