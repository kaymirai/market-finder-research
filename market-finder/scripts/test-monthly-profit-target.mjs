import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateMonthlyProfitTarget } from '../src/monthly-profit-target.js'

test('calculates hand-checked sales counts for fifty and one hundred thousand yen', () => {
  const result = calculateMonthlyProfitTarget({
    unitProfitYen: 800,
    estimatedMonthlySales: 20,
  })

  assert.deepEqual(result.targets.map(({ targetYen, requiredSales }) => ({ targetYen, requiredSales })), [
    { targetYen: 50000, requiredSales: 63 },
    { targetYen: 100000, requiredSales: 125 },
  ])
})

test('marks an estimate above the upper target as one-hundred-thousand-yen range', () => {
  const result = calculateMonthlyProfitTarget({
    unitProfitYen: 800,
    estimatedMonthlySales: 130,
  })

  assert.equal(result.band, '100k')
  assert.equal(result.targets[0].coverageRatio, 2.06)
  assert.equal(result.targets[1].coverageRatio, 1.04)
})

test('marks an estimate between both required counts as fifty-thousand-yen range', () => {
  const result = calculateMonthlyProfitTarget({
    unitProfitYen: 800,
    estimatedMonthlySales: 70,
  })

  assert.equal(result.band, '50k')
})

test('marks an estimate below both target counts as insufficient', () => {
  const result = calculateMonthlyProfitTarget({
    unitProfitYen: 800,
    estimatedMonthlySales: 20,
  })

  assert.equal(result.band, 'below')
})

test('does not invent required sales when unit profit is missing or zero', () => {
  for (const unitProfitYen of [undefined, null, 0, -100]) {
    const result = calculateMonthlyProfitTarget({
      unitProfitYen,
      estimatedMonthlySales: 100,
    })

    assert.equal(result.band, 'unavailable')
    assert.deepEqual(result.targets.map((target) => target.requiredSales), [null, null])
  }
})

test('normalizes negative or missing monthly estimates without overstating target coverage', () => {
  const result = calculateMonthlyProfitTarget({
    unitProfitYen: 1000,
    estimatedMonthlySales: -5,
  })

  assert.equal(result.estimatedMonthlySales, 0)
  assert.equal(result.band, 'below')
  assert.deepEqual(result.targets.map((target) => target.coverageRatio), [0, 0])
})
