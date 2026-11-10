import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { centre, cropFilter, findByLabel, parseUiDump, summaryLine } from '../uiDump'

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8')

const map = parseUiDump(fixture('ui-map.xml'))
const sheetOpen = parseUiDump(fixture('ui-map-sheet-open.xml'))

describe('summaryLine', () => {
  it('lists the labels and texts on screen once each, in screen order, without icon glyphs', () => {
    expect(summaryLine(map)).toBe(
      'Bottom Sheet | Show more | DEVCHECK dot cross | · 928 m · 60 m gain | Stop showing trail | Start recording | ' +
        'Reset north | Switch to 3D view | 3D | Open map layers | Frame the whole route | Center on your location',
    )
  })

  it('leaves out nodes that take no room on screen', () => {
    expect(summaryLine(sheetOpen).split(' | ').filter((l) => l === 'Trails')).toHaveLength(1)
  })
})

describe('findByLabel', () => {
  it('finds a control by its accessibility label', () => {
    const match = findByLabel(map, 'Start recording')
    expect(match.node).not.toBeNull()
  })

  it('finds a button whose label is an icon and a text, by the text', () => {
    const match = findByLabel(sheetOpen, 'Trails')
    expect(match.node?.bounds).toEqual({ left: 61, top: 2196, right: 380, bottom: 2252 })
    expect(centre(match.node!.bounds)).toEqual({ x: 221, y: 2224 })
  })

  it('prefers the control carrying the accessibility label over a text that reads the same', () => {
    const saveForm = parseUiDump(fixture('ui-save-activity.xml'))
    expect(findByLabel(saveForm, 'Save activity').node?.bounds).toEqual({ left: 41, top: 1338, right: 1039, bottom: 1475 })
  })

  it('finds a file in the system picker by its name', () => {
    const picker = parseUiDump(fixture('ui-picker.xml'))
    expect(findByLabel(picker, 'DEVCHECK-fixture.gpx').node).not.toBeNull()
  })

  it('lists the labels it saw when nothing matches', () => {
    const match = findByLabel(map, 'Stop and save recording')
    expect(match.node).toBeNull()
    expect(match.seen).toContain('Start recording')
    expect(match.seen).toContain('Center on your location')
  })
})

describe('cropFilter', () => {
  it('cuts the screenshot to the node bounds', () => {
    expect(cropFilter({ left: 61, top: 2196, right: 380, bottom: 2252 })).toBe('crop=319:56:61:2196')
  })
})

describe('parseUiDump', () => {
  it('decodes escaped characters in labels', () => {
    const nodes = parseUiDump(
      '<hierarchy><node text="Fish &amp; chips&#10;&quot;today&quot;" content-desc="" class="android.widget.TextView" bounds="[0,0][10,10]" /></hierarchy>',
    )
    expect(nodes[0].text).toBe('Fish & chips\n"today"')
    expect(summaryLine(nodes)).toBe('Fish & chips "today"')
  })

  it('reads a value holding double quotes, which the dump writes in single quotes', () => {
    const nodes = parseUiDump(
      `<hierarchy><node index="12" text='{"kept":1,"droppedJump":0}' resource-id="" class="android.widget.TextView" content-desc="" bounds="[30,1061][1050,1214]" /></hierarchy>`,
    )
    expect(nodes[0]).toMatchObject({ text: '{"kept":1,"droppedJump":0}', className: 'android.widget.TextView' })
    expect(nodes[0].bounds).toEqual({ left: 30, top: 1061, right: 1050, bottom: 1214 })
    expect(summaryLine(nodes)).toBe('{"kept":1,"droppedJump":0}')
  })
})
