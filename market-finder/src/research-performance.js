export function createMemoizedAnalysis(analyze) {
  let previousRows = null
  let previousOptionsKey = ''
  let previousResult = null

  return (rows, options) => {
    const optionsKey = JSON.stringify(options)
    if (rows === previousRows && optionsKey === previousOptionsKey) return previousResult

    previousRows = rows
    previousOptionsKey = optionsKey
    previousResult = analyze(rows, options)
    return previousResult
  }
}

export function mergeRowsByKey(existingRows, incomingRows, { keyOf, merge }) {
  const mergedRows = [...existingRows]
  const indexByKey = new Map()

  mergedRows.forEach((row, index) => {
    const key = keyOf(row)
    if (key) indexByKey.set(key, index)
  })

  incomingRows.forEach((incomingRow) => {
    const key = keyOf(incomingRow)
    if (!key) return

    const existingIndex = indexByKey.get(key)
    const existingRow = existingIndex === undefined ? null : mergedRows[existingIndex]
    const mergedRow = merge(existingRow, incomingRow, key)
    if (!mergedRow) return

    if (existingIndex === undefined) {
      indexByKey.set(key, mergedRows.length)
      mergedRows.push(mergedRow)
    } else {
      mergedRows[existingIndex] = mergedRow
    }
  })

  return mergedRows
}
