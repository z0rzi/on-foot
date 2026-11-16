import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { adbBuffer, serial, shell, sleep, TIMEOUT } from './adb'
import { evidenceDir, nextShotBase, slug } from './evidence'
import { ffmpeg } from './ffmpeg'
import { allowedForeground, readScreen, requireForeground, UNREADABLE_FRONT, type ScreenRead } from './screen'
import { ReaderAnsweredError } from './reader'
import { scrollSwipe, type ScrollDirection } from './scrollPlan'
import { notReached, outcomeAtCap, outcomeReport, reached, tapOutcome, type Expected, type TapOutcome } from './tapOutcome'
import { tapTarget, targetAtCap } from './tapTarget'
import { centre, cropFilter, findByLabel, labelsLine, parseUiDump, summaryLine, type Bounds, type UiNode } from './uiDump'

export async function shot(name: string): Promise<string> {
  const id = await serial()
  await requireForeground()
  const dir = evidenceDir()
  const base = nextShotBase(dir, name)
  const png = join(dir, `${base}.png`)
  writeFileSync(png, await adbBuffer(['exec-out', 'screencap', '-p'], TIMEOUT.screencap))
  const half = join(dir, `${base}.half.png`)
  const halfFailure = ffmpeg(['-i', png, '-vf', 'scale=iw/2:-1', half])
  const files = halfFailure ? `read: ${png} (no half copy: ${halfFailure})` : `read: ${half}\nfull: ${png}`
  const screen = await readScreen(id)
  writeFileSync(join(dir, `${base}.xml`), screen.xml)
  return `${files}
${labelsLine(screen.nodes)}`
}

export async function labels(): Promise<string> {
  const id = await serial()
  await requireForeground()
  const started = Date.now()
  const screen = await readScreen(id)
  const tookS = (Date.now() - started) / 1000
  return `${labelsLine(screen.nodes)}
read in ${tookS.toFixed(2)} s`
}

function findShot(ref: string): string {
  if (existsSync(ref)) return ref.replace(/(\.half)?\.(png|xml)$/, '')
  const dir = evidenceDir()
  const matches = readdirSync(dir).filter((f) => f.startsWith(ref) && /^\d{2,}-[A-Za-z0-9-]+\.png$/.test(f))
  if (matches.length !== 1) throw new Error(`shot "${ref}" matches ${matches.length} screenshots in ${dir}`)
  return join(dir, matches[0].replace(/\.png$/, ''))
}

export function crop(ref: string, label: string): string {
  const base = findShot(ref)
  if (!existsSync(`${base}.xml`)) throw new Error(`${basename(base)} has no dump to find "${label}" in`)
  const match = findByLabel(parseUiDump(readFileSync(`${base}.xml`, 'utf8')), label)
  if (!match.node) throw new Error(`no "${label}" in ${basename(base)}; labels seen: ${match.seen.join(' | ')}`)
  const out = `${base}.crop-${slug(label)}.png`
  const failure = ffmpeg(['-i', `${base}.png`, '-vf', cropFilter(match.node.bounds), out])
  if (failure) throw new Error(`crop failed: ${failure}`)
  return `read: ${out}`
}

// Taps the middle of bounds just read from a dump.
async function tapAt(bounds: Bounds, holdMs?: number): Promise<{ x: number; y: number }> {
  const { x, y } = centre(bounds)
  await shell(holdMs !== undefined ? `input swipe ${x} ${y} ${x} ${y} ${holdMs}` : `input tap ${x} ${y}`)
  return { x, y }
}

// Set on the device, where a read takes 0.2 to 0.4 s (longer while a screen hands over) and a tap
// shows its first effect 0.1 to 0.2 s after `input tap` returns: the time between two reads, the
// time from a tap to the first read of its outcome (an earlier read sees the screen the tap left),
// the caps on a target standing still and on a screen settling, and how long a tap waits for a
// named outcome unless told.
const READ_INTERVAL_MS = 100
const REACTION_MS = 250
const TARGET_CAP_S = 3
const SETTLE_CAP_S = 4
const UNTIL_TIMEOUT_S = 10

type Judge<T> = (current: UiNode[], previous: UiNode[] | null) => T | null

export type Polled<T> = { found: T; waitedS: number; read: UiNode[] } | { found: null; read: UiNode[] | null; last: string }

// A read, or the error the reader answered with.
async function readOrAnsweredError(id: string): Promise<ScreenRead | string> {
  try {
    return await readScreen(id)
  } catch (error) {
    if (error instanceof ReaderAnsweredError) return error.message
    throw error
  }
}

