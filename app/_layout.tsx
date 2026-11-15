import { useEffect } from 'react'
import { Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { Text, useColorScheme, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { MapProviderProvider, useOfflineController } from '../src/map/provider'
import { MapLaunchGate } from '../src/map/MapLaunchGate'
import { useMapStore } from '../src/store/mapStore'
import { mapboxProvider } from '../src/map/providers/mapbox'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { AppHeader } from '../src/components/AppHeader'
import { useOfflineStore } from '../src/map/offline/offlineStore'
import { useDownloadSettledToast } from '../src/map/offline/useDownloadSettledToast'
import { useDatabaseMigrations } from '../src/data/db/useDatabaseMigrations'
import { useStoresAtLaunch } from '../src/store/loadStoresAtLaunch'
import { useOverviewBackfill } from '../src/store/overviewBackfill'
import { useResumeRecording } from '../src/recording/useResumeRecording'
import { useRecordingStream } from '../src/recording/useRecordingStream'
import { useAlongTrailLog } from '../src/recording/useAlongTrailLog'
import { useIncomingShare } from '../src/trails/useIncomingShare'
import { getNavigationTheme } from '../src/theme/navigationTheme'
import { errorClass, logEvent, useLogRetention } from '../src/log'

// Held until the map can mount on its launch camera, so a restored camera never shows the globe first.
// Not awaited: if holding fails, the splash hides on its own and the cost is that globe frame.
void SplashScreen.preventAutoHideAsync()

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

function AlongTrailLogHandler() {
  useAlongTrailLog()
  return null
}

function OfflineInitHandler() {
  const controller = useOfflineController()
  const reload = useOfflineStore((s) => s.reload)
  useEffect(() => {
    reload(controller).catch((error) =>
      logEvent('warn', 'map', 'loading offline packs at launch failed', { errorClass: errorClass(error) }),
    )
  }, [reload, controller])
  return null
}

function DownloadSettledToastHandler() {
  useDownloadSettledToast()
  return null
}

function StoresAtLaunchHandler() {
  useStoresAtLaunch()
  return null
}

function OverviewBackfillHandler() {
  useOverviewBackfill()
  return null
}

function LogRetentionHandler() {
  useLogRetention()
  return null
}

export default function RootLayout() {
  const { success, error } = useDatabaseMigrations()
  const scheme = useColorScheme()
  const launchResolved = useMapStore((s) => s.launchResolved)

  useEffect(() => {
    if (error || launchResolved) SplashScreen.hide()
  }, [error, launchResolved])

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
              <StoresAtLaunchHandler />
              <MapProviderProvider provider={mapboxProvider}>
                <MapLaunchGate>
                  <BottomSheetModalProvider>
                    <Stack screenOptions={{ header: (props) => <AppHeader {...props} /> }}>
                      <Stack.Screen name="index" options={{ headerShown: false }} />
                      <Stack.Screen name="trails" options={{ title: 'Trails' }} />
                      <Stack.Screen name="activities" options={{ title: 'Activities' }} />
                      <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
                      <Stack.Screen name="settings/offline" options={{ title: 'Offline maps' }} />
                      <Stack.Screen name="settings/log" options={{ title: 'Debug log' }} />
                      <Stack.Screen name="trail/new" options={{ title: 'New trail' }} />
                      <Stack.Screen name="trail/[id]/edit" options={{ title: 'Edit trail' }} />
                      <Stack.Screen
                        name="activity/save"
                        // The end of the recording, so it carries no banner back to it.
                        options={{ title: 'Save activity', header: (props) => <AppHeader {...props} recordingBanner={false} /> }}
                      />
                    </Stack>
                    <ShareIntentHandler />
                    <ResumeRecordingHandler />
                    <RecordingStreamHandler />
                    <AlongTrailLogHandler />
                    <OfflineInitHandler />
                    <DownloadSettledToastHandler />
                    <OverviewBackfillHandler />
                    <LogRetentionHandler />
                  </BottomSheetModalProvider>
                </MapLaunchGate>
              </MapProviderProvider>
            </KeyboardProvider>
          ) : null}
        </ErrorBoundary>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
