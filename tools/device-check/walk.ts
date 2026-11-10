import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { quote, serial, shell, sleep } from './adb'
import { buildRoute, type Route } from './geometry'
import { parseGpxPoints } from './gpx'
import { fixIntake } from './screen'
import { fixIntentExtras, nextFixAt, parsePace, planJump, planMove, type Fix, type Place } from './walkPlan'
import { acquireMove, clearWalk, readMemory, releaseMove, runningMove, updateMemory } from './walkStore'

const MOCK_PACKAGE = 'io.appium.settings'
const MOCK_SERVICE = `${MOCK_PACKAGE}/.LocationService`
const DEFAULT_ACCURACY_M = 4
const PROGRESS_EVERY_MS = 60_000

export interface MoveOptions {
  route?: string
  offset?: number
  accuracy?: number
}

async function preflight(): Promise<void> {
  if (!(await shell(`pm path ${MOCK_PACKAGE} || true`)).includes('package:')) {
    throw new Error('Appium Settings is not installed (see SKILL.md, Phone setup)')
  }
  if (!(await shell(`appops get ${MOCK_PACKAGE} android:mock_location`)).includes('allow')) {
    throw new Error('Appium Settings lacks mock_location (see SKILL.md, Phone setup)')
  }
}

async function sendFix(fix: Fix): Promise<void> {
  const out = await shell(`am start-foreground-service --user 0 -n ${MOCK_SERVICE} ${fixIntentExtras(fix).map(quote).join(' ')}`)
  if (/Error/.test(out)) throw new Error(`the mock refused a fix: ${out.trim()}`)
}

function loadRoute(path: string): Route {
  return buildRoute(parseGpxPoints(readFileSync(path, 'utf8')))
}

function parseMark(value: string, route: Route): number {
  if (value === 'end') return route.length
  const mark = Number(value)
  if (!Number.isFinite(mark) || mark < 0) throw new Error(`mark "${value}" is not a distance in metres or "end"`)
  if (mark > route.length) throw new Error(`mark ${mark} m is past the route's end (${Math.round(route.length)} m)`)
  return mark
}

// A seek while recording is not dropped by the fix gate but recovered to after two good fixes, so
// it would draw a straight line into the track under check.
async function refuseJumpWhileTakingFixes(what: string): Promise<void> {
  const intake = await fixIntake()
  if (intake === 'taking-fixes') throw new Error(`${what} refused: On Foot is recording. Pause first, or walk there at --pace fast`)
  if (intake === 'unreadable') throw new Error(`${what} refused: cannot read whether On Foot is recording`)
}

const NEW_ROUTE_JUMP = 'a walk on a new route, which starts with a jump to the route start, is'

interface Target { serial: string; routePath: string; route: Route; to: Place; accuracy: number }

function target(id: string, markArg: string, options: MoveOptions): Target {
  const memory = readMemory(id)
  const routePath = options.route ? resolve(options.route) : memory.walk?.route
  if (!routePath) throw new Error('no route yet: pass --route FILE.gpx')
  const route = loadRoute(routePath)
  return {
    serial: id,
    routePath,
    route,
    to: { mark: parseMark(markArg, route), offset: options.offset ?? 0 },
    accuracy: options.accuracy ?? DEFAULT_ACCURACY_M,
  }
}

async function holdingThePhone(body: (id: string) => Promise<void>): Promise<void> {
  const id = await serial()
  acquireMove(id)
  try {
    await preflight()
    await body(id)
  } finally {
    releaseMove(id)
  }
}

const describePlace = (p: Place) => `${Math.round(p.mark)} m${p.offset !== 0 ? `, ${p.offset} m off the route` : ''}`

export function walkJump(markArg: string, options: MoveOptions): Promise<void> {
  return holdingThePhone(async (id) => {
    const t = target(id, markArg, options)
    await refuseJumpWhileTakingFixes('a jump')
    await sendFix(planJump(t.route, t.to, t.accuracy))
    updateMemory(id, { walk: { route: t.routePath, ...t.to } })
    console.log(`jumped to ${describePlace(t.to)}, standing`)
  })
}

