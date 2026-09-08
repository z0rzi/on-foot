import { EnumField } from '../components/enumField'
import { Difficulty } from '../data/trails/types'
import { AppColors } from '../theme/colors'

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

const LABELS: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export function difficultyLabel(difficulty: Difficulty): string {
  return LABELS[difficulty]
}

export function difficultyColor(difficulty: Difficulty, colors: AppColors): string {
  switch (difficulty) {
    case 'easy': return colors.intensityLow
    case 'medium': return colors.intensityMedium
    case 'hard': return colors.intensityHigh
  }
}

export const difficultyField: EnumField<Difficulty> = {
  name: 'Difficulty',
  values: DIFFICULTIES,
  label: difficultyLabel,
  color: difficultyColor,
}
