import { PhoneGone, serial } from './adb'
import { devcheckNames, requireDevcheckName } from './devcheckData'
import { errorMessage } from './errorMessage'
import { back, pressBack } from './keys'
import { backLanded, deleteDialog, dialogStill, ENTITY, listRows, listShown, MAP, mergePage, type EntityKind, type ListRow } from './listScan'
import { pollScreen, swipe, tap, tapAt, waitFor } from './look'
import type { ScrollDirection } from './scrollPlan'
import { stopReader } from './reader'
import { stopRecorder } from './recorder'
import { openInApp, refuseWhileMoving, refuseWhileRecording, requireOnFoot } from './screen'
import { screenAgrees } from './settled'
import { reached } from './tapOutcome'
import type { Bounds, UiNode } from './uiDump'
import { runningMove } from './phoneStore'

const LIST_TIMEOUT_S = 10
const MENU_TIMEOUT_S = 5
const DIALOG_TIMEOUT_S = 5
const MAX_PAGES = 40
const MAX_BACKS = 6

async function openList(kind: EntityKind): Promise<void> {
  await openInApp(ENTITY[kind].route)
  const shown = await pollScreen(LIST_TIMEOUT_S, (nodes) => (listShown(nodes, kind) ? true : null))
  if (shown.found === null) throw new Error(`the ${kind} list did not open; ${shown.last}`)
}

// The rows once the list stands still: two reads in a row agree on every label and where it is.
async function readPage(kind: EntityKind): Promise<{ rows: ListRow[]; nodes: UiNode[] }> {
  const page = await pollScreen(LIST_TIMEOUT_S, (current, previous) =>
    previous !== null && listShown(current, kind) && screenAgrees(previous, current) ? listRows(current, kind) : null,
  )
  if (page.found === null) throw new Error(`the ${kind} list is no longer on screen; ${page.last}`)
  return { rows: page.found, nodes: page.read }
}

// Scrolls one way until a page brings no new row or the list does not scroll, or until `stop` takes
// the page on screen.
async function scan(kind: EntityKind, direction: ScrollDirection, stop?: (page: ListRow[]) => boolean) {
  let page = await readPage(kind)
  let rows = page.rows.map((r) => r.name)
  for (let pages = 1; pages < MAX_PAGES; pages++) {
    if (stop?.(page.rows)) return { rows, page: page.rows, stopped: true }
    if (!(await swipe(page.nodes, direction))) return { rows, page: page.rows, stopped: false }
    page = await readPage(kind)
    const merged = mergePage(rows, page.rows.map((r) => r.name), direction)
    rows = merged.rows
    if (merged.added === 0) return { rows, page: page.rows, stopped: stop?.(page.rows) ?? false }
  }
  throw new Error(`the ${kind} list did not end after ${MAX_PAGES} pages`)
}

// Every row of the list, top to bottom; leaves the list scrolled to its end.
async function wholeList(kind: EntityKind): Promise<string[]> {
  await scan(kind, 'up')
  return (await scan(kind, 'down')).rows
}

const tappable = (page: ListRow[], name: string) => page.find((r) => r.name === name && r.actions !== null)?.actions ?? null

const occurrences = (rows: string[], name: string) => rows.filter((r) => r === name).length

// Answers the dialog once it stands still, then waits for it to go and for the list to drop the row
// from the page it was deleted from, `onPage` times there before; a list slow to refresh is waited
// out up to the cap and left to the whole-list count.
async function confirmDelete(kind: EntityKind, name: string, onPage: number): Promise<void> {
  const polled = await pollScreen(DIALOG_TIMEOUT_S, (current, previous) => dialogStill(current, previous, kind, name))
  if (polled.found === null) throw new Error(`no delete dialog stood still; ${polled.last}`)
  const dialog = polled.found
  if (dialog.kind === 'refuse') {
    if (dialog.cancel) await tapAt(dialog.cancel)
    else await back()
    throw new Error(`not confirmed, the dialog is dismissed: ${dialog.reason}`)
  }
  await tapAt(dialog.at)
  const listed = await pollScreen(LIST_TIMEOUT_S, (nodes) =>
    deleteDialog(nodes, kind, name).kind === 'absent' && listShown(nodes, kind) && occurrences(listRows(nodes, kind).map((r) => r.name), name) < onPage ? true : null,
  )
  if (listed.found !== null) return
  if (listed.read === null) throw new Error(`the list did not come back after the delete; ${listed.last}`)
  if (deleteDialog(listed.read, kind, name).kind !== 'absent') throw new Error(`the delete dialog is still open after the tap on its Delete button; ${listed.last}`)
  if (!listShown(listed.read, kind)) throw new Error(`the list did not come back after the delete; ${listed.last}`)
}

