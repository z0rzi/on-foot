import { spawnSync } from 'node:child_process'

// Runs ffmpeg quietly, overwriting its output; the failure as a line, or null.
export function ffmpeg(args: string[]): string | null {
  const run = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { encoding: 'utf8' })
  if (run.error) return run.error.message
  return run.status === 0 ? null : run.stderr.trim() || `ffmpeg exited ${run.status}`
}
