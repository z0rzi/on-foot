jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMapStore } from '../mapStore'
import { manualPitchProps } from '../../map/followCamera'
import { logEvent } from '../../log'
import { MapTokens } from '../../theme/tokens'

const CAMERA = { center: [6.86, 45.92] as [number, number], zoom: 14, pitch: 45, heading: 30 }

// Mirrors the provider's style list shape (id + semantic satellite flag). The store logic
// operates on this, never on a hardcoded provider style id, preserving the seam.
const STYLES = [
  { id: 'standard' },
  { id: 'satellite', satellite: true },
  { id: 'outdoors' },
]

describe('store actions', () => {
  beforeEach(() => {
    useMapStore.setState({
      followMode: 'off',
      mapStyleId: 'standard',
      previousMapStyleId: null,
      selection: null,
      cameraPitch: 0,
      pitchControl: null,
      cameraHeading: 0,
      northResetNonce: 0,
      pendingFit: null,
      lastCamera: null,
      launchResolved: false,
      startingCamera: null,
      overviewToggles: { trails: true, activities: true },
    })
  })
  test('defaults to position follow so a first launch centres on the user', () => {
    expect(useMapStore.getInitialState().followMode).toBe('position')
  })
  test('shows trails and activities on the map by default (D103)', () => {
    expect(useMapStore.getInitialState().overviewToggles).toEqual({ trails: true, activities: true })
  })
  test('setOverviewToggle turns one kind off and on, leaving the other as set', () => {
    useMapStore.getState().setOverviewToggle('trails', false)
    expect(useMapStore.getState().overviewToggles).toEqual({ trails: false, activities: true })
    useMapStore.getState().setOverviewToggle('activities', false)
    expect(useMapStore.getState().overviewToggles).toEqual({ trails: false, activities: false })
    useMapStore.getState().setOverviewToggle('trails', true)
    expect(useMapStore.getState().overviewToggles).toEqual({ trails: true, activities: false })
  })
  test('setLastCamera records the framing the camera came to rest on', () => {
    useMapStore.getState().setLastCamera(CAMERA)
    expect(useMapStore.getState().lastCamera).toEqual(CAMERA)
  })
  test('restoreCamera holds the camera for the session, follow off, and seeds pitch and heading', () => {
    useMapStore.setState({ followMode: 'position', pitchControl: 'animated' })
    useMapStore.getState().restoreCamera(CAMERA)
    const s = useMapStore.getState()
    expect(s.startingCamera).toEqual(CAMERA)
    expect(s.launchResolved).toBe(true)
    expect(s.followMode).toBe('off')
    expect(s.cameraPitch).toBe(45)
    expect(s.cameraHeading).toBe(30)
    expect(s.pitchControl).toBeNull()
  })
  test('startFollow resolves the launch into the mode and syncs its pitch', () => {
    useMapStore.getState().startFollow('positionAndBearing')
    const s = useMapStore.getState()
    expect(s.launchResolved).toBe(true)
    expect(s.startingCamera).toBeNull()
    expect(s.followMode).toBe('positionAndBearing')
    expect(s.cameraPitch).toBe(60)
  })
  test('startFollow from a last camera starts the map on it and seeds the heading', () => {
    useMapStore.getState().startFollow('position', CAMERA)
    const s = useMapStore.getState()
    expect(s.launchResolved).toBe(true)
    expect(s.startingCamera).toEqual(CAMERA)
    expect(s.followMode).toBe('position')
    expect(s.cameraHeading).toBe(30)
  })
  test('cycleFollowMode advances the machine and syncs the pitch label', () => {
    useMapStore.getState().cycleFollowMode()
    expect(useMapStore.getState().followMode).toBe('position')
    expect(useMapStore.getState().cameraPitch).toBe(0)
    useMapStore.getState().cycleFollowMode()
    expect(useMapStore.getState().followMode).toBe('positionAndBearing')
    expect(useMapStore.getState().cameraPitch).toBe(60)
  })
  test('disableFollow forces off without touching pitch', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', cameraPitch: 60 })
    useMapStore.getState().disableFollow()
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().cameraPitch).toBe(60)
  })
  test('northPressed demotes bearing follow', () => {
    useMapStore.setState({ followMode: 'positionAndBearing' })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().followMode).toBe('position')
  })
  test('setCameraPitch sets the pitch as a live pitch control', () => {
    useMapStore.setState({ pitchControl: 'animated' })
    useMapStore.getState().setCameraPitch(45)
    expect(useMapStore.getState().cameraPitch).toBe(45)
    expect(useMapStore.getState().pitchControl).toBe('live')
  })
  test('setCameraPitchAnimated sets the pitch as an eased pitch control', () => {
    useMapStore.getState().setCameraPitchAnimated(60)
    expect(useMapStore.getState().cameraPitch).toBe(60)
    expect(useMapStore.getState().pitchControl).toBe('animated')
  })
  test('setCameraHeading updates cameraHeading', () => {
    useMapStore.getState().setCameraHeading(42)
    expect(useMapStore.getState().cameraHeading).toBe(42)
  })
  test('select("trail") selects the trail, turns follow off, marks it pending fit, and flattens to 2D', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', selection: { kind: 'activity', id: 3 }, pendingFit: null, cameraPitch: 60, pitchControl: 'animated' })
    useMapStore.getState().select('trail', 7)
    expect(useMapStore.getState().selection).toEqual({ kind: 'trail', id: 7 })
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().pendingFit).toEqual({ kind: 'trail', id: 7 })
    expect(useMapStore.getState().cameraPitch).toBe(0)
    expect(useMapStore.getState().pitchControl).toBeNull()
  })
  test('select("activity") replaces a trail selection, turns follow off, marks it pending fit, and flattens to 2D', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', selection: { kind: 'trail', id: 9 }, pendingFit: null, cameraPitch: 60, pitchControl: 'animated' })
    useMapStore.getState().select('activity', 4)
    expect(useMapStore.getState().selection).toEqual({ kind: 'activity', id: 4 })
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().pendingFit).toEqual({ kind: 'activity', id: 4 })
    expect(useMapStore.getState().cameraPitch).toBe(0)
    expect(useMapStore.getState().pitchControl).toBeNull()
  })
  test('selectOnMap selects only: follow, pitch and camera stay, a stale fit is dropped (D113, D134)', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', selection: { kind: 'trail', id: 9 }, pendingFit: { kind: 'trail', id: 9 }, cameraPitch: 60, pitchControl: 'live', northResetNonce: 2 })
    useMapStore.getState().selectOnMap('activity', 4)
    const s = useMapStore.getState()
    expect(s.selection).toEqual({ kind: 'activity', id: 4 })
    expect(s.pendingFit).toBeNull()
    expect(s.followMode).toBe('positionAndBearing')
    expect(s.cameraPitch).toBe(60)
    expect(s.pitchControl).toBe('live')
    expect(s.northResetNonce).toBe(2)
  })
  test('fitCluster asks for a one-shot fit of the box, ending follow and flattening, the selection kept (D118, D134)', () => {
    useMapStore.setState({ followMode: 'position', selection: { kind: 'trail', id: 9 }, pendingFit: null, cameraPitch: 60, pitchControl: 'animated' })
    useMapStore.getState().fitCluster({ ne: [7.002, 45.91], sw: [7.001, 45.9] }, 17)
    const s = useMapStore.getState()
    expect(s.pendingFit).toEqual({ kind: 'bounds', bounds: { ne: [7.002, 45.91], sw: [7.001, 45.9] }, maxZoom: 17 })
    expect(s.followMode).toBe('off')
    expect(s.cameraPitch).toBe(MapTokens.pitchMin)
    expect(s.pitchControl).toBeNull()
    expect(s.selection).toEqual({ kind: 'trail', id: 9 })
  })
  test('fitCluster from follow sends the camera no pitch of its own beside the fit, which carries it', () => {
    useMapStore.setState({ followMode: 'position', cameraPitch: 0, pitchControl: 'animated' })
    useMapStore.getState().fitCluster({ ne: [7.002, 45.91], sw: [7.001, 45.9] }, 17)
    const s = useMapStore.getState()
    expect(manualPitchProps(s.followMode, s.cameraPitch, s.pitchControl)).toEqual({})
  })
  test('select and recenter from follow send the camera no pitch of their own beside the fit', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', cameraPitch: 60, pitchControl: 'animated' })
    useMapStore.getState().select('trail', 7)
    let s = useMapStore.getState()
    expect(manualPitchProps(s.followMode, s.cameraPitch, s.pitchControl)).toEqual({})
    useMapStore.setState({ followMode: 'position', pitchControl: 'live' })
    useMapStore.getState().recenter()
    s = useMapStore.getState()
    expect(manualPitchProps(s.followMode, s.cameraPitch, s.pitchControl)).toEqual({})
  })
  test('clearSelection clears the selection and pending fit, leaving follow untouched', () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 7 }, pendingFit: { kind: 'trail', id: 7 }, followMode: 'position' })
    useMapStore.getState().clearSelection()
    expect(useMapStore.getState().selection).toBeNull()
    expect(useMapStore.getState().pendingFit).toBeNull()
    expect(useMapStore.getState().followMode).toBe('position')
  })
  test('forgetEntity clears the selection when it shows that entity', () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 7 }, pendingFit: { kind: 'trail', id: 7 } })
    useMapStore.getState().forgetEntity('trail', 7)
    expect(useMapStore.getState().selection).toBeNull()
    expect(useMapStore.getState().pendingFit).toBeNull()
  })
  test('forgetEntity leaves another entity shown', () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 7 }, pendingFit: null })
    useMapStore.getState().forgetEntity('trail', 8)
    useMapStore.getState().forgetEntity('activity', 7)
    expect(useMapStore.getState().selection).toEqual({ kind: 'trail', id: 7 })
  })
  test('endActivityView clears a shown activity and its pending fit', () => {
    useMapStore.setState({ selection: { kind: 'activity', id: 4 }, pendingFit: { kind: 'activity', id: 4 } })
    useMapStore.getState().endActivityView()
    expect(useMapStore.getState().selection).toBeNull()
    expect(useMapStore.getState().pendingFit).toBeNull()
  })
  test('endActivityView leaves a shown trail, the one a recording follows, in place', () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 7 }, pendingFit: { kind: 'trail', id: 7 } })
    useMapStore.getState().endActivityView()
    expect(useMapStore.getState().selection).toEqual({ kind: 'trail', id: 7 })
    expect(useMapStore.getState().pendingFit).toEqual({ kind: 'trail', id: 7 })
  })
  test('clearPendingFit clears the pending fit without touching the selection', () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 7 }, pendingFit: { kind: 'trail', id: 7 } })
    useMapStore.getState().clearPendingFit()
    expect(useMapStore.getState().pendingFit).toBeNull()
    expect(useMapStore.getState().selection).toEqual({ kind: 'trail', id: 7 })
  })
  test('recenter re-arms the pending fit for the selected trail, turns follow off, and flattens to 2D', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', selection: { kind: 'trail', id: 7 }, pendingFit: null, cameraPitch: 60, pitchControl: 'animated' })
    useMapStore.getState().recenter()
    expect(useMapStore.getState().pendingFit).toEqual({ kind: 'trail', id: 7 })
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().selection).toEqual({ kind: 'trail', id: 7 })
    expect(useMapStore.getState().cameraPitch).toBe(0)
    expect(useMapStore.getState().pitchControl).toBeNull()
  })
  test('recenter re-arms the pending fit for the selected activity and flattens to 2D', () => {
    useMapStore.setState({ followMode: 'position', selection: { kind: 'activity', id: 4 }, pendingFit: null, cameraPitch: 60 })
    useMapStore.getState().recenter()
    expect(useMapStore.getState().pendingFit).toEqual({ kind: 'activity', id: 4 })
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().cameraPitch).toBe(0)
  })
  test('recenter is a no-op when nothing is selected, leaving pitch untouched', () => {
    useMapStore.setState({ selection: null, pendingFit: null, followMode: 'position', cameraPitch: 60 })
    useMapStore.getState().recenter()
    expect(useMapStore.getState().pendingFit).toBeNull()
    expect(useMapStore.getState().followMode).toBe('position')
    expect(useMapStore.getState().cameraPitch).toBe(60)
  })
  test('recenter produces a fresh pendingFit reference even when it already targets the selection', () => {
    const existing = { kind: 'trail' as const, id: 7 }
    useMapStore.setState({ selection: { kind: 'trail', id: 7 }, pendingFit: existing, followMode: 'off' })
    useMapStore.getState().recenter()
    const next = useMapStore.getState().pendingFit
    expect(next).toEqual({ kind: 'trail', id: 7 })
    expect(next).not.toBe(existing)
  })
  test('northPressed from compass follow demotes to position, flattening pitch, without bumping the nonce', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', cameraPitch: 60, northResetNonce: 0 })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().followMode).toBe('position')
    // Pitch must flatten so the 2D/3D label stays in sync with the now-flat follow camera.
    expect(useMapStore.getState().cameraPitch).toBe(0)
    expect(useMapStore.getState().pitchControl).toBeNull()
    expect(useMapStore.getState().northResetNonce).toBe(0)
  })
  test('northPressed while off bumps the reset nonce without changing follow', () => {
    useMapStore.setState({ followMode: 'off', northResetNonce: 0 })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().northResetNonce).toBe(1)
  })
  test('northPressed while position drops follow to off and bumps the reset nonce so the imperative reset is not swallowed', () => {
    useMapStore.setState({ followMode: 'position', northResetNonce: 5 })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().northResetNonce).toBe(6)
  })
  test('setMapStyle records the outgoing style as previous on change', () => {
    useMapStore.getState().setMapStyle('satellite')
    expect(useMapStore.getState().mapStyleId).toBe('satellite')
    expect(useMapStore.getState().previousMapStyleId).toBe('standard')
  })
  test('setMapStyle leaves previous untouched when the style is unchanged', () => {
    useMapStore.setState({ previousMapStyleId: 'outdoors' })
    useMapStore.getState().setMapStyle('standard')
    expect(useMapStore.getState().mapStyleId).toBe('standard')
    expect(useMapStore.getState().previousMapStyleId).toBe('outdoors')
  })
  test('quickSwitchMapStyle swaps to the resolved target and records previous', () => {
    // No history -> satellite toggle from the non-satellite default.
    useMapStore.getState().quickSwitchMapStyle(STYLES)
    expect(useMapStore.getState().mapStyleId).toBe('satellite')
    expect(useMapStore.getState().previousMapStyleId).toBe('standard')
  })
  test('quickSwitchMapStyle A/B-toggles between the two most-recent layers', () => {
    useMapStore.setState({ mapStyleId: 'satellite', previousMapStyleId: 'standard' })
    useMapStore.getState().quickSwitchMapStyle(STYLES)
    expect(useMapStore.getState().mapStyleId).toBe('standard')
    expect(useMapStore.getState().previousMapStyleId).toBe('satellite')
    useMapStore.getState().quickSwitchMapStyle(STYLES)
    expect(useMapStore.getState().mapStyleId).toBe('satellite')
    expect(useMapStore.getState().previousMapStyleId).toBe('standard')
  })
  test('quickSwitchMapStyle is a no-op when the resolved target equals the current style', () => {
    useMapStore.setState({ mapStyleId: 'standard', previousMapStyleId: null })
    useMapStore.getState().quickSwitchMapStyle([{ id: 'standard' }])
    expect(useMapStore.getState().mapStyleId).toBe('standard')
    expect(useMapStore.getState().previousMapStyleId).toBeNull()
  })
  test('partialize persists mapStyleId, a trail selection, the follow state, the last camera and the toggles', () => {
    const partialize = useMapStore.persist.getOptions().partialize!
    useMapStore.setState({
      selection: { kind: 'trail', id: 7 },
      followMode: 'off',
      lastCamera: CAMERA,
      overviewToggles: { trails: false, activities: true },
    })
    const partial = partialize({ ...useMapStore.getState() } as any)
    expect(partial).toEqual({
      mapStyleId: useMapStore.getState().mapStyleId,
      selection: { kind: 'trail', id: 7 },
      followMode: 'off',
      lastCamera: CAMERA,
      overviewToggles: { trails: false, activities: true },
    })
    expect(partial).not.toHaveProperty('pendingFit')
    expect(partial).not.toHaveProperty('startingCamera')
    expect(partial).not.toHaveProperty('launchResolved')
  })
  test('partialize drops an activity selection so it never restores across a restart', () => {
    const partialize = useMapStore.persist.getOptions().partialize!
    useMapStore.setState({ selection: { kind: 'activity', id: 4 } })
    const partial = partialize({ ...useMapStore.getState() } as any)
    expect(partial).toMatchObject({ mapStyleId: useMapStore.getState().mapStyleId, selection: null })
  })
})

