import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

// The bundler inlines the check-hooks flag, so its transform cache must tell the two builds apart.
// The config is read outside Jest, whose `process.env` the child would not see.
function cacheVersion(flag: string | undefined): string {
  const root = join(__dirname, '..', '..', '..')
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.EXPO_PUBLIC_DEBUG_CHECK_HOOKS
  if (flag !== undefined) env.EXPO_PUBLIC_DEBUG_CHECK_HOOKS = flag
  const run = spawnSync(process.execPath, ['-e', `process.stdout.write(require(${JSON.stringify(join(root, 'metro.config.js'))}).cacheVersion)`], { cwd: root, env, encoding: 'utf8' })
  if (run.status !== 0) throw new Error(`metro.config.js failed: ${run.stderr}`)
  return run.stdout
}

describe("the bundler's transform cache", () => {
  it('keys on the check-hooks flag', () => {
    expect(cacheVersion('1')).not.toBe(cacheVersion(undefined))
  })
})
