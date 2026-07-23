const PENDING_STAGE_LABELS = Object.freeze({
  'pending-erank': 'eRankを確認',
  'pending-etsy': 'Etsy公式を確認',
  'pending-everbee': 'EverBeeを確認',
})

function normalizedStage(value) {
  const stage = String(value ?? '').trim()
  return Object.hasOwn(PENDING_STAGE_LABELS, stage) ? stage : ''
}

function finiteNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function deriveFinalEvidenceState(input = {}) {
  if (input.excluded) {
    return {
      status: 'excluded',
      label: '除外',
      nextStage: '',
      actionLabel: '',
      terminal: true,
    }
  }

  const erankStatus = String(input.erankStatus ?? '').trim().toLowerCase()
  if (erankStatus === 'failed' || input.failed) {
    const nextStage = normalizedStage(input.failureStage) || 'pending-erank'
    return {
      status: 'failed',
      label: '取得失敗',
      nextStage,
      actionLabel: '再試行',
      terminal: true,
    }
  }

  const nextStage = normalizedStage(input.nextStage)
  if (nextStage) {
    return {
      status: 'pending',
      label: '検証待ち',
      nextStage,
      actionLabel: PENDING_STAGE_LABELS[nextStage],
      terminal: false,
    }
  }

  if (['no-data', 'unknown'].includes(erankStatus)) {
    return {
      status: 'hold',
      label: '需要Unknown・保留',
      nextStage: '',
      actionLabel: '',
      terminal: true,
    }
  }

  if (input.hasEverbeeData || input.verified) {
    return {
      status: 'verified',
      label: '検証済み',
      nextStage: '',
      actionLabel: '',
      terminal: true,
    }
  }

  return {
    status: 'hold',
    label: '要判断・保留',
    nextStage: '',
    actionLabel: '',
    terminal: true,
  }
}

export function deriveFinalScoreState(input = {}) {
  const candidateStage = String(input.candidateStage ?? '').trim()
  const score = finiteNumber(input.score)
  const explorationPriority = finiteNumber(input.explorationPriority)

  if (candidateStage === 'idea' || score === null) {
    return {
      type: 'pending',
      label: '採点前',
      score: null,
      explorationPriority,
    }
  }

  if (candidateStage === 'demand-checked') {
    return {
      type: 'reference',
      label: `参考点 ${Math.round(score)}`,
      score,
      explorationPriority: null,
    }
  }

  return {
    type: 'overall',
    label: String(Math.round(score)),
    score,
    explorationPriority: null,
  }
}

export function formatEvidenceMetric(value, options = {}) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== ''
  if (hasValue) {
    return {
      kind: 'value',
      text: `${String(value).trim()}${String(options.suffix ?? '')}`,
    }
  }
  if (options.checked) return { kind: 'unknown', text: 'Unknown' }
  return { kind: 'pending', text: '未取得' }
}

export function pendingEvidenceBatch(rows = [], stage, limit = 50) {
  const targetStage = normalizedStage(stage)
  if (!targetStage) return []

  const seen = new Set()
  const maxBatch = Math.max(1, Math.min(50, Math.floor(Number(limit) || 50)))
  return rows.filter((row) => {
    if (row?.evidenceState?.status !== 'pending') return false
    if (row.evidenceState.nextStage !== targetStage) return false
    const keyword = String(row.keyword ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
    if (!keyword || seen.has(keyword)) return false
    seen.add(keyword)
    return true
  }).slice(0, maxBatch)
}

export function finalEvidenceFilterMatches(row = {}, filter = 'all') {
  const selected = String(filter ?? 'all').trim().toLowerCase()
  if (selected === 'all') return true
  if (selected === 'recommended') {
    return row.evidenceState?.status === 'verified'
      && ['A', 'B'].includes(String(row.opportunityLabel ?? '').trim())
  }
  return row.evidenceState?.status === selected
}

export function deriveFinalKeywordDecision(rows = []) {
  const rank = { A: 0, B: 1 }
  const recommended = rows
    .filter((row) => (
      row?.evidenceState?.status === 'verified'
      && Object.hasOwn(rank, String(row.opportunityLabel ?? '').trim())
      && String(row.keyword ?? '').trim()
    ))
    .sort((left, right) => (
      rank[String(left.opportunityLabel).trim()] - rank[String(right.opportunityLabel).trim()]
      || (finiteNumber(right.scoreState?.score) ?? -1) - (finiteNumber(left.scoreState?.score) ?? -1)
      || String(left.keyword).localeCompare(String(right.keyword), 'en')
    ))

  const pendingCount = rows.filter((row) => (
    ['pending', 'failed'].includes(String(row?.evidenceState?.status ?? '').trim())
  )).length

  if (recommended.length > 0) {
    const primary = recommended[0]
    return {
      status: 'ready',
      primaryKeyword: String(primary.keyword).trim(),
      primaryLabel: String(primary.opportunityLabel).trim(),
      primaryScore: finiteNumber(primary.scoreState?.score),
      alternatives: recommended.slice(1, 3).map((row) => String(row.keyword).trim()),
      pendingCount,
    }
  }

  return {
    status: pendingCount > 0 ? 'pending' : 'none',
    primaryKeyword: '',
    primaryLabel: '',
    primaryScore: null,
    alternatives: [],
    pendingCount,
  }
}
