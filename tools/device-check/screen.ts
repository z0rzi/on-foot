import { shell } from './adb'
import { APP_PACKAGE, classifyForeground, classifyServices, parseDisplaySize, type DisplaySize, type FixIntake, type Foreground } from './phoneState'
import { readTree } from './reader'
import { parseUiDump, type UiNode } from './uiDump'
import { runningMove } from './phoneStore'

async function foreground(): Promise<Foreground> {
  return classifyForeground(await shell('dumpsys activity activities | grep topResumedActivity || true'))
}

export const UNREADABLE_FRONT = 'cannot tell which app is in front (screen off or locked?)'

// Keeps the owner's other apps out of the evidence and out of reach of taps. Null while no activity
// is resumed, which a switch between two activities also shows for a moment.
export async function allowedForeground(): Promise<Extract<Foreground, { activity: string }> | null> {
  const front = await foreground()
  if (front.kind === 'other') throw new Error(`another app is in front (${front.activity}): bring On Foot back first`)
  return front.kind === 'unreadable' ? null : front
}

export async function requireForeground(): Promise<Extract<Foreground, { activity: string }>> {
  const front = await allowedForeground()
  if (front === null) throw new Error(UNREADABLE_FRONT)
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

export interface ScreenRead { nodes: UiNode[]; xml: string }

// One read of the screen through the reader; a reader that fails throws with its reason.
export async function readScreen(serial: string): Promise<ScreenRead> {
  const xml = await readTree(serial)
  return { nodes: parseUiDump(xml), xml }
}
