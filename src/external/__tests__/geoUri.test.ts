import { geoUri } from '../geoUri'

describe('geoUri', () => {
  test('emits the coordinates twice: once as the path, once as the q= query', () => {
    expect(geoUri({ lat: 46.123456, lng: 6.654321 }, 'Col de Bise')).toBe(
      'geo:46.123456,6.654321?q=46.123456,6.654321(Col%20de%20Bise)',
    )
  })

  test('fixes coordinates at six decimals rather than emitting raw float noise', () => {
    expect(geoUri({ lat: 46.12345678901234, lng: 6.1 }, 'X')).toBe(
      'geo:46.123457,6.100000?q=46.123457,6.100000(X)',
    )
  })

  test('keeps the sign of southern and western coordinates', () => {
    expect(geoUri({ lat: -33.5, lng: -70.25 }, 'X')).toBe(
      'geo:-33.500000,-70.250000?q=-33.500000,-70.250000(X)',
    )
  })

  test('percent-encodes spaces and accents in the label', () => {
    expect(geoUri({ lat: 1, lng: 2 }, 'Pré du Lac')).toBe(
      'geo:1.000000,2.000000?q=1.000000,2.000000(Pr%C3%A9%20du%20Lac)',
    )
  })

  // encodeURIComponent leaves ( and ) alone, and the q= label syntax is parenthesis-delimited:
  // a trail named "Col de Bise (boucle)" would otherwise close the label early.
  test('encodes parentheses in the label so exactly one pair delimits it', () => {
    const uri = geoUri({ lat: 1, lng: 2 }, 'Col de Bise (boucle)')
    expect(uri).toBe('geo:1.000000,2.000000?q=1.000000,2.000000(Col%20de%20Bise%20%28boucle%29)')
    expect(uri.match(/\(/g)).toHaveLength(1)
    expect(uri.match(/\)/g)).toHaveLength(1)
  })
})
