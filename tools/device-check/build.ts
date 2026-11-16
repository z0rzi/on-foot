import { spawn } from 'node:child_process'
import { createFingerprintAsync } from 'expo/fingerprint'
import { describeIdentity, identityEnv, type BuildIdentity } from './buildIdentity'
import { REPO_ROOT, workingTree } from './workingTree'

// Every build an agent makes answers check hooks; the bundler inlines the flag.
const HOOKS_FLAG = { EXPO_PUBLIC_DEBUG_CHECK_HOOKS: '1' }

// The release build of the checkout, naming itself: its identity is computed here, outside the
// app's config, whose fingerprint would otherwise change with it, and reaches the config through
// the environment. `expo run:android` installs and opens the app.
export async function build(): Promise<number> {
  const tree = workingTree()
  const { hash } = await createFingerprintAsync(REPO_ROOT, { platforms: ['android'] })
  const identity: BuildIdentity = { ...tree, fingerprint: hash }
  console.log(`building ${describeIdentity(identity)}`)
  const child = spawn('npx', ['expo', 'run:android', '--variant', 'release', '--no-bundler'], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...identityEnv(identity), ...HOOKS_FLAG },
    stdio: 'inherit',
  })
  return new Promise((resolve, reject) => {
    child.on('error', (error) => reject(new Error(`expo run:android could not run: ${error.message}`)))
    child.on('exit', (code, signal) => resolve(code ?? (signal === null ? 1 : 128)))
  })
}
