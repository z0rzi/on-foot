// A burst of screenshots read as one image: each frame at half width, side by side.
export const MAX_FRAMES = 10
const MAX_BURST_MS = 60_000

export function checkBurst(count: number, everyMs: number): void {
  if (!Number.isInteger(count) || count < 2 || count > MAX_FRAMES) throw new Error(`--count must be a whole number from 2 to ${MAX_FRAMES}`)
  if (!Number.isInteger(everyMs) || everyMs < 0) throw new Error('--every must be a whole number of milliseconds, 0 or more')
  if ((count - 1) * everyMs > MAX_BURST_MS) throw new Error('a burst lasts a minute at most: fewer frames or a shorter --every')
}

export function frameFile(base: string, index: number): string {
  return `${base}.frame-${String(index + 1).padStart(2, '0')}.png`
}

export function stripArgs(frames: string[], out: string): string[] {
  const scaled = frames.map((_, i) => `[${i}:v]scale=iw/2:-1[f${i}]`).join(';')
  const stack = `${frames.map((_, i) => `[f${i}]`).join('')}hstack=inputs=${frames.length}`
  return [...frames.flatMap((f) => ['-i', f]), '-filter_complex', `${scaled};${stack}`, out]
}
