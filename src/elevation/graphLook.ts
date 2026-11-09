import type { GradeBand } from './profile'
import type { AppColors } from '../theme/colors'
import { slopeBandColour } from './slopeColour'

// One stop of a band's vertical fade: how far down the band's area (0 at its top edge, 1 at the
// plot's floor) and how opaque its colour is there.
export interface FadeStop { offset: number; opacity: number }

export interface GraphLook {
  // Each band's colour.
  fill: (band: GradeBand) => string
  // How each band's colour fades down its area, so the bands melt into the card at the bottom.
  fade: FadeStop[]
  line: string
  // The y-axis's elevation labels, and its gridlines drawn faint.
  axis: string
}

const FADE: FadeStop[] = [
  { offset: 0, opacity: 1 },
  { offset: 0.6, opacity: 0.45 },
  { offset: 1, opacity: 0 },
]

// The graph's look on the card's surface: each band fading to nothing at the bottom, flat a
// theme-aware grey, which reads on a light or dark card where the map route's flat colour vanishes;
// the line and the axis in the card's text colours.
export function graphLook(c: AppColors): GraphLook {
  return {
    fill: (band) => (band === 'flat' ? c.slopeFlatOnPanel : slopeBandColour(band, c)),
    fade: FADE,
    line: c.onSurface,
    axis: c.onSurfaceVariant,
  }
}
