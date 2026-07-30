export function createMultiAngleRetryScheduler({
  setTimeoutFn,
  clearTimeoutFn,
} = {}) {
  let timerHandle = null
  let generation = 0

  function invalidate() {
    generation += 1
    if (timerHandle !== null) clearTimeoutFn(timerHandle)
    timerHandle = null
  }

  function schedule({
    delayMs = 0,
    isCurrent = () => true,
    dispatch,
  } = {}) {
    invalidate()
    const scheduledGeneration = generation
    timerHandle = setTimeoutFn(() => {
      if (scheduledGeneration !== generation) return
      timerHandle = null
      if (!isCurrent()) return
      dispatch()
    }, Math.max(0, Number(delayMs) || 0))
  }

  return {
    invalidate,
    schedule,
  }
}
