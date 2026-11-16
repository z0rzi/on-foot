import { isDevcheckName } from './devcheckData'
import { sameBounds } from './settled'
import { hasArea, type Bounds, type UiNode } from './uiDump'

// The app's delete confirmations (the Alert of useDeleteTrail and useDeleteActivity) as a dump
// shows them: the title, the item named between double quotes, a Delete button that Material may
// capitalise.
const TITLES = ['Delete trail', 'Delete activity']

const confirmButton = (nodes: UiNode[]) =>
  nodes.find((n) => n.className === 'android.widget.Button' && /^delete$/i.test(n.text.trim()) && hasArea(n.bounds))?.bounds ?? null

// Why a tap at `target` would confirm deleting an item that is not a check's; null for any other tap.
export function deleteConfirmRefusal(nodes: UiNode[], target: Bounds): string | null {
  const confirm = confirmButton(nodes)
  if (!confirm || !sameBounds(confirm, target) || !nodes.some((n) => TITLES.includes(n.text))) return null
  const named = nodes.map((n) => /"(.*)"/s.exec(n.text)?.[1]).find((q) => q !== undefined)
  if (named === undefined) return 'refused: the dialog names no item; only DEVCHECK items are deleted'
  return isDevcheckName(named) ? null : `refused: the dialog deletes "${named}", not a DEVCHECK item; only DEVCHECK items are deleted`
}
