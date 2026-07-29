import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [html, app, css] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
])

async function loadController() {
  return import(`../src/listing-outcomes-ui.js?test=${Date.now()}-${Math.random()}`)
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body
    },
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body)
    },
  }
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

const fixtureCsv = [
  'snapshotAt,listingId,clusterId,visits,orders,revenue,netProfit',
  '2026-05-01,listing-1,nurse,80,0,0,0',
  '2026-07-01,listing-1,nurse,120,4,100,40',
  '2026-07-01,listing-2,teacher,160,0,0,-8',
].join('\n')

test('shows the Etsy Stats import, decision band, M3, and M6 surfaces', () => {
  assert.match(html, /id="listingOutcomesPanel"/)
  assert.match(html, />Etsy Stats</)
  assert.match(html, />Watch</)
  assert.match(html, />Early Go</)
  assert.match(html, /停止候補/)
  assert.match(html, /停止・大幅修正/)
  assert.match(html, />M3</)
  assert.match(html, />M6</)
  assert.match(css, /\.listing-outcomes-status-band/)
})

test('labels incomplete legacy rows instead of displaying missing metrics as zero', () => {
  assert.match(app, /legacyMetricsIncomplete/)
  assert.match(app, /旧データ（指標不足）/)
})

test('uses latest listing snapshots for decisions and every snapshot for the trend table', async () => {
  const { buildListingOutcomesView, previewListingOutcomesCsv } = await loadController()
  const preview = previewListingOutcomesCsv(fixtureCsv)
  assert.equal(preview.error, '')
  assert.equal(preview.rows.length, 3)

  const view = buildListingOutcomesView(preview.rows, { selectedExplorationMode: 'M1' })
  assert.equal(view.listingCount, 2)
  assert.equal(view.snapshotCount, 3)
  assert.equal(view.trendRows.length, 3)
  assert.deepEqual(
    Object.fromEntries(view.latestRows.map((row) => [row.listingId, row.status])),
    { 'listing-1': 'early-go', 'listing-2': 'stop' },
  )
  assert.equal(view.m3.winnerCount, 1)
  assert.equal(view.m6.winnerRate, 0.5)
  assert.equal(view.recommendedStrategy, 'winner-deepening')
  assert.equal(view.selectedExplorationMode, 'M1', 'a recommendation must not replace the manually selected mode')
})

test('returns useful validation errors for empty and malformed CSV previews', async () => {
  const { previewListingOutcomesCsv } = await loadController()

  assert.match(previewListingOutcomesCsv('').error, /CSV/)
  assert.match(
    previewListingOutcomesCsv('snapshotAt,listingId,visits,orders\n2026-02-30,bad,10,0').error,
    /日付|snapshotAt/,
  )
  assert.match(
    previewListingOutcomesCsv('snapshotAt,listingId,visits,orders\n2026-07-01,,10,0').error,
    /listingId/,
  )
})

test('keeps normalized rows pending after a failed save and clears them after retry', async () => {
  const { createListingOutcomesController, LISTING_OUTCOMES_PENDING_KEY } = await loadController()
  const storage = memoryStorage()
  let attempt = 0
  let acceptedRows = []
  const request = async (_url, options = {}) => {
    if (!options.method) return jsonResponse(200, acceptedRows)
    attempt += 1
    if (attempt === 1) return jsonResponse(503, 'temporarily unavailable')
    acceptedRows = JSON.parse(options.body)
    return jsonResponse(200, acceptedRows)
  }
  const controller = createListingOutcomesController({ request, storage })

  controller.previewText(fixtureCsv)
  const failed = await controller.savePreview()
  assert.equal(failed.pendingRows.length, 3)
  assert.match(failed.saveError, /503/)
  assert.equal(JSON.parse(storage.getItem(LISTING_OUTCOMES_PENDING_KEY)).length, 3)

  const saved = await controller.retryPending()
  assert.equal(saved.pendingRows.length, 0)
  assert.equal(saved.rows.length, 3)
  assert.equal(storage.getItem(LISTING_OUTCOMES_PENDING_KEY), null)
})

