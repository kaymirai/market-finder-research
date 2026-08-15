import assert from 'node:assert/strict'
import test from 'node:test'

const schedulerApi = await import('../src/multi-angle-retry-scheduler.js')
  .catch(() => ({}))

test('stop and resume lets only the current retry timer dispatch', () => {
  assert.equal(typeof schedulerApi.createMultiAngleRetryScheduler, 'function')

  const callbacks = []
  const clearedHandles = []
  const scheduler = schedulerApi.createMultiAngleRetryScheduler({
    setTimeoutFn(callback) {
      callbacks.push(callback)
      return callbacks.length
    },
    clearTimeoutFn(handle) {
      clearedHandles.push(handle)
    },
  })
  const exploration = {
    status: 'running',
    retryQueue: [{ evidenceKey: 'retry-one' }],
  }
  let dispatchCount = 0
  const schedule = () => scheduler.schedule({
    delayMs: 60_000,
    isCurrent: () => (
      exploration.status === 'running'
      && exploration.retryQueue.length > 0
    ),
    dispatch: () => {
      dispatchCount += 1
    },
  })

  schedule()
  exploration.status = 'stopped'
  scheduler.invalidate()
  exploration.status = 'running'
  schedule()

  callbacks[0]()
  callbacks[1]()

  assert.equal(dispatchCount, 1)
  assert.deepEqual(clearedHandles, [1])
})

test('a new cycle invalidates a retry timer even if its callback later fires', () => {
  assert.equal(typeof schedulerApi.createMultiAngleRetryScheduler, 'function')

  const callbacks = []
  const scheduler = schedulerApi.createMultiAngleRetryScheduler({
    setTimeoutFn(callback) {
      callbacks.push(callback)
      return callbacks.length
    },
    clearTimeoutFn() {},
  })
  let dispatchCount = 0
  scheduler.schedule({
    delayMs: 60_000,
    isCurrent: () => true,
    dispatch: () => {
      dispatchCount += 1
    },
  })

  scheduler.invalidate()
  callbacks[0]()

  assert.equal(dispatchCount, 0)
})

test('the current timer checks live exploration state before dispatching', () => {
  assert.equal(typeof schedulerApi.createMultiAngleRetryScheduler, 'function')

  const callbacks = []
  const scheduler = schedulerApi.createMultiAngleRetryScheduler({
    setTimeoutFn(callback) {
      callbacks.push(callback)
      return callbacks.length
    },
    clearTimeoutFn() {},
  })
  const exploration = {
    status: 'running',
    retryQueue: [{ evidenceKey: 'retry-one' }],
  }
  let dispatchCount = 0
  scheduler.schedule({
    delayMs: 60_000,
    isCurrent: () => (
      exploration.status === 'running'
      && exploration.retryQueue.length > 0
    ),
    dispatch: () => {
      dispatchCount += 1
    },
  })

  exploration.retryQueue = []
  callbacks[0]()

  assert.equal(dispatchCount, 0)
})
