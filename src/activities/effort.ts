import { Effort } from '../data/activities/types'
import { AppColors } from '../theme/colors'

export const EFFORTS: Effort[] = ['easy', 'moderate', 'hard', 'max']

const LABELS: Record<Effort, string> = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', max: 'Max' }

export function effortLabel(effort: Effort): string {
  return LABELS[effort]
}

export function effortColor(effort: Effort, colors: AppColors): string {
  switch (effort) {
    case 'easy': return colors.difficultyEasy
    case 'moderate': return colors.difficultyMedium
    case 'hard': return colors.difficultyHard
    case 'max': return colors.danger
  }
}
