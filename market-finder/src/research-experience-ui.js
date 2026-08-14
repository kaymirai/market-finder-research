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
