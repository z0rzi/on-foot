import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { adbBuffer, sleep, TIMEOUT } from './adb'
import { evidenceDir, nextShotBase } from './evidence'
import { ffmpeg } from './ffmpeg'
import { checkBurst, frameFile, stripArgs } from './framesPlan'
import { requireForeground } from './screen'

// A screenshot burst for what moves (a sheet opening, the camera easing). The app in front is
// checked before and after; a burst that ends on another app is deleted, as it may hold that app.
export async function frames(name: string, count: number, everyMs: number): Promise<void> {
  checkBurst(count, everyMs)
  await requireForeground()
  const dir = evidenceDir()
  const base = nextShotBase(dir, name)
  const files: string[] = []
  const times: number[] = []
  const started = Date.now()
  try {
    for (let i = 0; i < count; i++) {
      const due = started + i * everyMs
      if (Date.now() < due) await sleep(due - Date.now())
      times.push(Date.now() - started)
      const file = join(dir, frameFile(base, i))
      writeFileSync(file, await adbBuffer(['exec-out', 'screencap', '-p'], TIMEOUT.screencap))
      files.push(file)
    }
    await requireForeground()
  } catch (error) {
    for (const file of files) rmSync(file, { force: true })
    if (files.length > 0) console.error(`the ${files.length} frames taken are deleted`)
    throw error
  }
  const strip = join(dir, `${base}.strip.png`)
  const failure = ffmpeg(stripArgs(files, strip))
  console.log(failure ? `no strip (${failure}); frames: ${files.join(' ')}` : `read: ${strip}`)
  console.log(`frames at ${times.map((t) => `${(t / 1000).toFixed(2)} s`).join(', ')} (${count} in ${join(dir, `${base}.frame-NN.png`)})`)
}
