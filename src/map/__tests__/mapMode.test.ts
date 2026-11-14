import { mapMode, trailToShow } from '../mapMode'

describe('mapMode', () => {
  test('recording takes precedence over any selection', () =>
    expect(mapMode({ recording: true, selection: { kind: 'activity', id: 5 } })).toBe('recording'))
  test('activity selection (no recording) -> activity', () =>
    expect(mapMode({ recording: false, selection: { kind: 'activity', id: 5 } })).toBe('activity'))
  test('trail selection (no recording) -> trail', () =>
    expect(mapMode({ recording: false, selection: { kind: 'trail', id: 9 } })).toBe('trail'))
  test('no selection -> free', () =>
    expect(mapMode({ recording: false, selection: null })).toBe('free'))
})

describe('trailToShow', () => {
  const trail = { id: 1 }
  it('shows the selected trail when viewing a trail', () => {
    expect(trailToShow('trail', trail)).toBe(trail)
  })
  it('shows the selected trail while recording (the followed trail)', () => {
    expect(trailToShow('recording', trail)).toBe(trail)
  })
  it('shows nothing in free or activity mode', () => {
    expect(trailToShow('free', trail)).toBeNull()
    expect(trailToShow('activity', trail)).toBeNull()
  })
  it('shows nothing when no trail is selected', () => {
    expect(trailToShow('recording', null)).toBeNull()
  })
})
