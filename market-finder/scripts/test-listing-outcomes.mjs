import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const moduleUrl = new URL('../src/listing-outcomes.js', import.meta.url)
const serverScript = new URL('static-server.mjs', import.meta.url).pathname.replace(/^\//, '')

async function loadOutcomesModule() {
  return import(`${moduleUrl.href}?test=${Date.now()}-${Math.random()}`)
}

async function reservePort() {
  const probe = createNetServer()
  await new Promise((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', resolve)
  })
  const address = probe.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()))
  return port
}

async function waitForServer(port) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/market-finder/health`)
      if (response.ok) return
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('static server did not start')
}

test('normalizes outcome numbers, CSV aliases, and optional diagnostics without dropping evidence', async () => {
  const { normalizeListingOutcome } = await loadOutcomesModule()
  const normalized = normalizeListingOutcome({
    researchedAt: ' 2026-07-01 ',
    listingId: 42,
    clusterKey: ' nurse-shirts ',
    visits30d: '100',
    orders30d: '3',
    revenue30d: '72.50',
    netProfit30d: '18.25',
    impressions: '1000',
    clicks: '120',
    favorites: '9',
    trafficSource: ' Etsy search ',
    opportunityLabel: 'A',
  })

  assert.deepEqual(
    {
      listingId: normalized.listingId,
      snapshotAt: normalized.snapshotAt,
      clusterId: normalized.clusterId,
      visits: normalized.visits,
      orders: normalized.orders,
      revenue: normalized.revenue,
      netProfit: normalized.netProfit,
      impressions: normalized.impressions,
      clicks: normalized.clicks,
      favorites: normalized.favorites,
      trafficSource: normalized.trafficSource,
      opportunityLabel: normalized.opportunityLabel,
    },
    {
      listingId: '42',
      snapshotAt: '2026-07-01T00:00:00.000Z',
      clusterId: 'nurse-shirts',
      visits: 100,
      orders: 3,
      revenue: 72.5,
      netProfit: 18.25,
      impressions: 1000,
      clicks: 120,
      favorites: 9,
      trafficSource: 'Etsy search',
      opportunityLabel: 'A',
    },
  )
})

test('rejects missing, non-finite, and negative visits or orders instead of treating them as zero', async () => {
  const { normalizeListingOutcome, parseListingOutcomesCsv } = await loadOutcomesModule()
  const base = { listingId: 'strict', snapshotAt: '2026-07-01', visits: 10, orders: 1 }

  for (const [field, value] of [
    ['visits', ''],
    ['visits', 'not-a-number'],
    ['visits', -1],
    ['orders', undefined],
    ['orders', 'Infinity'],
    ['orders', -1],
  ]) {
    assert.throws(
      () => normalizeListingOutcome({ ...base, [field]: value }),
      new RegExp(`${field} must be a finite non-negative number`),
    )
  }

  assert.throws(
    () => parseListingOutcomesCsv('listingId,snapshotAt,visits,orders\nstrict,2026-07-01,not-a-number,1'),
    /visits must be a finite non-negative number/,
  )
})

test('keeps legacy rows explicit and excluded from new metric validation', async () => {
  const { normalizeLegacyListingOutcome, normalizeListingOutcome } = await loadOutcomesModule()
  const legacy = normalizeLegacyListingOutcome({ listingId: 'legacy', snapshotAt: '2026-07-01', orders: 1 })

  assert.equal(legacy.visits, null)
  assert.equal(legacy.orders, 1)
  assert.equal(legacy.legacyMetricsIncomplete, true)
  assert.throws(
    () => normalizeListingOutcome({ listingId: 'legacy', snapshotAt: '2026-07-01', orders: 1 }),
    /visits must be a finite non-negative number/,
  )
})

test('canonicalizes date-only and timezone-qualified ISO snapshots to UTC', async () => {
  const { normalizeListingOutcome } = await loadOutcomesModule()

  assert.equal(
    normalizeListingOutcome({ listingId: 'date', snapshotAt: '2026-09-30', visits: 0, orders: 0 }).snapshotAt,
    '2026-09-30T00:00:00.000Z',
  )
  assert.equal(
    normalizeListingOutcome({
      listingId: 'offset',
      snapshotAt: '2026-10-01T09:30:00+09:00',
      visits: 0,
      orders: 0,
    }).snapshotAt,
    '2026-10-01T00:30:00.000Z',
  )
})

test('rejects non-zero-padded, impossible, missing, and ambiguous snapshot dates', async () => {
  const { normalizeListingOutcome } = await loadOutcomesModule()

  for (const snapshotAt of ['2026-9-30', '2026-02-30', '', 'not-a-date', '2026-10-01T09:30:00']) {
    assert.throws(
      () => normalizeListingOutcome({ listingId: 'invalid', snapshotAt }),
      /snapshotAt must be YYYY-MM-DD or a valid ISO 8601 timestamp/,
      `${JSON.stringify(snapshotAt)} must be rejected`,
    )
  }
})

test('treats date-only and ISO midnight as the same snapshot key', async () => {
  const { mergeListingOutcomeSnapshots } = await loadOutcomesModule()
  const merged = mergeListingOutcomeSnapshots(
    [{ listingId: '1', snapshotAt: '2026-10-01', visits: 0, orders: 1 }],
    [{ listingId: '1', snapshotAt: '2026-10-01T00:00:00.000Z', visits: 0, orders: 2 }],
  )

  assert.equal(merged.length, 1)
  assert.equal(merged[0].snapshotAt, '2026-10-01T00:00:00.000Z')
  assert.equal(merged[0].orders, 2)
})

test('keeps time-series snapshots and replaces only the same listing timestamp with the last row', async () => {
  const { mergeListingOutcomeSnapshots } = await loadOutcomesModule()
  const merged = mergeListingOutcomeSnapshots(
    [
      { listingId: '1', snapshotAt: '2026-07-01', visits: 0, orders: 0 },
      { listingId: '2', snapshotAt: '2026-07-01', visits: 0, orders: 1 },
    ],
    [
      { listingId: '1', snapshotAt: '2026-07-15', visits: 0, orders: 3 },
      { listingId: '1', snapshotAt: '2026-07-15', visits: 0, orders: 4 },
    ],
  )

  assert.equal(merged.length, 3)
  assert.equal(merged.find((row) => row.listingId === '1' && row.snapshotAt === '2026-07-01T00:00:00.000Z').orders, 0)
  assert.equal(merged.find((row) => row.listingId === '1' && row.snapshotAt === '2026-07-15T00:00:00.000Z').orders, 4)
  assert.equal(merged.find((row) => row.listingId === '2').orders, 1)
})

test('parses quoted listing outcome CSV into normalized rows', async () => {
  const { parseListingOutcomesCsv } = await loadOutcomesModule()
  const rows = parseListingOutcomesCsv([
    'researchedAt,listingId,clusterKey,visits30d,orders30d,netProfit30d,trafficSource,notes',
    '2026-07-01,100,nurses,80,0,0,"Etsy search, organic","comma, retained"',
    '2026-07-31,101,nurses,100,3,24.5,ads,winning row',
  ].join('\r\n'))

  assert.equal(rows.length, 2)
  assert.deepEqual(
    {
      listingId: rows[0].listingId,
      snapshotAt: rows[0].snapshotAt,
      visits: rows[0].visits,
      orders: rows[0].orders,
      trafficSource: rows[0].trafficSource,
      notes: rows[0].notes,
    },
    {
      listingId: '100',
      snapshotAt: '2026-07-01T00:00:00.000Z',
      visits: 80,
      orders: 0,
      trafficSource: 'Etsy search, organic',
      notes: 'comma, retained',
    },
  )
})

test('classifies watch, stop, early-go, and cluster-stop from each listing latest snapshot', async () => {
  const { summarizeListingLearning } = await loadOutcomesModule()
  const summary = summarizeListingLearning([
    { listingId: 'watch', clusterId: 'single', snapshotAt: '2026-06-01', visits: 80, orders: 0 },
    { listingId: 'stop', clusterId: 'single-2', snapshotAt: '2026-06-01', visits: 150, orders: 0 },
    { listingId: 'winner', clusterId: 'winner-cluster', snapshotAt: '2026-06-01', visits: 100, orders: 3 },
    { listingId: 'cluster-a', clusterId: 'zero-cluster', snapshotAt: '2026-05-01', visits: 500, orders: 5 },
    { listingId: 'cluster-a', clusterId: 'zero-cluster', snapshotAt: '2026-06-01', visits: 140, orders: 0 },
    { listingId: 'cluster-b', clusterId: 'zero-cluster', snapshotAt: '2026-06-01', visits: 160, orders: 0 },
  ], { month: 3 })

  assert.deepEqual(
    Object.fromEntries(summary.listings.map((row) => [row.listingId, row.status])),
    {
      watch: 'watch',
      stop: 'stop',
      winner: 'early-go',
      'cluster-a': 'cluster-stop',
      'cluster-b': 'cluster-stop',
    },
  )
})

test('uses the M3 winner-count bands', async () => {
  const { summarizeListingLearning } = await loadOutcomesModule()
  const scenarios = [
    [0, '0-1', 'diagnose-before-scaling'],
    [1, '0-1', 'diagnose-before-scaling'],
    [2, '2-4', 'continue-to-m6'],
    [4, '2-4', 'continue-to-m6'],
    [5, '5+', 'continue-plan'],
  ]

  for (const [winnerCount, band, action] of scenarios) {
    const rows = Array.from({ length: winnerCount }, (_, index) => ({
      listingId: `winner-${index}`,
      snapshotAt: '2026-07-01',
      visits: 100,
      orders: 3,
    }))
    const summary = summarizeListingLearning(rows, { month: 3 })
    assert.deepEqual(summary.m3, { winnerCount, band, action })
  }
})

test('replaces assumed M6 win rate, profit per order, and CVR with latest observed outcomes', async () => {
  const { summarizeListingLearning } = await loadOutcomesModule()
  const summary = summarizeListingLearning([
    { listingId: '1', snapshotAt: '2026-05-01', visits: 1000, orders: 100, netProfit: 900 },
    { listingId: '1', snapshotAt: '2026-06-01', visits: 100, orders: 3, netProfit: 30 },
    { listingId: '2', snapshotAt: '2026-06-01', visits: 200, orders: 1, netProfit: 10 },
    ...Array.from({ length: 48 }, (_, index) => ({
      listingId: `zero-${index}`,
      snapshotAt: '2026-06-01',
      visits: 10,
      orders: 0,
      netProfit: 0,
    })),
  ], { month: 6 })

  assert.deepEqual(summary.m6, {
    winnerRate: 0.02,
    averageNetProfitPerOrder: 10,
    conversionRate: 0.005128205128205128,
    action: 'consider-scale-or-margin',
  })
})

test('uses gap-free M6 action thresholds', async () => {
  const { summarizeListingLearning } = await loadOutcomesModule()

  for (const [listingCount, winnerCount, action] of [
    [25, 1, 'maintain-30-40'],
    [25, 2, 'maintain-25-30'],
    [26, 1, 'consider-scale-or-margin'],
  ]) {
    const rows = Array.from({ length: listingCount }, (_, index) => ({
      listingId: String(index),
      snapshotAt: '2026-07-01',
      visits: 100,
      orders: index < winnerCount ? 3 : 0,
      netProfit: index < winnerCount ? 30 : 0,
    }))
    assert.equal(summarizeListingLearning(rows, { month: 6 }).m6.action, action)
  }
})

test('recommends an exploration mode from observed winner strength', async () => {
  const { recommendNextExplorationMode } = await loadOutcomesModule()

  assert.equal(recommendNextExplorationMode({ m3: { winnerCount: 1 } }), 'distribution')
  assert.equal(recommendNextExplorationMode({ m3: { winnerCount: 3 } }), 'hybrid')
  assert.equal(recommendNextExplorationMode({ m3: { winnerCount: 5 } }), 'hybrid')
  assert.equal(recommendNextExplorationMode({ m6: { winnerRate: 0 } }), 'distribution')
  assert.equal(recommendNextExplorationMode({ m6: { winnerRate: 0.03 } }), 'hybrid')
  assert.equal(recommendNextExplorationMode({ m6: { winnerRate: 0.06 } }), 'winner-deepening')
  assert.equal(recommendNextExplorationMode({ m6: { winnerRate: 0.08 } }), 'winner-deepening')
})

test('GET and POST persist normalized arrays without deleting older timestamps', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'market-finder-outcomes-'))
  const dataDir = join(dir, 'market-finder', 'data')
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, 'listing-outcomes.json'), JSON.stringify([
    { listingId: '1', snapshotAt: '2026-07-01', visits: 20, orders: 0 },
  ]), 'utf8')
  const port = await reservePort()
  const child = spawn(process.execPath, [serverScript, dir, String(port)], { stdio: 'ignore' })
  t.after(() => {
    child.kill()
    rmSync(dir, { recursive: true, force: true })
  })
  await waitForServer(port)

  const initial = await fetch(`http://127.0.0.1:${port}/market-finder/listing-outcomes`)
  assert.equal(initial.status, 200)
  assert.equal((await initial.json()).length, 1)

  const saved = await fetch(`http://127.0.0.1:${port}/market-finder/listing-outcomes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { listingId: '1', snapshotAt: '2026-07-15', visits: '100', orders: '3', clicks: '12' },
      { listingId: '1', snapshotAt: '2026-07-15', visits: '110', orders: '4', clicks: '14' },
    ]),
  })
  assert.equal(saved.status, 200)
  const responseRows = await saved.json()
  assert.equal(responseRows.length, 2)
  assert.equal(responseRows.find((row) => row.snapshotAt === '2026-07-15T00:00:00.000Z').orders, 4)

  const storedRows = JSON.parse(readFileSync(join(dataDir, 'listing-outcomes.json'), 'utf8'))
  assert.deepEqual(storedRows, responseRows)
  assert.equal(readdirSync(dataDir).filter((name) => name.includes('.tmp')).length, 0)
})

test('POST accepts only valid JSON arrays and leaves the previous file intact', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'market-finder-outcomes-'))
  const dataDir = join(dir, 'market-finder', 'data')
  mkdirSync(dataDir, { recursive: true })
  const original = '[{"listingId":"safe","snapshotAt":"2026-07-01","orders":1}]\n'
  writeFileSync(join(dataDir, 'listing-outcomes.json'), original, 'utf8')
  const port = await reservePort()
  const child = spawn(process.execPath, [serverScript, dir, String(port)], { stdio: 'ignore' })
  t.after(() => {
    child.kill()
    rmSync(dir, { recursive: true, force: true })
  })
  await waitForServer(port)

  for (const body of ['not json', '{"listingId":"1"}', '[{"listingId":"missing-timestamp"}]']) {
    const response = await fetch(`http://127.0.0.1:${port}/market-finder/listing-outcomes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    assert.equal(response.status, 400, `${body} must be rejected`)
    assert.equal(readFileSync(join(dataDir, 'listing-outcomes.json'), 'utf8'), original)
  }

  const put = await fetch(`http://127.0.0.1:${port}/market-finder/listing-outcomes`, { method: 'PUT' })
  assert.equal(put.status, 405)
})

