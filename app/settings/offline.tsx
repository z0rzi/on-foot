import { Pressable, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../src/theme/useTheme'
import { OfflineMapsList } from '../../src/map/offline/OfflineMapsList'

export default function OfflineMapsScreen() {
  const c = useTheme()
  const router = useRouter()
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Offline maps',
          headerLeft: () => (
            <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color={c.onSurface} />
            </Pressable>
          ),
        }}
      />
      <OfflineMapsList />
    </View>
  )
}
