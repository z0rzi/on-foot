import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { adbBuffer, serial, shell, sleep, TIMEOUT } from './adb'
import { evidenceDir, nextShotBase, slug } from './evidence'
import { ffmpeg } from './ffmpeg'
import { describeNoDump, fixIntake, readScreen, refuseWhileMoving, requireForeground } from './screen'
import { tapTarget } from './tapTarget'
import { centre, cropFilter, findByLabel, parseUiDump, summaryLine, type Bounds, type UiNode } from './uiDump'
import { readMemory, runningMove } from './walkStore'

export async function shot(name: string): Promise<void> {
  const id = await serial()
  const front = await requireForeground()
  const dir = evidenceDir()
  const base = nextShotBase(dir, name)
  const png = join(dir, `${base}.png`)
  writeFileSync(png, await adbBuffer(['exec-out', 'screencap', '-p'], TIMEOUT.screencap))
  const half = join(dir, `${base}.half.png`)
  const halfFailure = ffmpeg(['-i', png, '-vf', 'scale=iw/2:-1', half])
  console.log(halfFailure ? `read: ${png} (no half copy: ${halfFailure})` : `read: ${half}\nfull: ${png}`)
  if (runningMove(id) !== null) {
    console.log('no dump: a walk is moving')
    return
  }
  const screen = await readScreen(id, front)
  if (screen.kind !== 'dump') {
    console.log(describeNoDump(screen))
    return
  }
  writeFileSync(join(dir, `${base}.xml`), screen.xml)
  console.log(`labels: ${summaryLine(screen.nodes)}`)
}

function findShot(ref: string): string {
  if (existsSync(ref)) return ref.replace(/(\.half)?\.(png|xml)$/, '')
  const dir = evidenceDir()
  const matches = readdirSync(dir).filter((f) => f.startsWith(ref) && /^\d{2,}-[A-Za-z0-9-]+\.png$/.test(f))
  if (matches.length !== 1) throw new Error(`shot "${ref}" matches ${matches.length} screenshots in ${dir}`)
  return join(dir, matches[0].replace(/\.png$/, ''))
}

export function crop(ref: string, label: string): void {
  const base = findShot(ref)
  if (!existsSync(`${base}.xml`)) throw new Error(`${basename(base)} has no dump to find "${label}" in`)
  const match = findByLabel(parseUiDump(readFileSync(`${base}.xml`, 'utf8')), label)
  if (!match.node) throw new Error(`no "${label}" in ${basename(base)}; labels seen: ${match.seen.join(' | ')}`)
  const out = `${base}.crop-${slug(label)}.png`
  const failure = ffmpeg(['-i', `${base}.png`, '-vf', cropFilter(match.node.bounds), out])
  if (failure) throw new Error(`crop failed: ${failure}`)
  console.log(`read: ${out}`)
}

// Taps the middle of bounds just read from a dump.
export async function tapAt(bounds: Bounds, holdMs?: number): Promise<{ x: number; y: number }> {
  const { x, y } = centre(bounds)
  await shell(holdMs !== undefined ? `input swipe ${x} ${y} ${x} ${y} ${holdMs}` : `input tap ${x} ${y}`)
  return { x, y }
}

export async function tap(label: string, holdMs?: number): Promise<void> {
  const id = await serial()
  refuseWhileMoving(id, 'tap')
  const screen = await readScreen(id, await requireForeground())
  const target = tapTarget(label, screen, readMemory(id).recordButton)
  if (target.kind === 'missing') throw new Error(target.reason)
  const { x, y } = await tapAt(target.bounds, holdMs)
  const how = holdMs !== undefined ? `held ${holdMs} ms` : 'tapped'
  console.log(`${how} "${label}" at ${x},${y}${target.remembered ? ' (record button bounds remembered from an earlier dump)' : ''}`)
  if (target.remembered) await confirmPaused()
}

const POLL_MS = 500
const PAUSE_CONFIRM_MS = 3000

// Remembered bounds are blind: the button moves with the map card. The one control they reach is
// the pause, so the recording state says whether the hold landed.
async function confirmPaused(): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < PAUSE_CONFIRM_MS) {
    if ((await fixIntake()) === 'not-taking-fixes') return
    await sleep(POLL_MS)
  }
  throw new Error('still recording: the remembered record button missed (is the map card open? collapse it with `input keyevent 4`)')
}

export type Polled<T> = { found: T; waitedS: number } | { found: null; last: string }

// Reads the screen until `judge` finds what it looks for, at least once and up to the timeout.
export async function pollScreen<T>(what: string, timeoutS: number, judge: (nodes: UiNode[]) => T | null): Promise<Polled<T>> {
  const id = await serial()
  refuseWhileMoving(id, what)
  const started = Date.now()
  let last = ''
  do {
    const screen = await readScreen(id, await requireForeground())
    if (screen.kind === 'recording') throw new Error(`${what} cannot read the screen: ${describeNoDump(screen)}`)
    if (screen.kind === 'dump') {
      const found = judge(screen.nodes)
      if (found !== null) return { found, waitedS: (Date.now() - started) / 1000 }
      last = `labels seen: ${summaryLine(screen.nodes)}`
    } else {
      last = describeNoDump(screen)
    }
    await sleep(POLL_MS)
  } while (Date.now() - started < timeoutS * 1000)
  return { found: null, last }
}

export async function waitFor(label: string, gone: boolean, timeoutS: number): Promise<void> {
  const polled = await pollScreen('wait-for', timeoutS, (nodes) => ((findByLabel(nodes, label).node !== null) !== gone ? true : null))
  if (polled.found === null) throw new Error(`"${label}" ${gone ? 'still there' : 'not there'} after ${timeoutS} s; ${polled.last}`)
  console.log(`"${label}" ${gone ? 'gone' : 'appeared'} after ${polled.waitedS.toFixed(1)} s`)
}
