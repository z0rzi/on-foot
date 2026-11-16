import Constants from 'expo-constants'
import { deviceInfo } from './deviceInfo'
import { runtimeAgeMs } from './runtimeAge'

// The identity the toolkit's build command put in the config's `extra` (null for a build made
// without it), carried as it came for the toolkit to read back (tools/device-check/buildIdentity.ts).
export function installedBuild(): unknown {
  const build: unknown = Constants.expoConfig?.extra?.build
  return build ?? null
}

// What the `launch cold start` line says: the installed build's version and identity, and the age of
// the runtime it opened onto.
export function coldStartDetail(): { appVersion: string; build: unknown; runtimeAgeMs: number } {
  return { appVersion: deviceInfo().appVersion, build: installedBuild(), runtimeAgeMs: runtimeAgeMs() }
}
