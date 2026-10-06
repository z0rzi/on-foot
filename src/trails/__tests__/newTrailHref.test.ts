import { newTrailHref } from '../newTrailHref'

describe('newTrailHref', () => {
  test('encodes a content uri into the uri param', () => {
    expect(newTrailHref('content://downloads/42')).toBe(
      '/trail/new?uri=content%3A%2F%2Fdownloads%2F42',
    )
  })

  test('encodes a space as %20, not as +', () => {
    expect(newTrailHref('file:///tmp/Col du Palet.gpx')).toBe(
      '/trail/new?uri=file%3A%2F%2F%2Ftmp%2FCol%20du%20Palet.gpx',
    )
  })

  test('encodes characters that would otherwise split the query', () => {
    expect(newTrailHref('file:///a&b#c.gpx')).toBe('/trail/new?uri=file%3A%2F%2F%2Fa%26b%23c.gpx')
  })

  test('appends an encoded name when one is given', () => {
    expect(newTrailHref('file:///a.gpx', 'Col du Palet')).toBe(
      '/trail/new?uri=file%3A%2F%2F%2Fa.gpx&name=Col%20du%20Palet',
    )
  })

  test('omits an empty name', () => {
    expect(newTrailHref('file:///a.gpx', '')).toBe('/trail/new?uri=file%3A%2F%2F%2Fa.gpx')
  })

  test('omits a null name', () => {
    expect(newTrailHref('file:///a.gpx', null)).toBe('/trail/new?uri=file%3A%2F%2F%2Fa.gpx')
  })

  test('omits an absent name', () => {
    expect(newTrailHref('file:///a.gpx', undefined)).toBe('/trail/new?uri=file%3A%2F%2F%2Fa.gpx')
  })
})
