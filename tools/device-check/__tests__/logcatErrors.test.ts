import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { redactPositions } from '../logcat'
import { nativeErrors } from '../logcatErrors'

const logcat = readFileSync(join(__dirname, '..', 'fixtures', 'logcat-threadtime.txt'), 'utf8')

describe('nativeErrors', () => {
  it('keeps the Mapbox source and layer errors, JS errors and the fatal crash, in order', () => {
    expect(nativeErrors(logcat)).toEqual([
      { kind: 'mapbox', line: `11-12 10:52:07.709 W Mapbox: [maps-core/style]: Source '{ "sourceId": "composite" }' missing for layer '{ "layerId": "overview-lines-dimmed" }'` },
      { kind: 'mapbox', line: `11-12 10:52:07.711 W Mapbox: [maps-core/style]: Source '{ "sourceId": "composite" }' missing for layer '{ "layerId": "overview-lines-shown" }'` },
      { kind: 'mapbox', line: '11-12 10:52:07.901 E RNMBXMapView: An error occurred while attempting to parse the expression' },
      { kind: 'js', line: '11-12 10:52:08.230 E ReactNativeJS: Error: route failed near <position> ("lat":<redacted>,"lng":<redacted>)' },
      { kind: 'fatal', line: '11-12 10:52:09.001 E AndroidRuntime: FATAL EXCEPTION: main' },
      { kind: 'fatal', line: '11-12 10:52:09.001 E AndroidRuntime: Process: com.zorzi.onfootrn, PID: 21603' },
      { kind: 'fatal', line: '11-12 10:52:09.001 E AndroidRuntime: java.lang.IllegalStateException: at [<position>]' },
    ])
  })

  it('finds nothing in a clean log', () => {
    expect(nativeErrors('--------- beginning of main\n11-12 10:52:06.101 21603 21603 I ReactNativeJS: Running "main"\n')).toEqual([])
  })
})

describe('redactPositions', () => {
  it.each([
    ['at 43.60445, 1.44345 now', 'at <position> now'],
    ['[-1.44345,-43.60445]', '[<position>]'],
    ['lat=43.6 lon: 1.4', 'lat=<redacted> lon: <redacted>'],
    ['{"latitude":43.60445,"longitude":1.44345}', '{"latitude":<redacted>,"longitude":<redacted>}'],
  ])('redacts "%s"', (text, redacted) => {
    expect(redactPositions(text)).toBe(redacted)
  })

  it('leaves tile ids, versions and plain numbers alone', () => {
    expect(redactPositions('tile 14/8253/5972, v11.8.0, took 1.5 s, 3 of 4')).toBe('tile 14/8253/5972, v11.8.0, took 1.5 s, 3 of 4')
  })
})