// Sends the move's fixes a second apart. The mark advances only once a fix is sent, so a lost
// phone stops the walk where the phone last stood instead of skipping ahead.
export function walkTo(markArg: string, pace: string | undefined, options: MoveOptions): Promise<void> {
  const speed = parsePace(pace)
  return holdingThePhone(async (id) => {
    const t = target(id, markArg, options)
    const current = readMemory(id).walk
    let from: Place
    if (current && current.route === t.routePath) {
      from = { mark: current.mark, offset: current.offset }
    } else {
      await refuseJumpWhileTakingFixes(NEW_ROUTE_JUMP)
      from = { mark: 0, offset: 0 }
      await sendFix(planJump(t.route, from, t.accuracy))
      updateMemory(id, { walk: { route: t.routePath, ...from } })
      console.log(`new route ${t.routePath} (${Math.round(t.route.length)} m): jumped to its start`)
    }
    const fixes = planMove(t.route, from, t.to, speed, t.accuracy)
    let stopping = false
    const stop = () => { stopping = true }
    process.once('SIGTERM', stop)
    process.once('SIGINT', stop)
    const started = Date.now()
    let lastProgress = started
    let last: Fix | null = null
    let due = started
    for (let k = 0; k < fixes.length && !stopping; k++) {
      if (due > Date.now()) await sleep(due - Date.now())
      const sendStarted = Date.now()
      await sendFix(fixes[k])
      due = nextFixAt(sendStarted, Date.now())
      last = fixes[k]
      updateMemory(id, { walk: { route: t.routePath, mark: last.mark, offset: last.offset } })
      if (Date.now() - lastProgress >= PROGRESS_EVERY_MS) {
        lastProgress = Date.now()
        console.log(`at ${describePlace(last)}, ${Math.round((lastProgress - started) / 1000)} s in`)
      }
    }
    process.off('SIGTERM', stop)
    process.off('SIGINT', stop)
    if (stopping) {
      if (last && last.speed !== null) await sendFix({ ...last, speed: null, bearing: null })
      console.log(`stopped at ${last ? describePlace(last) : describePlace(from)}, standing`)
      process.exitCode = 130
      return
    }
    console.log(`reached ${describePlace(t.to)} in ${Math.round((Date.now() - started) / 1000)} s (${fixes.length} fixes at ${speed} m/s), standing`)
  })
}

async function mockRunning(): Promise<boolean> {
  return (await shell(`dumpsys activity services ${MOCK_PACKAGE}`)).includes('LocationService')
}

export async function walkStatus(): Promise<void> {
  const id = await serial()
  const { walk } = readMemory(id)
  const pid = runningMove(id)
  console.log(walk ? `route: ${walk.route}\nat: ${describePlace(walk)}` : 'route: none')
  console.log(`moving: ${pid !== null ? `yes (pid ${pid})` : 'no'}`)
  console.log(`mock: ${(await mockRunning()) ? 'on, the phone stands on the last fix sent' : 'off, the phone is on real GPS'}`)
}

// A move still running may be another agent's: stopping it takes --force.
export async function walkStop(force: boolean): Promise<void> {
  const id = await serial()
  const pid = runningMove(id)
  if (pid !== null && !force) throw new Error(`a walk is moving (pid ${pid}), maybe another agent's: \`walk stop --force\` stops it`)
  if (pid !== null) {
    process.kill(pid, 'SIGTERM')
    for (let i = 0; i < 50 && runningMove(id) === pid; i++) await sleep(100)
    if (runningMove(id) === pid) process.kill(pid, 'SIGKILL')
  }
  // `am stopservice` exits 255 whether it stopped the service or found it not running.
  const out = await shell(`am stopservice ${MOCK_SERVICE} 2>&1; true`)
  if (!/Service stopped|was not running/.test(out)) throw new Error(`could not stop the mock: ${out.trim()}`)
  clearWalk(id)
  console.log('mock stopped: the phone is back on real GPS')
}
