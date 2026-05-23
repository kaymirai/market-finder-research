import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const DEFAULT_COLUMNS = [
  'keyword',
  'searches',
  'results',
  'search_result_ratio',
  'source_type',
  'source_id',
  'captured_at',
  'confidence',
  'notes',
]

function parseArgs(argv) {
  const args = {}
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith('--')) continue
    const key = value.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      index += 1
    }
  }
  return args
}

function toDate(value) {
  if (!value) return null
  const normalized = value.replace(' ', 'T')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatLocalDate(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(':')
}

function timestampFromName(name) {
  const match = name.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2})(\d{2})(\d{2})/)
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
}

function sourceIdFromName(name) {
  const match = name.match(/(\d{6})/)
  return match ? `screenshot_${match[1]}` : path.basename(name, path.extname(name))
}

function parseNumber(value) {
  return Number(value.replace(/,/g, ''))
}

function normalizeRatio(value) {
  if (/^0\d{4,}$/.test(value)) {
    return `0.${value.slice(1)}`
  }
  return value
}

function parseOcrLine(line) {
  const normalized = line.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  if (/^(keyword|searches|results|copy)\b/i.test(normalized)) return null

  const match = normalized.match(/^(.+?)\s+([\d,]+)\s+([\d,]+)\s+([0-9]+(?:\.[0-9]+)?)$/)
  if (!match) return null

  const [, rawKeyword, rawSearches, rawResults, rawRatio] = match
  const keyword = rawKeyword
    .replace(/^copy\s+/i, '')
    .trim()
    .toLowerCase()

  if (!keyword || keyword.length < 2) return null

  return {
    keyword,
    searches: parseNumber(rawSearches),
    results: parseNumber(rawResults),
    search_result_ratio: normalizeRatio(rawRatio),
  }
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows) {
  return [
    DEFAULT_COLUMNS.join(','),
    ...rows.map((row) => DEFAULT_COLUMNS.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n') + '\n'
}

async function main() {
  const args = parseArgs(process.argv)
  const inputDir = args.input
  const outPath = args.out
  const fromDate = toDate(args.from)
  const toDateValue = toDate(args.to)
  const moduleDir = args['module-dir'] || process.env.NODE_PATH

  if (!inputDir || !outPath) {
    throw new Error('Usage: node extract-youtube-screenshot-keywords.mjs --input <folder> --out <csv> [--from yyyy-mm-ddTHH:mm:ss] [--to yyyy-mm-ddTHH:mm:ss] [--module-dir <node_modules>]')
  }

  const requireFromModuleDir = createRequire(path.join(moduleDir || process.cwd(), 'ocr-deps.js'))
  let tesseract
  try {
    tesseract = requireFromModuleDir('tesseract.js')
  } catch {
    throw new Error('tesseract.js is not installed. Run: npm.cmd install tesseract.js "@tesseract.js-data/eng" --prefix market-finder/data/ocr-work')
  }

  const langPath = path.join(moduleDir || process.cwd(), '@tesseract.js-data', 'eng', '4.0.0')
  const imageFiles = fs.readdirSync(inputDir)
    .filter((name) => /\.png$/i.test(name))
    .map((name) => {
      const fullPath = path.join(inputDir, name)
      const capturedAt = timestampFromName(name) || fs.statSync(fullPath).mtime
      return { name, fullPath, capturedAt }
    })
    .filter((file) => !fromDate || file.capturedAt >= fromDate)
    .filter((file) => !toDateValue || file.capturedAt <= toDateValue)
    .sort((a, b) => a.capturedAt - b.capturedAt)

  const rowsByKeyword = new Map()
  const diagnostics = []

  for (const [index, file] of imageFiles.entries()) {
    console.log(`[${index + 1}/${imageFiles.length}] ${file.name}`)
    const result = await tesseract.recognize(file.fullPath, 'eng', {
      langPath,
    })
    const lines = result.data.text.split(/\r?\n/)
    let found = 0
    for (const line of lines) {
      const parsed = parseOcrLine(line)
      if (!parsed) continue
      found += 1
      const existing = rowsByKeyword.get(parsed.keyword)
      const row = {
        ...parsed,
        source_type: 'youtube_screenshot_ocr',
        source_id: sourceIdFromName(file.name),
        captured_at: formatLocalDate(file.capturedAt),
        confidence: 'ocr',
        notes: 'OCR seed only; validate in eRank and EverBee',
      }
      if (!existing || Number(row.searches) > Number(existing.searches)) {
        rowsByKeyword.set(parsed.keyword, row)
      }
    }
    diagnostics.push(`${file.name}: ${found} rows`)
  }

  const rows = [...rowsByKeyword.values()]
    .sort((a, b) => Number(b.searches) - Number(a.searches) || a.keyword.localeCompare(b.keyword))

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, toCsv(rows), 'utf8')
  fs.writeFileSync(outPath.replace(/\.csv$/i, '.log.txt'), diagnostics.join('\n') + '\n', 'utf8')
  console.log(`Wrote ${rows.length} rows to ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
