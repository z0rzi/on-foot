import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deleteDialog, listRows, listShown, mergePage } from '../listScan'
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
