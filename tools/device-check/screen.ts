import { adb, shell, TIMEOUT } from './adb'
import { APP_PACKAGE, classifyForeground, classifyServices, parseDisplaySize, type DisplaySize, type FixIntake, type Foreground } from './phoneState'
import { recordButtonIn, type ScreenRead } from './tapTarget'
import { parseUiDump } from './uiDump'
import { runningMove, updateMemory } from './walkStore'

const REMOTE_DUMP = '/sdcard/devcheck-ui.xml'

async function foreground(): Promise<Foreground> {
  return classifyForeground(await shell('dumpsys activity activities | grep topResumedActivity || true'))
}

// Keeps the owner's other apps out of the evidence and out of reach of taps.
export async function requireForeground(): Promise<Extract<Foreground, { activity: string }>> {
  const front = await foreground()
  if (front.kind === 'other') throw new Error(`another app is in front (${front.activity}): bring On Foot back first`)
  if (front.kind === 'unreadable') throw new Error('cannot tell which app is in front (screen off or locked?)')
  return front
}

export async function requireOnFoot(): Promise<void> {
  const front = await requireForeground()
  if (front.kind !== 'on-foot') throw new Error(`On Foot must be in front, not ${front.activity}`)
}

export async function fixIntake(): Promise<FixIntake> {
  return classifyServices(await shell(`dumpsys activity services ${APP_PACKAGE}`))
}

export async function refuseWhileRecording(what: string): Promise<void> {
  if ((await fixIntake()) !== 'not-taking-fixes') throw new Error(`${what} refused: On Foot is recording, or its state cannot be read`)
}

// A screen of the app by its route, through the app's own `onfootrn://` scheme.
export async function openInApp(route: string): Promise<void> {
  await shell(`am start -a android.intent.action.VIEW -d onfootrn://${route} ${APP_PACKAGE}`)
}

export async function displaySize(): Promise<DisplaySize> {
  return parseDisplaySize(await shell('wm size'))
}

export function refuseWhileMoving(serial: string, what: string): void {
  const pid = runningMove(serial)
  if (pid !== null) throw new Error(`${what} refused: a walk is moving (pid ${pid}); wait for it to end`)
}

// One dump attempt. While On Foot records, its clock ticks every second and the screen never
// idles, so no attempt is made. A failed dump leaves nothing behind to be mistaken for this screen.
export async function readScreen(serial: string, front: Foreground): Promise<ScreenRead> {
  if (front.kind === 'on-foot' && (await fixIntake()) === 'taking-fixes') return { kind: 'recording' }
  await shell(`rm -f ${REMOTE_DUMP}`)
  const out = await shell(`uiautomator dump ${REMOTE_DUMP}`, TIMEOUT.dump)
  if (!out.includes('dumped to')) return { kind: 'failed', reason: out.trim().replace(/^ERROR: /, '') || 'uiautomator printed nothing' }
  const xml = await adb(['exec-out', 'cat', REMOTE_DUMP])
  const nodes = parseUiDump(xml)
  if (front.kind === 'on-foot') {
    const recordButton = recordButtonIn(nodes)
    if (recordButton) updateMemory(serial, { recordButton })
  }
  return { kind: 'dump', nodes, xml }
}

export function describeNoDump(screen: ScreenRead): string {
  if (screen.kind === 'recording') return 'no dump: On Foot is recording, its clock never lets the screen idle'
  if (screen.kind === 'failed') return `no dump: ${screen.reason}`
  return ''
}
