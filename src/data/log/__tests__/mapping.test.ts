import { encodeDetail } from '../mapping'

describe('encodeDetail', () => {
  it('encodes a detail object as compact JSON', () => {
    expect(encodeDetail({ a: 1, b: 'two' })).toBe('{"a":1,"b":"two"}')
  })

  it('is null when there is no detail', () => {
    expect(encodeDetail(undefined)).toBeNull()
  })

  it('is null rather than throwing when the value cannot be serialised', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(encodeDetail(cyclic)).toBeNull()
  })

  it('is null when the value serialises to nothing', () => {
    expect(encodeDetail({ fn: () => 1 })).toBe('{}')
  })
})
