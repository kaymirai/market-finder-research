import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptsDir, '..', '..')
const serverScript = resolve(scriptsDir, 'static-server.mjs')

async function reservePort() {
  const listener = createServer()
  await new Promise((resolvePromise, reject) => {
    listener.once('error', reject)
    listener.listen(0, '127.0.0.1', resolvePromise)
  })
  const address = listener.address()
  const port = address && typeof address === 'object' ? address.port : null
  await new Promise((resolvePromise, reject) => listener.close((error) => error ? reject(error) : resolvePromise()))
  if (!port) throw new Error('Could not reserve a local test port')
  return port
}

async function waitForHealth(baseUrl) {
  let lastError
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/market-finder/health`)
      if (response.ok) return
      lastError = new Error(`Health check returned ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50))
  }
  throw lastError || new Error('Market Finder server did not become healthy')
}

async function waitForNoHealth(baseUrl) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(`${baseUrl}/market-finder/health`)
    } catch {
      return
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50))
  }
  throw new Error('Market Finder server did not stop')
}

async function waitForFile(path) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (existsSync(path)) return
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50))
  }
  throw new Error(`Timed out waiting for ${path}`)
}

function runPowerShell(script, args, timeoutMs = 10000) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], { cwd: root })
    let output = ''
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      resolvePromise({ code, output, timedOut })
    })
  })
}

async function listenOnWildcard(host, port) {
  const listener = createServer((socket) => socket.destroy())
  await new Promise((resolvePromise, reject) => {
    listener.once('error', reject)
    listener.listen(port, host, resolvePromise)
  })
  return listener
}

test('health endpoint identifies only the Market Finder server', async (t) => {
  const port = await reservePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [serverScript, root, String(port)], { stdio: 'ignore' })
  t.after(() => {
    if (!child.killed) child.kill()
  })

  await waitForHealth(baseUrl)
  const response = await fetch(`${baseUrl}/market-finder/health`)
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.service, 'market-finder')
  assert.equal(payload.root, root)
  assert.ok(Number.isInteger(payload.pid))
})

test('launcher reuses its healthy server and stop targets only its recorded PID', async (t) => {
  const port = await reservePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const pidPath = resolve(root, '.tmp', `market-finder-${port}.pid`)
  const startScript = resolve(root, 'scripts', 'start-market-finder.ps1')
  const stopScript = resolve(root, 'scripts', 'stop-market-finder.ps1')
  t.after(() => {
    if (existsSync(pidPath)) rmSync(pidPath)
  })

  const started = await runPowerShell(startScript, ['-NoBrowser', '-Port', String(port)])
  assert.equal(started.code, 0, started.output)
  await waitForHealth(baseUrl)
  const firstHealth = await (await fetch(`${baseUrl}/market-finder/health`)).json()
  assert.equal(readFileSync(pidPath, 'utf8').trim(), String(firstHealth.pid))

  const reused = await runPowerShell(startScript, ['-NoBrowser', '-Port', String(port)])
  assert.equal(reused.code, 0, reused.output)
  assert.match(reused.output, /reusing PID/i)
  const secondHealth = await (await fetch(`${baseUrl}/market-finder/health`)).json()
  assert.equal(secondHealth.pid, firstHealth.pid)

  const stopped = await runPowerShell(stopScript, ['-Port', String(port)])
  assert.equal(stopped.code, 0, stopped.output)
  assert.equal(existsSync(pidPath), false)
  await waitForNoHealth(baseUrl)
})

test('launcher opens the requested browser when reusing a healthy server', async (t) => {
  const port = await reservePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const pidPath = resolve(root, '.tmp', `market-finder-${port}.pid`)
  const markerPath = resolve(root, '.tmp', `market-finder-browser-${port}.txt`)
  const browserPath = resolve(root, '.tmp', `market-finder-browser-${port}.cmd`)
  const startScript = resolve(root, 'scripts', 'start-market-finder.ps1')
  const stopScript = resolve(root, 'scripts', 'stop-market-finder.ps1')
  t.after(async () => {
    if (existsSync(pidPath)) await runPowerShell(stopScript, ['-Port', String(port)])
    for (const path of [markerPath, browserPath]) {
      if (existsSync(path)) rmSync(path)
    }
  })

  const started = await runPowerShell(startScript, ['-NoBrowser', '-Port', String(port)])
  assert.equal(started.code, 0, started.output)
  await waitForHealth(baseUrl)
  writeFileSync(browserPath, `@echo off\r\necho opened>"${markerPath}"\r\n`, 'ascii')

  const reused = await runPowerShell(startScript, ['-Port', String(port), '-BrowserPath', browserPath])
  assert.equal(reused.code, 0, reused.output)
  assert.match(reused.output, /reusing PID/i)
  await waitForFile(markerPath)
  assert.equal(readFileSync(markerPath, 'utf8').trim(), 'opened')
})

for (const [host, name] of [['0.0.0.0', 'IPv4'], ['::', 'IPv6']]) {
  test(`launcher immediately refuses an unknown ${name} wildcard listener`, async (t) => {
    const port = await reservePort()
    const listener = await listenOnWildcard(host, port)
    const pidPath = resolve(root, '.tmp', `market-finder-${port}.pid`)
    const startScript = resolve(root, 'scripts', 'start-market-finder.ps1')
    const stopScript = resolve(root, 'scripts', 'stop-market-finder.ps1')
    t.after(async () => {
      if (existsSync(pidPath)) await runPowerShell(stopScript, ['-Port', String(port)])
      await new Promise((resolvePromise) => listener.close(resolvePromise))
    })

    const result = await runPowerShell(startScript, ['-NoBrowser', '-Port', String(port)], 2500)
    assert.equal(result.timedOut, false, `launcher did not reject the ${name} wildcard listener promptly`)
    assert.notEqual(result.code, 0)
    assert.match(result.output, new RegExp(`Port ${port} is already used`))
  })
}

test('stop refuses a PID file that points to an unrelated Node process', async (t) => {
  const port = await reservePort()
  const pidPath = resolve(root, '.tmp', `market-finder-${port}.pid`)
  const stopScript = resolve(root, 'scripts', 'stop-market-finder.ps1')
  const unrelatedNode = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  t.after(() => {
    if (existsSync(pidPath)) rmSync(pidPath)
    if (unrelatedNode.exitCode === null) unrelatedNode.kill()
  })
  await new Promise((resolvePromise) => unrelatedNode.once('spawn', resolvePromise))
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 50))
  writeFileSync(pidPath, String(unrelatedNode.pid), 'ascii')

  const result = await runPowerShell(stopScript, ['-Port', String(port)])
  assert.notEqual(result.code, 0)
  assert.match(result.output, /not serving the verified Market Finder health endpoint/)
  assert.doesNotThrow(() => process.kill(unrelatedNode.pid, 0))
})
