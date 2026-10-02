jest.mock('../../data/log', () => ({ logRepository: { append: jest.fn() } }))

import { logRepository } from '../../data/log'
import { flushLog, logEvent } from '../logEvent'

const append = jest.mocked(logRepository.append)

describe('logEvent', () => {
  beforeEach(() => {
    append.mockReset()
    append.mockResolvedValue(undefined)
  })

  it('writes the level, area, message and the time it was logged', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    logEvent('info', 'recording', 'start requested')
    await flushLog()

    expect(append).toHaveBeenCalledWith({
      t: 1_700_000_000_000,
      level: 'info',
      area: 'recording',
      message: 'start requested',
      detail: null,
    })
  })

  it('encodes detail as compact JSON', async () => {
    logEvent('warn', 'capture', 'stream refused', { reason: 'location-off' })
    await flushLog()

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ detail: '{"reason":"location-off"}' }),
    )
  })

  it('reaches the repository in the order the entries were logged', async () => {
    const order: string[] = []
    append.mockImplementation(async (entry) => { order.push(entry.message) })

    logEvent('info', 'recording', 'first')
    logEvent('info', 'recording', 'second')
    logEvent('info', 'recording', 'third')
    await flushLog()

    expect(order).toEqual(['first', 'second', 'third'])
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
