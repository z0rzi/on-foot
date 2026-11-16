import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { adb, quote, serial, shell, sleep, TIMEOUT } from './adb'
import { gpxTitle } from './gpx'
import { cleanupReport, deleteReport, importReport } from './hookReply'
import { hookData } from './hookData'
import { HOOK_FOLDER } from './phoneState'
import { runningMove } from './phoneStore'
import { stopReader } from './reader'
import { stopRecorder } from './recorder'
import { requireOnFoot } from './screen'
import { backToMap, type ToMapIo } from './toMap'

// The name a GPX takes in the hook folder while the app imports it: one at a time.
const PUSHED_GPX = 'import.gpx'

// Imports a GPX under the name the app's picker would give it, its title, which the app refuses
// unless it starts with DEVCHECK.
export async function importGpx(file: string, difficulty: string): Promise<string> {
  const path = resolve(file)
  const name = gpxTitle(readFileSync(path, 'utf8'), basename(path).replace(/\.[^.]+$/, ''))
  const remote = `${HOOK_FOLDER}/${PUSHED_GPX}`
  await shell(`mkdir -p ${quote(HOOK_FOLDER)}`)
  await adb(['push', path, remote], TIMEOUT.pull)
  try {
    return importReport(await hookData('import-gpx', { file: PUSHED_GPX, name, difficulty }))
  } finally {
    await shell(`rm -f ${quote(remote)}`)
  }
}

export async function deleteItem(kind: 'trail' | 'activity', id: number): Promise<string> {
  return deleteReport(await hookData('delete', { kind, id }))
}

async function screenInFront(): Promise<string | null> {
  const { screen } = ((await hookData('state')) ?? {}) as Record<string, unknown>
  return typeof screen === 'string' ? screen : null
}

const phone: ToMapIo = {
  screen: screenInFront,
  back: async () => {
    await requireOnFoot()
    await shell('input keyevent KEYCODE_BACK')
  },
  sleep,
  now: Date.now,
}

// Back to the map, every DEVCHECK activity and trail deleted in one hook, then the reader and the
// recorder stopped unless a walk moves. True when nothing was left behind.
export async function cleanup(): Promise<boolean> {
  const id = await serial()
  await backToMap(phone)
  console.log('back on the map')
  const { report, complete } = cleanupReport(await hookData('cleanup'))
  console.log(report)
  const walker = runningMove(id)
  if (walker === null) {
    await stopReader()
    console.log('reader stopped')
    const { kept, failure } = await stopRecorder(id)
    console.log(failure === null ? 'recorder stopped' : `recorder stopped; it had died before: ${failure}`)
    console.log(kept === null ? 'no capture to keep' : `capture: ${kept}`)
  } else {
    console.log(`reader and recorder left running: a walk is moving (pid ${walker})`)
  }
  return complete
}
