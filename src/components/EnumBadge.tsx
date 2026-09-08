import { Text } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { EnumField } from './enumField'

export function EnumBadge<T extends string>({ field, value }: { field: EnumField<T>; value: T }) {
  const c = useTheme()
  return (
    <Text style={{ color: field.color(value, c), fontSize: 12, fontWeight: '600' }}>
      {field.label(value)}
    </Text>
  )
}
