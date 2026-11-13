import { shell, TIMEOUT } from './adb'
import { nativeErrors, type NativeErrorKind } from './logcatErrors'
import { APP_PACKAGE } from './phoneState'

const HEADINGS: Record<NativeErrorKind, string> = {
  mapbox: 'Mapbox style, layer and source errors',
  js: 'ReactNativeJS errors',
  fatal: 'AndroidRuntime FATAL',
}

// What logcat holds of On Foot's current process: a pid is one launch, so nothing from an earlier
// launch shows. Logcat filtered to that pid holds no other app's lines.
export async function reportNativeErrors(): Promise<boolean> {
  const pids = (await shell(`pidof ${APP_PACKAGE} || true`)).trim().split(/\s+/).filter(Boolean)
  if (pids.length !== 1) throw new Error(pids.length === 0 ? 'On Foot is not running: launch it first' : `On Foot runs as several processes (${pids.join(', ')})`)
  const [pid] = pids
  const started = (await shell(`ps -o STIME= -p ${pid} || true`)).trim()
  const found = nativeErrors(await shell(`logcat -d -v threadtime -b main -b system -b crash --pid=${pid}`, TIMEOUT.dump))
  console.log(`On Foot pid ${pid}${started ? `, started ${started}` : ''}: ${found.length === 0 ? 'no native errors' : `${found.length} native error lines`}`)
  for (const kind of Object.keys(HEADINGS) as NativeErrorKind[]) {
    const lines = found.filter((e) => e.kind === kind)
    if (lines.length === 0) continue
    console.log(`\n${HEADINGS[kind]}:`)
    for (const { line } of lines) console.log(`  ${line}`)
  }
  return found.length > 0
}
