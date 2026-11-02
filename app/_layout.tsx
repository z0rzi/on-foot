import { useEffect } from 'react'
import { Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Text, useColorScheme, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { MapProviderProvider, useOfflineController } from '../src/map/provider'
import { mapboxProvider } from '../src/map/providers/mapbox'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { useOfflineStore } from '../src/map/offline/offlineStore'
import { useDatabaseMigrations } from '../src/data/db/useDatabaseMigrations'
import '../src/recording/locationTask'
import { useResumeRecording } from '../src/recording/useResumeRecording'
import { useRecordingStream } from '../src/recording/useRecordingStream'
import { useIncomingShare } from '../src/trails/useIncomingShare'
import { getNavigationTheme } from '../src/theme/navigationTheme'
import { installGlobalErrorHandler, logEvent, useLogRetention } from '../src/log'

installGlobalErrorHandler()

function ShareIntentHandler() {
  useIncomingShare()
  return null
}

function ResumeRecordingHandler() {
  useResumeRecording()
  return null
}

function RecordingStreamHandler() {
  useRecordingStream()
  return null
}

function OfflineInitHandler() {
  const controller = useOfflineController()
  const reload = useOfflineStore((s) => s.reload)
  useEffect(() => {
    reload(controller).catch((error) =>
      logEvent('warn', 'map', 'loading offline packs at launch failed', { error: String(error) }),
    )
  }, [reload, controller])
  return null
}

function LogRetentionHandler() {
  useLogRetention()
  return null
}

export default function RootLayout() {
  const { success, error } = useDatabaseMigrations()
  const scheme = useColorScheme()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={getNavigationTheme(scheme)}>
        <StatusBar style="auto" />
        <ErrorBoundary>
          {error ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Text>Database failed to initialize: {error.message}</Text>
            </View>
          ) : success ? (
            <KeyboardProvider>
              <MapProviderProvider provider={mapboxProvider}>
                <BottomSheetModalProvider>
                  <Stack screenOptions={{ headerShown: false }} />
                  <ShareIntentHandler />
                  <ResumeRecordingHandler />
                  <RecordingStreamHandler />
                  <OfflineInitHandler />
                  <LogRetentionHandler />
                </BottomSheetModalProvider>
              </MapProviderProvider>
            </KeyboardProvider>
          ) : null}
        </ErrorBoundary>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