test('POST rejects invalid required Etsy Stats metrics without replacing prior outcomes', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'market-finder-outcomes-'))
  const dataDir = join(dir, 'market-finder', 'data')
  mkdirSync(dataDir, { recursive: true })
  const original = '[{"listingId":"safe","snapshotAt":"2026-07-01","visits":10,"orders":1}]\n'
  writeFileSync(join(dataDir, 'listing-outcomes.json'), original, 'utf8')
  const port = await reservePort()
  const child = spawn(process.execPath, [serverScript, dir, String(port)], { stdio: 'ignore' })
  t.after(() => {
    child.kill()
    rmSync(dir, { recursive: true, force: true })
  })
  await waitForServer(port)

  for (const body of [
    [{ listingId: 'missing-visits', snapshotAt: '2026-07-15', orders: 1 }],
    [{ listingId: 'invalid-orders', snapshotAt: '2026-07-15', visits: 10, orders: 'NaN' }],
    [{ listingId: 'negative-visits', snapshotAt: '2026-07-15', visits: -1, orders: 1 }],
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}/market-finder/listing-outcomes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    assert.equal(response.status, 400)
    assert.equal(readFileSync(join(dataDir, 'listing-outcomes.json'), 'utf8'), original)
  }
})

test('POST rejects bodies over 4 MiB without replacing existing outcomes', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'market-finder-outcomes-'))
  const dataDir = join(dir, 'market-finder', 'data')
  mkdirSync(dataDir, { recursive: true })
  const original = '[{"listingId":"safe","snapshotAt":"2026-07-01","orders":1}]\n'
  writeFileSync(join(dataDir, 'listing-outcomes.json'), original, 'utf8')
  const port = await reservePort()
  const child = spawn(process.execPath, [serverScript, dir, String(port)], { stdio: 'ignore' })
  t.after(() => {
    child.kill()
    rmSync(dir, { recursive: true, force: true })
  })
  await waitForServer(port)

  const response = await fetch(`http://127.0.0.1:${port}/market-finder/listing-outcomes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      listingId: 'large',
      snapshotAt: '2026-07-15',
      notes: 'x'.repeat((4 * 1024 * 1024) + 1),
    }]),
  })

  assert.equal(response.status, 413)
  assert.equal(readFileSync(join(dataDir, 'listing-outcomes.json'), 'utf8'), original)
})
