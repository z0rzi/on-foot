import { sheetRest } from '../sheetRest'

// Pip row 20 dp over the 62 dp graph and its 12 dp gap, 44 dp alone; nav row 72 dp; a 10 dp
// gesture inset inside the 16 dp margin.
const base = { graphShown: false, navRowHeight: 72, systemInset: 10 }

describe('sheetRest', () => {
  test('nothing shown and idle, the card rests as the nav card: the nav row alone', () => {
    expect(sheetRest({ ...base, mode: 'free' })).toEqual({
      kind: 'nav',
      height: 72,
      bottomInset: 16,
      covered: 88,
      navRowHeight: 72,
    })
  })
  test('the nav card never holds a graph', () => {
    expect(sheetRest({ ...base, mode: 'free', graphShown: true })).toMatchObject({ kind: 'nav', height: 72 })
  })
  test('a shown trail with no profile rests as the graph card collapsed on its pip row only', () => {
    expect(sheetRest({ ...base, mode: 'trail' })).toEqual({
      kind: 'graph',
      height: 44,
      bottomInset: 16,
      covered: 60,
      navRowHeight: 72,
    })
  })
  test('a shown trail with a profile rests collapsed on the pip row and the graph under it', () => {
    expect(sheetRest({ ...base, mode: 'trail', graphShown: true })).toEqual({
      kind: 'graph',
      height: 94,
      bottomInset: 16,
      covered: 110,
      navRowHeight: 72,
    })
  })
  test('a shown activity rests collapsed', () => {
    expect(sheetRest({ ...base, mode: 'activity', graphShown: true })).toMatchObject({ kind: 'graph', height: 94 })
  })
  test('recording, paused included, rests collapsed, with or without a profile yet', () => {
    expect(sheetRest({ ...base, mode: 'recording' })).toMatchObject({ kind: 'graph', height: 44 })
    expect(sheetRest({ ...base, mode: 'recording', graphShown: true })).toMatchObject({ kind: 'graph', height: 94 })
  })
  test('the bottom inset is the 16 dp side margin, the system inset lying inside it', () => {
    for (const mode of ['free', 'trail'] as const) {
      expect(sheetRest({ ...base, mode, systemInset: 0 }).bottomInset).toBe(16)
      expect(sheetRest({ ...base, mode, systemInset: 10 }).bottomInset).toBe(16)
    }
  })
  test('a system inset taller than the margin carries the card on top of it', () => {
    for (const mode of ['free', 'trail'] as const) {
      expect(sheetRest({ ...base, mode, systemInset: 48 }).bottomInset).toBe(48)
    }
  })
  test('the covered height counts the card and its bottom inset', () => {
    expect(sheetRest({ ...base, mode: 'trail', graphShown: true, systemInset: 48 }).covered).toBe(142)
    expect(sheetRest({ ...base, mode: 'free', systemInset: 0 }).covered).toBe(88)
  })
})
