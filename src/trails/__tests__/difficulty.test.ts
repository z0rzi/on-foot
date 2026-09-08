import { DIFFICULTIES, difficultyLabel, difficultyColor, difficultyField } from '../difficulty'
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

test('difficultyField exposes the difficulty enum to the generic controls', () => {
  expect(difficultyField.name).toBe('Difficulty')
  expect(difficultyField.values).toEqual(DIFFICULTIES)
  expect(difficultyField.label('hard')).toBe('Hard')
  expect(difficultyField.color('hard', lightColors)).toBe(lightColors.difficultyHard)
})
