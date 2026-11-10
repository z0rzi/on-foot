import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { adb, quote, serial, shell, TIMEOUT } from './adb'
import { buildRoute } from './geometry'
import { gpxTitle, parseGpxPoints } from './gpx'
import { tap, waitFor } from './look'
import { APP_PACKAGE } from './phoneState'
import { devcheckName } from './routeSpec'
import { fixIntake, refuseWhileMoving, requireForeground } from './screen'

// Labels come from the app (`grep -rn accessibilityLabel src`); a renamed one surfaces as a tap
// listing the labels it saw.
const HOLD_TO_PAUSE_MS = 1500

async function requireOnFoot(): Promise<void> {
  const front = await requireForeground()
  if (front.kind !== 'on-foot') throw new Error(`On Foot must be in front, not ${front.activity}`)
}

export async function importGpx(file: string, difficulty: string): Promise<void> {
  const path = resolve(file)
  const xml = readFileSync(path, 'utf8')
  buildRoute(parseGpxPoints(xml))
  const fileName = basename(path)
  const title = gpxTitle(xml, fileName.replace(/\.[^.]+$/, ''))
  if (!title.startsWith('DEVCHECK')) throw new Error(`the trail would be named "${title}": only DEVCHECK items may be created`)
  refuseWhileMoving(await serial(), 'import-gpx')
  await requireOnFoot()
  if ((await fixIntake()) !== 'not-taking-fixes') throw new Error('import-gpx refused: On Foot is recording, or its state cannot be read')
  const remote = `/sdcard/Download/${fileName}`
  await adb(['push', path, remote], TIMEOUT.pull)
  try {
    await shell(`am start -a android.intent.action.VIEW -d onfootrn:///trails ${APP_PACKAGE}`)
    await waitFor('Add a GPX file', false, 10)
    await tap('Add a GPX file')
    await waitFor(fileName, false, 15)
    await tap(fileName)
    await waitFor('Save trail', false, 15)
    await tap(`Difficulty ${difficulty}`)
    await tap('Save trail')
    await waitFor('Save trail', true, 15)
  } finally {
    await shell(`rm -f ${quote(remote)}`)
  }
  console.log(`imported "${title}"`)
}

export async function saveActivity(name: string, effort: string): Promise<void> {
  const title = devcheckName(name)
  refuseWhileMoving(await serial(), 'save-activity')
  await requireOnFoot()
  if ((await fixIntake()) === 'taking-fixes') {
    await tap('Pause recording (press and hold)', HOLD_TO_PAUSE_MS)
  }
  await waitFor('Stop and save recording', false, 10)
  await tap('Stop and save recording')
  await waitFor('Activity name', false, 15)
  await tap('Activity name')
  await shell(`input text ${quote(title.replace(/ /g, '%s'))}`)
  await shell('input keyevent KEYCODE_ESCAPE')
  await tap(`Effort ${effort}`)
  await tap('Save activity')
  await waitFor('Save activity', true, 15)
  console.log(`saved "${title}"`)
}
