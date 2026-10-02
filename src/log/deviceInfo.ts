import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { LogDeviceInfo } from './logExportText'

// The model and the OS release come from React Native's own platform constants, typed per platform —
// no device library, and nothing to install. Android is the app's target; elsewhere the header still
// reads honestly rather than claiming a model it does not know.
export function deviceInfo(): LogDeviceInfo {
  return {
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    model: Platform.OS === 'android' ? Platform.constants.Model : 'unknown',
    androidVersion: Platform.OS === 'android' ? Platform.constants.Release : 'unknown',
  }
}
