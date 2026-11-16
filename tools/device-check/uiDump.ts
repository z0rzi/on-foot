// A screen's accessibility tree, as the reader's page source gives it, read as the flat list of its
// nodes in document (screen) order. The platform's `uiautomator dump` form is read too, for the
// fixtures taken in that form, among them the pairs holding both forms of one screen.
export interface Bounds { left: number; top: number; right: number; bottom: number }

export interface UiNode {
  text: string
  desc: string
  className: string
  bounds: Bounds
  scrollable: boolean
}

export type LabelMatch = { node: UiNode; seen?: undefined } | { node: null; seen: string[] }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (whole, code: string) => {
    if (code.startsWith('#x')) return String.fromCodePoint(parseInt(code.slice(2), 16))
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10))
    return ENTITIES[code] ?? whole
  })

function parseBounds(raw: string | undefined): Bounds {
  const m = raw?.match(/^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/)
  if (!m) return { left: 0, top: 0, right: 0, bottom: 0 }
  return { left: Number(m[1]), top: Number(m[2]), right: Number(m[3]), bottom: Number(m[4]) }
}

// Every element below the root: `node` in a platform dump, the widget class (`android.widget.TextView`)
// in the reader's page source. Both carry the same attributes.
const ELEMENT = /<(?!hierarchy[\s>])[A-Za-z_][\w.$-]*\s([^>]*?)\/?>/g

export function parseUiDump(xml: string): UiNode[] {
  const nodes: UiNode[] = []
  for (const tag of xml.matchAll(ELEMENT)) {
    const attrs: Record<string, string> = {}
    for (const [, name, double, single] of tag[1].matchAll(/([\w-]+)=(?:"([^"]*)"|'([^']*)')/g)) attrs[name] = decode(double ?? single)
    nodes.push({
      text: attrs.text ?? '',
      desc: attrs['content-desc'] ?? '',
      className: attrs.class ?? '',
      bounds: parseBounds(attrs.bounds),
      scrollable: attrs.scrollable === 'true',
    })
  }
  return nodes
}

// React Native joins an accessible group's child texts with ", ", and an icon's text is a glyph from
// the private use area: "<glyph>, Trails" reads "Trails".
function readable(raw: string): string {
  return raw
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\s+/g, ' ')
    .split(', ')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(', ')
}

export const hasArea = (b: Bounds) => b.right > b.left && b.bottom > b.top

export function labelsOf(node: UiNode): string[] {
  if (!hasArea(node.bounds)) return []
  return [readable(node.desc), readable(node.text)].filter((l) => l.length > 0)
}

const within = (inner: Bounds, outer: Bounds) =>
  inner.left >= outer.left && inner.top >= outer.top && inner.right <= outer.right && inner.bottom <= outer.bottom

// Each label in screen order. A label is said once for a control and the texts nested in it, which
// repeat it, and again for a node elsewhere on screen that carries it too.
function labelsOnScreen(nodes: UiNode[]): string[] {
  const said = new Map<string, Bounds[]>()
  const labels: string[] = []
  for (const node of nodes) {
    for (const label of labelsOf(node)) {
      const at = said.get(label) ?? []
      if (at.some((b) => within(node.bounds, b) || within(b, node.bounds))) continue
      said.set(label, [...at, node.bounds])
      labels.push(label)
    }
  }
  return labels
}

export function summaryLine(nodes: UiNode[]): string {
  return labelsOnScreen(nodes).join(' | ')
}

const LABELS = 'labels: '

export const labelsLine = (nodes: UiNode[]) => `${LABELS}${summaryLine(nodes)}`

// An accessibility label names a control; a text may also be a title that reads the same, so a
// label match wins over a text match.
export function findByLabel(nodes: UiNode[], label: string): LabelMatch {
  const visible = nodes.filter((n) => hasArea(n.bounds))
  const node = visible.find((n) => readable(n.desc) === label) ?? visible.find((n) => readable(n.text) === label)
  return node ? { node } : { node: null, seen: labelsOnScreen(nodes) }
}

export function centre(b: Bounds): { x: number; y: number } {
  return { x: Math.round((b.left + b.right) / 2), y: Math.round((b.top + b.bottom) / 2) }
}

// An ffmpeg filter cutting a screenshot to the bounds.
export function cropFilter(b: Bounds): string {
  return `crop=${b.right - b.left}:${b.bottom - b.top}:${b.left}:${b.top}`
}
