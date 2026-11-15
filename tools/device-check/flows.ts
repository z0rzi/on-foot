import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { adb, quote, serial, shell, TIMEOUT } from './adb'
import { devcheckName, isDevcheckName } from './devcheckData'
import { buildRoute } from './geometry'
import { gpxTitle, parseGpxPoints } from './gpx'
import { hideKeyboard, typeText } from './keys'
import { tap, waitFor } from './look'
import { fixIntake, openInApp, refuseWhileMoving, refuseWhileRecording, requireOnFoot } from './screen'
import { withoutLabels } from './tapOutcome'

// Labels come from the app (`grep -rn accessibilityLabel src`); a renamed one surfaces as a tap
// listing the labels it saw.
const HOLD_TO_PAUSE_MS = 1500

export async function importGpx(file: string, difficulty: string): Promise<string> {
  const path = resolve(file)
  const xml = readFileSync(path, 'utf8')
  buildRoute(parseGpxPoints(xml))
  const fileName = basename(path)
  const title = gpxTitle(xml, fileName.replace(/\.[^.]+$/, ''))
  if (!isDevcheckName(title)) throw new Error(`the trail would be named "${title}": only DEVCHECK items may be created`)
  refuseWhileMoving(await serial(), 'import-gpx')
  await requireOnFoot()
  await refuseWhileRecording('import-gpx')
  const remote = `/sdcard/Download/${fileName}`
  await adb(['push', path, remote], TIMEOUT.pull)
  const steps: string[] = []
  try {
    await openInApp('/trails')
    steps.push(await waitFor('Add a GPX file', false, 10))
    steps.push(withoutLabels(await tap('Add a GPX file', { until: { label: fileName, gone: false }, timeoutS: 15 })))
    steps.push(await tap(fileName, { until: { label: 'Save trail', gone: false }, timeoutS: 15 }))
    steps.push(await tap(`Difficulty ${difficulty}`))
    steps.push(await tap('Save trail', { until: { label: 'Save trail', gone: true }, timeoutS: 15 }))
  } finally {
    await shell(`rm -f ${quote(remote)}`)
  }
  return [...steps, `imported "${title}"`].join('\n')
}

export async function saveActivity(name: string, effort: string): Promise<string> {
  const title = devcheckName(name)
  refuseWhileMoving(await serial(), 'save-activity')
  await requireOnFoot()
  const steps: string[] = []
  const stopAndSave = { label: 'Stop and save recording', gone: false }
  if ((await fixIntake()) === 'taking-fixes') {
    steps.push(await tap('Pause recording (press and hold)', { holdMs: HOLD_TO_PAUSE_MS, until: stopAndSave }))
  } else {
    steps.push(await waitFor(stopAndSave.label, false, 10))
  }
  steps.push(await tap(stopAndSave.label, { until: { label: 'Activity name', gone: false }, timeoutS: 15 }))
  steps.push(await tap('Activity name'))
  steps.push(await typeText(title))
  await hideKeyboard()
  steps.push(await tap(`Effort ${effort}`))
  steps.push(await tap('Save activity', { until: { label: 'Save activity', gone: true }, timeoutS: 15 }))
  return [...steps, `saved "${title}"`].join('\n')
}
