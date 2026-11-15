import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { backLanded, deleteDialog, dialogStill, listRows, listShown, mergePage } from '../listScan'
import { parseUiDump } from '../uiDump'

const dump = (name: string) => parseUiDump(readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8'))

describe('listRows', () => {
  it('reads each row of the list by its name, with its actions button when on screen', () => {
    const rows = listRows(dump('ui-trails-list.xml'), 'trail')
    expect(rows.map((r) => r.name)).toEqual(['DEVCHECK climb', 'Owner hike', 'DEVCHECK climb', 'DEVCHECK flat'])
    expect(rows[0].actions).toEqual({ left: 933, top: 310, right: 1023, bottom: 420 })
    expect(rows[2].actions).toEqual({ left: 933, top: 778, right: 1023, bottom: 888 })
    expect(rows[3].actions).toBeNull()
  })

  it('pairs no actions button of the other kind', () => {
    expect(listRows(dump('ui-trails-list.xml'), 'activity').every((r) => r.actions === null)).toBe(true)
  })
})

describe('listShown', () => {
  it('knows the list by its rows or by its empty message', () => {
    expect(listShown(dump('ui-trails-list.xml'), 'trail')).toBe(true)
    expect(listShown(dump('ui-trails-empty.xml'), 'trail')).toBe(true)
  })

  it('does not take the map or the other list for it', () => {
    expect(listShown(dump('ui-map.xml'), 'trail')).toBe(false)
    expect(listShown(dump('ui-trails-empty.xml'), 'activity')).toBe(false)
  })
})

describe('mergePage', () => {
  it('adds the rows a scroll down brought in, after the ones still on screen', () => {
    expect(mergePage(['A', 'B', 'C', 'D'], ['C', 'D', 'E', 'F'], 'down')).toEqual({ rows: ['A', 'B', 'C', 'D', 'E', 'F'], added: 2 })
  })

  it('adds nothing at the end of the list', () => {
    expect(mergePage(['A', 'B', 'C'], ['A', 'B', 'C'], 'down')).toEqual({ rows: ['A', 'B', 'C'], added: 0 })
    expect(mergePage(['A', 'B', 'C', 'D'], ['C', 'D'], 'down')).toEqual({ rows: ['A', 'B', 'C', 'D'], added: 0 })
  })

  it('keeps rows of the same name apart', () => {
    expect(mergePage(['A', 'X', 'X'], ['X', 'X', 'B'], 'down')).toEqual({ rows: ['A', 'X', 'X', 'B'], added: 1 })
  })

  it('takes a page with nothing in common as all new', () => {
    expect(mergePage(['A', 'B'], ['C', 'D'], 'down')).toEqual({ rows: ['A', 'B', 'C', 'D'], added: 2 })
    expect(mergePage([], ['A'], 'down')).toEqual({ rows: ['A'], added: 1 })
  })

  it('puts the rows a scroll up brought in before the ones still on screen', () => {
    expect(mergePage(['C', 'D', 'E'], ['A', 'B', 'C'], 'up')).toEqual({ rows: ['A', 'B', 'C', 'D', 'E'], added: 2 })
    expect(mergePage(['A', 'B'], ['A', 'B'], 'up')).toEqual({ rows: ['A', 'B'], added: 0 })
  })
})

describe('deleteDialog', () => {
  const dialog = dump('ui-delete-trail-dialog.xml')

  it('confirms only a dialog naming exactly the item, at its Delete button', () => {
    expect(deleteDialog(dialog, 'trail', 'DEVCHECK climb')).toEqual({ kind: 'confirm', at: { left: 780, top: 1280, right: 980, bottom: 1380 } })
  })

  it('refuses a dialog naming another item, and offers its Cancel button', () => {
    for (const name of ['DEVCHECK clim', 'DEVCHECK climb 2']) {
      const judged = deleteDialog(dialog, 'trail', name)
      expect(judged).toMatchObject({ kind: 'refuse', cancel: { left: 560, top: 1280, right: 760, bottom: 1380 } })
      expect(judged.kind === 'refuse' && judged.reason).toContain('"DEVCHECK climb"')
    }
  })

  it('refuses the other kind of dialog', () => {
    expect(deleteDialog(dialog, 'activity', 'DEVCHECK climb').kind).toBe('refuse')
  })

  it('sees no dialog on the list or on the actions menu', () => {
    expect(deleteDialog(dump('ui-trails-list.xml'), 'trail', 'DEVCHECK climb')).toEqual({ kind: 'absent' })
    expect(deleteDialog(dump('ui-trail-menu.xml'), 'trail', 'DEVCHECK climb')).toEqual({ kind: 'absent' })
  })
})

describe('dialogStill', () => {
  const dialog = dump('ui-delete-trail-dialog.xml')
  const opening = dialog.map((n) => (n.text === 'DELETE' ? { ...n, bounds: { ...n.bounds, top: n.bounds.top + 12, bottom: n.bounds.bottom + 12 } } : n))

  it('reads the dialog once two reads in a row agree on where its button is', () => {
    expect(dialogStill(dialog, dump('ui-delete-trail-dialog.xml'), 'trail', 'DEVCHECK climb')).toEqual({ kind: 'confirm', at: { left: 780, top: 1280, right: 980, bottom: 1380 } })
    expect(dialogStill(dialog, dump('ui-delete-trail-dialog.xml'), 'trail', 'DEVCHECK other')).toMatchObject({ kind: 'refuse', cancel: { left: 560, top: 1280, right: 760, bottom: 1380 } })
  })

  it('waits while the dialog still moves, on the first read, and while there is none', () => {
    expect(dialogStill(dialog, opening, 'trail', 'DEVCHECK climb')).toBeNull()
    expect(dialogStill(dialog, null, 'trail', 'DEVCHECK climb')).toBeNull()
    const list = dump('ui-trails-list.xml')
    expect(dialogStill(list, list, 'trail', 'DEVCHECK climb')).toBeNull()
  })
})

describe('backLanded', () => {
  const map = dump('server-map-idle.xml')
  const list = dump('server-trails-owner.xml')

  it('is on the map once a back key settles on it', () => {
    expect(backLanded({ found: { kind: 'settled', nodes: map } })).toEqual({ kind: 'map' })
  })

  it('needs another press when the key settled on a screen that is not the map', () => {
    expect(backLanded({ found: { kind: 'settled', nodes: list } })).toEqual({ kind: 'not-yet' })
  })

  it('is stuck when the key changed nothing', () => {
    const landed = backLanded({ found: { kind: 'nothing-changed', nodes: list } })
    expect(landed.kind).toBe('stuck')
    expect(landed.kind === 'stuck' && landed.reason).toMatch(/^back changed nothing; labels seen: /)
  })

  it('takes a screen that never settled for the map when the map is on it, else as stuck', () => {
    expect(backLanded({ found: null, read: map, last: 'labels seen: x' })).toEqual({ kind: 'map' })
    expect(backLanded({ found: null, read: list, last: 'labels seen: x' })).toEqual({ kind: 'stuck', reason: 'the screen did not settle after back; labels seen: x' })
    expect(backLanded({ found: null, read: null, last: 'cannot tell' })).toEqual({ kind: 'stuck', reason: 'the screen did not settle after back; cannot tell' })
  })
})
