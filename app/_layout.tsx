import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useDatabaseMigrations } from '../src/data/db/useDatabaseMigrations'
import { useIncomingShare } from '../src/trails/useIncomingShare'

function ShareIntentHandler() {
  useIncomingShare()
  return null
}

export default function RootLayout() {
  const { success, error } = useDatabaseMigrations()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text>Database failed to initialize: {error.message}</Text>
        </View>
      ) : success ? (
        <>
          <Stack screenOptions={{ headerShown: false }} />
          <ShareIntentHandler />
        </>
      ) : null}
    </GestureHandlerRootView>
  )
}
