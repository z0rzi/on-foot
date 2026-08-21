import { requireNativeModule, type EventSubscription } from 'expo-modules-core'

type ShareIntentModule = {
  getInitialShareIntentUri(): string | null
  addListener(
    event: 'onShareIntent',
    listener: (payload: { uri: string }) => void,
  ): EventSubscription
}

const ShareIntent = requireNativeModule<ShareIntentModule>('ShareIntent')

export function getInitialShareIntentUri(): string | null {
  return ShareIntent.getInitialShareIntentUri()
}

export function addShareIntentListener(
  listener: (uri: string) => void,
): EventSubscription {
  return ShareIntent.addListener('onShareIntent', (payload) => listener(payload.uri))
}
