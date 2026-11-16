// The dispatcher's debug-log line, which this file does not read, would open the app's database.
jest.mock('../../../src/log', () => ({ ...jest.requireActual('../../../src/log/errorClass'), logEvent: jest.fn() }))

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { haversineMeters } from '../../../src/data/geo/metrics'
import { buildElevationProfile } from '../../../src/elevation/profile'
import { NO_PROGRESS, indexTrail, stepAlongTrail } from '../../../src/elevation/trailProgress'
import type { LocationFix } from '../../../src/location'
import { logcatLine } from '../../../src/log/logcatLine'
import { gateFixes } from '../../../src/recording/fixGate'
import { RECORDING_OPTIONS } from '../../../src/recording/options'
import { appLogEntries } from '../appLog'
import { IDENTITY_ENV, identityEnv, launchFromCapture } from '../buildIdentity'
import { captureLine, parseCapture } from '../capture'
import { buildRoute, destination, type RoutePoint } from '../geometry'
import { PACES, planJump, planMove, type Fix } from '../walkPlan'
import { createDispatcher } from '../../../src/checkHooks/dispatcher'
import { HOOKS, type Cores } from '../../../src/checkHooks/hooks'
import { replyText, type HookReply } from '../../../src/checkHooks/reply'
import { cleanupReport, deleteReport, importReport, listReport, parseBroadcast, recordReport, stateReport } from '../hookReply'
import { snapshotFiles } from '../snapshotFiles'
import { EFFORTS as APP_EFFORTS } from '../../../src/activities/effort'
import { DIFFICULTIES as APP_DIFFICULTIES } from '../../../src/trails/difficulty'
import { isDevcheckName as appIsDevcheckName } from '../../../src/checkHooks/hook'
import { DIFFICULTIES, EFFORTS } from '../commandLine'
import { devcheckName, isDevcheckName } from '../devcheckData'

// A walked route through the app's own pipeline: the location service's distance interval, the fix
// gate, then trail matching. If a change to either makes a planned walk record as something else
// (a dropped Jump, a fix matched to the other branch of a fold), this fails.

const START = { lat: 43.60445, lng: 1.44345 }

// Out 300 m east, a 10 m turn, back 300 m west: the two branches lie inside each other's match radius.
const turn = destination(START, 90, 300)
const back = destination(turn, 0, 10)
const FOLDED: RoutePoint[] = [
  { ...START, ele: 150 },
  { ...turn, ele: 160 },
  { ...back, ele: 160 },
  { ...destination(back, 270, 300), ele: 150 },
]

const T0 = 1_700_000_000_000

// Fixes are stamped a second apart; the service delivers only those 10 m or more from the last one.
function delivered(fixes: Fix[]): (LocationFix & { mark: number })[] {
  const out: (LocationFix & { mark: number })[] = []
  fixes.forEach((fix, i) => {
    const last = out[out.length - 1]
    if (last && haversineMeters(last.lat, last.lng, fix.lat, fix.lng) < RECORDING_OPTIONS.minDistanceM) return
    out.push({ lat: fix.lat, lng: fix.lng, ele: fix.ele, t: T0 + i * 1000, accuracy: fix.accuracy, mark: fix.mark })
  })
  return out
}

function recordWalk(speed: number) {
  const route = buildRoute(FOLDED)
  const fixes = [planJump(route, { mark: 0, offset: 0 }, 4), ...planMove(route, { mark: 0, offset: 0 }, { mark: route.length, offset: 0 }, speed, 4)]
  const points = delivered(fixes)
  const gate = gateFixes(points, null, null)
  const profile = buildElevationProfile([FOLDED])
  if (!profile) throw new Error('degenerate route')
  const trail = indexTrail(profile)
  let progress = NO_PROGRESS
  const offBranch: { mark: number; s: number | null }[] = []
  for (const point of points) {
    progress = stepAlongTrail(progress, point, trail)
    if (!progress.matched || progress.s === null || Math.abs(progress.s - point.mark) > 5) offBranch.push({ mark: point.mark, s: progress.s })
  }
  return { points, gate, offBranch }
}

describe.each([
  ['fast', PACES.fast],
  ['walk', PACES.walk],
])('a %s walk along a folded route, through the app', (_pace, speed) => {
  const { points, gate, offBranch } = recordWalk(speed)

  it('passes the fix gate whole', () => {
    expect(gate.droppedJump).toBe(0)
    expect(gate.droppedAccuracy).toBe(0)
    expect(gate.kept).toHaveLength(points.length)
  })

  it('stays matched to the branch being walked', () => {
    expect(offBranch).toEqual([])
  })
})

it('records fast walks about 16 m apart', () => {
  const { points } = recordWalk(PACES.fast)
  const gaps = points.slice(1, 15).map((p, i) => haversineMeters(points[i].lat, points[i].lng, p.lat, p.lng))
  for (const gap of gaps) expect(gap).toBeCloseTo(16, 0)
})

