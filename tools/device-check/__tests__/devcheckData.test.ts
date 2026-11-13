import { devcheckName, devcheckNames, requireDevcheckName } from '../devcheckData'

describe('devcheckName', () => {
  it('gives a name the DEVCHECK prefix, once', () => {
    expect(devcheckName('climb then flat')).toBe('DEVCHECK climb then flat')
    expect(devcheckName('DEVCHECK climb')).toBe('DEVCHECK climb')
  })

  it('prefixes a name that only looks like it has the prefix, so cleanup finds it', () => {
    expect(devcheckName('DEVCHECK-climb')).toBe('DEVCHECK DEVCHECK-climb')
  })
})

describe('requireDevcheckName', () => {
  it('accepts a name with the DEVCHECK prefix and a space', () => {
    expect(() => requireDevcheckName('DEVCHECK climb')).not.toThrow()
  })

  it.each(['climb', 'DEVCHECKclimb', 'devcheck climb', ' DEVCHECK climb', 'DEVCHECK '])('refuses "%s"', (name) => {
    expect(() => requireDevcheckName(name)).toThrow('DEVCHECK ')
  })
})

describe('devcheckNames', () => {
  it('keeps the DEVCHECK rows, each as often as it is listed', () => {
    expect(devcheckNames(['DEVCHECK climb', 'Owner hike', 'DEVCHECK climb', 'DEVCHECKS mine', 'DEVCHECK flat'])).toEqual([
      'DEVCHECK climb',
      'DEVCHECK climb',
      'DEVCHECK flat',
    ])
  })
})
