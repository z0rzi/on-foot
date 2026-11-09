import { TrailSummary } from '../data/trails/types'
import { EntitySummary } from '../components/EntitySummary'
import { difficultyField } from './difficulty'
import { formatTrailSummary } from './format'

// A trail's difficulty badge leading its distance and gain on one line, as the Trails list and the recording card show them.
export function TrailSummaryRow({ trail }: { trail: TrailSummary }) {
  return (
    <EntitySummary
      badge={{ field: difficultyField, value: trail.difficulty }}
      lines={[formatTrailSummary(trail.metrics)]}
    />
  )
}
