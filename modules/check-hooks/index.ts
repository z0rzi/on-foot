import { requireNativeModule, type EventSubscription } from 'expo-modules-core'

type CheckHooksModule = {
  hookFolder(): string | null
  reply(id: string, data: string): void
  addListener(
    event: 'onCheckHook',
    listener: (payload: { id: string; hook: string; args: string }) => void,
  ): EventSubscription
}

const CheckHooks = requireNativeModule<CheckHooksModule>('CheckHooks')

// The app's folder on shared storage, which adb reads and writes; null while storage is unmounted.
export function hookFolder(): string | null {
  return CheckHooks.hookFolder()
}

// The receiver is registered while a listener is added and unregistered once none is left. Each
// request is answered once, through `reply`, within the receiver's deadline.
export function addCheckHookListener(
  listener: (request: { hook: string; args: string }, reply: (data: string) => void) => void,
): EventSubscription {
  return CheckHooks.addListener('onCheckHook', ({ id, hook, args }) =>
    listener({ hook, args }, (data) => CheckHooks.reply(id, data)),
  )
}
