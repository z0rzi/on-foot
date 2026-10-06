import { LoadedState, resolveLoad } from '../loadedEntity'

type Trail = { id: number; name: string }

const resolved = (id: number, name = 'Ridge'): LoadedState<Trail> => ({
  id,
  result: { ok: true, entity: { id, name } },
})
const absent = (id: number): LoadedState<Trail> => ({ id, result: { ok: true, entity: null } })
const failed = (id: number): LoadedState<Trail> => ({ id, result: { ok: false } })

describe('resolveLoad', () => {
  test('no id -> idle', () => {
    expect(resolveLoad(null, null)).toEqual({ status: 'idle', entity: null })
  })

  test('no id discards a result from when there was one', () => {
    expect(resolveLoad(null, resolved(1))).toEqual({ status: 'idle', entity: null })
  })

  test('nothing loaded yet -> loading', () => {
    expect(resolveLoad(1, null)).toEqual({ status: 'loading', entity: null })
  })

  test('a result keyed to the previous id -> loading, never the stale entity', () => {
    expect(resolveLoad(2, resolved(1))).toEqual({ status: 'loading', entity: null })
  })

  test('a failure keyed to the previous id is not reported for the new id', () => {
    expect(resolveLoad(2, failed(1))).toEqual({ status: 'loading', entity: null })
  })

  test('a rejected load -> error', () => {
    expect(resolveLoad(1, failed(1))).toEqual({ status: 'error', entity: null })
  })

  test('a load that resolved null -> missing', () => {
    expect(resolveLoad(1, absent(1))).toEqual({ status: 'missing', entity: null })
  })

  test('a load that resolved an entity -> ready, carrying it', () => {
    expect(resolveLoad(1, resolved(1, 'Col du Palet'))).toEqual({
      status: 'ready',
      entity: { id: 1, name: 'Col du Palet' },
    })
  })

  test('a non-finite id -> idle, rather than loading for ever', () => {
    expect(resolveLoad(Number('not-a-number'), null)).toEqual({ status: 'idle', entity: null })
  })
})
