import {
  mergeListingOutcomeSnapshots,
  normalizeLegacyListingOutcome,
  parseListingOutcomeCsvRecords,
  parseListingOutcomesCsv,
  recommendNextExplorationMode,
  summarizeListingLearning,
} from './listing-outcomes.js?v=20260726-2'

export const LISTING_OUTCOMES_PENDING_KEY = 'etsy-mirai-market-finder-listing-outcomes-pending-v1'

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Etsy Stats must be an array')
  return mergeListingOutcomeSnapshots([], rows)
}

function normalizeLegacyResponseRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Etsy Stats must be an array')
  const normalized = rows.map(normalizeLegacyListingOutcome)
  return mergeListingOutcomeSnapshots([], normalized, { allowLegacyIncoming: true })
}

function readPendingRows(storage) {
  if (!storage) return { rows: [], error: '' }
  let raw = ''
  try {
    raw = storage.getItem(LISTING_OUTCOMES_PENDING_KEY)
  } catch (error) {
    return {
      rows: [],
      error: `localStorageから未保存データを読めませんでした: ${messageOf(error)}`,
    }
  }
  if (!raw) return { rows: [], error: '' }
  try {
    return { rows: normalizeRows(JSON.parse(raw)), error: '' }
  } catch (error) {
    return {
      rows: [],
      error: `localStorageの未保存データが不正なため読み飛ばしました: ${messageOf(error)}`,
    }
  }
}

function writePendingRows(storage, rows) {
  if (!storage) return ''
  try {
    if (rows.length === 0) {
      storage.removeItem(LISTING_OUTCOMES_PENDING_KEY)
      return ''
    }
    storage.setItem(LISTING_OUTCOMES_PENDING_KEY, JSON.stringify(rows))
    return ''
  } catch (error) {
    return `localStorageへ未保存データを反映できませんでした: ${messageOf(error)}`
  }
}

function sortTrendRows(rows) {
  return [...rows].sort((left, right) => (
    right.snapshotAt.localeCompare(left.snapshotAt)
      || left.listingId.localeCompare(right.listingId)
  ))
}

function validateCsvDecisionFields(text) {
  const { headers, records: dataRecords } = parseListingOutcomeCsvRecords(text)
  for (const required of ['listingId', 'snapshotAt', 'visits', 'orders']) {
    if (!headers.includes(required)) return `必須列 ${required} がありません。`
  }

  const rows = dataRecords.filter((record) => record.some((value) => String(value ?? '').trim()))
  const numericRules = [
    ['visits', false, false],
    ['orders', false, false],
    ['revenue', true, false],
    ['impressions', true, false],
    ['clicks', true, false],
    ['favorites', true, false],
    ['netProfit', true, true],
  ]
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const record = rows[rowIndex]
    for (const [fieldName, optional, allowNegative] of numericRules) {
      const columnIndex = headers.indexOf(fieldName)
      if (columnIndex < 0) continue
      const raw = String(record[columnIndex] ?? '').trim()
      if (!raw && optional) continue
      const number = Number(raw)
      if (!raw || !Number.isFinite(number) || (!allowNegative && number < 0)) {
        return `${rowIndex + 2}行目の${fieldName}は${allowNegative ? '有限な数値' : '0以上の有限な数値'}で入力してください。`
      }
    }
  }
  return ''
}

export function previewListingOutcomesCsv(text) {
  if (!String(text ?? '').trim()) {
    return { rows: [], error: 'Etsy StatsのCSVを貼り付けるか、CSVファイルを選んでください。' }
  }

  try {
    const validationError = validateCsvDecisionFields(text)
    if (validationError) return { rows: [], error: validationError }
    const rows = parseListingOutcomesCsv(text)
    if (rows.length === 0) {
      return { rows: [], error: 'CSVにデータ行がありません。見出しの次に1件以上追加してください。' }
    }
    const missingListingId = rows.findIndex((row) => !row.listingId)
    if (missingListingId >= 0) {
      return { rows: [], error: `${missingListingId + 2}行目のlistingIdが空です。` }
    }
    return { rows: normalizeRows(rows), error: '' }
  } catch (error) {
    const detail = messageOf(error)
    const translated = /snapshotAt/.test(detail)
      ? `日付を確認してください: ${detail}`
      : `CSVを確認してください: ${detail}`
    return { rows: [], error: translated }
  }
}