describe("the toolkit's reading of the app's debug-log mirror", () => {
  it("reads back what the app's writer puts in logcat, through the capture too", () => {
    const line = logcatLine({ t: 1_763_194_321_640, level: 'info', area: 'map', message: 'heading watch', detail: '{"on":false}' })
    const entry = { time: '11-15 09:12:01.640', pid: 21603, area: 'map', text: 'info map heading watch {"on":false}' }
    const read = appLogEntries(`11-15 09:12:01.640 21603 21650 I ReactNativeJS: ${line}`)
    expect(read).toEqual([entry])
    expect(parseCapture(read.map(captureLine).join('\n'))).toEqual([{ kind: 'entry', entry }])
  })
})

describe("the build's identity, from the build command to the toolkit", () => {
  const identity = { commit: 'c7f942b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', uncommitted: '9a8b7c6d5e4f', fingerprint: '5f0c1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b' }

  // The config as the build embeds it for expo-constants (its own script, run as Gradle runs it)
  // under the build command's environment, then the app's launch line as logcat and the capture
  // carry it. The script runs outside Jest, whose `process.env` the config loader does not see.
  function launchLineOf(env: Record<string, string>): string {
    const root = join(__dirname, '..', '..', '..')
    const out = mkdtempSync(join(tmpdir(), 'app-config-'))
    try {
      const childEnv: NodeJS.ProcessEnv = { ...process.env }
      for (const name of Object.values(IDENTITY_ENV)) delete childEnv[name]
      const run = spawnSync(process.execPath, [join(root, 'node_modules', 'expo-constants', 'scripts', 'getAppConfig.js'), root, out], { env: { ...childEnv, ...env }, encoding: 'utf8' })
      if (run.status !== 0) throw new Error(`getAppConfig failed: ${run.stderr}`)
      const config: unknown = JSON.parse(readFileSync(join(out, 'app.config'), 'utf8'))
      let line = ''
      jest.isolateModules(() => {
        jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: config } }))
        const { coldStartDetail } = jest.requireActual('../../../src/log/launchDetail') as typeof import('../../../src/log/launchDetail')
        line = logcatLine({ t: 1_763_194_321_640, level: 'info', area: 'launch', message: 'cold start', detail: JSON.stringify(coldStartDetail()) })
      })
      return line
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  }

  const launchOf = (env: Record<string, string>) =>
    launchFromCapture(appLogEntries(`11-15 09:12:01.640 21603 21650 I ReactNativeJS: ${launchLineOf(env)}`).map(captureLine).join('\n'))

  it('is read back from the launch line of a build the command made', () => {
    expect(launchOf(identityEnv(identity))).toEqual({ time: '11-15 09:12:01.640', identity })
    expect(launchOf(identityEnv({ ...identity, uncommitted: null }))).toEqual({ time: '11-15 09:12:01.640', identity: { ...identity, uncommitted: null } })
  })

  it('is none on the launch line of a build made without the command', () => {
    expect(launchOf({})).toEqual({ time: '11-15 09:12:01.640', identity: null })
  })
})

