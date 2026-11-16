import { createHash } from 'node:crypto'
import { parseCapture } from './capture'

// A build's identity: the commit it was built from, the hash of the uncommitted changes it carried
// (null for a clean tree) and its native fingerprint.
export interface BuildIdentity {
  commit: string
  uncommitted: string | null
  fingerprint: string
}

// The latest `launch cold start` entry of the capture, with the identity its build carried.
export interface Launch {
  time: string
  identity: BuildIdentity | null
}

// Where the installed build's identity was read.
export type IdentityRead =
  // A build with hooks: its `state` hook's answer.
  | { from: 'state'; identity: BuildIdentity | null }
  // A build without hooks: the capture's last launch, and the package's `lastUpdateTime`,
  // `YYYY-MM-DD HH:MM:SS` on the phone's clock.
  | { from: 'capture'; launch: Launch | null; installedAt: string }

export interface VerdictInput {
  wanted: string
  read: IdentityRead
  // Whether the wanted commit is the installed one or an ancestor of it; null when the installed
  // build names no commit this repository has.
  holds: boolean | null
  tree: { commit: string; uncommitted: string | null }
}

// How the build command hands the identity to the app's config (app.config.ts), which puts it in
// `extra` for expo-constants as strings. An empty `uncommitted` is a clean tree's, there and on the
// launch line.
export const IDENTITY_ENV = { commit: 'ON_FOOT_BUILD_COMMIT', uncommitted: 'ON_FOOT_BUILD_UNCOMMITTED', fingerprint: 'ON_FOOT_BUILD_FINGERPRINT' } as const

export const identityEnv = (identity: BuildIdentity): Record<string, string> => ({
  [IDENTITY_ENV.commit]: identity.commit,
  [IDENTITY_ENV.uncommitted]: identity.uncommitted ?? '',
  [IDENTITY_ENV.fingerprint]: identity.fingerprint,
})

export interface UntrackedFile {
  path: string
  content: Buffer
}

// The uncommitted changes of a working tree, as `git diff HEAD --binary` and the untracked files
// git does not ignore, hashed; null when there are none.
export function uncommittedHash(diff: Buffer, untracked: UntrackedFile[]): string | null {
  if (diff.length === 0 && untracked.length === 0) return null
  const hash = createHash('sha256').update(diff)
  for (const file of [...untracked].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    hash.update(`\0${file.path}\0`).update(file.content)
  }
  return hash.digest('hex').slice(0, 12)
}

const COLD_START = 'info launch cold start '
const COMMIT = /^[0-9a-f]{40}$/
const HASH = /^[0-9a-f]+$/

export function identityOf(value: unknown): BuildIdentity | null {
  if (typeof value !== 'object' || value === null) return null
  const { commit, uncommitted, fingerprint } = value as Record<string, unknown>
  if (typeof commit !== 'string' || !COMMIT.test(commit)) return null
  if (typeof uncommitted !== 'string' || (uncommitted !== '' && !HASH.test(uncommitted))) return null
  if (typeof fingerprint !== 'string' || !HASH.test(fingerprint)) return null
  return { commit, uncommitted: uncommitted === '' ? null : uncommitted, fingerprint }
}

function detailOf(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function launchFromCapture(capture: string): Launch | null {
  const launches = parseCapture(capture).flatMap((item) => (item.kind === 'entry' && item.entry.text.startsWith(COLD_START) ? [item.entry] : []))
  const last = launches[launches.length - 1]
  if (!last) return null
  const detail = detailOf(last.text.slice(COLD_START.length))
  const build = typeof detail === 'object' && detail !== null ? (detail as Record<string, unknown>).build : null
  return { time: last.time, identity: identityOf(build) }
}

// `<commit>, clean|uncommitted changes <hash>, native fingerprint <fp>`, as the build command prints it.
export const describeIdentity = ({ commit, uncommitted, fingerprint }: BuildIdentity) =>
  `${commit}, ${uncommitted === null ? 'clean' : `uncommitted changes ${uncommitted}`}, native fingerprint ${fingerprint}`

const short = (commit: string) => commit.slice(0, 12)

// Logcat's `MM-DD HH:MM:SS.mmm` against the install's `YYYY-MM-DD HH:MM:SS`, both of the phone's clock.
const launchedBefore = (launchTime: string, installedAt: string) => launchTime.slice(0, 14) < installedAt.slice(5, 19)

function treeDiffers(identity: BuildIdentity, tree: VerdictInput['tree']): string | null {
  if (tree.commit !== identity.commit) return `the working tree stands on ${short(tree.commit)}`
  if (tree.uncommitted === null) return 'the working tree is clean'
  if (tree.uncommitted !== identity.uncommitted) return `the working tree's are ${tree.uncommitted}`
  return null
}

// The identity read and where it was read, or why the capture tells nothing of the installed build.
function identityFrom(read: IdentityRead): { identity: BuildIdentity | null; where: string } | { unknown: string } {
  if (read.from === 'state') return { identity: read.identity, where: 'as its `state` says' }
  const { launch, installedAt } = read
  if (launch === null) return { unknown: "the capture holds no launch of On Foot; relaunch it as the skill's Rules say and run this again" }
  if (launchedBefore(launch.time, installedAt)) {
    return { unknown: `the last launch in the capture (${launch.time}) is older than the install (${installedAt}); relaunch On Foot as the skill's Rules say and run this again` }
  }
  return { identity: launch.identity, where: `launched ${launch.time}` }
}

// Whether the installed build holds a commit. A build made with uncommitted changes is known only
// when the working tree still stands on its commit with the same changes.
export function buildVerdict({ wanted, read, holds, tree }: VerdictInput): { held: boolean; report: string } {
  const unknown = (why: string) => ({ held: false, report: `cannot tell whether it holds ${wanted}: ${why}` })
  const found = identityFrom(read)
  if ('unknown' in found) return unknown(found.unknown)
  const { identity, where } = found
  if (identity === null) return unknown(`the installed build carries no identity (${where}), so it was not made by \`devcheck build\`; build needed`)
  const installed = (changes: string) =>
    `the installed build is ${short(identity.commit)}${identity.uncommitted === null ? ', clean' : ` with ${changes} ${identity.uncommitted}`} (native fingerprint ${identity.fingerprint}, ${where})`
  if (holds === null) return unknown(`${installed('uncommitted changes')}, a commit this repository does not have; build needed`)
  const differs = identity.uncommitted === null ? null : treeDiffers(identity, tree)
  if (differs !== null) return unknown(`${installed('uncommitted changes')}, and ${differs}; build needed`)
  const described = installed("the working tree's uncommitted changes")
  return holds
    ? { held: true, report: `holds ${wanted}: ${described}` }
    : { held: false, report: `does not hold ${wanted}: ${described}; build needed` }
}