export function buildListingOutcomesView(rows, { selectedExplorationMode = 'M1' } = {}) {
  const snapshots = normalizeLegacyResponseRows(rows)
  const learningSnapshots = snapshots.filter((row) => row.legacyMetricsIncomplete !== true)
  const m3Summary = summarizeListingLearning(learningSnapshots, { month: 3 })
  const m6Summary = summarizeListingLearning(learningSnapshots, { month: 6 })
  const recommendedStrategy = recommendNextExplorationMode(m6Summary)
  const latestRows = m6Summary.listings
  const statusCounts = latestRows.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1
    return counts
  }, {})

  return {
    rows: snapshots,
    latestRows,
    trendRows: sortTrendRows(snapshots),
    snapshotCount: snapshots.length,
    legacyIncompleteCount: snapshots.length - learningSnapshots.length,
    listingCount: latestRows.length,
    statusCounts,
    m3: m3Summary.m3,
    m6: m6Summary.m6,
    recommendedStrategy,
    selectedExplorationMode,
  }
}

const LISTING_OUTCOMES_DOM_KEYS = [
  'listingOutcomesPanel',
  'listingOutcomesCount',
  'listingOutcomesCsvInput',
  'listingOutcomesFileInput',
  'listingOutcomesPreviewBtn',
  'listingOutcomesSaveBtn',
  'listingOutcomesRetryBtn',
  'listingOutcomesImportStatus',
  'listingOutcomesPreview',
  'listingOutcomesM3Value',
  'listingOutcomesM3Note',
  'listingOutcomesM6Value',
  'listingOutcomesM6Note',
  'listingOutcomesRecommendation',
  'listingOutcomesTrendBody',
]

export function listingOutcomesDomReady(elements = {}) {
  const missing = LISTING_OUTCOMES_DOM_KEYS.filter((key) => !elements[key])
  const recommendationStrong = elements.listingOutcomesRecommendation?.querySelector?.('strong')
  if (!recommendationStrong) missing.push('listingOutcomesRecommendation strong')
  if (missing.length === 0) return true
  if (elements.listingOutcomesImportStatus) {
    elements.listingOutcomesImportStatus.textContent = 'Etsy Stats画面の一部が古い状態です。ページを更新してください。'
    elements.listingOutcomesImportStatus.className = 'inline-status warn'
  }
  return false
}

export function bindListingOutcomesEvents({
  elements = {},
  controller = null,
  onState = () => {},
} = {}) {
  if (!listingOutcomesDomReady(elements) || !controller) return false

  elements.listingOutcomesPreviewBtn.addEventListener('click', () => {
    onState(controller.previewText(elements.listingOutcomesCsvInput.value))
  })
  elements.listingOutcomesFileInput.addEventListener('change', async () => {
    const file = elements.listingOutcomesFileInput.files?.[0]
    onState(await controller.previewFile(file))
  })
  elements.listingOutcomesSaveBtn.addEventListener('click', async () => {
    elements.listingOutcomesSaveBtn.disabled = true
    onState(await controller.savePreview())
  })
  elements.listingOutcomesRetryBtn.addEventListener('click', async () => {
    elements.listingOutcomesRetryBtn.disabled = true
    onState(await controller.retryPending())
  })
  return true
}

async function responseError(response) {
  let detail = ''
  try {
    detail = String(await response.text()).trim()
  } catch {
    // The status still gives the user a retryable error.
  }
  return `HTTP ${response.status}${detail ? `: ${detail}` : ''}`
}

