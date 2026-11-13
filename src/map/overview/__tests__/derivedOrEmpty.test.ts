import { derivedOrEmpty } from '../derivedOrEmpty'

describe('an overview derivation that throws leaves the overview empty (Failure modes)', () => {
  it('passes a derivation’s value through, with no failure', () =>
    expect(derivedOrEmpty(() => ['trail-1'], [])).toEqual({ value: ['trail-1'], failure: null }))

  it('gives the empty value and the error when the derivation throws', () => {
    const error = new TypeError('rows')
    const derived = derivedOrEmpty((): string[] => {
      throw error
    }, [])
    expect(derived).toEqual({ value: [], failure: { error } })
  })

  it('reports a thrown non-error too', () =>
    expect(
      derivedOrEmpty((): number => {
        throw undefined
      }, 0),
    ).toEqual({ value: 0, failure: { error: undefined } }))
})
