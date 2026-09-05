import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MapTokens } from '../theme/tokens'

export type FollowMode = 'off' | 'position' | 'positionAndBearing'

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

// A follow-mode change also (animated) syncs the pitch that mode implies, so the 2D/3D label
// stays consistent with the follow-driven camera. Shared by every action that changes followMode
// (cycleFollowMode, northPressed) so the two paths can't drift out of sync.
export interface FollowModeChange {
  followMode: FollowMode
  cameraPitch: number
  pitchAnimated: boolean
}
export function followModeChange(mode: FollowMode, currentPitch: number): FollowModeChange {
  return { followMode: mode, cameraPitch: pitchForFollowMode(mode, currentPitch), pitchAnimated: true }
}

// SDK-neutral <Camera> follow configuration for a given follow mode. Mirrors the Kotlin
// FollowPuckViewportState options: Position = follow location north-up & flat; PositionAndBearing
// = follow location + device heading, tilted to 3D. 'off' releases the camera to the user.
export interface FollowCameraProps {
  followUserLocation: boolean
  followUserMode?: 'normal' | 'compass' | 'course'
  followZoomLevel?: number
  followPitch?: number
}
export function followCameraProps(mode: FollowMode): FollowCameraProps {
  switch (mode) {
    case 'off':
      return { followUserLocation: false }
    case 'position':
      return {
        followUserLocation: true,
        followUserMode: 'normal',
        followZoomLevel: MapTokens.locationZoom,
        followPitch: MapTokens.pitchMin,
      }
    case 'positionAndBearing':
      return {
        followUserLocation: true,
        followUserMode: 'compass',
        followZoomLevel: MapTokens.locationZoom,
        followPitch: MapTokens.pitchToggle,
      }
  }
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

// A pending one-shot camera fit for whichever selection requested it, consumed once its geometry
// loads (see MapCanvas). Generalized over trail and activity so both frame identically.
export interface PendingFit {
  kind: 'trail' | 'activity'
  id: number
}

interface MapStore {
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
  // Whether the next declarative pitch application should animate (tap toggle) or snap
  // (live drag). Session-only; drives the <Camera> animationDuration in MapCanvas.
  pitchAnimated: boolean
  // Live map camera bearing (deg), streamed from onCameraChanged; drives North-button
  // visibility. Session-only.
  cameraHeading: number
  // Bumped by northPressed in the off/manually-rotated case to signal MapCanvas to fire a
  // one-shot imperative rotate-to-north. Session-only.
  northResetNonce: number
  // The trail or activity a user tap has requested the camera to frame, consumed once its
  // geometry loads. select() sets it; a restored trail selection leaves it null, so restore shows
  // the overlay without fitting. Session-only.
  pendingFit: PendingFit | null
  cycleFollowMode: () => void
  disableFollow: () => void
  northPressed: () => void
  setMapStyle: (id: string) => void
  quickSwitchMapStyle: (styles: StyleChoice[]) => void
  select: (kind: 'trail' | 'activity', id: number) => void
  clearSelection: () => void
  clearPendingFit: () => void
  recenter: () => void
  setCameraPitch: (p: number) => void
  setCameraPitchAnimated: (p: number) => void
  setCameraHeading: (h: number) => void
}

export const useMapStore = create<MapStore>()(
  persist(
    (set) => ({
      // Default to Position so the map centres and zooms to the user on launch once location is
      // granted (matches the Kotlin app's default FollowMode.Position). Not persisted, so every
      // launch re-follows.
      followMode: 'position',
      mapStyleId: 'standard',
      previousMapStyleId: null,
      selection: null,
      cameraPitch: 0,
      pitchAnimated: false,
      cameraHeading: 0,
      northResetNonce: 0,
      pendingFit: null,
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
      // followMode: 'off' — rnmapbox ignores a camera move while following, and MapCanvas defers the
      // op a frame past this follow-off (see the deferral there). Leave follow on and it is swallowed.
      select: (kind, id) =>
        set({
          selection: { kind, id },
          followMode: 'off',
          pendingFit: { kind, id },
          cameraPitch: MapTokens.pitchMin,
          pitchAnimated: true,
        }),
      clearSelection: () => set({ selection: null, pendingFit: null }),
      clearPendingFit: () => set({ pendingFit: null }),
      recenter: () =>
        set((s) =>
          s.selection
            ? {
                pendingFit: { kind: s.selection.kind, id: s.selection.id },
                followMode: 'off',
                cameraPitch: MapTokens.pitchMin,
                pitchAnimated: true,
              }
            : {},
        ),
      setCameraPitch: (p) => set({ cameraPitch: p, pitchAnimated: false }),
      setCameraPitchAnimated: (p) => set({ cameraPitch: p, pitchAnimated: true }),
      setCameraHeading: (h) => set({ cameraHeading: h }),
    }),
    {
      name: 'onfoot-map',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        mapStyleId: s.mapStyleId,
        selection: s.selection?.kind === 'trail' ? s.selection : null,
      }),
    }
  )
)
