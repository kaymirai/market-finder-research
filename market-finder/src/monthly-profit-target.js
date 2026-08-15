const DEFAULT_TARGETS_YEN = Object.freeze([50000, 100000])

function positiveNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function nonNegativeNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function normalizedTargets(value) {
  const source = Array.isArray(value) && value.length > 0 ? value : DEFAULT_TARGETS_YEN
  const targets = [...new Set(source.map(positiveNumber).filter((item) => item !== null))]
  return targets.length > 0 ? targets.sort((left, right) => left - right) : [...DEFAULT_TARGETS_YEN]
}

export function calculateMonthlyProfitTarget(input = {}) {
  const unitProfitYen = positiveNumber(input.unitProfitYen)
  const estimatedMonthlySales = nonNegativeNumber(input.estimatedMonthlySales)
  const targetValues = normalizedTargets(input.targetsYen)

  if (unitProfitYen === null) {
    return {
      unitProfitYen: null,
      estimatedMonthlySales,
      targets: targetValues.map((targetYen) => ({
        targetYen,
        requiredSales: null,
        coverageRatio: null,
      })),
      band: 'unavailable',
    }
  }

  const targets = targetValues.map((targetYen) => {
    const requiredSales = Math.ceil(targetYen / unitProfitYen)
    return {
      targetYen,
      requiredSales,
      coverageRatio: Number((estimatedMonthlySales / requiredSales).toFixed(2)),
    }
  })
  const reached = targets.filter((target) => estimatedMonthlySales >= target.requiredSales)

  return {
    unitProfitYen,
    estimatedMonthlySales,
    targets,
    band: reached.length === targets.length
      ? '100k'
      : reached.length > 0
        ? '50k'
        : 'below',
  }
}

export { DEFAULT_TARGETS_YEN }