export function createListingOutcomesController({
  request = globalThis.fetch?.bind(globalThis),
  storage = null,
  endpoint = '/market-finder/listing-outcomes',
  selectedExplorationMode = () => 'M1',
} = {}) {
  const restoredPending = readPendingRows(storage)
  const state = {
    rows: [],
    pendingRows: restoredPending.rows,
    previewRows: [],
    previewError: '',
    loadError: '',
    saveError: '',
    storageError: restoredPending.error,
    message: '',
    busy: false,
    view: buildListingOutcomesView(restoredPending.rows, {
      selectedExplorationMode: selectedExplorationMode(),
    }),
  }

  function syncView() {
    const visibleRows = mergeListingOutcomeSnapshots(state.rows, state.pendingRows, {
      allowLegacyExisting: true,
    })
    state.view = buildListingOutcomesView(visibleRows, {
      selectedExplorationMode: selectedExplorationMode(),
    })
    return state
  }

  function previewText(text) {
    const preview = previewListingOutcomesCsv(text)
    state.previewRows = preview.rows
    state.previewError = preview.error
    state.saveError = ''
    state.message = preview.error
      ? ''
      : `${preview.rows.length}件のスナップショットを確認しました。保存すると学習結果へ反映します。`
    return state
  }

  async function previewFile(file) {
    if (!file || typeof file.text !== 'function') {
      state.previewRows = []
      state.previewError = '読み込むCSVファイルを選んでください。'
      return state
    }
    try {
      return previewText(await file.text())
    } catch (error) {
      state.previewRows = []
      state.previewError = `ファイルを読めませんでした: ${messageOf(error)}`
      return state
    }
  }

  async function saveRows(rows) {
    const normalized = normalizeRows(rows)
    const pendingToSend = mergeListingOutcomeSnapshots(state.pendingRows, normalized)
    if (pendingToSend.length === 0) {
      state.saveError = '保存するスナップショットがありません。'
      return state
    }
    if (typeof request !== 'function') {
      state.pendingRows = pendingToSend
      state.storageError = writePendingRows(storage, pendingToSend)
      state.saveError = '保存先へ接続できません。未保存データとしてこの端末に保持しました。'
      return syncView()
    }

    state.busy = true
    state.saveError = ''
    try {
      const response = await request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingToSend),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const savedRows = normalizeLegacyResponseRows(await response.json())
      state.rows = savedRows
      state.pendingRows = []
      state.previewRows = []
      state.storageError = writePendingRows(storage, [])
      state.message = `${savedRows.length}件のスナップショットを保存しました。`
      state.loadError = ''

      try {
        const authoritativeResponse = await request(endpoint, { cache: 'no-store' })
        if (!authoritativeResponse.ok) throw new Error(await responseError(authoritativeResponse))
        state.rows = normalizeLegacyResponseRows(await authoritativeResponse.json())
        state.loadError = ''
        state.message = `${state.rows.length}件の保存済みスナップショットへ同期しました。`
      } catch (error) {
        state.loadError = `保存後の全件再読込に失敗しました: ${messageOf(error)}。保存受付済みの結果を表示しています。`
      }
    } catch (error) {
      state.pendingRows = pendingToSend
      state.storageError = writePendingRows(storage, pendingToSend)
      state.saveError = `${messageOf(error)}。未保存データとしてこの端末に保持しました。`
    } finally {
      state.busy = false
    }
    return syncView()
  }

  async function load() {
    if (typeof request !== 'function') {
      state.loadError = '保存済みEtsy Statsの読込先へ接続できません。'
      return syncView()
    }
    state.busy = true
    state.loadError = ''
    try {
      const response = await request(endpoint, { cache: 'no-store' })
      if (!response.ok) throw new Error(await responseError(response))
      state.rows = normalizeLegacyResponseRows(await response.json())
      state.loadError = ''
      state.message = state.rows.length
        ? `${state.rows.length}件の保存済みスナップショットを読み込みました。`
        : '保存済みスナップショットはまだありません。'
    } catch (error) {
      state.loadError = `${messageOf(error)}。未保存データがあれば下に表示しています。`
    } finally {
      state.busy = false
    }
    return syncView()
  }

  return {
    state,
    load,
    previewText,
    previewFile,
    savePreview: () => saveRows(state.previewRows),
    retryPending: () => saveRows(state.pendingRows),
  }
}