describe('hydration', () => {
  const getItem = AsyncStorage.getItem as jest.Mock
  const setItem = AsyncStorage.setItem as jest.Mock
  const persisted = JSON.stringify({
    state: { mapStyleId: 'outdoors', followMode: 'off', lastCamera: CAMERA },
    version: 0,
  })
  beforeEach(() => {
    useMapStore.setState({
      followMode: 'position',
      mapStyleId: 'standard',
      lastCamera: null,
      launchResolved: false,
      hydrationError: null,
      overviewToggles: { trails: true, activities: true },
    })
    setItem.mockClear()
  })
  afterEach(() => {
    getItem.mockReset()
    setItem.mockReset()
  })

  test('a storage error is reported as a failed hydration, not a completed one', async () => {
    getItem.mockRejectedValueOnce(new Error('storage unavailable'))
    await useMapStore.persist.rehydrate()
    expect(useMapStore.getState().hydrationError).not.toBeNull()
    expect(useMapStore.persist.hasHydrated()).toBe(false)
  })
  test('a corrupt payload is reported by its error class, never by a message quoting the payload', async () => {
    getItem.mockResolvedValueOnce('{"state":{"lastCamera":{"center":[6.86,45.92]')
    await useMapStore.persist.rehydrate()
    expect(useMapStore.getState().hydrationError).toBe('SyntaxError')
  })
  test('before the launch is resolved, the persisted state lands whole', async () => {
    getItem.mockResolvedValueOnce(persisted)
    await useMapStore.persist.rehydrate()
    const s = useMapStore.getState()
    expect(s.mapStyleId).toBe('outdoors')
    expect(s.followMode).toBe('off')
    expect(s.lastCamera).toEqual(CAMERA)
  })
  test('a stored state from before the toggles hydrates with both on', async () => {
    getItem.mockResolvedValueOnce(persisted)
    await useMapStore.persist.rehydrate()
    expect(useMapStore.getState().overviewToggles).toEqual({ trails: true, activities: true })
  })
  test('the stored toggles land on hydration', async () => {
    getItem.mockResolvedValueOnce(
      JSON.stringify({ state: { mapStyleId: 'outdoors', overviewToggles: { trails: false, activities: true } }, version: 0 }),
    )
    await useMapStore.persist.rehydrate()
    expect(useMapStore.getState().overviewToggles).toEqual({ trails: false, activities: true })
  })
  test('a toggle flipped while hydration is pending is not written, one flipped after it is', async () => {
    let land: (value: string) => void = () => {}
    getItem.mockReturnValueOnce(new Promise<string>((resolve) => { land = resolve }))
    const hydration = useMapStore.persist.rehydrate()
    useMapStore.getState().setOverviewToggle('activities', false)
    expect(setItem).not.toHaveBeenCalled()
    land(JSON.stringify({ state: { overviewToggles: { trails: false, activities: true } }, version: 0 }))
    await hydration
    useMapStore.getState().setOverviewToggle('activities', false)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(setItem.mock.calls[0][1]).state.overviewToggles).toEqual({ trails: false, activities: false })
  })
  test('a hydration landing after a launch resolved on the defaults keeps the session camera state', async () => {
    const live = { ...CAMERA, zoom: 10 }
    useMapStore.setState({ launchResolved: true, followMode: 'position', lastCamera: live })
    getItem.mockResolvedValueOnce(persisted)
    await useMapStore.persist.rehydrate()
    const s = useMapStore.getState()
    expect(s.mapStyleId).toBe('outdoors')
    expect(s.followMode).toBe('position')
    expect(s.lastCamera).toEqual(live)
  })
  test('a failed hydration never writes the defaults over the stored state', async () => {
    getItem.mockRejectedValueOnce(new Error('storage unavailable'))
    await useMapStore.persist.rehydrate()
    useMapStore.getState().startFollow('position')
    useMapStore.getState().setLastCamera(CAMERA)
    expect(setItem).not.toHaveBeenCalled()
  })
  test('nothing is written while hydration is pending, and writes resume once it lands', async () => {
    let land: (value: string) => void = () => {}
    getItem.mockReturnValueOnce(new Promise<string>((resolve) => { land = resolve }))
    const hydration = useMapStore.persist.rehydrate()
    useMapStore.getState().startFollow('position')
    expect(setItem).not.toHaveBeenCalled()
    land(persisted)
    await hydration
    useMapStore.getState().setLastCamera(CAMERA)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(setItem.mock.calls[0][1]).state).toMatchObject({ mapStyleId: 'outdoors', lastCamera: CAMERA })
  })
})

