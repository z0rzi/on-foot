import type { AppColors } from '../theme/colors'

// The card's surface at its two snap points, which the live index blends between. Collapsed it is the
// pill's translucent surface, so the map shows faintly through the graph card and the nav card; open
// it is opaque, where the details are read over any map.
export function cardSurfaces(c: AppColors): { collapsed: string; open: string } {
  return { collapsed: c.pillSurface, open: c.surface }
}
