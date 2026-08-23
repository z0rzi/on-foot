import { Text } from 'react-native'
import { Effort } from '../data/activities/types'
import { useTheme } from '../theme/useTheme'
import { effortColor, effortLabel } from './effort'

export function EffortBadge({ effort }: { effort: Effort }) {
  const c = useTheme()
  return (
    <Text style={{ color: effortColor(effort, c), fontSize: 12, fontWeight: '600' }}>
      {effortLabel(effort)}
    </Text>
  )
}
