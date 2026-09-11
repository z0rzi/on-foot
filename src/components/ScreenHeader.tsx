import { Pressable } from 'react-native'
import { Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/useTheme'

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const c = useTheme()
  return (
    <Stack.Screen
      options={{
        headerShown: true,
        title,
        headerLeft: () => (
          <Pressable accessibilityLabel="Back" onPress={onBack} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={c.onSurface} />
          </Pressable>
        ),
      }}
    />
  )
}
