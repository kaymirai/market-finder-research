function normalizedLease(value) {
  const tabId = String(value?.tabId ?? '').trim()
  const expiresAt = Number(value?.expiresAt)
  if (!tabId || !Number.isFinite(expiresAt)) return null
  return { tabId, expiresAt }
}

export function ownsResearchTabLease(value, { tabId, now = Date.now() } = {}) {
  const lease = normalizedLease(value)
  return Boolean(lease && lease.tabId === String(tabId ?? '') && lease.expiresAt > Number(now))
}

export function acquireResearchTabLease(value, {
  tabId,
  now = Date.now(),
  ttlMs = 15_000,
  force = false,
} = {}) {
  const current = normalizedLease(value)
  const ownerId = String(tabId ?? '').trim()
  const currentTime = Number(now)
  const duration = Math.max(1_000, Number(ttlMs) || 15_000)
  const available = force || !current || current.expiresAt <= currentTime || current.tabId === ownerId

  if (!ownerId || !Number.isFinite(currentTime) || !available) {
    return { acquired: false, lease: current }
  }
  return {
    acquired: true,
    lease: { tabId: ownerId, expiresAt: currentTime + duration },
  }
}

export function releaseResearchTabLease(value, tabId) {
  const current = normalizedLease(value)
  if (!current || current.tabId !== String(tabId ?? '')) return current
  return null
}
