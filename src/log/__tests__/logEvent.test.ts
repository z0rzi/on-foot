jest.mock('../../data/log', () => ({ logRepository: { append: jest.fn() } }))

import { logRepository } from '../../data/log'
import { flushLog, logEvent } from '../logEvent'

const append = jest.mocked(logRepository.append)

describe('logEvent', () => {
  beforeEach(() => {
    append.mockReset()
    append.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('writes the level, area, message and the time it was logged', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    logEvent('info', 'recording', 'start requested')
    await flushLog()

    expect(append).toHaveBeenCalledWith({
      t: 1_700_000_000_000,
      level: 'info',
      area: 'recording',
      message: 'start requested',
      detail: null,
    })

    nowSpy.mockRestore()
  })

  it('encodes detail as compact JSON', async () => {
    logEvent('warn', 'capture', 'stream refused', { reason: 'location-off' })
    await flushLog()

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ detail: '{"reason":"location-off"}' }),
    )
  })

  it('reaches the repository in the order the entries were logged', async () => {
    let firstSettled = false
    const callOrder: string[] = []

    append.mockImplementation(async (entry) => {
      if ((entry.message === 'second' || entry.message === 'third') && !firstSettled) {
        throw new Error(`${entry.message} was invoked before first settled`)
      }

      callOrder.push(entry.message)

      if (entry.message === 'first') {
        await new Promise(resolve => setTimeout(resolve, 100))
        firstSettled = true
      }
    })

    logEvent('info', 'recording', 'first')
    logEvent('info', 'recording', 'second')
    logEvent('info', 'recording', 'third')
    await flushLog()

    expect(callOrder).toEqual(['first', 'second', 'third'])
  })

  it('swallows a repository failure and still writes the next entry', async () => {
    append.mockRejectedValueOnce(new Error('disk gone'))

    logEvent('info', 'recording', 'doomed')
    logEvent('info', 'recording', 'survivor')
    await expect(flushLog()).resolves.toBeUndefined()

    expect(append).toHaveBeenCalledTimes(2)
    expect(append).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'survivor' }))
  })

  it('returns nothing, so no caller can await it', () => {
    expect(logEvent('info', 'map', 'mode changed')).toBeUndefined()
  })
})
