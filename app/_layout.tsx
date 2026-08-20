import * as Linking from 'expo-linking'
import { router, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useDatabaseMigrations } from '../src/data/db/useDatabaseMigrations'

function useGpxOpenHandler(ready: boolean) {
  useEffect(() => {
    if (!ready) return
    const handle = (url: string | null) => {
      // Guards against stray deep links (e.g. the app's own `onfootrn://` scheme)
      // reaching the add-trail form; only a GPX-suffixed URL routes there.
      if (url && /\.gpx($|\?)/i.test(url)) {
        const name = decodeURIComponent(url.split('/').pop() ?? '').replace(/\.[^.]+$/, '')
        router.push({ pathname: '/trail/new', params: { uri: url, name } })
      }
    }
    Linking.getInitialURL().then(handle)
    const sub = Linking.addEventListener('url', (e) => handle(e.url))
    return () => sub.remove()
  }, [ready])
}

export default function RootLayout() {
  const { success, error } = useDatabaseMigrations()

  useGpxOpenHandler(success)

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
