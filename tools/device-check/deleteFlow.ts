import { PhoneGone, serial, shell, sleep } from './adb'
import { devcheckNames, requireDevcheckName } from './devcheckData'
import { deleteDialog, ENTITY, listRows, listShown, mergePage, type EntityKind, type ListRow } from './listScan'
import { pollScreen, tapAt } from './look'
import type { DisplaySize } from './phoneState'
import { displaySize, openInApp, refuseWhileMoving, refuseWhileRecording, requireOnFoot } from './screen'
import { findByLabel, type Bounds } from './uiDump'

const LIST_TIMEOUT_S = 10
const MENU_TIMEOUT_S = 5
const DIALOG_TIMEOUT_S = 5
const SWIPE_MS = 600
const SETTLE_MS = 500
const MAX_PAGES = 40

type Direction = 'down' | 'up'

async function openList(kind: EntityKind): Promise<void> {
  await openInApp(ENTITY[kind].route)
  const shown = await pollScreen('delete', LIST_TIMEOUT_S, (nodes) => (listShown(nodes, kind) ? true : null))
  if (shown.found === null) throw new Error(`the ${kind} list did not open; ${shown.last}`)
}

async function readPage(kind: EntityKind): Promise<ListRow[]> {
  const page = await pollScreen('delete', LIST_TIMEOUT_S, (nodes) => (listShown(nodes, kind) ? listRows(nodes, kind) : null))
  if (page.found === null) throw new Error(`the ${kind} list is no longer on screen; ${page.last}`)
  return page.found
}

// A drag, not a fling, over a third of the screen: each page keeps rows of the one before.
async function scroll(display: DisplaySize, direction: Direction): Promise<void> {
  const x = Math.round(display.width / 2)
  const [low, high] = [Math.round(display.height * 0.7), Math.round(display.height * 0.35)]
  const [from, to] = direction === 'down' ? [low, high] : [high, low]
  await shell(`input swipe ${x} ${from} ${x} ${to} ${SWIPE_MS}`)
  await sleep(SETTLE_MS)
}

// Scrolls one way until a page brings no new row, or until `stop` takes the page on screen.
async function scan(kind: EntityKind, display: DisplaySize, direction: Direction, stop?: (page: ListRow[]) => boolean) {
  let page = await readPage(kind)
  let rows = page.map((r) => r.name)
  for (let pages = 1; pages < MAX_PAGES; pages++) {
    if (stop?.(page)) return { rows, page, stopped: true }
    await scroll(display, direction)
    page = await readPage(kind)
    const merged = mergePage(rows, page.map((r) => r.name), direction)
    rows = merged.rows
    if (merged.added === 0) return { rows, page, stopped: stop?.(page) ?? false }
  }
  throw new Error(`the ${kind} list did not end after ${MAX_PAGES} pages`)
}

// Every row of the list, top to bottom; leaves the list scrolled to its end.
async function wholeList(kind: EntityKind, display: DisplaySize): Promise<string[]> {
  await scan(kind, display, 'up')
  return (await scan(kind, display, 'down')).rows
}

const tappable = (page: ListRow[], name: string) => page.find((r) => r.name === name && r.actions !== null)?.actions ?? null

async function tapLabel(label: string, timeoutS: number): Promise<void> {
  const found = await pollScreen('delete', timeoutS, (nodes) => findByLabel(nodes, label).node?.bounds ?? null)
  if (found.found === null) throw new Error(`no "${label}" on screen; ${found.last}`)
  await tapAt(found.found)
}

async function confirmDelete(kind: EntityKind, name: string): Promise<void> {
  const polled = await pollScreen('delete', DIALOG_TIMEOUT_S, (nodes) => {
    const read = deleteDialog(nodes, kind, name)
    return read.kind === 'absent' ? null : read
  })
  if (polled.found === null) throw new Error(`no delete dialog appeared; ${polled.last}`)
  const dialog = polled.found
  if (dialog.kind === 'refuse') {
    if (dialog.cancel) await tapAt(dialog.cancel)
    else await shell('input keyevent 4')
    throw new Error(`not confirmed, the dialog is dismissed: ${dialog.reason}`)
  }
  await tapAt(dialog.at)
  const back = await pollScreen('delete', LIST_TIMEOUT_S, (nodes) => (listShown(nodes, kind) ? true : null))
  if (back.found === null) throw new Error(`the list did not come back after the delete; ${back.last}`)
}

const occurrences = (rows: string[], name: string) => rows.filter((r) => r === name).length

export async function deleteItem(kind: EntityKind, name: string): Promise<void> {
  requireDevcheckName(name)
  refuseWhileMoving(await serial(), 'delete')
  await requireOnFoot()
  await refuseWhileRecording('delete')
  const display = await displaySize()
  await openList(kind)
  const before = occurrences(await wholeList(kind, display), name)
  if (before === 0) throw new Error(`no ${kind} named "${name}" in the list`)
  const found = await scan(kind, display, 'up', (page) => tappable(page, name) !== null)
  const actions: Bounds | null = tappable(found.page, name)
  if (!actions) throw new Error(`"${name}" is listed but its ${ENTITY[kind].actions} button never came on screen`)
  await tapAt(actions)
  await tapLabel(ENTITY[kind].deleteLabel, MENU_TIMEOUT_S)
  await confirmDelete(kind, name)
  const after = occurrences(await wholeList(kind, display), name)
  if (after !== before - 1) throw new Error(`"${name}" is still listed ${after} times (${before} before the delete)`)
  console.log(`deleted ${kind} "${name}"`)
}

const KINDS: EntityKind[] = ['activity', 'trail']

// Every DEVCHECK activity, then trail, through `delete`. True when nothing was left behind.
export async function cleanup(): Promise<boolean> {
  refuseWhileMoving(await serial(), 'cleanup')
  await requireOnFoot()
  await refuseWhileRecording('cleanup')
  const display = await displaySize()
  const deleted: string[] = []
  const left: string[] = []
  for (const kind of KINDS) {
    try {
      await openList(kind)
      const names = devcheckNames(await wholeList(kind, display))
      console.log(`${kind} list: ${names.length === 0 ? 'no DEVCHECK item' : names.map((n) => `"${n}"`).join(', ')}`)
      for (const name of names) {
        try {
          await deleteItem(kind, name)
          deleted.push(`${kind} "${name}"`)
        } catch (error) {
          if (error instanceof PhoneGone) throw error
          left.push(`${kind} "${name}": ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    } catch (error) {
      if (error instanceof PhoneGone) throw error
      left.push(`the ${kind} list: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  console.log(`deleted ${deleted.length}${deleted.length > 0 ? `: ${deleted.join(', ')}` : ''}`)
  if (left.length > 0) console.log(`could not delete:\n${left.map((l) => `  ${l}`).join('\n')}`)
  return left.length === 0
}