test('merges restored pending rows with a new preview before POST and keeps the merged rows after failure', async () => {
  const { createListingOutcomesController, LISTING_OUTCOMES_PENDING_KEY } = await loadController()
  const restoredPending = [
    { listingId: 'same', snapshotAt: '2026-07-01', visits: 10, orders: 0 },
    { listingId: 'pending-only', snapshotAt: '2026-07-01', visits: 25, orders: 1 },
  ]
  const storage = memoryStorage({
    [LISTING_OUTCOMES_PENDING_KEY]: JSON.stringify(restoredPending),
  })
  let postedRows = []
  const controller = createListingOutcomesController({
    storage,
    request: async (_url, options) => {
      postedRows = JSON.parse(options.body)
      return jsonResponse(503, 'offline')
    },
  })

  controller.previewText([
    'snapshotAt,listingId,visits,orders',
    '2026-07-01,same,120,4',
    '2026-07-01,preview-only,40,0',
  ].join('\n'))
  const failed = await controller.savePreview()

  assert.deepEqual(
    postedRows.map((row) => [row.listingId, row.visits, row.orders]),
    [
      ['same', 120, 4],
      ['pending-only', 25, 1],
      ['preview-only', 40, 0],
    ],
  )
  assert.deepEqual(failed.pendingRows, postedRows)
  assert.deepEqual(JSON.parse(storage.getItem(LISTING_OUTCOMES_PENDING_KEY)), postedRows)
})

test('POST success reloads the authoritative saved collection before clearing the accepted pending rows', async () => {
  const { createListingOutcomesController, LISTING_OUTCOMES_PENDING_KEY } = await loadController()
  const storage = memoryStorage({
    [LISTING_OUTCOMES_PENDING_KEY]: JSON.stringify([
      { listingId: 'pending', snapshotAt: '2026-07-01', visits: 10, orders: 0 },
    ]),
  })
  const calls = []
  let postedRows = []
  const controller = createListingOutcomesController({
    storage,
    request: async (_url, options = {}) => {
      const method = options.method ?? 'GET'
      calls.push(method)
      if (method === 'POST') {
        postedRows = JSON.parse(options.body)
        return jsonResponse(200, postedRows)
      }
      return jsonResponse(200, [
        { listingId: 'older-saved', snapshotAt: '2026-06-01', visits: 50, orders: 1 },
        ...postedRows,
      ])
    },
  })
  controller.state.loadError = 'stale error'
  controller.previewText('snapshotAt,listingId,visits,orders\n2026-07-01,new,100,3')
  const saved = await controller.savePreview()

  assert.deepEqual(calls, ['POST', 'GET'])
  assert.deepEqual(saved.rows.map((row) => row.listingId), ['older-saved', 'pending', 'new'])
  assert.equal(saved.pendingRows.length, 0)
  assert.equal(storage.getItem(LISTING_OUTCOMES_PENDING_KEY), null)
  assert.equal(saved.loadError, '')
})

test('loads legacy GET rows explicitly while excluding incomplete metrics from learning totals', async () => {
  const { createListingOutcomesController } = await loadController()
  const controller = createListingOutcomesController({
    request: async () => jsonResponse(200, [
      { listingId: 'legacy', snapshotAt: '2026-06-01', clusterId: 'old-cluster' },
      { listingId: 'strict', snapshotAt: '2026-07-01', clusterId: 'new-cluster', visits: 100, orders: 3 },
    ]),
  })

  const loaded = await controller.load()

  assert.equal(loaded.loadError, '')
  assert.equal(loaded.rows.length, 2)
  assert.equal(loaded.rows.find((row) => row.listingId === 'legacy').legacyMetricsIncomplete, true)
  assert.equal(loaded.view.snapshotCount, 2)
  assert.equal(loaded.view.legacyIncompleteCount, 1)
  assert.equal(loaded.view.listingCount, 1)
  assert.deepEqual(loaded.view.latestRows.map((row) => row.listingId), ['strict'])
})

test('accepts a legacy row in POST success responses without weakening the strict outgoing payload', async () => {
  const { createListingOutcomesController } = await loadController()
  let postedRows = []
  const responseRows = () => [
    { listingId: 'legacy', snapshotAt: '2026-06-01' },
    ...postedRows,
  ]
  const controller = createListingOutcomesController({
    request: async (_url, options = {}) => {
      if (options.method === 'POST') {
        postedRows = JSON.parse(options.body)
        return jsonResponse(200, responseRows())
      }
      return jsonResponse(200, responseRows())
    },
  })
  controller.previewText('snapshotAt,listingId,visits,orders\n2026-07-01,new,100,3')

  const saved = await controller.savePreview()

  assert.deepEqual(postedRows.map((row) => [row.listingId, row.visits, row.orders]), [
    ['new', 100, 3],
  ])
  assert.equal(saved.saveError, '')
  assert.equal(saved.pendingRows.length, 0)
  assert.equal(saved.rows.find((row) => row.listingId === 'legacy').legacyMetricsIncomplete, true)
  assert.equal(saved.view.legacyIncompleteCount, 1)
  assert.equal(saved.view.m3.winnerCount, 1)
})

