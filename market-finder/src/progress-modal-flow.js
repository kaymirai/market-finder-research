function normalizeKeyword(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function completionModalBehavior({
  completed = false,
  failed = false,
  stopped = false,
  automationActive = false,
} = {}) {
  const successful = completed && !failed && !stopped
  return {
    buttonLabel: successful ? '閉じて次へ' : '閉じる',
    autoClose: successful && automationActive,
  }
}

export function startSingleKeywordEvidenceAutomation(keyword) {
  const normalizedKeyword = normalizeKeyword(keyword)
  return {
    active: Boolean(normalizedKeyword),
    scheduled: false,
    initialCount: normalizedKeyword ? 1 : 0,
    completedBatches: 0,
    currentStage: '',
    targetKeywords: normalizedKeyword ? [normalizedKeyword] : [],
  }
}

export function pendingAutomationToggleAction({
  automationActive = false,
  extensionActive = false,
  marketplaceActive = false,
  scheduled = false,
  orchestrationActive = false,
} = {}) {
  if (!automationActive) return 'start'
  return extensionActive || marketplaceActive || scheduled || orchestrationActive
    ? 'stop'
    : 'resume'
}

export function pendingEvidenceWinnerTargetReached({
  winnerCount = 0,
  targetWinnerCount = 5,
} = {}) {
  const target = Math.max(1, Math.floor(Number(targetWinnerCount) || 5))
  return Math.max(0, Math.floor(Number(winnerCount) || 0)) >= target
}

export function shouldAutoStartPendingEvidenceAutomation({
  flowMode = 'auto',
  actionablePendingCount = 0,
  winnerCount = 0,
  targetWinnerCount = 5,
  activeWork = false,
  restoredAwaiting = false,
  crossNichePending = false,
  blocked = false,
} = {}) {
  if (flowMode !== 'auto') return false
  if (Math.max(0, Number(actionablePendingCount) || 0) === 0) return false
  if (pendingEvidenceWinnerTargetReached({ winnerCount, targetWinnerCount })) return false
  return !activeWork && !restoredAwaiting && !crossNichePending && !blocked
}


export function resumePendingEvidenceAutomation(saved = {}, pendingKeywords = []) {
  const targetKeywords = [...new Set(
    pendingKeywords
      .map(normalizeKeyword)
      .filter(Boolean),
  )]
  return {
    active: targetKeywords.length > 0,
    scheduled: false,
    initialCount: Math.max(targetKeywords.length, Number(saved.initialCount) || 0),
    completedBatches: Math.max(0, Number(saved.completedBatches) || 0),
    currentStage: '',
    targetKeywords,
  }
}
