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
