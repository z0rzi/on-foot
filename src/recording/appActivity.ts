import { AppState } from 'react-native'

export function isAppActive(): boolean {
  return AppState.currentState === 'active'
}

// Resolves once the app is in the foreground. A system dialog that just closed can leave the native
// side still backgrounded for a moment, and a location start issued then is refused.
export function whenAppActive(): Promise<void> {
  if (isAppActive()) return Promise.resolve()
  return new Promise((resolve) => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      subscription.remove()
      resolve()
    })
  })
}
