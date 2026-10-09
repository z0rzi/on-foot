import { useMemo } from 'react'
import type { ColouredLine } from '../map/provider/types'
import { useTheme } from '../theme/useTheme'
import { routeColouring } from './routeColouring'
import type { RouteDisplay } from './routeDisplay'

// Thin wrapper: the derivation lives in routeColouring, pure and unit-tested.
export function useRouteColouring(display: RouteDisplay | null): ColouredLine[] | undefined {
  const c = useTheme()

  return useMemo(() => routeColouring(display, c), [display, c])
}
