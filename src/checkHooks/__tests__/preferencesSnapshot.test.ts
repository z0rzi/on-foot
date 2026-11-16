import { preferencesSnapshot } from '../preferencesSnapshot'

const camera = { center: [1.44345, 43.60445], zoom: 14, pitch: 0, heading: 0 }

describe("a snapshot's preferences", () => {
  it('holds every stored entry by its key, read from its JSON', () => {
    expect(
      preferencesSnapshot([
        ['onfoot-preferences', JSON.stringify({ state: { paceSpeedMode: 'pace', elevationSmoothingMeters: 50 }, version: 0 })],
        ['onfoot-map', JSON.stringify({ state: { mapStyleId: 'standard', followMode: 'off' }, version: 0 })],
      ]),
    ).toEqual({
      'onfoot-preferences': { state: { paceSpeedMode: 'pace', elevationSmoothingMeters: 50 }, version: 0 },
      'onfoot-map': { state: { mapStyleId: 'standard', followMode: 'off' }, version: 0 },
    })
  })

  it("leaves out the map's last camera, the one live position the preferences hold", () => {
    const stored = { state: { mapStyleId: 'standard', selection: { kind: 'trail', id: 7 }, lastCamera: camera }, version: 0 }
    expect(preferencesSnapshot([['onfoot-map', JSON.stringify(stored)]])).toEqual({
      'onfoot-map': { state: { mapStyleId: 'standard', selection: { kind: 'trail', id: 7 } }, version: 0 },
    })
  })

  it('leaves out a last camera wherever an entry holds one', () => {
    const stored = { lastCamera: camera, nested: [{ lastCamera: camera, kept: 1 }] }
    expect(preferencesSnapshot([['another-store', JSON.stringify(stored)]])).toEqual({ 'another-store': { nested: [{ kept: 1 }] } })
  })

  it('leaves out an entry it cannot read rather than quote it raw', () => {
    expect(preferencesSnapshot([['broken', '{"lastCamera": [1.4'], ['empty', null]])).toEqual({ broken: '(not JSON, left out)', empty: null })
  })
})
