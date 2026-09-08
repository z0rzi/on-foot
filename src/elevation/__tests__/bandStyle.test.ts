import { bandLineWidth, bandLineContrast } from '../bandStyle'
import type { GradeBand } from '../profile'

describe('bandLineWidth', () => {
  it('locks the width per band', () => {
    expect(bandLineWidth('steep')).toBe(4.5)
    expect(bandLineWidth('rough')).toBe(3.5)
    expect(bandLineWidth('uphill')).toBe(2.5)
    expect(bandLineWidth('flat')).toBe(1)
    expect(bandLineWidth('downhill')).toBe(1)
  })
})

describe('bandLineContrast', () => {
  it('locks the contrast per band', () => {
    expect(bandLineContrast('steep')).toBe(1)
    expect(bandLineContrast('rough')).toBe(0.9)
    expect(bandLineContrast('uphill')).toBe(0.7)
    expect(bandLineContrast('downhill')).toBe(0.4)
    expect(bandLineContrast('flat')).toBe(0.35)
  })
})

describe('steeper uphill reads thicker and higher-contrast', () => {
  const increasing: GradeBand[] = ['flat', 'uphill', 'rough', 'steep']

  it('width strictly increases across flat < uphill < rough < steep', () => {
    for (let i = 1; i < increasing.length; i++) {
      expect(bandLineWidth(increasing[i])).toBeGreaterThan(bandLineWidth(increasing[i - 1]))
    }
  })

  it('contrast strictly increases across flat < uphill < rough < steep', () => {
    for (let i = 1; i < increasing.length; i++) {
      expect(bandLineContrast(increasing[i])).toBeGreaterThan(bandLineContrast(increasing[i - 1]))
    }
  })

  it('downhill is never thicker than uphill', () => {
    expect(bandLineWidth('downhill')).toBeLessThanOrEqual(bandLineWidth('uphill'))
  })
})
