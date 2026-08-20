import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator'
import { db } from '../src/data/db/client'
import migrations from '../src/data/db/migrations/migrations'

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations)

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text>Database failed to initialize: {error.message}</Text>
        </View>
      ) : success ? (
        <Stack screenOptions={{ headerShown: false }} />
      ) : null}
    </GestureHandlerRootView>
  )
}
