import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { adbBuffer, serial, shell, sleep, TIMEOUT } from './adb'
import { evidenceDir, nextShotBase, slug } from './evidence'
import { describeNoDump, fixIntake, readScreen, refuseWhileMoving, requireForeground } from './screen'
import { tapTarget } from './tapTarget'
import { centre, cropFilter, findByLabel, parseUiDump, summaryLine } from './uiDump'
import { readMemory, runningMove } from './walkStore'

function ffmpeg(args: string[]): string | null {
  const run = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { encoding: 'utf8' })
  if (run.error) return run.error.message
  return run.status === 0 ? null : run.stderr.trim() || `ffmpeg exited ${run.status}`
}

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

export async function tap(label: string, holdMs?: number): Promise<void> {
  const id = await serial()
  refuseWhileMoving(id, 'tap')
  const screen = await readScreen(id, await requireForeground())
  const target = tapTarget(label, screen, readMemory(id).recordButton)
  if (target.kind === 'missing') throw new Error(target.reason)
  const { x, y } = centre(target.bounds)
  await shell(holdMs !== undefined ? `input swipe ${x} ${y} ${x} ${y} ${holdMs}` : `input tap ${x} ${y}`)
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


export async function waitFor(label: string, gone: boolean, timeoutS: number): Promise<void> {
  const id = await serial()
  refuseWhileMoving(id, 'wait-for')
  const started = Date.now()
  let last = ''
  while (Date.now() - started < timeoutS * 1000) {
    const screen = await readScreen(id, await requireForeground())
    if (screen.kind === 'recording') throw new Error(`wait-for cannot read the screen: ${describeNoDump(screen)}`)
    if (screen.kind === 'dump') {
      const present = findByLabel(screen.nodes, label).node !== null
      if (present !== gone) {
        console.log(`"${label}" ${gone ? 'gone' : 'appeared'} after ${((Date.now() - started) / 1000).toFixed(1)} s`)
        return
      }
      last = `labels seen: ${summaryLine(screen.nodes)}`
    } else {
      last = describeNoDump(screen)
    }
    await sleep(POLL_MS)
  }
  throw new Error(`"${label}" ${gone ? 'still there' : 'not there'} after ${timeoutS} s; ${last}`)
}
