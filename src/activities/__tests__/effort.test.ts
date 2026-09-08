import { EFFORTS, effortLabel, effortColor, effortField } from '../effort'
import { lightColors } from '../../theme/colors'

test('EFFORTS lists all four in ascending order', () => {
  expect(EFFORTS).toEqual(['easy', 'moderate', 'hard', 'max'])
})

test('effortLabel capitalizes each level', () => {
  expect(effortLabel('easy')).toBe('Easy')
  expect(effortLabel('moderate')).toBe('Moderate')
  expect(effortLabel('hard')).toBe('Hard')
  expect(effortLabel('max')).toBe('Max')
})

test('effortColor maps each level to its theme color', () => {
  expect(effortColor('easy', lightColors)).toBe(lightColors.intensityLow)
  expect(effortColor('moderate', lightColors)).toBe(lightColors.intensityMedium)
  expect(effortColor('hard', lightColors)).toBe(lightColors.intensityHigh)
  expect(effortColor('max', lightColors)).toBe(lightColors.danger)
})

test('effortField exposes the effort enum to the generic controls', () => {
  expect(effortField.name).toBe('Effort')
  expect(effortField.values).toEqual(EFFORTS)
  expect(effortField.label('max')).toBe('Max')
  expect(effortField.color('max', lightColors)).toBe(lightColors.danger)
})
