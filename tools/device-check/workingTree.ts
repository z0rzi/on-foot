import { spawnSync } from 'node:child_process'
import { lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { join } from 'node:path'
import { uncommittedHash, type UntrackedFile } from './buildIdentity'

// The checkout the toolkit runs from: what a build made here holds, and what its commits contain.
export const REPO_ROOT = join(__dirname, '..', '..')

function git(args: string[]): { status: number | null; stdout: Buffer } {
  const run = spawnSync('git', args, { cwd: REPO_ROOT, maxBuffer: 512 * 1024 * 1024 })
  if (run.error) throw new Error(`git could not run: ${run.error.message}`)
  return { status: run.status, stdout: run.stdout }
}

function gitText(args: string[]): string {
  const { status, stdout } = git(args)
  if (status !== 0) throw new Error(`git ${args.join(' ')} failed (exit ${status})`)
  return stdout.toString().trim()
}

// An untracked symlink is hashed by its target, as git would store it.
function untrackedFile(path: string): UntrackedFile {
  const full = join(REPO_ROOT, path)
  return { path, content: lstatSync(full).isSymbolicLink() ? Buffer.from(readlinkSync(full)) : readFileSync(full) }
}

export function workingTree(): { commit: string; uncommitted: string | null } {
  const diff = git(['diff', 'HEAD', '--binary'])
  if (diff.status !== 0) throw new Error(`git diff HEAD failed (exit ${diff.status})`)
  const untracked = gitText(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter((p) => p !== '')
  return { commit: gitText(['rev-parse', 'HEAD']), uncommitted: uncommittedHash(diff.stdout, untracked.map(untrackedFile)) }
}

// The full commit a revision names, or null when it names none here.
export function resolveCommit(rev: string): string | null {
  const { status, stdout } = git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`])
  return status === 0 ? stdout.toString().trim() : null
}

// Whether `wanted` is `commit` or one of its ancestors; null when this repository lacks `commit`.
export function holdsCommit(wanted: string, commit: string): boolean | null {
  if (resolveCommit(commit) === null) return null
  const { status } = git(['merge-base', '--is-ancestor', wanted, commit])
  if (status === 0) return true
  if (status === 1) return false
  throw new Error(`git merge-base --is-ancestor failed (exit ${status})`)
}
