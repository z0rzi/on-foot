import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scrollSwipe } from '../scrollPlan'
import { parseUiDump } from '../uiDump'

// The debug log while recording: a banner and the area chips above it, the list from y 876 down.
const debugLog = parseUiDump(readFileSync(join(__dirname, '..', 'fixtures', 'server-debug-log-recording.xml'), 'utf8'))

const screenHighList = parseUiDump(
  '<hierarchy><node scrollable="false" class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">' +
    '<node scrollable="true" class="android.widget.ScrollView" bounds="[0,0][1080,2400]" /></node></hierarchy>',
)

describe('scrollSwipe', () => {
  it('drags up the middle of the list, from 70 % to 35 % of its height, to bring the rows below', () => {
    expect(scrollSwipe(screenHighList, 'down')).toEqual({ x: 540, from: 1680, to: 840, ms: 600 })
  })

  it('drags the same stretch down to bring the rows above', () => {
    expect(scrollSwipe(screenHighList, 'up')).toEqual({ x: 540, from: 840, to: 1680, ms: 600 })
  })

  it('drags inside a list that starts below a header, both ways', () => {
    expect(scrollSwipe(debugLog, 'up')).toEqual({ x: 540, from: 1409, to: 1943, ms: 600 })
    expect(scrollSwipe(debugLog, 'down')).toEqual({ x: 540, from: 1943, to: 1409, ms: 600 })
  })

  it('has no drag for a screen where nothing scrolls, such as an empty list', () => {
    expect(scrollSwipe(parseUiDump('<hierarchy><node class="android.view.View" bounds="[0,0][1080,2400]" /></hierarchy>'), 'down')).toBeNull()
  })
})
