import { TrailSummary } from '../data/trails/types'
import { EntitySummary } from '../components/EntitySummary'
import { difficultyField } from './difficulty'
import { formatCompleted, formatTrailSummary } from './format'

// A trail's difficulty badge leading its distance and gain on one line, as the Trails list and the
// recording card show them; under it, when given and not zero, how often it was completed.
export function TrailSummaryRow({ trail, completed = 0 }: { trail: TrailSummary; completed?: number }) {
  return (
    <EntitySummary
      badge={{ field: difficultyField, value: trail.difficulty }}
      lines={completed > 0 ? [formatTrailSummary(trail.metrics), formatCompleted(completed)] : [formatTrailSummary(trail.metrics)]}
    />
  )
}
