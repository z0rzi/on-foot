import { useEffect } from 'react'
import { nextFrame } from '../async/nextFrame'
import { activitiesRepository } from '../data/activities'
import type { OverviewFill } from '../data/geo/overview'
import { trailsRepository } from '../data/trails'
import { errorClass, logEvent, toOneDecimal } from '../log'
import { whenNoRecordingSession } from '../recording/whenNoRecordingSession'
import { useActivitiesStore } from './activitiesStore'
import { useTrailsStore } from './trailsStore'

// Rows filled between two reloads of their store, each reload rebuilding the overview.
const ROWS_PER_RELOAD = 5

interface BackfillKind {
  kind: 'trail' | 'activity'
  listIds: () => Promise<number[]>
  fill: (id: number) => Promise<OverviewFill>
  reload: () => Promise<void>
}

const KINDS: BackfillKind[] = [
  {
    kind: 'trail',
    listIds: () => trailsRepository.listIdsWithoutOverview(),
    fill: (id) => trailsRepository.fillOverview(id),
    reload: () => useTrailsStore.getState().loadTrails(),
  },
  {
    kind: 'activity',
    listIds: () => activitiesRepository.listIdsWithoutOverview(),
    fill: (id) => activitiesRepository.fillOverview(id),
    reload: () => useActivitiesStore.getState().loadActivities(),
  },
]

interface Pass { rows: number; failed: number; slowestMs: number; ms: number }

const reloadLogged = (kind: BackfillKind) =>
  kind.reload().catch((error) =>
    logEvent('warn', 'map', 'reloading after the overview backfill failed', { kind: kind.kind, errorClass: errorClass(error) }),
  )

async function fillRows(kind: BackfillKind, ids: number[], pass: Pass): Promise<void> {
  let sinceReload = 0
  try {
    for (const id of ids) {
      const startedAt = performance.now()
      const fill = await kind.fill(id)
      const ms = performance.now() - startedAt
      pass.ms += ms
      pass.slowestMs = Math.max(pass.slowestMs, ms)
      if (fill.kind !== 'missing') pass.rows++
      if (fill.kind === 'unreadable') {
        pass.failed++
        logEvent('warn', 'map', 'overview geometry unreadable', { kind: kind.kind, errorClass: errorClass(fill.error) })
      }
      if (++sinceReload === ROWS_PER_RELOAD) {
        sinceReload = 0
        await reloadLogged(kind)
      }
      await nextFrame()
    }
  } finally {
    if (sinceReload > 0) await reloadLogged(kind)
  }
}

// One pass over the rows saved before overviews existed, a row at a time with a frame between rows.
// A pass stopped by a failure leaves the rest unfilled: the next start resumes there.
export async function backfillOverviews(): Promise<void> {
  const pass: Pass = { rows: 0, failed: 0, slowestMs: 0, ms: 0 }
  try {
    const pending = await Promise.all(KINDS.map((kind) => kind.listIds()))
    if (pending.every((ids) => ids.length === 0)) return
    for (const [i, kind] of KINDS.entries()) await fillRows(kind, pending[i], pass)
  } catch (error) {
    logEvent('warn', 'map', 'overview backfill stopped', { rows: pass.rows, failed: pass.failed, errorClass: errorClass(error) })
    return
  }
  logEvent('info', 'map', 'overview backfill', {
    rows: pass.rows,
    failed: pass.failed,
    slowestMs: toOneDecimal(pass.slowestMs),
    ms: toOneDecimal(pass.ms),
  })
}

// Mounted once the migrations have run; the pass waits for no recording session to exist.
export function useOverviewBackfill(): void {
  useEffect(() => whenNoRecordingSession(() => void backfillOverviews()), [])
}
