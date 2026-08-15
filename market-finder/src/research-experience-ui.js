export const RESEARCH_EXPERIENCE_PHASES = Object.freeze(['setup', 'running', 'result'])

const RESEARCH_STAGE_IDS = new Set(['conditions', 'candidates', 'etsy', 'everbee', 'results'])
const TERMINAL_DECISION_STATUSES = new Set(['ready', 'none', 'retry'])

function nonNegativeInteger(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0
}

function normalizedStage(value, fallback = 'conditions') {
  const stage = String(value ?? '')
  return RESEARCH_STAGE_IDS.has(stage) ? stage : fallback
}

export function researchPauseRecovery(value = '') {
  const reason = String(value ?? '').trim().toLowerCase()
  if (reason === 'login-required') {
    return {
      actionLabel: 'EverBeeにログイン後、探索を再開',
      reason: 'EverBeeのログインが切れています。開いているEverBee SSOタブでログインしてから、このボタンを押してください。',
    }
  }
  return { actionLabel: '', reason: '' }
}

export function deriveResearchActionFeedback(input = {}) {
  if (String(input.actionPending ?? '').trim()) {
    return {
      mode: 'starting',
      buttonAction: 'pending',
      buttonLabel: '探索を開始しています…',
      buttonDisabled: true,
      headline: '開始処理中',
      detail: 'ブラウザ接続と未調査候補を確認しています。',
    }
  }
  if (input.isRunning) {
    return {
      mode: 'running',
      buttonAction: 'stop-active',
      buttonLabel: '調査を停止（稼働中）',
      buttonDisabled: false,
      headline: '調査中',
      detail: '調査は動いています。進捗件数が順番に更新されます。',
    }
  }
  return null
}

export function researchAutomationIdleReason(status = '') {
  if (status === 'exhausted') {
    return '現在は停止中です。今回の未調査候補は確認済みです。押すと条件を広げて再探索します。'
  }
  if (status === 'stopped') return '現在は停止中です。押すと続きから再開します。'
  if (status === 'paused') return '現在は一時停止中です。押すと続きから再開します。'
  return ''
}

export function deriveResearchExperienceUi(input = {}) {
  const decisionStatus = String(input.decisionStatus ?? 'empty')
  const isRunning = Boolean(input.isRunning) || decisionStatus === 'pending'
  const hasTerminalResult = Boolean(input.hasResearchRows) && TERMINAL_DECISION_STATUSES.has(decisionStatus)
  const phase = isRunning ? 'running' : hasTerminalResult ? 'result' : 'setup'
  const stage = phase === 'result'
    ? 'results'
    : normalizedStage(input.activeStage, phase === 'running' ? 'conditions' : 'conditions')
  const targetWinnerCount = nonNegativeInteger(input.targetWinnerCount)
  const winnerCount = nonNegativeInteger(input.winnerCount)

  return {
    phase,
    stage,
    headline: phase === 'setup' ? '調査を始める' : phase === 'running' ? '調査中' : '最終結果',
    description: String(input.description ?? ''),
    action: String(input.action ?? ''),
    targetLabel: `A/B候補 ${winnerCount} / ${targetWinnerCount}件`,
  }
}
