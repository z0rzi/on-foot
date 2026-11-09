import { parsePackId } from './packId'

export interface DownloadSettled {
  trailId: number
  failed: boolean
}

type PackOutcome = 'pending' | 'complete' | 'failed'

export interface DownloadBatches {
  start: (id: string) => void
  settle: (id: string, failed: boolean) => DownloadSettled | null
  drop: (id: string) => void
}

// One batch per trail: the packs being downloaded for it. The batch settles once, when its last
// pending pack settles; a pack that already settled, or is not tracked, settles nothing. Dropping a
// pack (a user remove, which shows its own feedback) never settles: a batch left with no pending
// pack closes silently.
export function createDownloadBatches(): DownloadBatches {
  const batches = new Map<number, Map<string, PackOutcome>>()

  const close = (trailId: number): DownloadSettled | null => {
    const batch = batches.get(trailId)
    if (!batch) return null
    const outcomes = [...batch.values()]
    if (outcomes.includes('pending')) return null
    batches.delete(trailId)
    if (outcomes.length === 0) return null
    return { trailId, failed: outcomes.includes('failed') }
  }

  return {
    start: (id) => {
      const trailId = parsePackId(id)?.trailId
      if (trailId === undefined) return
      const batch = batches.get(trailId) ?? new Map<string, PackOutcome>()
      batch.set(id, 'pending')
      batches.set(trailId, batch)
    },
    settle: (id, failed) => {
      const trailId = parsePackId(id)?.trailId
      if (trailId === undefined) return null
      const batch = batches.get(trailId)
      if (batch?.get(id) !== 'pending') return null
      batch.set(id, failed ? 'failed' : 'complete')
      return close(trailId)
    },
    drop: (id) => {
      const trailId = parsePackId(id)?.trailId
      if (trailId === undefined) return
      const batch = batches.get(trailId)
      if (!batch?.delete(id)) return
      if (![...batch.values()].includes('pending')) batches.delete(trailId)
    },
  }
}
