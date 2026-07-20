#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'

const root = resolve(process.argv[2] || '.')
const port = Number(process.argv[3] || 4173)
const host = '127.0.0.1'

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

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${host}:${port}`)
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
