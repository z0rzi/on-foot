import { GradeBand } from './profile'
import { AppColors } from '../theme/colors'

export function slopeBandColour(band: GradeBand, c: AppColors): string {
  return band === 'steep' ? c.slopeSteep
    : band === 'rough' ? c.slopeRough
    : band === 'uphill' ? c.slopeUphill
    : band === 'downhill' ? c.slopeDownhill
    : c.slopeFlat
}
