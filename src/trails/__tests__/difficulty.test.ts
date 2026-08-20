import { DIFFICULTIES, difficultyLabel, difficultyColor } from '../difficulty'
import { lightColors } from '../../theme/colors'

test('DIFFICULTIES lists all three in ascending order', () => {
  expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard'])
})

test('difficultyLabel capitalizes each level', () => {
  expect(difficultyLabel('easy')).toBe('Easy')
  expect(difficultyLabel('medium')).toBe('Medium')
  expect(difficultyLabel('hard')).toBe('Hard')
})

test('difficultyColor maps each level to its theme color', () => {
  expect(difficultyColor('easy', lightColors)).toBe(lightColors.difficultyEasy)
  expect(difficultyColor('medium', lightColors)).toBe(lightColors.difficultyMedium)
  expect(difficultyColor('hard', lightColors)).toBe(lightColors.difficultyHard)
})
