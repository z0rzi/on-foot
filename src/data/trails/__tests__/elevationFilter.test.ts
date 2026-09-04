import {
  ELEVATION_DEADBAND_METERS,
  ELEVATION_SMOOTHING_WINDOW_METERS,
  ElevationPoint,
  accumulateGainLoss,
  elevationChange,
  smoothElevationSeries,
} from '../gpx/elevationFilter'

const series = (eles: number[], spacingMeters = 10): ElevationPoint[] =>
  eles.map((ele, i) => ({ distance: i * spacingMeters, ele }))

// Park–Miller minimal standard: deterministic, and exact in double precision.
const uniform = (seed: number) => {
  let s = seed
  return (): number => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

const rawGain = (eles: number[]): number =>
  eles.reduce((sum, ele, i) => (i > 0 && ele > eles[i - 1] ? sum + ele - eles[i - 1] : sum), 0)

describe('smoothElevationSeries', () => {
  it('returns nothing for an empty series', () => {
    expect(smoothElevationSeries([], 50)).toEqual([])
  })

  it('leaves a single sample untouched', () => {
    expect(smoothElevationSeries(series([100]), 50)).toEqual([100])
  })

  it('is the identity when the window is zero or negative', () => {
    expect(smoothElevationSeries(series([100, 130, 100]), 0)).toEqual([100, 130, 100])
    expect(smoothElevationSeries(series([100, 130, 100]), -10)).toEqual([100, 130, 100])
  })

  it('flattens a spike against its neighbours inside the window', () => {
    expect(smoothElevationSeries(series([100, 100, 130, 100, 100]), 50)).toEqual([100, 110, 106, 110, 100])
  })

  it('keeps the first and last sample of a run, the window never reaching past them', () => {
    const out = smoothElevationSeries(series([100, 130, 100]), 1000)
    expect(out[0]).toBe(100)
    expect(out[out.length - 1]).toBe(100)
  })

  it('leaves samples further apart than the window independent', () => {
    const far: ElevationPoint[] = [{ distance: 0, ele: 100 }, { distance: 1000, ele: 200 }]
    expect(smoothElevationSeries(far, 50)).toEqual([100, 200])
  })

  it('averages a cluster of samples at the same distance to one value', () => {
    const stationary: ElevationPoint[] = [100, 106, 94, 100].map((ele) => ({ distance: 250, ele }))
    expect(smoothElevationSeries(stationary, 50)).toEqual([100, 100, 100, 100])
  })

  it('keeps a monotone ramp increasing and preserves its total rise', () => {
    const ramp = series(Array.from({ length: 10 }, (_, i) => i))
    const out = smoothElevationSeries(ramp, 50)
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThan(out[i - 1])
    expect(out[out.length - 1] - out[0]).toBeCloseTo(9)
  })
})

describe('accumulateGainLoss', () => {
  const T = 3

  it('reports nothing for an empty or single-sample series', () => {
    expect(accumulateGainLoss([], T)).toEqual({ gainMeters: 0, lossMeters: 0 })
    expect(accumulateGainLoss([100], T)).toEqual({ gainMeters: 0, lossMeters: 0 })
  })

  it('ignores an oscillation smaller than the deadband', () => {
    expect(accumulateGainLoss([100, 102, 100, 102, 100, 102], T)).toEqual({ gainMeters: 0, lossMeters: 0 })
  })

  it('counts a monotone climb exactly, whatever the step size', () => {
    expect(accumulateGainLoss([100, 101, 102, 103, 104, 105], T)).toEqual({ gainMeters: 5, lossMeters: 0 })
    expect(accumulateGainLoss([100, 200], T)).toEqual({ gainMeters: 100, lossMeters: 0 })
  })

  it('does not split a climb around a dip smaller than the deadband', () => {
    expect(accumulateGainLoss([100, 105, 103, 108], T)).toEqual({ gainMeters: 8, lossMeters: 0 })
  })

  it('counts a confirmed reversal in full, threshold included', () => {
    expect(accumulateGainLoss([100, 110, 103], T)).toEqual({ gainMeters: 10, lossMeters: 7 })
  })

  it('is symmetric for a descent followed by a climb', () => {
    expect(accumulateGainLoss([100, 90, 97], T)).toEqual({ gainMeters: 7, lossMeters: 10 })
  })

  it('measures the first swing from its own extreme, not from the first sample', () => {
    expect(accumulateGainLoss([200, 198.5, 201.5], T)).toEqual({ gainMeters: 3, lossMeters: 1.5 })
    expect(accumulateGainLoss([200, 205, 195], 8)).toEqual({ gainMeters: 5, lossMeters: 10 })
  })

  it('reads the same swings wherever the series starts within them', () => {
    const fromValley = accumulateGainLoss([100, 110, 100, 110], T)
    const fromMidSlope = accumulateGainLoss([105, 110, 100, 110], T)
    expect(fromValley).toEqual({ gainMeters: 20, lossMeters: 10 })
    expect(fromMidSlope).toEqual({ gainMeters: 15, lossMeters: 10 })
  })
})

describe('elevationChange', () => {
  it('composes smoothing and the deadband with the module constants', () => {
    const samples = series([100, 130, 100, 130, 100])
    const expected = accumulateGainLoss(
      smoothElevationSeries(samples, ELEVATION_SMOOTHING_WINDOW_METERS),
      ELEVATION_DEADBAND_METERS,
    )
    expect(elevationChange(samples)).toEqual(expected)
  })

  // GPS altitude error is not white noise: it wanders, correlated over minutes, which is what
  // makes a flat walk read as a climb. These fixtures model it as AR(1) over 10 m fixes.
  const wander = (seed: number, sigma: number, rho: number) => {
    const next = uniform(seed)
    let previous = 0
    return (): number => {
      const u = Math.max(1e-9, next())
      const v = next()
      const white = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      previous = rho * previous + Math.sqrt(1 - rho * rho) * sigma * white
      return previous
    }
  }

  it('cuts most of the phantom climb out of a flat, noisy five kilometres', () => {
    const drift = wander(3, 5, 0.9)
    const eles = Array.from({ length: 500 }, () => 200 + drift())
    const { gainMeters } = elevationChange(series(eles))
    expect(rawGain(eles)).toBeGreaterThan(300)
    expect(gainMeters).toBeLessThan(rawGain(eles) / 4)
  })

  it('recovers a real climb buried in the same wander', () => {
    const drift = wander(3, 5, 0.9)
    const eles = Array.from({ length: 500 }, (_, i) => 200 + i * 0.6 + drift())
    const { gainMeters, lossMeters } = elevationChange(series(eles))
    expect(gainMeters).toBeGreaterThan(290)
    expect(gainMeters).toBeLessThan(330)
    expect(lossMeters).toBeLessThan(30)
  })
})
