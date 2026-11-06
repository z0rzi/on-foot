import { hydrationGate } from '../hydrationGate'

describe('hydrationGate', () => {
  test('waits while hydration is pending and the bound has not passed', () => {
    expect(hydrationGate({ hydrated: false, failed: false, timedOut: false })).toBe('wait')
  })
  test('opens on hydration', () => {
    expect(hydrationGate({ hydrated: true, failed: false, timedOut: false })).toBe('hydrated')
  })
  test('opens on a failed hydration without waiting for the bound', () => {
    expect(hydrationGate({ hydrated: false, failed: true, timedOut: false })).toBe('failed')
  })
  test('opens past the bound when hydration never reported', () => {
    expect(hydrationGate({ hydrated: false, failed: false, timedOut: true })).toBe('timed-out')
  })
  test('a hydration that lands with the bound reads as hydrated', () => {
    expect(hydrationGate({ hydrated: true, failed: false, timedOut: true })).toBe('hydrated')
  })
  test('a failure reported with the bound reads as failed', () => {
    expect(hydrationGate({ hydrated: false, failed: true, timedOut: true })).toBe('failed')
  })
})