export async function deleteItem(kind: EntityKind, name: string): Promise<string> {
  requireDevcheckName(name)
  refuseWhileMoving(await serial(), 'delete')
  await requireOnFoot()
  await refuseWhileRecording('delete')
  await openList(kind)
  const before = occurrences(await wholeList(kind), name)
  if (before === 0) throw new Error(`no ${kind} named "${name}" in the list`)
  const found = await scan(kind, 'up', (page) => tappable(page, name) !== null)
  const actions: Bounds | null = tappable(found.page, name)
  if (!actions) throw new Error(`"${name}" is listed but its ${ENTITY[kind].actions} button never came on screen`)
  await tapAt(actions)
  await waitFor(ENTITY[kind].deleteLabel, false, MENU_TIMEOUT_S)
  await tap(ENTITY[kind].deleteLabel)
  await confirmDelete(kind, name, occurrences(found.page.map((r) => r.name), name))
  const after = occurrences(await wholeList(kind), name)
  if (after !== before - 1) throw new Error(`"${name}" is still listed ${after} times (${before} before the delete)`)
  return `deleted ${kind} "${name}"`
}

const KINDS: EntityKind[] = ['activity', 'trail']

// The lists the sweep opened are left one back key at a time, each press waited out until the
// screen settles, down to the map.
async function backToMap(): Promise<void> {
  const front = await pollScreen(LIST_TIMEOUT_S, (current) => current)
  if (front.found === null) throw new Error(`the screen could not be read; ${front.last}`)
  if (reached(MAP, front.found)) return
  for (let presses = 1; presses <= MAX_BACKS; presses++) {
    const landed = backLanded(await pressBack())
    if (landed.kind === 'map') return
    if (landed.kind === 'stuck') throw new Error(landed.reason)
  }
  throw new Error(`the map did not come back after ${MAX_BACKS} presses of back`)
}

// Every DEVCHECK activity, then trail, through `delete`, then back to the map, and the reader and
// then the recorder are stopped unless a walk moves. True when nothing was left behind and the map is in front.
export async function cleanup(): Promise<boolean> {
  const id = await serial()
  refuseWhileMoving(id, 'cleanup')
  await requireOnFoot()
  await refuseWhileRecording('cleanup')
  const deleted: string[] = []
  const left: string[] = []
  for (const kind of KINDS) {
    try {
      await openList(kind)
      const names = devcheckNames(await wholeList(kind))
      console.log(`${kind} list: ${names.length === 0 ? 'no DEVCHECK item' : names.map((n) => `"${n}"`).join(', ')}`)
      for (const name of names) {
        try {
          console.log(await deleteItem(kind, name))
          deleted.push(`${kind} "${name}"`)
        } catch (error) {
          if (error instanceof PhoneGone) throw error
          left.push(`${kind} "${name}": ${errorMessage(error)}`)
        }
      }
    } catch (error) {
      if (error instanceof PhoneGone) throw error
      left.push(`the ${kind} list: ${errorMessage(error)}`)
    }
  }
  console.log(`deleted ${deleted.length}${deleted.length > 0 ? `: ${deleted.join(', ')}` : ''}`)
  if (left.length > 0) console.log(`could not delete:\n${left.map((l) => `  ${l}`).join('\n')}`)
  let onMap = true
  try {
    await backToMap()
    console.log('back on the map')
  } catch (error) {
    if (error instanceof PhoneGone) throw error
    onMap = false
    console.log(`not back on the map: ${errorMessage(error)}`)
  }
  const walker = runningMove(id)
  if (walker === null) {
    await stopReader()
    console.log('reader stopped')
    const { kept, failure } = await stopRecorder(id)
    console.log(failure === null ? 'recorder stopped' : `recorder stopped; it had died before: ${failure}`)
    console.log(kept === null ? 'no capture to keep' : `capture: ${kept}`)
  } else {
    console.log(`reader and recorder left running: a walk is moving (pid ${walker})`)
  }
  return left.length === 0 && onMap
}
