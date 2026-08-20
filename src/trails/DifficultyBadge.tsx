import { Text } from 'react-native'
import { Difficulty } from '../data/trails/types'
import { useTheme } from '../theme/useTheme'
import { difficultyColor, difficultyLabel } from './difficulty'

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const c = useTheme()
  return (
    <Text style={{ color: difficultyColor(difficulty, c), fontSize: 12, fontWeight: '600' }}>
      {difficultyLabel(difficulty)}
    </Text>
  )
}
