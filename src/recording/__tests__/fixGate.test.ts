import { haversineMeters } from '../../data/geo/metrics'
import { LocationFix } from '../../location'
import { Anchor, gateFixes } from '../fixGate'

const EARTH_RADIUS_M = 6371000
const BASE_LAT = 45
const LNG = 6
const T0 = 1_000_000

// Every position sits on one meridian, so the haversine distance between two of them is the
// difference of their offsets to within a ulp, which keeps the boundary tests deterministic.
const latAt = (northM: number): number => BASE_LAT + (northM / EARTH_RADIUS_M) * (180 / Math.PI)

const fix = (northM: number, seconds: number, accuracy: number | null = 5): LocationFix => ({
  lat: latAt(northM),
  lng: LNG,
  ele: null,
  t: T0 + seconds * 1000,
  accuracy,
})

const anchorAt = (northM: number, seconds = 0): Anchor => ({ lat: latAt(northM), lng: LNG, t: T0 + seconds * 1000 })

describe('gateFixes', () => {
  it('keeps nothing from an empty delivery and passes the candidate through', () => {
    const candidate = fix(600, -5, 8)
    expect(gateFixes([], anchorAt(0), candidate)).toEqual({
      kept: [],
      candidate,
      droppedAccuracy: 0,
      droppedJump: 0,
      recovered: 0,
      worstRejectedAccuracy: null,
      worstJump: null,
    })
  })

  it('keeps a fix at 50 m accuracy, drops one at 50.1 m, keeps unknown accuracy', () => {
    const atLimit = fix(1, 1, 50)
    const over = fix(2, 2, 50.1)
    const unknown = fix(3, 3, null)
    const result = gateFixes([atLimit, over, unknown], anchorAt(0), null)
    expect(result.kept).toEqual([atLimit, unknown])
    expect(result.droppedAccuracy).toBe(1)
    expect(result.droppedJump).toBe(0)
  })

  it('reports the largest accuracy rule 1 rejected', () => {
    const result = gateFixes([fix(0, 1, 80), fix(0, 2, 383), fix(0, 3, 120)], anchorAt(0), null)
    expect(result.droppedAccuracy).toBe(3)
    expect(result.worstRejectedAccuracy).toBe(383)
  })

  it('drops the coarse fixes of the 2026-10-26 incident for accuracy and keeps the return', () => {
    const back = fix(0, 16, 34)
    const result = gateFixes([fix(675, 5, 383), fix(675, 10, 390), back], anchorAt(0), null)
    expect(result.kept).toEqual([back])
    expect(result.droppedAccuracy).toBe(2)
    expect(result.droppedJump).toBe(0)
    expect(result.recovered).toBe(0)
    expect(result.worstRejectedAccuracy).toBe(390)
  })

  it('drops the same incident as jumps when the coarse fixes read 45 m, without a candidate', () => {
    const back = fix(0, 16, 34)
    const result = gateFixes([fix(675, 5, 45), fix(675, 10, 45), back], anchorAt(0), null)
    expect(result.kept).toEqual([back])
    expect(result.droppedAccuracy).toBe(0)
    expect(result.droppedJump).toBe(2)
    expect(result.recovered).toBe(0)
    expect(result.candidate).toBeNull()
  })

  it('keeps the first fix of a segment on rule 1 alone', () => {
    const first = fix(5000, 0, 40)
    expect(gateFixes([first], null, null).kept).toEqual([first])
  })

  it('keeps 15 m at +1 s and 120 m at +15 s', () => {
    expect(gateFixes([fix(15, 1)], anchorAt(0), null).kept).toHaveLength(1)
    expect(gateFixes([fix(120, 15)], anchorAt(0), null).kept).toHaveLength(1)
  })

  it('keeps 200 m at +15 s, the allowance exactly, and drops 201 m', () => {
    const atAllowance = fix(200, 15)
    expect(haversineMeters(latAt(0), LNG, atAllowance.lat, atAllowance.lng)).toBeLessThanOrEqual(200)
    expect(gateFixes([atAllowance], anchorAt(0), null).kept).toEqual([atAllowance])
    const past = gateFixes([fix(201, 15)], anchorAt(0), null)
    expect(past.kept).toEqual([])
    expect(past.droppedJump).toBe(1)
  })

  it('drops a fix at or before the anchor instant as a jump', () => {
    const result = gateFixes([fix(0, 0), fix(0, -1)], anchorAt(0), null)
    expect(result.kept).toEqual([])
    expect(result.droppedJump).toBe(2)
  })

  it('judges each fix from the last kept one', () => {
    const a = fix(0, 0)
    const b = fix(30, 5)
    const c = fix(60, 10)
    expect(gateFixes([a, b, c], null, null).kept).toEqual([a, b, c])

    // 100 m from A in 10 s is inside A's 150 m, but 130 m from B in 5 s is outside B's 100 m.
    const behindA = fix(-100, 10)
    expect(gateFixes([a, behindA], null, null).kept).toEqual([a, behindA])
    const judgedFromB = gateFixes([a, b, behindA], null, null)
    expect(judgedFromB.kept).toEqual([a, b])
    expect(judgedFromB.worstJump?.allowedMetres).toBe(100)
  })

  it('reports the rejected jump that most exceeded its allowance', () => {
    const result = gateFixes([fix(300, 5), fix(900, 10), fix(250, 15)], anchorAt(0), null)
    expect(result.droppedJump).toBe(3)
    expect(result.kept).toHaveLength(0)
    expect(result.worstJump?.seconds).toBe(10)
    expect(result.worstJump?.allowedMetres).toBe(150)
    expect(result.worstJump?.metres).toBeCloseTo(900, 6)
  })

  describe('anchor recovery', () => {
    const wrongAnchor = anchorAt(0)

    it('re-anchors on two agreeing GNSS-grade fixes and judges the next from the second', () => {
      const first = fix(600, 5, 8)
      const second = fix(610, 10, 8)
      const third = fix(640, 15, null)
      const result = gateFixes([first, second, third], wrongAnchor, null)
      expect(result.kept).toEqual([second, third])
      expect(result.recovered).toBe(1)
      expect(result.droppedJump).toBe(1)
      expect(result.candidate).toBeNull()
    })

    it('carries the candidate from one delivery into the next', () => {
      const first = fix(600, 5, 8)
      const second = fix(610, 10, 8)
      const one = gateFixes([first], wrongAnchor, null)
      expect(one.kept).toEqual([])
      expect(one.candidate).toEqual(first)
      const two = gateFixes([second], wrongAnchor, one.candidate)
      expect(two.kept).toEqual([second])
      expect(two.recovered).toBe(1)
      expect(two.candidate).toBeNull()
    })

    it('drops a lone outlier and clears it once a fix agrees with the anchor', () => {
      const near = fix(5, 10, 8)
      const result = gateFixes([fix(600, 5, 8), near], wrongAnchor, null)
      expect(result.kept).toEqual([near])
      expect(result.recovered).toBe(0)
      expect(result.candidate).toBeNull()
    })

    it('neither confirms nor replaces the candidate with a non-voting jump', () => {
      const candidate = fix(600, 5, 8)
      const result = gateFixes([fix(605, 10, 30)], wrongAnchor, candidate)
      expect(result.kept).toEqual([])
      expect(result.droppedJump).toBe(1)
      expect(result.candidate).toBe(candidate)
    })

    it('replaces the candidate with a voting jump that does not agree with it', () => {
      const elsewhere = fix(-900, 10, 8)
      const result = gateFixes([elsewhere], wrongAnchor, fix(600, 5, 8))
      expect(result.kept).toEqual([])
      expect(result.candidate).toBe(elsewhere)
    })
  })
})
