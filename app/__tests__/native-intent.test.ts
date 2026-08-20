import { redirectSystemPath } from '../+native-intent'

describe('redirectSystemPath', () => {
  test('redirects a content:// file-open URI into the add-GPX form, uri-encoded', () => {
    const path = 'content://media/external/downloads/1000058466'
    const result = redirectSystemPath({ path, initial: true })
    expect(result).toBe(`/trail/new?uri=${encodeURIComponent(path)}`)
    const uri = new URLSearchParams(result.split('?')[1]).get('uri')
    expect(uri).toBe(path)
  })

  test('redirects a file:// .gpx URI into the add-GPX form', () => {
    const path = 'file:///storage/emulated/0/Download/hike.gpx'
    const result = redirectSystemPath({ path, initial: false })
    expect(result).toBe(`/trail/new?uri=${encodeURIComponent(path)}`)
  })

  test('passes the app deep-link scheme through unchanged', () => {
    expect(redirectSystemPath({ path: 'onfootrn://trail/new', initial: false })).toBe('onfootrn://trail/new')
  })

  test('passes an https app link through unchanged', () => {
    expect(redirectSystemPath({ path: 'https://example.com/x', initial: true })).toBe('https://example.com/x')
  })

  test('passes an in-app absolute path through unchanged', () => {
    expect(redirectSystemPath({ path: '/trail/new', initial: false })).toBe('/trail/new')
  })
})
