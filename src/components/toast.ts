import { Platform, ToastAndroid } from 'react-native'

// Brief non-blocking confirmation. Android-only today (the app's target); a no-op elsewhere until
// a cross-platform surface is added.
export function showToast(message: string): void {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT)
}
