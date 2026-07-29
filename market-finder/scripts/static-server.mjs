#!/usr/bin/env node
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'
import { mergeListingOutcomeSnapshots } from '../src/listing-outcomes.js'

const root = resolve(process.argv[2] || '.')
const port = Number(process.argv[3] || 4173)
const host = '127.0.0.1'

// Research evidence is expensive to collect and was living only in one browser's
// localStorage, where clearing site data or switching machines threw away every lookup ever
// paid for. Writing it to disk keeps it reviewable, diffable and backed up by the same git
// history as the code that produced it.
const archiveDir = join(root, 'market-finder', 'archive')
const ARCHIVE_MAX_BYTES = 4 * 1024 * 1024
const listingOutcomesFile = join(root, 'market-finder', 'data', 'listing-outcomes.json')
const LISTING_OUTCOMES_MAX_BYTES = 4 * 1024 * 1024

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

function send(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': type,
  })
  response.end(body)
}

function safeJoin(base, requestPath) {
  const normalized = normalize(requestPath).replace(/^(\.\.[/\\])+/, '')
  const target = resolve(base, normalized)
  const rel = relative(base, target)
  if (rel.startsWith('..') || rel === '..' || rel.includes(`..${sep}`)) return null
  return target
}

function resolveRequest(pathname) {
  if (pathname === '/') return { redirect: '/market-finder/' }

  const decoded = decodeURIComponent(pathname)
  if (decoded.startsWith('/market-finder/')) {
    const relPath = decoded.slice('/market-finder/'.length) || 'index.html'
    return { file: safeJoin(join(root, 'market-finder'), relPath) }
  }

  if (decoded.startsWith('/shared/')) {
    const relPath = decoded.slice('/shared/'.length)
    return { file: safeJoin(join(root, 'shared'), relPath) }
  }

  return { status: 404 }
}

function archiveSlug(record) {
  const parts = [record?.categoryId, record?.eventId || 'no-event']
    .map((value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
  return parts.join('-') || 'research'
}

function listArchives() {
  if (!existsSync(archiveDir)) return []
  return readdirSync(archiveDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
}

// The filename is built here rather than taken from the request. A browser posting a path
// is the whole shape of a directory traversal, and nothing about this endpoint needs it.
function writeArchive(body) {
  const record = JSON.parse(body)
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Archive must be a JSON object')
  }
  mkdirSync(archiveDir, { recursive: true })
  const runId = String(record.runId ?? '').trim()
  if (Number(record.version) >= 3 && runId) {
    const existingName = listArchives().find((name) => {
      try {
        const existing = JSON.parse(readFileSync(join(archiveDir, name), 'utf8'))
        return Number(existing?.version) >= 3 && String(existing?.runId ?? '').trim() === runId
      } catch {
        return false
      }
    })
    if (existingName) {
      writeFileSync(join(archiveDir, existingName), JSON.stringify(record, null, 2), 'utf8')
      return existingName
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const name = `${stamp}-${archiveSlug(record)}.json`
  writeFileSync(join(archiveDir, name), JSON.stringify(record, null, 2), 'utf8')
  return name
}

function handleArchivePost(request, response) {
  let body = ''
  let aborted = false
  request.on('data', (chunk) => {
    if (aborted) return
    body += chunk
    if (body.length > ARCHIVE_MAX_BYTES) {
      aborted = true
      send(response, 413, 'Archive too large')
      request.destroy()
    }
  })
  request.on('end', () => {
    if (aborted) return
    try {
      const name = writeArchive(body)
      send(response, 200, JSON.stringify({ name }), contentTypes['.json'])
    } catch (error) {
      send(response, 400, error instanceof Error ? error.message : 'Bad archive')
    }
  })
}

function readListingOutcomes() {
  if (!existsSync(listingOutcomesFile)) return []
  const rows = JSON.parse(readFileSync(listingOutcomesFile, 'utf8'))
  if (!Array.isArray(rows)) throw new Error('Stored listing outcomes must be a JSON array')
  return mergeListingOutcomeSnapshots([], rows, { allowLegacyIncoming: true })
}

function writeListingOutcomes(rows) {
  const dataDir = join(root, 'market-finder', 'data')
  mkdirSync(dataDir, { recursive: true })
  const temporaryFile = join(dataDir, `.listing-outcomes-${process.pid}-${Date.now()}.tmp`)
  try {
    writeFileSync(temporaryFile, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
    renameSync(temporaryFile, listingOutcomesFile)
  } catch (error) {
    if (existsSync(temporaryFile)) unlinkSync(temporaryFile)
    throw error
  }
}

function handleListingOutcomesPost(request, response) {
  const chunks = []
  let receivedBytes = 0
  let rejected = false
  request.on('data', (chunk) => {
    if (rejected) return
    receivedBytes += chunk.length
    if (receivedBytes > LISTING_OUTCOMES_MAX_BYTES) {
      rejected = true
      send(response, 413, 'Listing outcomes too large')
      return
    }
    chunks.push(chunk)
  })
  request.on('end', () => {
    if (rejected) return
    try {
      const incoming = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!Array.isArray(incoming)) throw new Error('Listing outcomes must be a JSON array')
      const merged = mergeListingOutcomeSnapshots(readListingOutcomes(), incoming, { allowLegacyExisting: true })
      writeListingOutcomes(merged)
      send(response, 200, JSON.stringify(merged), contentTypes['.json'])
    } catch (error) {
      send(response, 400, error instanceof Error ? error.message : 'Bad listing outcomes')
    }
  })
}

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${host}:${port}`)

    if (url.pathname === '/market-finder/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        send(response, 405, 'Method not allowed')
        return
      }
      send(response, 200, JSON.stringify({ service: 'market-finder', pid: process.pid, root }), contentTypes['.json'])
      return
    }

    if (url.pathname === '/market-finder/archive') {
      if (request.method === 'POST') {
        handleArchivePost(request, response)
        return
      }
      if (request.method === 'GET') {
        send(response, 200, JSON.stringify({ files: listArchives() }), contentTypes['.json'])
        return
      }
      send(response, 405, 'Method not allowed')
      return
    }

    if (url.pathname === '/market-finder/listing-outcomes') {
      if (request.method === 'POST') {
        handleListingOutcomesPost(request, response)
        return
      }
      if (request.method === 'GET') {
        try {
          send(response, 200, JSON.stringify(readListingOutcomes()), contentTypes['.json'])
        } catch (error) {
          send(response, 500, error instanceof Error ? error.message : 'Stored listing outcomes are invalid')
        }
        return
      }
      send(response, 405, 'Method not allowed')
      return
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(response, 405, 'Method not allowed')
      return
    }

    const resolved = resolveRequest(url.pathname)

    if (resolved.redirect) {
      response.writeHead(302, { Location: resolved.redirect })
      response.end()
      return
    }

    if (!resolved.file || !existsSync(resolved.file)) {
      send(response, resolved.status || 404, 'Not found')
      return
    }

    const stats = statSync(resolved.file)
    const file = stats.isDirectory() ? join(resolved.file, 'index.html') : resolved.file
    if (!existsSync(file) || !statSync(file).isFile()) {
      send(response, 404, 'Not found')
      return
    }

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': statSync(file).size,
      'Content-Type': contentTypes[extname(file).toLowerCase()] || 'application/octet-stream',
    })
    createReadStream(file).pipe(response)
  } catch (error) {
    send(response, 500, error instanceof Error ? error.message : 'Server error')
  }
})

server.listen(port, host)
