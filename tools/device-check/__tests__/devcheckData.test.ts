import { devcheckName } from '../devcheckData'

describe('devcheckName', () => {
  it('gives a name the DEVCHECK prefix, once', () => {
    expect(devcheckName('climb then flat')).toBe('DEVCHECK climb then flat')
    expect(devcheckName('DEVCHECK climb')).toBe('DEVCHECK climb')
  })

  it('prefixes a name that only looks like it has the prefix, so cleanup finds it', () => {
    expect(devcheckName('DEVCHECK-climb')).toBe('DEVCHECK DEVCHECK-climb')
  })
})