test('keeps the accepted POST response when the authoritative GET refresh fails', async () => {
  const { createListingOutcomesController, LISTING_OUTCOMES_PENDING_KEY } = await loadController()
  const storage = memoryStorage()
  const calls = []
  const controller = createListingOutcomesController({
    storage,
    request: async (_url, options = {}) => {
      const method = options.method ?? 'GET'
      calls.push(method)
      return method === 'POST'
        ? jsonResponse(200, JSON.parse(options.body))
        : jsonResponse(502, 'refresh failed')
    },
  })
  controller.previewText('snapshotAt,listingId,visits,orders\n2026-07-01,accepted,100,3')

  const saved = await controller.savePreview()

  assert.deepEqual(calls, ['POST', 'GET'])
  assert.equal(saved.rows[0].listingId, 'accepted')
  assert.equal(saved.pendingRows.length, 0)
  assert.equal(storage.getItem(LISTING_OUTCOMES_PENDING_KEY), null)
  assert.match(saved.loadError, /502/)
})

test('diagnoses malformed and throwing storage without losing in-memory pending retry state', async () => {
  const {
    createListingOutcomesController,
    LISTING_OUTCOMES_PENDING_KEY,
  } = await loadController()
  const malformed = memoryStorage({
    [LISTING_OUTCOMES_PENDING_KEY]: '{bad json',
  })
  const malformedController = createListingOutcomesController({ storage: malformed })
  assert.equal(malformedController.state.pendingRows.length, 0)
  assert.match(malformedController.state.storageError, /localStorage|未保存/)

  const getThrowingController = createListingOutcomesController({
    storage: {
      getItem() {
        throw new Error('storage denied')
      },
    },
  })
  assert.equal(getThrowingController.state.pendingRows.length, 0)
  assert.match(getThrowingController.state.storageError, /storage denied/)

  const throwingStorage = {
    getItem() {
      return null
    },
    setItem() {
      throw new Error('quota exceeded')
    },
    removeItem() {
      throw new Error('blocked')
    },
  }
  const controller = createListingOutcomesController({
    storage: throwingStorage,
    request: async () => jsonResponse(503, 'offline'),
  })
  controller.previewText('snapshotAt,listingId,visits,orders\n2026-07-01,retry-me,80,0')

  const failed = await controller.savePreview()

  assert.equal(failed.busy, false)
  assert.equal(failed.pendingRows.length, 1)
  assert.equal(failed.previewRows.length, 1, 'the save control can return to an enabled retryable state')
  assert.match(failed.storageError, /quota exceeded/)
  assert.match(failed.saveError, /未保存/)

  const removeThrowingController = createListingOutcomesController({
    storage: throwingStorage,
    request: async (_url, options = {}) => (
      options.method === 'POST'
        ? jsonResponse(200, JSON.parse(options.body))
        : jsonResponse(200, [{ listingId: 'accepted', snapshotAt: '2026-07-01', visits: 80, orders: 0 }])
    ),
  })
  removeThrowingController.previewText('snapshotAt,listingId,visits,orders\n2026-07-01,accepted,80,0')
  const accepted = await removeThrowingController.savePreview()
  assert.equal(accepted.pendingRows.length, 0)
  assert.equal(accepted.busy, false)
  assert.match(accepted.storageError, /blocked/)
})

test('requires decision headers and rejects non-finite or negative decision numbers', async () => {
  const { previewListingOutcomesCsv } = await loadController()

  assert.match(
    previewListingOutcomesCsv('snapshotAt,listingId,visits\n2026-07-01,a,10').error,
    /orders/,
  )
  assert.match(
    previewListingOutcomesCsv('snapshotAt,listingId,visits,orders\n2026-07-01,a,abc,0').error,
    /visits/,
  )
  assert.match(
    previewListingOutcomesCsv('snapshotAt,listingId,visits,orders\n2026-07-01,a,-1,0').error,
    /visits/,
  )
  assert.equal(
    previewListingOutcomesCsv('snapshotAt,listingId,visits,orders,revenue\n2026-07-01,a,10,0,').error,
    '',
    'optional numeric cells may be empty',
  )
})

test('reports partial cached DOM instead of throwing while rendering', async () => {
  const { listingOutcomesDomReady } = await loadController()
  const status = { textContent: '', className: '' }

  assert.equal(listingOutcomesDomReady({
    listingOutcomesPanel: {},
    listingOutcomesImportStatus: status,
  }), false)
  assert.match(status.textContent, /画面|更新/)
  assert.match(status.className, /warn/)
})

