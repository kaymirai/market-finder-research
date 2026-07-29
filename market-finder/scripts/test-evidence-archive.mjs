import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const [app, html] = await Promise.all([
  readFile(new URL('src/app.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
])

const serverScript = new URL('static-server.mjs', import.meta.url).pathname.replace(/^\//, '')
const port = 4399

function startServer(dir) {
  const child = spawn(process.execPath, [serverScript, dir, String(port)], { stdio: 'ignore' })
  return child
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/market-finder/archive`)
      if (response.ok) return
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('static server did not start')
}

test('stores research evidence on disk and lists it back', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'market-finder-archive-'))
  mkdirSync(join(dir, 'market-finder'), { recursive: true })
  writeFileSync(join(dir, 'market-finder', 'index.html'), '<p>ok</p>', 'utf8')
  const child = startServer(dir)
  t.after(() => {
    child.kill()
    rmSync(dir, { recursive: true, force: true })
  })
  await waitForServer()

  const listed = await (await fetch(`http://127.0.0.1:${port}/market-finder/archive`)).json()
  assert.deepEqual(listed.files, [])

  const record = {
    version: 1,
    categoryId: 'shirt',
    eventId: 'halloween',
    demandKeywords: [{ keyword: 'halloween nurse shirt', etsySearches30d: 1300 }],
    supplyListings: [{ title: 'NICU Nurse Halloween Sweatshirt', monthlySales: 4 }],
  }
  const saved = await fetch(`http://127.0.0.1:${port}/market-finder/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  assert.equal(saved.status, 200)
  const { name } = await saved.json()
  assert.match(name, /shirt-halloween\.json$/)

  // The stored file has to be readable back through the same static route the app fetches.
  const fetched = await (await fetch(`http://127.0.0.1:${port}/market-finder/archive/${name}`)).json()
  assert.deepEqual(fetched.demandKeywords, record.demandKeywords)

  const relisted = await (await fetch(`http://127.0.0.1:${port}/market-finder/archive`)).json()
  assert.deepEqual(relisted.files, [name])

  // Appending must never disturb what is already there, because a lost archive is a lookup
  // quota that cannot be bought back.
  await fetch(`http://127.0.0.1:${port}/market-finder/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...record, categoryId: 'mug' }),
  })
  assert.equal(readdirSync(join(dir, 'market-finder', 'archive')).length, 2)
  assert.deepEqual(
    JSON.parse(readFileSync(join(dir, 'market-finder', 'archive', name), 'utf8')).demandKeywords,
    record.demandKeywords,
  )
})

test('refuses archives that are not a JSON object and never takes a path from the client', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'market-finder-archive-'))
  mkdirSync(join(dir, 'market-finder'), { recursive: true })
  const child = startServer(dir)
  t.after(() => {
    child.kill()
    rmSync(dir, { recursive: true, force: true })
  })
  await waitForServer()

  for (const body of ['not json', '"a string"', '[1,2,3]']) {
    const response = await fetch(`http://127.0.0.1:${port}/market-finder/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    assert.equal(response.status, 400, `${body} must be rejected`)
  }

  // A traversal attempt in the payload must land in the archive directory like any other
  // record, because the filename is derived here and never read from the request.
  const escaped = await fetch(`http://127.0.0.1:${port}/market-finder/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: '../../../etc/passwd', eventId: '../..' }),
  })
  assert.equal(escaped.status, 200)
  const files = readdirSync(join(dir, 'market-finder', 'archive'))
  assert.equal(files.length, 1)
  assert.doesNotMatch(files[0], /\.\./)

  const put = await fetch(`http://127.0.0.1:${port}/market-finder/archive`, { method: 'PUT' })
  assert.equal(put.status, 405)
})

test('updates one version-three archive for the same run and creates a new file for another run', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'market-finder-archive-'))
  mkdirSync(join(dir, 'market-finder'), { recursive: true })
  const child = startServer(dir)
  t.after(() => {
    child.kill()
    rmSync(dir, { recursive: true, force: true })
  })
  await waitForServer()

  const post = (record) => fetch(`http://127.0.0.1:${port}/market-finder/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  const first = await (await post({
    version: 3,
    runId: 'initial:2026-07-26T01:00:00.000Z',
    categoryId: 'shirt',
    eventId: 'halloween',
    drilldownNodes: [{ keyword: 'teacher shirt', verdict: 'needs-research' }],
  })).json()
  const second = await (await post({
    version: 3,
    runId: 'initial:2026-07-26T01:00:00.000Z',
    categoryId: 'shirt',
    eventId: 'halloween',
    drilldownNodes: [{ keyword: 'teacher shirt', verdict: 'watch' }],
  })).json()

  assert.equal(second.name, first.name)
  assert.equal(readdirSync(join(dir, 'market-finder', 'archive')).length, 1)
  assert.equal(
    JSON.parse(readFileSync(join(dir, 'market-finder', 'archive', first.name), 'utf8')).drilldownNodes[0].verdict,
    'watch',
  )

  await post({
    version: 3,
    runId: 'initial:2026-07-27T01:00:00.000Z',
    categoryId: 'shirt',
    eventId: 'halloween',
    drilldownNodes: [],
  })
  assert.equal(readdirSync(join(dir, 'market-finder', 'archive')).length, 2)
})

test('feeds versioned contextual archives into the next candidate search', () => {
  assert.match(app, /analyzeMarketplaceVocabulary\(marketplaceLearningRecords\(\)/)
  assert.match(app, /learnedBuyerIntentSignals\(analysis/)
  assert.match(app, /learnedSignals: learnedSignalsForGeneration\(\)/)
  assert.match(app, /version: 3/)
  assert.match(app, /drilldownNodes:/)
  assert.match(app, /function currentEvidenceRunId\(\)/)
  assert.match(app, /`\$\{round\.id\}:\$\{startedAt\}`/)
  assert.match(app, /const runId = currentEvidenceRunId\(\)/)
  assert.match(app, /locale: 'en-US'/)
  assert.match(app, /context: \{/)
  assert.match(app, /buyerIdentities: buyerIdentityLines\(\)/)
  assert.match(app, /function evidenceRecordFingerprint\(/)
  assert.match(app, /runId: String\(record\.runId \?\? ''\)/)
  assert.match(app, /function scheduleEvidenceAutoArchive\(/)
  assert.match(app, /function addResearchRows\(rows\)[\s\S]{0,260}scheduleEvidenceAutoArchive\(\)/)
  assert.match(app, /自動保管/)
  assert.match(app, /function evidenceArchiveBlockReason\(\)/)
  assert.match(app, /file:\/\/ で開いています/)
  assert.match(app, /elements\.evidenceArchiveBtn\.disabled = Boolean\(blocked\)/)
  assert.match(app, /filesToLoad = \(files \?\? \[\]\)\.slice\(-EVIDENCE_ARCHIVE_LOAD_LIMIT\)/)
  assert.match(app, /loadEvidenceArchives\(\)/)
  assert.match(html, /id="evidenceArchiveBtn"/)
  assert.match(html, /id="evidenceArchiveStatus"/)
})
