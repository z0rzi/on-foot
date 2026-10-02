import { createSerialQueue } from '../serialQueue'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('createSerialQueue', () => {
  it('runs operations one at a time, in the order they were queued', async () => {
    const run = createSerialQueue()
    const order: string[] = []
    const first = deferred<void>()
    const second = deferred<void>()

    const a = run(async () => { order.push('a:start'); await first.promise; order.push('a:end') })
    const b = run(async () => { order.push('b:start'); await second.promise; order.push('b:end') })

    await Promise.resolve()
    expect(order).toEqual(['a:start'])
    first.resolve()
    await a
    await Promise.resolve()
    expect(order).toEqual(['a:start', 'a:end', 'b:start'])
    second.resolve()
    await b
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end'])
  })

  it('keeps running after an operation rejects, and gives the rejection to its own caller', async () => {
    const run = createSerialQueue()
    const failing = run(async () => { throw new Error('nope') })
    const after = run(async () => 'ran')

    await expect(failing).rejects.toThrow('nope')
    await expect(after).resolves.toBe('ran')
  })

  it('gives each queue its own chain, so one cannot block another', async () => {
    const slow = createSerialQueue()
    const fast = createSerialQueue()
    const blocker = deferred<void>()

    const blocked = slow(() => blocker.promise)
    await expect(fast(async () => 'free')).resolves.toBe('free')

    blocker.resolve()
    await blocked
  })
})
