function normalizeQuery(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9'&+\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function removePhrase(source, phrase) {
  const sourceTokens = normalizeQuery(source).split(' ').filter(Boolean)
  const phraseTokens = normalizeQuery(phrase).split(' ').filter(Boolean)
  if (phraseTokens.length === 0) return sourceTokens.join(' ')

  const output = []
  for (let index = 0; index < sourceTokens.length; index += 1) {
    const matches = phraseTokens.every((token, offset) => sourceTokens[index + offset] === token)
    if (matches) index += phraseTokens.length - 1
    else output.push(sourceTokens[index])
  }
  return output.join(' ')
}

function addOrigin(plan, byQuery, query, sourceKeyword, queryKind) {
  const normalizedQuery = normalizeQuery(query)
  const normalizedSource = normalizeQuery(sourceKeyword)
  if (!normalizedQuery || !normalizedSource) return

  const existing = byQuery.get(normalizedQuery)
  const origin = { sourceKeyword: normalizedSource, queryKind }
  if (existing) {
    if (!existing.sourceKeywords.includes(normalizedSource)) existing.sourceKeywords.push(normalizedSource)
    if (!existing.origins.some((item) => item.sourceKeyword === normalizedSource && item.queryKind === queryKind)) {
      existing.origins.push(origin)
    }
    return
  }

  const item = {
    query: normalizedQuery,
    queryKind,
    sourceKeyword: normalizedSource,
    sourceKeywords: [normalizedSource],
    origins: [origin],
  }
  plan.push(item)
  byQuery.set(normalizedQuery, item)
}

function readyCandidates(candidates, candidateLimit) {
  return (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate?.status === undefined || candidate.status === 'ready')
    .slice(0, candidateLimit)
}

function baseQueryFrom(candidate, sourceKeyword, options) {
  return normalizeQuery(typeof options.baseQueryFor === 'function'
    ? options.baseQueryFor(sourceKeyword, candidate)
    : removePhrase(sourceKeyword, options.eventTerm))
}

function excludedQuerySet(values) {
  return new Set((Array.isArray(values) ? values : [...(values ?? [])])
    .map(normalizeQuery)
    .filter(Boolean))
}

// eRank charges one daily lookup per query, so base phrases stay off by default and are
// only spent later on candidates whose full phrase came back without demand.
export function buildErankQueryPlan(candidates, options = {}) {
  const candidateLimit = Math.max(1, Number(options.candidateLimit) || 20)
  const ready = readyCandidates(candidates, candidateLimit)
  const excluded = excludedQuerySet(options.excludeQueries)
  const plan = []
  const byQuery = new Map()

  for (const candidate of ready) {
    const sourceKeyword = normalizeQuery(candidate?.keyword)
    if (!sourceKeyword || excluded.has(sourceKeyword)) continue
    addOrigin(plan, byQuery, sourceKeyword, sourceKeyword, 'direct')
  }

  if (options.includeBaseQueries !== true) return plan

  for (const candidate of ready) {
    const sourceKeyword = normalizeQuery(candidate?.keyword)
    if (!sourceKeyword) continue
    const baseQuery = baseQueryFrom(candidate, sourceKeyword, options)
    if (!baseQuery || baseQuery === sourceKeyword || excluded.has(baseQuery)) continue
    addOrigin(plan, byQuery, baseQuery, sourceKeyword, 'base')
  }

  return plan
}

export function buildErankBaseFollowUpPlan(candidates, options = {}) {
  const candidateLimit = Math.max(1, Number(options.candidateLimit) || 20)
  const ready = readyCandidates(candidates, candidateLimit)
  const excluded = excludedQuerySet(options.excludeQueries)
  const needsFollowUp = typeof options.needsFollowUp === 'function'
    ? options.needsFollowUp
    : () => true
  const plan = []
  const byQuery = new Map()

  for (const candidate of ready) {
    const sourceKeyword = normalizeQuery(candidate?.keyword)
    if (!sourceKeyword || !needsFollowUp(sourceKeyword, candidate)) continue
    const baseQuery = baseQueryFrom(candidate, sourceKeyword, options)
    if (!baseQuery || baseQuery === sourceKeyword || excluded.has(baseQuery)) continue
    addOrigin(plan, byQuery, baseQuery, sourceKeyword, 'base')
  }

  return plan
}

export function summarizeErankQueryPlan(plan) {
  const items = Array.isArray(plan) ? plan : []
  const sourceKeywords = new Set(items.flatMap((item) => item.sourceKeywords ?? []))
  return {
    candidateCount: sourceKeywords.size,
    queryCount: items.length,
    directCount: items.filter((item) => item.queryKind === 'direct').length,
    baseCount: items.filter((item) => item.queryKind === 'base').length,
  }
}

export function attachErankQueryProvenance(row, plan) {
  const query = normalizeQuery(row?.query ?? row?.keyword)
  const item = (Array.isArray(plan) ? plan : []).find((entry) => normalizeQuery(entry.query) === query)
  if (!item) return { ...row }

  const attempted = Boolean(row?.erankAttemptedAt || row?.erankCheckedAt)
  const failed = attempted && Boolean(String(row?.error ?? '').trim())
  const declaredStatus = String(row?.erankCaptureStatus ?? '').trim()
  return {
    ...row,
    sourceKeyword: item.sourceKeyword,
    sourceKeywords: [...item.sourceKeywords],
    query: item.query,
    queryKind: item.queryKind,
    erankCaptureStatus: declaredStatus || (failed ? 'failed' : attempted ? 'captured' : 'unsearched'),
  }
}
