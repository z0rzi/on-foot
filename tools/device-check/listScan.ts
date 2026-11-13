import type { Bounds, UiNode } from './uiDump'

// The Trails and Activities lists as a dump shows them, and their delete dialog. Labels and copy
// come from the app: EntityListItem's `Show <name> on map`, the actions buttons, the menu item,
// ListScreen's empty message, and the Alert of useDeleteTrail / useDeleteActivity.
export type EntityKind = 'trail' | 'activity'

export const ENTITY: Record<EntityKind, { route: string; actions: string; deleteLabel: string; empty: string }> = {
  trail: { route: '/trails', actions: 'Trail actions', deleteLabel: 'Delete trail', empty: 'No trails yet.' },
  activity: { route: '/activities', actions: 'Activity actions', deleteLabel: 'Delete activity', empty: 'No activities yet.' },
}

export interface ListRow { name: string; actions: Bounds | null }

const hasArea = (b: Bounds) => b.right > b.left && b.bottom > b.top
const ROW_LABEL = /^Show (.+) on map$/

// Rows in screen order. The actions button sits beside the row's body, level with it; one scrolled
// off the screen leaves the row with none.
export function listRows(nodes: UiNode[], kind: EntityKind): ListRow[] {
  const visible = nodes.filter((n) => hasArea(n.bounds))
  const buttons = visible.filter((n) => n.desc === ENTITY[kind].actions)
  return visible.flatMap((n) => {
    const m = ROW_LABEL.exec(n.desc)
    if (!m) return []
    const button = buttons.find((b) => {
      const middle = (b.bounds.top + b.bounds.bottom) / 2
      return middle >= n.bounds.top && middle <= n.bounds.bottom
    })
    return [{ name: m[1], actions: button?.bounds ?? null }]
  })
}

export function listShown(nodes: UiNode[], kind: EntityKind): boolean {
  return listRows(nodes, kind).some((r) => r.actions !== null) || nodes.some((n) => n.text.startsWith(ENTITY[kind].empty))
}

// The rows seen so far, top to bottom, with a page read after a scroll. The page shares its first
// rows (scrolling down) or its last rows (up) with the ones seen: the longest such run is the
// overlap, and the rest is new.
export function mergePage(seen: string[], page: string[], direction: 'down' | 'up'): { rows: string[]; added: number } {
  if (direction === 'up') {
    const merged = mergePage([...seen].reverse(), [...page].reverse(), 'down')
    return { rows: merged.rows.reverse(), added: merged.added }
  }
  const same = (k: number) => seen.slice(seen.length - k).every((name, i) => name === page[i])
  let overlap = Math.min(seen.length, page.length)
  while (overlap > 0 && !same(overlap)) overlap--
  const fresh = page.slice(overlap)
  return { rows: [...seen, ...fresh], added: fresh.length }
}

export type DeleteDialogRead =
  | { kind: 'absent' }
  | { kind: 'confirm'; at: Bounds }
  | { kind: 'refuse'; reason: string; cancel: Bounds | null }

const button = (nodes: UiNode[], text: RegExp) =>
  nodes.find((n) => n.className === 'android.widget.Button' && text.test(n.text.trim()) && hasArea(n.bounds))?.bounds ?? null

// The confirm dialog names its item between double quotes. Material dialogs may capitalise the
// button texts.
export function deleteDialog(nodes: UiNode[], kind: EntityKind, name: string): DeleteDialogRead {
  const confirm = button(nodes, /^delete$/i)
  if (!confirm) return { kind: 'absent' }
  const cancel = button(nodes, /^cancel$/i)
  const title = ENTITY[kind].deleteLabel
  if (!nodes.some((n) => n.text === title)) return { kind: 'refuse', reason: `the dialog is not "${title}"`, cancel }
  const named = nodes.map((n) => /"(.*)"/s.exec(n.text)?.[1]).find((q) => q !== undefined)
  if (named !== name) return { kind: 'refuse', reason: `the dialog names ${named === undefined ? 'no item' : `"${named}"`}, not "${name}"`, cancel }
  return { kind: 'confirm', at: confirm }
}