test('does not bind outcome controls when a cached partial DOM is missing the textarea', async () => {
  const { bindListingOutcomesEvents } = await loadController()
  const listeners = new Map()
  const previewButton = {
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    click() {
      listeners.get('click')?.()
    },
  }
  const status = { textContent: '', className: '' }
  const bound = bindListingOutcomesEvents({
    elements: {
      listingOutcomesPanel: {},
      listingOutcomesPreviewBtn: previewButton,
      listingOutcomesImportStatus: status,
    },
    controller: {
      previewText() {
        throw new Error('must not run for partial DOM')
      },
    },
    onState() {},
  })

  assert.equal(bound, false)
  assert.equal(listeners.size, 0)
  assert.doesNotThrow(() => previewButton.click())
  assert.match(status.textContent, /更新/)
})

test('accepts the Task 3 CSV header aliases in the UI preview', async () => {
  const { previewListingOutcomesCsv } = await loadController()
  const snapshotAlias = previewListingOutcomesCsv([
    'snapshot_at,listing_id,visits30d,orders30d,revenue30d',
    '2026-07-01,alias-a,120,4,88',
  ].join('\n'))
  const researchedAlias = previewListingOutcomesCsv([
    'researchedAt,listing_id,visits30d,orders30d',
    '2026-07-02,alias-b,40,0',
  ].join('\n'))

  assert.equal(snapshotAlias.error, '')
  assert.deepEqual(
    snapshotAlias.rows.map((row) => [row.listingId, row.snapshotAt, row.visits, row.orders, row.revenue]),
    [['alias-a', '2026-07-01T00:00:00.000Z', 120, 4, 88]],
  )
  assert.equal(researchedAlias.error, '')
  assert.equal(researchedAlias.rows[0].listingId, 'alias-b')
})

test('shares one alias-aware CSV record parser with quoted newlines and escaped quotes', async () => {
  const model = await import(`../src/listing-outcomes.js?records=${Date.now()}-${Math.random()}`)
  assert.equal(typeof model.parseListingOutcomeCsvRecords, 'function')
  assert.equal(typeof model.resolveListingOutcomeCsvHeader, 'function')
  assert.equal(model.resolveListingOutcomeCsvHeader(' listing_id '), 'listingId')
  assert.equal(model.resolveListingOutcomeCsvHeader('snapshot_at'), 'snapshotAt')

  const text = [
    'snapshot_at,listing_id,visits30d,orders30d,notes',
    '2026-07-01,quoted,10,0,"comma, newline',
    'and ""escaped quote"""',
  ].join('\n')
  const parsed = model.parseListingOutcomeCsvRecords(text)
  assert.deepEqual(parsed.headers, ['snapshotAt', 'listingId', 'visits', 'orders', 'notes'])
  assert.equal(parsed.records.length, 1)
  assert.equal(parsed.records[0][4], 'comma, newline\nand "escaped quote"')

  const normalized = model.parseListingOutcomesCsv(text)
  assert.equal(normalized[0].notes, 'comma, newline\nand "escaped quote"')
})

test('loads saved outcomes, accepts a CSV file, and keeps pending data visible on GET errors', async () => {
  const { createListingOutcomesController, LISTING_OUTCOMES_PENDING_KEY } = await loadController()
  const pendingRows = [{
    listingId: 'pending',
    snapshotAt: '2026-07-01T00:00:00.000Z',
    clusterId: '',
    visits: 20,
    orders: 0,
    revenue: 0,
    netProfit: 0,
  }]
  const storage = memoryStorage({
    [LISTING_OUTCOMES_PENDING_KEY]: JSON.stringify(pendingRows),
  })
  const controller = createListingOutcomesController({
    storage,
    request: async () => jsonResponse(500, 'broken store'),
  })

  const loaded = await controller.load()
  assert.match(loaded.loadError, /500/)
  assert.equal(loaded.pendingRows.length, 1)
  assert.equal(loaded.view.listingCount, 1)

  const fromFile = await controller.previewFile({
    name: 'etsy-stats.csv',
    async text() {
      return fixtureCsv
    },
  })
  assert.equal(fromFile.previewRows.length, 3)
  assert.equal(fromFile.previewError, '')
})

test('connects the latest outcome listing count to the monthly productization funnel', () => {
  assert.match(app, /listings:\s*state\.listingOutcomesView\.listingCount/)
})