// Reads the screen until `judge` finds what it looks for in the read and the one just before it,
// at least once and up to the cap. A moment with no resumed activity, or a read the reader answers
// with an error, as both happen while one screen hands over to another, is waited through and
// breaks the run of reads.
async function pollScreen<T>(capS: number, judge: Judge<T>): Promise<Polled<T>> {
  const id = await serial()
  const started = Date.now()
  let last = ''
  let previous: UiNode[] | null = null
  let read: UiNode[] | null = null
  for (;;) {
    const screen = (await allowedForeground()) === null ? UNREADABLE_FRONT : await readOrAnsweredError(id)
    if (typeof screen === 'string') {
      last = screen
      previous = null
    } else {
      const found = judge(screen.nodes, previous)
      if (found !== null) return { found, waitedS: (Date.now() - started) / 1000, read: screen.nodes }
      last = `labels seen: ${summaryLine(screen.nodes)}`
      previous = read = screen.nodes
    }
    if (Date.now() - started >= capS * 1000) return { found: null, read, last }
    await sleep(READ_INTERVAL_MS)
  }
}

export interface TapOptions { holdMs?: number; until?: Expected; timeoutS?: number }

// Taps once the target stands still, then waits for the named outcome or for the screen to settle,
// and says which, with the labels of the screen it ended on.
export async function tap(label: string, options: TapOptions = {}): Promise<string> {
  const aimed = await pollScreen(TARGET_CAP_S, (current, previous) => tapTarget(label, current, previous))
  if (aimed.found === null) throw new Error(targetAtCap(label, TARGET_CAP_S, aimed))
  if (aimed.found.kind !== 'still') throw new Error(aimed.found.reason)
  const { x, y } = await tapAt(aimed.found.bounds, options.holdMs)
  const tapped = `${options.holdMs !== undefined ? `held ${options.holdMs} ms` : 'tapped'} "${label}" at ${x},${y}, still after ${aimed.waitedS.toFixed(1)} s`
  const expected = options.until ?? null
  const capS = expected ? (options.timeoutS ?? UNTIL_TIMEOUT_S) : SETTLE_CAP_S
  return outcomeText(tapped, expected, capS, await awaitOutcome(expected, aimed.read, capS))
}

// Waits for what an action on the screen read as `before` caused: the expected label or, with none,
// the screen settling.
async function awaitOutcome(expected: Expected | null, before: UiNode[], capS: number): Promise<Polled<TapOutcome>> {
  await sleep(REACTION_MS)
  const after = await pollScreen(capS, tapOutcome(expected, before))
  return after.found === null ? after : { ...after, waitedS: REACTION_MS / 1000 + after.waitedS }
}

// The report of an outcome, headed by `done`, the action that caused it.
function outcomeText(done: string, expected: Expected | null, capS: number, after: Polled<TapOutcome>): string {
  if (after.found !== null) return `${done}\n${outcomeReport(after.found, after.waitedS)}`
  const atCap = outcomeAtCap(expected, capS, after)
  if (atCap.kind === 'failed') throw new Error(`${done}, but ${atCap.reason}`)
  return `${done}\n${atCap.report}`
}

// The screen read as `before` waited out after an action until it settles, as after a tap with no
// outcome named, and the report of it.
export const settleAfter = (before: UiNode[]) => awaitOutcome(null, before, SETTLE_CAP_S)
export const settledText = (done: string, after: Polled<TapOutcome>) => outcomeText(done, null, SETTLE_CAP_S, after)

// Drags the largest list of the screen read as `nodes`; false when nothing there scrolls.
async function swipe(nodes: UiNode[], direction: ScrollDirection): Promise<boolean> {
  const plan = scrollSwipe(nodes, direction)
  if (plan === null) return false
  await shell(`input swipe ${plan.x} ${plan.from} ${plan.x} ${plan.to} ${plan.ms}`)
  return true
}

// Scrolls what is on screen, then waits for it to settle as a tap does: a list at its end reads
// as nothing changed.
export async function scroll(direction: ScrollDirection): Promise<string> {
  const id = await serial()
  await requireForeground()
  const before = await readScreen(id)
  if (!(await swipe(before.nodes, direction))) throw new Error(`nothing on screen scrolls; labels seen: ${summaryLine(before.nodes)}`)
  return settledText(`scrolled ${direction}`, await settleAfter(before.nodes))
}

export async function waitFor(label: string, gone: boolean, timeoutS: number): Promise<string> {
  const expected = { label, gone }
  const polled = await pollScreen(timeoutS, (nodes) => (reached(expected, nodes) ? true : null))
  if (polled.found === null) throw new Error(notReached(expected, timeoutS, polled.last))
  return `"${label}" ${gone ? 'gone' : 'appeared'} after ${polled.waitedS.toFixed(1)} s`
}