describe('fit requests in the debug log', () => {
  beforeEach(() => {
    jest.mocked(logEvent).mockClear()
    useMapStore.setState({ selection: null, pendingFit: null })
  })

  test('select logs who asked and the kind, never the id', () => {
    useMapStore.getState().select('trail', 7)
    expect(logEvent).toHaveBeenCalledTimes(1)
    expect(logEvent).toHaveBeenCalledWith('info', 'map', 'fit requested', { by: 'select', kind: 'trail' })
  })

  test('recenter logs who asked and the kind of the selection', () => {
    useMapStore.setState({ selection: { kind: 'activity', id: 4 } })
    useMapStore.getState().recenter()
    expect(logEvent).toHaveBeenCalledTimes(1)
    expect(logEvent).toHaveBeenCalledWith('info', 'map', 'fit requested', { by: 'recenter', kind: 'activity' })
  })

  test('fitCluster logs who asked, never the box', () => {
    useMapStore.getState().fitCluster({ ne: [7.002, 45.91], sw: [7.001, 45.9] }, 17)
    expect(logEvent).toHaveBeenCalledTimes(1)
    expect(logEvent).toHaveBeenCalledWith('info', 'map', 'fit requested', { by: 'cluster' })
  })

  test('recenter with nothing selected requests no fit and logs nothing', () => {
    useMapStore.getState().recenter()
    expect(useMapStore.getState().pendingFit).toBeNull()
    expect(logEvent).not.toHaveBeenCalled()
  })

  test('no other action logs a fit', () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 7 }, pendingFit: { kind: 'trail', id: 7 } })
    useMapStore.getState().clearPendingFit()
    useMapStore.getState().selectOnMap('activity', 4)
    useMapStore.getState().clearSelection()
    useMapStore.getState().restoreCamera(CAMERA)
    expect(logEvent).not.toHaveBeenCalled()
  })
})
