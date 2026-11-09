import { elevationAxis } from '../elevationAxis'

const labels = (min: number, max: number) => elevationAxis(min, max).ticks.map((t) => t.label)
const range = (min: number, max: number) => {
  const axis = elevationAxis(min, max)
  return [axis.low, axis.high]
}

describe('elevationAxis', () => {
  it('spans the profile itself, so its lowest point is the plot\'s floor and its highest the top', () => {
    expect(range(1150, 1998)).toEqual([1150, 1998])
    expect(range(1850, 3120)).toEqual([1850, 3120])
  })

  it('labels a 200–300 m profile "200 m · 250 m · 300 m", low to high', () => {
    expect(labels(200, 300)).toEqual(['200 m', '250 m', '300 m'])
  })

  it('labels only round numbers inside the profile, never one past its lowest point', () => {
    expect(labels(1150, 1998)).toEqual(['1250 m', '1500 m', '1750 m'])
    expect(labels(1150, 2010)).toEqual(['1500 m', '2000 m'])
  })

  it('labels a high-mountain range inside the climb', () => {
    expect(labels(1850, 3120)).toEqual(['2000 m', '2500 m', '3000 m'])
  })

  it('labels a range below sea level, with a plain "0 m"', () => {
    expect(labels(-12, 8)).toEqual(['-10 m', '0 m'])
  })

  it('never shows more than three labels', () => {
    for (const [min, max] of [[0, 1000], [137, 961], [1150, 1998], [-12, 8], [101, 104]]) {
      expect(labels(min, max).length).toBeLessThanOrEqual(3)
    }
  })

  it('widens a near-flat profile to 10 m around its middle, labelled inside that range, past the profile itself', () => {
    expect(range(101, 104)).toEqual([97.5, 107.5])
    expect(labels(101, 104)).toEqual(['100 m', '105 m'])
    expect(range(42, 42)).toEqual([37, 47])
    expect(labels(42, 42)).toEqual(['40 m', '45 m'])
  })
})
