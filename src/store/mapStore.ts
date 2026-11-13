import { create, type Mutate, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { errorClass, logEvent } from '../log'
import { MapTokens } from '../theme/tokens'
import { writesAfterHydration } from './writesAfterHydration'
import type { CameraFraming, CameraProps, FollowUserMode } from '../map/provider/types'
import type { LngLatBounds } from '../map/geo'

export type FollowMode = 'off' | FollowUserMode

export function nextFollowMode(current: FollowMode): FollowMode {
  switch (current) {
    case 'off': return 'position'
    case 'position': return 'positionAndBearing'
    case 'positionAndBearing': return 'position'
  }
}

export function demoteBearing(current: FollowMode): FollowMode {
  return current === 'positionAndBearing' ? 'position' : current
}

// Pure toggle helper for the 2D/3D control: when flat (<= pitchMin), toggling
// animates up to pitchToggle; when tilted, toggling flattens back to pitchMin.
export function nextPitchOnToggle(current: number): number {
  return current <= MapTokens.pitchMin ? MapTokens.pitchToggle : MapTokens.pitchMin
}

// Clamp a live-drag pitch target into the allowed [pitchMin, pitchMax] range.
export function clampPitch(v: number): number {
  return Math.min(MapTokens.pitchMax, Math.max(MapTokens.pitchMin, v))
}

// Normalize any angle (degrees) to the half-open range (-180, 180], so 359° reads as -1°.
export function normalizeDeg(deg: number): number {
  const m = ((deg % 360) + 360) % 360 // [0, 360)
  return m > 180 ? m - 360 : m
}

// The North button shows when the map camera is rotated more than `threshold` degrees off
// north (either direction). Pure so it can drive a re-render-cheap derived selector.
export function shouldShowNorthButton(heading: number, threshold: number): boolean {
  return Math.abs(normalizeDeg(heading)) > threshold
}

// The camera pitch each follow mode implies, so the 2D/3D label stays in sync with the
// follow-driven camera without reading back the live camera: Position is flat (north-up 2D),
// PositionAndBearing tilts to the 3D angle (mirrors the Kotlin location-button flyTo, which
// enters PositionAndBearing at pitchToggle). 'off' leaves pitch under manual/gesture control.
export function pitchForFollowMode(mode: FollowMode, current: number): number {
  switch (mode) {
    case 'position': return MapTokens.pitchMin
    case 'positionAndBearing': return MapTokens.pitchToggle
    case 'off': return current
  }
}

// A follow-mode change also syncs the pitch that mode implies, so the 2D/3D label stays consistent
// with the follow-driven camera, which brings the camera there itself (no pitch control). Shared by
// every action that changes followMode (cycleFollowMode, northPressed) so the two paths can't drift
// out of sync.
export interface FollowModeChange {
  followMode: FollowMode
  cameraPitch: number
  pitchControl: null
}
export function followModeChange(mode: FollowMode, currentPitch: number): FollowModeChange {
  return { followMode: mode, cameraPitch: pitchForFollowMode(mode, currentPitch), pitchControl: null }
}

// SDK-neutral <Camera> follow configuration for a given follow mode. Mirrors the Kotlin
// FollowPuckViewportState options: Position = follow location north-up & flat; PositionAndBearing
// = follow location + device heading, tilted to 3D. 'off' releases the camera to the user.
export type FollowCameraProps = Required<Pick<CameraProps, 'followUserLocation'>> &
  Pick<CameraProps, 'followUserMode' | 'followZoomLevel' | 'followPitch'>
export function followCameraProps(mode: FollowMode): FollowCameraProps {
  switch (mode) {
    case 'off':
      return { followUserLocation: false }
    case 'position':
      return {
        followUserLocation: true,
        followUserMode: 'position',
        followZoomLevel: MapTokens.locationZoom,
        followPitch: MapTokens.pitchMin,
      }
    case 'positionAndBearing':
      return {
        followUserLocation: true,
        followUserMode: 'positionAndBearing',
        followZoomLevel: MapTokens.locationZoom,
        followPitch: MapTokens.pitchToggle,
      }
  }
}

// How a pitch control (the 2D/3D toggle, the tilt drag) last set the pitch: eased or live.
export type PitchControl = 'animated' | 'live'

// The declarative pitch the camera is given: a pitch control's, once follow is off. None when the
// pitch was last set otherwise (a follow mode, a fit, the launch camera), which brings the camera
// there itself. rnmapbox turns a pitch prop into a camera stop of its own, sent with the commit's
// other props, and the native camera gets those and an imperative move unordered: a pitch prop
// appearing with the follow-off of a fit could land after the fit and cancel it.
export function manualPitchProps(
  mode: FollowMode,
  pitch: number,
  control: PitchControl | null,
): Pick<CameraProps, 'pitch' | 'animationDuration'> {
  if (mode !== 'off' || control === null) return {}
  return { pitch, animationDuration: control === 'animated' ? 300 : 0 }
}

// A style choice as the quick-switch logic needs to see it: an id plus the semantic satellite
// marker declared on the provider port. The store stays provider-agnostic — callers (MapControls)
// pass the provider's style list in, so no provider style id is ever hardcoded here.
export interface StyleChoice {
  id: string
  satellite?: boolean
}

// The cold-start fallback for quick-switch when there is no usable previous layer: from any
// non-satellite layer, switch to the satellite one; from satellite, switch to the first
// non-satellite layer in the list. Degenerate lists (no satellite / no non-satellite) leave the
// style unchanged by returning the current id.
export function satelliteToggleTarget(currentId: string, styles: StyleChoice[]): string {
  const current = styles.find((s) => s.id === currentId)
  const target = current?.satellite
    ? styles.find((s) => !s.satellite)
    : styles.find((s) => s.satellite)
  return target?.id ?? currentId
}

// Resolve the quick-switch (swipe) target: the previously selected layer when it is still a
// valid, different, in-list choice (the A/B toggle); otherwise the satellite-toggle fallback.
export function resolveQuickSwitch(
  currentId: string,
  previousId: string | null,
  styles: StyleChoice[],
): string {
  if (previousId && previousId !== currentId && styles.some((s) => s.id === previousId)) {
    return previousId
  }
  return satelliteToggleTarget(currentId, styles)
}

export type MapMode = 'free' | 'trail' | 'recording' | 'activity'

// Which kinds the overview draws, each on or off; both off is allowed (D119).
export interface OverviewToggles {
  trails: boolean
  activities: boolean
}

// The one thing shown on the map: a trail or an activity, never both. A single tagged field makes
// that mutual exclusion true by construction — the store cannot represent "both selected".
export interface Selection {
  kind: 'trail' | 'activity'
  id: number
}

// The single map's mode, derived (never stored) so it can't drift from reality. Recording takes
// precedence over any selection.
export function mapMode(input: { recording: boolean; selection: Selection | null }): MapMode {
  if (input.recording) return 'recording'
  if (input.selection?.kind === 'activity') return 'activity'
  if (input.selection?.kind === 'trail') return 'trail'
  return 'free'
}

// The trail to draw on the map: the selected trail is shown both when viewing it and while
// recording (so the followed trail stays visible), never in free or activity mode.
export function trailToShow<T>(mode: MapMode, selectedTrail: T | null): T | null {
  return mode === 'trail' || mode === 'recording' ? selectedTrail : null
}

// A pending one-shot camera fit (see MapCanvas): of whichever selection requested it, consumed once
// its geometry loads, trail and activity framed identically; or of a box known at once, never
// zooming past its limit, as a cluster's starts are.
export type PendingFit =
  | { kind: 'trail' | 'activity'; id: number }
  | { kind: 'bounds'; bounds: LngLatBounds; maxZoom: number }

interface MapStore {
  // Persisted exactly, so a launch follows again in the same mode or, when free, restores lastCamera.
  followMode: FollowMode
  mapStyleId: string
  // The style shown before the current one, so a swipe on the layers button can A/B-toggle back.
  // Session-only (not persisted) — a fresh launch cold-starts into the satellite-toggle fallback.
  previousMapStyleId: string | null
  // The trail or activity shown on the map; drives the overlay + info panel. Only a trail selection
  // is persisted (see partialize), so the displayed trail survives a restart while an activity view
  // never does.
  selection: Selection | null
  cameraPitch: number
  // How a pitch control last set cameraPitch, null when something else did since (see
  // manualPitchProps). Session-only.
  pitchControl: PitchControl | null
  // Live map camera bearing (deg), streamed from onCameraChanged; drives North-button
  // visibility. Session-only.
  cameraHeading: number
  // Bumped by northPressed in the off/manually-rotated case to signal MapCanvas to fire a
  // one-shot imperative rotate-to-north. Session-only.
  northResetNonce: number
  // The trail or activity a user tap has requested the camera to frame, consumed once its
  // geometry loads, or the box a cluster tap asked for. select() sets it; a restored trail
  // selection leaves it null, so restore shows the overlay without fitting. Session-only.
  pendingFit: PendingFit | null
  // The framing the camera last came to rest on, whatever the follow state. Persisted; the launch
  // starts the map on it.
  lastCamera: CameraFraming | null
  // Whether this session's launch camera has been decided (see MapLaunchGate). Session-only.
  launchResolved: boolean
  // The last camera this session's launch started the map on, held for the session as the map's
  // initial camera; null when there was none to use. Session-only.
  startingCamera: CameraFraming | null
  // The class of the error reading the persisted state failed with, null while it has not. Never
  // the message: a parse error's can quote the stored payload, coordinates included. The store
  // library reports a failure only through its rehydration callback; the launch gate opens on it
  // (see MapLaunchGate). Session-only.
  hydrationError: string | null
  // Persisted, both on by default (D124).
  overviewToggles: OverviewToggles
  cycleFollowMode: () => void
  disableFollow: () => void
  northPressed: () => void
  setMapStyle: (id: string) => void
  quickSwitchMapStyle: (styles: StyleChoice[]) => void
  select: (kind: 'trail' | 'activity', id: number) => void
  // A tap on the map's overview: the selection alone, the camera, pitch and follow left as they are,
  // and no fit, an earlier selection's pending one included (D113, D134).
  selectOnMap: (kind: 'trail' | 'activity', id: number) => void
  // A tap on a cluster below the cap: the camera frames its starts, never past maxZoom, the
  // selection left as it is (D118).
  fitCluster: (bounds: LngLatBounds, maxZoom: number) => void
  clearSelection: () => void
  // Drops the selection only when it shows this entity, as after the entity is deleted.
  forgetEntity: (kind: 'trail' | 'activity', id: number) => void
  // A recording started over an activity view replaces it; a shown trail stays, as the followed trail.
  endActivityView: () => void
  clearPendingFit: () => void
  recenter: () => void
  setCameraPitch: (p: number) => void
  setCameraPitchAnimated: (p: number) => void
  setCameraHeading: (h: number) => void
  setLastCamera: (camera: CameraFraming) => void
  restoreCamera: (camera: CameraFraming) => void
  startFollow: (mode: FollowUserMode, from?: CameraFraming) => void
  failHydration: (errorClass: string) => void
  setOverviewToggle: (kind: keyof OverviewToggles, shown: boolean) => void
}

// Nothing shown, and no framing left pending for what was.
const NO_SELECTION: Pick<MapStore, 'selection' | 'pendingFit'> = { selection: null, pendingFit: null }

type PersistedMapState = Pick<MapStore, 'mapStyleId' | 'selection' | 'followMode' | 'lastCamera' | 'overviewToggles'>

// A hydration that lands after the launch was resolved without it (the gate timed out) still
// restores the style and selection, but never overrides the follow state the session started in
// or a last camera captured since.
function mergeHydrated(persisted: unknown, current: MapStore): MapStore {
  const restored = (persisted ?? {}) as Partial<PersistedMapState>
  if (!current.launchResolved) return { ...current, ...restored }
  return { ...current, ...restored, followMode: current.followMode, lastCamera: current.lastCamera }
}

// Annotated because the storage reads the store's own hydration status.
type MapStoreHook = UseBoundStore<Mutate<StoreApi<MapStore>, [['zustand/persist', PersistedMapState]]>>

export const useMapStore: MapStoreHook = create<MapStore>()(
  persist(
    (set, get) => ({
      // Default to Position so a first launch centres and zooms to the user once location is
      // granted (matches the Kotlin app's default FollowMode.Position).
      followMode: 'position',
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
      hydrationError: null,
      overviewToggles: { trails: true, activities: true },
      cycleFollowMode: () => set((s) => followModeChange(nextFollowMode(s.followMode), s.cameraPitch)),
      disableFollow: () => set({ followMode: 'off' }),
      // Compass-follow → demote to north-up Position (follow viewport snaps bearing to north, and
      // followModeChange flattens the pitch + keeps the 2D/3D label in sync). Otherwise → drop
      // follow and signal MapCanvas to one-shot rotate the camera north. Follow must go off: an
      // imperative camera move is a no-op while rnmapbox is following, so leaving position-follow
      // on would swallow the reset.
      northPressed: () =>
        set((s) =>
          s.followMode === 'positionAndBearing'
            ? followModeChange(demoteBearing(s.followMode), s.cameraPitch)
            : { northResetNonce: s.northResetNonce + 1, followMode: 'off' },
        ),
      // Record the outgoing style as previous (only on an actual change) so the swipe quick-switch
      // can A/B-toggle back to it — whether the change came from the sheet or from a swipe.
      setMapStyle: (id) =>
        set((s) =>
          id === s.mapStyleId ? { mapStyleId: id } : { mapStyleId: id, previousMapStyleId: s.mapStyleId },
        ),
      quickSwitchMapStyle: (styles) =>
        set((s) => {
          const target = resolveQuickSwitch(s.mapStyleId, s.previousMapStyleId, styles)
          return target === s.mapStyleId ? {} : { mapStyleId: target, previousMapStyleId: s.mapStyleId }
        }),
      // Any action that triggers a one-shot camera op (pendingFit here / northResetNonce) MUST set
      // followMode: 'off' — rnmapbox ignores a camera move while following (see MapCanvas). Leave
      // follow on and it is swallowed. A fit flattens through its own pitch, so it leaves no pitch
      // control behind: a declarative pitch sent beside it could cancel it (manualPitchProps).
      // Each request for a fit is logged with who asked (T-84), so a fit at relaunch names its caller.
      select: (kind, id) => {
        logEvent('info', 'map', 'fit requested', { by: 'select', kind })
        set({
          selection: { kind, id },
          followMode: 'off',
          pendingFit: { kind, id },
          cameraPitch: MapTokens.pitchMin,
          pitchControl: null,
        })
      },
      selectOnMap: (kind, id) => set({ selection: { kind, id }, pendingFit: null }),
      fitCluster: (bounds, maxZoom) => {
        logEvent('info', 'map', 'fit requested', { by: 'cluster' })
        set({
          followMode: 'off',
          pendingFit: { kind: 'bounds', bounds, maxZoom },
          cameraPitch: MapTokens.pitchMin,
          pitchControl: null,
        })
      },
      clearSelection: () => set(NO_SELECTION),
      forgetEntity: (kind, id) =>
        set((s) => (s.selection?.kind === kind && s.selection.id === id ? NO_SELECTION : {})),
      endActivityView: () =>
        set((s) => (s.selection?.kind === 'activity' ? NO_SELECTION : {})),
      clearPendingFit: () => set({ pendingFit: null }),
      recenter: () => {
        const { selection } = get()
        if (!selection) return
        logEvent('info', 'map', 'fit requested', { by: 'recenter', kind: selection.kind })
        set({
          pendingFit: { kind: selection.kind, id: selection.id },
          followMode: 'off',
          cameraPitch: MapTokens.pitchMin,
          pitchControl: null,
        })
      },
      setCameraPitch: (p) => set({ cameraPitch: p, pitchControl: 'live' }),
      setCameraPitchAnimated: (p) => set({ cameraPitch: p, pitchControl: 'animated' }),
      setCameraHeading: (h) => set({ cameraHeading: h }),
      setLastCamera: (camera) => set({ lastCamera: camera }),
      // The 2D/3D label and the North button read cameraPitch and cameraHeading, so both start from
      // the restored camera instead of flattening or hiding its tilt and rotation. The camera starts
      // there itself (startingCamera), so no pitch control.
      restoreCamera: (camera) =>
        set({
          launchResolved: true,
          startingCamera: camera,
          followMode: 'off',
          cameraPitch: camera.pitch,
          cameraHeading: camera.heading,
          pitchControl: null,
        }),
      startFollow: (mode, from) =>
        set((s) => ({
          launchResolved: true,
          startingCamera: from ?? null,
          cameraHeading: from?.heading ?? s.cameraHeading,
          ...followModeChange(mode, s.cameraPitch),
        })),
      failHydration: (errorClass) => set({ hydrationError: errorClass }),
      setOverviewToggle: (kind, shown) => set((s) => ({ overviewToggles: { ...s.overviewToggles, [kind]: shown } })),
    }),
    {
      name: 'onfoot-map',
      // The launch runs on the defaults when hydration fails or times out; those never reach storage.
      storage: writesAfterHydration(
        createJSONStorage<PersistedMapState>(() => AsyncStorage),
        () => useMapStore.persist.hasHydrated(),
      ),
      partialize: (s) => ({
        mapStyleId: s.mapStyleId,
        selection: s.selection?.kind === 'trail' ? s.selection : null,
        followMode: s.followMode,
        lastCamera: s.lastCamera,
        overviewToggles: s.overviewToggles,
      }),
      merge: mergeHydrated,
      onRehydrateStorage: (state) => (_, error) => {
        if (error) state.failHydration(errorClass(error))
      },
    }
  )
)
