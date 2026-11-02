import { lastCameraFault, launchCamera } from '../launchCamera'
import type { CameraFraming } from '../provider/types'

const RANGE = { minZoom: 0, maxZoom: 22 }
const CAMERA: CameraFraming = { center: [6.86, 45.92], zoom: 14, pitch: 45, heading: 30 }

describe('lastCameraFault', () => {
  test('a finite in-range camera has no fault', () => {
    expect(lastCameraFault(CAMERA, RANGE)).toBeNull()
  })
  test('a missing camera is missing', () => {
    expect(lastCameraFault(null, RANGE)).toBe('missing')
  })
  test.each([
    ['NaN longitude', { ...CAMERA, center: [NaN, 45] as [number, number] }],
    ['Infinity latitude', { ...CAMERA, center: [6, Infinity] as [number, number] }],
    ['NaN zoom', { ...CAMERA, zoom: NaN }],
    ['Infinity pitch', { ...CAMERA, pitch: Infinity }],
    ['NaN heading', { ...CAMERA, heading: NaN }],
  ])('%s is non-finite', (_, camera) => {
    expect(lastCameraFault(camera, RANGE)).toBe('non-finite')
  })
  test.each([
    ['latitude above 90', { ...CAMERA, center: [6, 90.1] as [number, number] }],
    ['latitude below -90', { ...CAMERA, center: [6, -90.1] as [number, number] }],
    ['longitude above 180', { ...CAMERA, center: [180.1, 45] as [number, number] }],
    ['longitude below -180', { ...CAMERA, center: [-180.1, 45] as [number, number] }],
    ['zoom below the range', { ...CAMERA, zoom: -0.1 }],
    ['zoom above the range', { ...CAMERA, zoom: 22.1 }],
  ])('%s is out of range', (_, camera) => {
    expect(lastCameraFault(camera, RANGE)).toBe('out-of-range')
  })
  test('range edges are valid', () => {
    expect(lastCameraFault({ ...CAMERA, center: [-180, -90], zoom: 0 }, RANGE)).toBeNull()
    expect(lastCameraFault({ ...CAMERA, center: [180, 90], zoom: 22 }, RANGE)).toBeNull()
  })
  test('pitch and heading are not range-checked', () => {
    expect(lastCameraFault({ ...CAMERA, pitch: 120, heading: -400 }, RANGE)).toBeNull()
  })
  test('a malformed value from storage is non-finite, not a throw', () => {
    const malformed = { center: 'x', zoom: '3' } as unknown as CameraFraming
    expect(lastCameraFault(malformed, RANGE)).toBe('non-finite')
  })
})

describe('launchCamera', () => {
  test.each(['position', 'positionAndBearing'] as const)('following in %s follows in the same mode', (mode) => {
    expect(launchCamera(mode, CAMERA, RANGE)).toEqual({ kind: 'follow', mode })
    expect(launchCamera(mode, null, RANGE)).toEqual({ kind: 'follow', mode })
  })
  test('free with a valid last camera restores it', () => {
    expect(launchCamera('off', CAMERA, RANGE)).toEqual({ kind: 'restore', camera: CAMERA })
  })
  test('free with an invalid last camera follows position and names the fault', () => {
    expect(launchCamera('off', { ...CAMERA, zoom: 99 }, RANGE)).toEqual({
      kind: 'follow',
      mode: 'position',
      invalid: 'out-of-range',
    })
  })
  test('free with no last camera follows position, fault missing', () => {
    expect(launchCamera('off', null, RANGE)).toEqual({ kind: 'follow', mode: 'position', invalid: 'missing' })
  })
})