describe("the toolkit's reading of a check hook's reply", () => {
  // As `am broadcast` prints the result the app's receiver set (modules/check-hooks).
  const printed = (reply: HookReply) =>
    `Broadcasting: Intent { act=com.zorzi.onfootrn.CHECK_HOOK flg=0x10400000 pkg=com.zorzi.onfootrn (has extras) }\nBroadcast completed: result=1, data="${replyText(reply)}"\n`

  it.each<HookReply>([
    { reply: 'ok', data: { id: 3, name: 'DEVCHECK "quoted" climb' } },
    { reply: 'refused', reason: 'the map must be in front, not /activity/save' },
    { reply: 'not-ready', loading: ['launch', 'offline packs'] },
  ])('reads back what the app wrote: $reply', (reply) => {
    expect(parseBroadcast(printed(reply))).toEqual({ kind: 'reply', reply })
  })

  const build = { commit: 'c7f942b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', uncommitted: '9a8b7c6d5e4f', fingerprint: '5f0c1a2b3c4d' }
  const trails = [
    { id: 3, name: 'Tour du Canigou' },
    { id: 5, name: 'DEVCHECK "quoted" climb' },
    { id: 9, name: 'DEVCHECK flat' },
  ]
  const files = {
    database: '/storage/emulated/0/Android/data/com.zorzi.onfootrn/files/hooks/snapshot.db',
    preferences: '/storage/emulated/0/Android/data/com.zorzi.onfootrn/files/hooks/snapshot-preferences.json',
  }
  // The agent session is 42; a session 40 is the owner's.
  const appWith = (recording: 'idle' | 'recording' | 'paused', sessionId = 42): Cores => {
    let live = recording === 'idle' ? null : { id: sessionId, paused: recording === 'paused' }
    return {
      readState: () => ({ selection: { kind: 'activity', id: 12 }, mapMode: 'activity', followMode: 'off', recording, build }),
      recordingPhase: () => recording,
      listed: (kind) => (kind === 'trail' ? trails : [{ id: 12, name: 'Sunday walk' }]),
      showTrail: () => ({ kind: 'shown' }),
      showActivity: () => ({ kind: 'shown' }),
      clearSelection: () => undefined,
      takeSnapshot: () => Promise.resolve(files),
      liveSession: () => live,
      agentSession: { read: async () => 42, keep: async () => {}, drop: async () => {} },
      startRecording: async () => {
        live = { id: 42, paused: false }
        return 'started'
      },
      pauseRecording: async () => {},
      resumeRecording: async () => 'resumed',
      discardRecording: async () => {},
      stopForSave: async () => {},
      loadRecording: async () => ({
        session: { id: sessionId, startedAt: 0, linkedTrailId: null, pausedAt: 1, pausedMs: 0, currentSegment: 0, segmentStartedAt: 0 },
        segments: [],
      }),
      saveRecording: async () => 31,
      deleteItem: async (_kind, id) => {
        if (id === 9) throw new Error('database is locked')
      },
      importTrail: async () => ({ ok: true, id: 31 }),
    }
  }

  async function answered(cores: Cores, hook: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const dispatch = createDispatcher({ hooks: HOOKS, cores, app: () => ({ screen: '/', loading: [] }) })
    const read = parseBroadcast(printed(await dispatch({ hook, args: JSON.stringify(args) })))
    if (read.kind !== 'reply' || read.reply.reply !== 'ok') throw new Error(`${hook}: no ok reply`)
    return read.reply.data
  }
  const dataOf = (hook: string, args: Record<string, unknown> = {}) => answered(appWith('idle'), hook, args)

  it("prints the app's list hook answer: the DEVCHECK items, and a count of the others", async () => {
    expect(listReport('trail', await dataOf('list', { kind: 'trail' }))).toBe(
      ['5  DEVCHECK "quoted" climb', '9  DEVCHECK flat', 'and 1 trail not named DEVCHECK'].join('\n'),
    )
    expect(listReport('activity', await dataOf('list', { kind: 'activity' }))).toBe(
      ['no DEVCHECK activities', 'and 1 activity not named DEVCHECK'].join('\n'),
    )
  })

  it("prints the app's import-gpx and delete answers", async () => {
    expect(importReport(await dataOf('import-gpx', { file: 'import.gpx', name: 'DEVCHECK climb', difficulty: 'easy' }))).toBe('imported trail 31 "DEVCHECK climb"')
    expect(deleteReport(await dataOf('delete', { kind: 'trail', id: 5 }))).toBe('deleted trail 5 "DEVCHECK "quoted" climb"')
  })

  it("prints the app's cleanup answer, what it could not delete apart", async () => {
    expect(cleanupReport(await dataOf('cleanup'))).toEqual({
      report: ['deleted 1: trail 5 "DEVCHECK "quoted" climb"', 'could not delete:', '  trail 9 "DEVCHECK flat": database is locked'].join('\n'),
      complete: false,
    })
  })

  it("prints the app's state hook answer", async () => {
    expect(stateReport(await dataOf('state'))).toBe(
      [
        'screen: /',
        'selection: activity 12',
        'map mode: activity',
        'follow mode: off',
        'recording: idle',
        'build: c7f942b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7, uncommitted changes 9a8b7c6d5e4f, native fingerprint 5f0c1a2b3c4d',
      ].join('\n'),
    )
  })

  it('says whose recording the state hook found', async () => {
    expect(stateReport(await answered(appWith('paused'), 'state'))).toContain('recording: paused, agent session')
    expect(stateReport(await answered(appWith('recording', 40), 'state'))).toContain('recording: recording, not an agent session')
  })

  it.each([
    ['record-start', 'idle', {}, 'agent session 42 started'],
    ['record-pause', 'recording', {}, 'agent session 42 paused'],
    ['record-resume', 'paused', {}, 'agent session 42 resumed'],
    ['record-discard', 'paused', {}, 'agent session 42 discarded'],
    ['record-save', 'paused', { name: 'DEVCHECK climb', effort: 'easy' }, 'agent session 42 saved as activity 31'],
  ] as const)("prints the app's %s answer", async (hook, recording, args, printedAnswer) => {
    expect(recordReport(hook, await answered(appWith(recording), hook, args))).toBe(printedAnswer)
  })

  it("reads the paths of the app's snapshot hook answer", async () => {
    expect(snapshotFiles(await dataOf('snapshot'))).toEqual(files)
  })
})

describe("the toolkit's copies of the app's values", () => {
  it("takes the app's difficulties and efforts, and sends them as the app spells them", () => {
    expect(DIFFICULTIES.map((d) => d.toLowerCase())).toEqual(APP_DIFFICULTIES)
    expect(EFFORTS.map((e) => e.toLowerCase())).toEqual(APP_EFFORTS)
  })

  it.each(['DEVCHECK climb', 'DEVCHECK ', 'DEVCHECKclimb', 'devcheck climb', 'Col de la Croix DEVCHECK', ''])(
    'tells a DEVCHECK name as the app does: %j',
    (name) => {
      expect(isDevcheckName(name)).toBe(appIsDevcheckName(name))
    },
  )

  it('names what it creates so that the app writes it', () => {
    expect(appIsDevcheckName(devcheckName('hooks'))).toBe(true)
  })
})
