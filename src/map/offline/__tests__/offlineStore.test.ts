jest.mock('../../../log', () => ({ ...jest.requireActual('../../../log/errorClass'), logEvent: jest.fn() }))

import { logEvent } from '../../../log'
import { useOfflineStore } from '../offlineStore'
import { packId } from '../packId'
import type { OfflineController, OfflinePackInfo } from '../../provider/types'

const flush = () => new Promise<void>((r) => setImmediate(r))

const info = (id: string, state: OfflinePackInfo['state'] = 'complete', percentage = 100): OfflinePackInfo => ({
  id, state, percentage, sizeBytes: 1,
})

const descriptor = (id: string) => ({
  id, styleUrl: 'u', bounds: [[1, 1], [0, 0]] as [[number, number], [number, number]], minZoom: 10, maxZoom: 16,
})

// Fake controller. `subscribe` immediately drives the provided script of progress/error calls,
// so the store's completion/error wiring runs synchronously within a flushed microtask, and it
// records unsubscribe calls so teardown can be asserted.
function makeController(opts: {
  packs?: OfflinePackInfo[]
  onSubscribe?: (id: string, onProgress: (i: OfflinePackInfo) => void, onError: (id: string, m: string) => void) => void
} = {}): OfflineController & { deleted: string[]; downloaded: string[]; resumed: string[]; unsubscribed: string[] } {
  const deleted: string[] = []
  const downloaded: string[] = []
  const resumed: string[] = []
  const unsubscribed: string[] = []
  return {
    deleted, downloaded, resumed, unsubscribed,
    downloadPack: async (d) => { downloaded.push(d.id) },
    resumePack: async (id) => { resumed.push(id) },
    deletePack: async (id) => { deleted.push(id) },
    listPacks: async () => opts.packs ?? [],
    subscribe: (id, onProgress, onError) => {
      opts.onSubscribe?.(id, onProgress, onError)
      return () => { unsubscribed.push(id) }
    },
  }
}

beforeEach(() => useOfflineStore.setState({ packs: [], progress: {}, loaded: false }))

describe('offlineStore ownership', () => {
  test('reload loads the registry', async () => {
    await useOfflineStore.getState().reload(makeController({ packs: [info(packId(1, 'a'))] }))
    expect(useOfflineStore.getState().packs).toHaveLength(1)
  })

  test('is loaded once a reload has read the registry, and not after a failed one', async () => {
    const failing = makeController()
    failing.listPacks = () => Promise.reject(new Error('sdk'))
    await expect(useOfflineStore.getState().reload(failing)).rejects.toThrow('sdk')
    expect(useOfflineStore.getState().loaded).toBe(false)
    await useOfflineStore.getState().reload(makeController())
    expect(useOfflineStore.getState().loaded).toBe(true)
  })

  test('download: optimistic progress, then completion clears progress and reloads packs', async () => {
    const controller = makeController({
      packs: [info(packId(1, 'a'))],
      onSubscribe: (id, onProgress) => onProgress(info(id, 'complete', 100)),
    })
    useOfflineStore.getState().download(controller, descriptor(packId(1, 'a')))
    await flush()
    expect(controller.downloaded).toEqual([packId(1, 'a')])
    expect(useOfflineStore.getState().progress[packId(1, 'a')]).toBeUndefined()
    expect(useOfflineStore.getState().packs).toHaveLength(1)
  })

  test('download error marks the pack failed', async () => {
    const controller = makeController({ onSubscribe: (id, _p, onError) => onError(id, 'boom') })
    useOfflineStore.getState().download(controller, descriptor(packId(1, 'a')))
    await flush()
    expect(useOfflineStore.getState().progress[packId(1, 'a')]).toEqual({ percentage: 0, failed: true })
  })

  test('resume unsticks a failed entry and completes', async () => {
    const id = packId(1, 'a')
    useOfflineStore.setState({ progress: { [id]: { percentage: 0, failed: true } } })
    const controller = makeController({ packs: [info(id)], onSubscribe: (sid, onProgress) => onProgress(info(sid, 'complete', 100)) })
    useOfflineStore.getState().resume(controller, id)
    await flush()
    expect(controller.resumed).toEqual([id])
    expect(useOfflineStore.getState().progress[id]).toBeUndefined()
  })

  test('remove tears down an in-flight subscription so no ghost progress survives', async () => {
    const id = packId(1, 'a')
    // subscribe attaches but never completes (in-flight download)
    const controller = makeController({ onSubscribe: (sid, onProgress) => onProgress(info(sid, 'incomplete', 30)) })
    useOfflineStore.getState().download(controller, descriptor(id))
    await flush()
    expect(useOfflineStore.getState().progress[id]).toEqual({ percentage: 30, failed: false })
    await useOfflineStore.getState().remove(controller, [id])
    expect(controller.unsubscribed).toContain(id)
    expect(useOfflineStore.getState().progress[id]).toBeUndefined()
  })

  test('concurrent same-id downloads never orphan the first subscription', async () => {
    const id = packId(1, 'a')
    const controller = makeController({ onSubscribe: (sid, onProgress) => onProgress(info(sid, 'incomplete', 20)) })
    useOfflineStore.getState().download(controller, descriptor(id))
    useOfflineStore.getState().download(controller, descriptor(id))
    await flush()
    // the first subscription was torn down when the second registered
    expect(controller.unsubscribed).toContain(id)
  })

  test('reconciles a completion that landed before the subscription attached', async () => {
    const id = packId(1, 'a')
    // subscribe fires nothing, but the registry already shows the pack complete
    const controller = makeController({ packs: [info(id, 'complete', 100)] })
    useOfflineStore.getState().download(controller, descriptor(id))
    await flush()
    expect(useOfflineStore.getState().progress[id]).toBeUndefined()
    expect(useOfflineStore.getState().packs).toHaveLength(1)
  })

  test('remove deletes the given ids, clears their progress, and reloads', async () => {
    const id = packId(1, 'a')
    useOfflineStore.setState({ progress: { [id]: { percentage: 50, failed: false } } })
    const controller = makeController({ packs: [] })
    await useOfflineStore.getState().remove(controller, [id])
    expect(controller.deleted).toEqual([id])
    expect(useOfflineStore.getState().progress[id]).toBeUndefined()
    expect(useOfflineStore.getState().packs).toEqual([])
  })

  test('removeForTrail deletes only that trail\'s packs (from in-memory state)', async () => {
    useOfflineStore.setState({
      packs: [info(packId(5, 'a')), info(packId(5, 'b')), info(packId(6, 'a'))],
      progress: {},
    })
    const controller = makeController({ packs: [] })
    await useOfflineStore.getState().removeForTrail(controller, 5)
    expect(controller.deleted.sort()).toEqual([packId(5, 'a'), packId(5, 'b')])
  })

  test('removeForTrail cancels a pending download that has no registry pack yet', async () => {
    // A pending offline download: tracked in progress, not (yet) in packs.
    useOfflineStore.setState({ packs: [], progress: { [packId(7, 'a')]: { percentage: 0, failed: false } } })
    const controller = makeController({ packs: [] })
    await useOfflineStore.getState().removeForTrail(controller, 7)
    expect(controller.deleted).toEqual([packId(7, 'a')])
    expect(useOfflineStore.getState().progress[packId(7, 'a')]).toBeUndefined()
  })

  test('removeForTrail leaves the progress of another trail and of a key that is no pack id', async () => {
    useOfflineStore.setState({
      packs: [],
      progress: {
        [packId(7, 'a')]: { percentage: 10, failed: false },
        [packId(8, 'a')]: { percentage: 20, failed: false },
        'not-a-pack-id': { percentage: 30, failed: false },
      },
    })
    const controller = makeController({ packs: [] })
    await useOfflineStore.getState().removeForTrail(controller, 7)
    expect(controller.deleted).toEqual([packId(7, 'a')])
    expect(Object.keys(useOfflineStore.getState().progress).sort()).toEqual([packId(8, 'a'), 'not-a-pack-id'].sort())
  })

  test('removeForTrail deletes a pack both registered and tracked once', async () => {
    const id = packId(7, 'a')
    useOfflineStore.setState({ packs: [info(id, 'incomplete', 40)], progress: { [id]: { percentage: 40, failed: false } } })
    const controller = makeController({ packs: [] })
    await useOfflineStore.getState().removeForTrail(controller, 7)
    expect(controller.deleted).toEqual([id])
  })

  test('remove is best-effort: a rejecting deletePack still clears local state and does not throw', async () => {
    const id = packId(1, 'a')
    useOfflineStore.setState({ packs: [info(id)], progress: { [id]: { percentage: 50, failed: true } } })
    const controller = makeController({ packs: [info(id)] })
    controller.deletePack = async () => { throw new Error('offline') }
    await expect(useOfflineStore.getState().remove(controller, [id])).resolves.toBeUndefined()
    expect(useOfflineStore.getState().progress[id]).toBeUndefined()
  })

  test('remove tolerates a rejecting listPacks (offline) without throwing', async () => {
    const id = packId(1, 'a')
    useOfflineStore.setState({ progress: { [id]: { percentage: 0, failed: false } } })
    const controller = makeController({})
    controller.listPacks = async () => { throw new Error('offline') }
    await expect(useOfflineStore.getState().remove(controller, [id])).resolves.toBeUndefined()
    expect(useOfflineStore.getState().progress[id]).toBeUndefined()
  })
})

describe('offlineStore settled downloads', () => {
  beforeEach(() => useOfflineStore.setState({ settled: [] }))

  test('a trail\'s download settles once, after every pack', async () => {
    const a = packId(1, 'a')
    const b = packId(1, 'b')
    const finish: Record<string, (i: OfflinePackInfo) => void> = {}
    const controller = makeController({ onSubscribe: (id, onProgress) => { finish[id] = onProgress } })
    useOfflineStore.getState().download(controller, descriptor(a))
    useOfflineStore.getState().download(controller, descriptor(b))
    await flush()
    finish[a](info(a, 'complete', 100))
    await flush()
    expect(useOfflineStore.getState().settled).toEqual([])
    finish[b](info(b, 'complete', 100))
    await flush()
    expect(useOfflineStore.getState().settled).toEqual([{ trailId: 1, failed: false }])
  })

  test('one failed pack makes the trail\'s download failed', async () => {
    const a = packId(1, 'a')
    const b = packId(1, 'b')
    const controller = makeController({
      onSubscribe: (id, onProgress, onError) =>
        id === a ? onProgress(info(id, 'complete', 100)) : onError(id, 'boom'),
    })
    useOfflineStore.getState().download(controller, descriptor(a))
    useOfflineStore.getState().download(controller, descriptor(b))
    await flush()
    expect(useOfflineStore.getState().settled).toEqual([{ trailId: 1, failed: true }])
  })

  test('a completion seen by both the progress callback and the reconcile counts once', async () => {
    const a = packId(1, 'a')
    const controller = makeController({
      packs: [info(a, 'complete', 100)],
      onSubscribe: (id, onProgress) => onProgress(info(id, 'complete', 100)),
    })
    useOfflineStore.getState().download(controller, descriptor(a))
    await flush()
    await flush()
    expect(useOfflineStore.getState().settled).toEqual([{ trailId: 1, failed: false }])
  })

  test('a failed kickoff settles the download as failed', async () => {
    const a = packId(1, 'a')
    const controller = makeController()
    controller.downloadPack = async () => { throw new Error('offline') }
    useOfflineStore.getState().download(controller, descriptor(a))
    await flush()
    expect(useOfflineStore.getState().settled).toEqual([{ trailId: 1, failed: true }])
  })

  test('canceling a download settles nothing', async () => {
    const a = packId(1, 'a')
    const controller = makeController({ onSubscribe: (id, onProgress) => onProgress(info(id, 'incomplete', 30)) })
    useOfflineStore.getState().download(controller, descriptor(a))
    await flush()
    await useOfflineStore.getState().removeForTrail(controller, 1)
    expect(useOfflineStore.getState().settled).toEqual([])
  })

  const partlyFinished = async () => {
    const a = packId(1, 'a')
    const b = packId(1, 'b')
    const controller = makeController({
      onSubscribe: (id, onProgress) => onProgress(info(id, id === a ? 'complete' : 'incomplete', id === a ? 100 : 30)),
    })
    useOfflineStore.getState().download(controller, descriptor(a))
    useOfflineStore.getState().download(controller, descriptor(b))
    await flush()
    expect(useOfflineStore.getState().settled).toEqual([])
    return { a, b, controller }
  }

  test('removing the last pending layer settles nothing: the remove shows its own toast', async () => {
    const { b, controller } = await partlyFinished()
    await useOfflineStore.getState().remove(controller, [b])
    expect(useOfflineStore.getState().settled).toEqual([])
  })

  test.each([
    ['finished layer first', true],
    ['pending layer first', false],
  ])('canceling a partly finished download settles nothing (%s)', async (_, finishedFirst) => {
    const { a, b, controller } = await partlyFinished()
    await useOfflineStore.getState().remove(controller, finishedFirst ? [a, b] : [b, a])
    expect(useOfflineStore.getState().settled).toEqual([])
  })

  test('a layer removed mid-download leaves the rest of the download to settle on its own', async () => {
    const a = packId(1, 'a')
    const b = packId(1, 'b')
    const finish: Record<string, (i: OfflinePackInfo) => void> = {}
    const controller = makeController({ onSubscribe: (id, onProgress) => { finish[id] = onProgress } })
    useOfflineStore.getState().download(controller, descriptor(a))
    useOfflineStore.getState().download(controller, descriptor(b))
    await flush()
    await useOfflineStore.getState().remove(controller, [a])
    finish[b](info(b, 'complete', 100))
    await flush()
    expect(useOfflineStore.getState().settled).toEqual([{ trailId: 1, failed: false }])
  })

  test('downloads of two trails settle separately', async () => {
    const controller = makeController({ onSubscribe: (id, onProgress) => onProgress(info(id, 'complete', 100)) })
    useOfflineStore.getState().download(controller, descriptor(packId(1, 'a')))
    useOfflineStore.getState().download(controller, descriptor(packId(2, 'a')))
    await flush()
    expect(useOfflineStore.getState().settled).toEqual([
      { trailId: 1, failed: false },
      { trailId: 2, failed: false },
    ])
  })

  test('dismissSettled drops only the events it is given', async () => {
    const first = { trailId: 1, failed: false }
    const second = { trailId: 2, failed: true }
    useOfflineStore.setState({ settled: [first, second] })
    useOfflineStore.getState().dismissSettled([first])
    expect(useOfflineStore.getState().settled).toEqual([second])
  })
})

describe('offlineStore download failures in the debug log', () => {
  beforeEach(() => jest.mocked(logEvent).mockClear())

  test('a pack failing mid-download is logged, without the SDK message', async () => {
    const controller = makeController({ onSubscribe: (id, _p, onError) => onError(id, 'pack trail-1 failed') })
    useOfflineStore.getState().download(controller, descriptor(packId(1, 'a')))
    await flush()
    expect(logEvent).toHaveBeenCalledWith('warn', 'error', 'download failed', { stage: 'progress' })
  })

  test('a kickoff that rejects is logged by its class', async () => {
    const controller = makeController()
    controller.downloadPack = async () => { throw new TypeError('network request failed') }
    useOfflineStore.getState().download(controller, descriptor(packId(1, 'a')))
    await flush()
    expect(logEvent).toHaveBeenCalledWith('warn', 'error', 'download failed', { stage: 'start', errorClass: 'TypeError' })
  })

  test('a download that completes logs nothing', async () => {
    const controller = makeController({ onSubscribe: (id, onProgress) => onProgress(info(id, 'complete', 100)) })
    useOfflineStore.getState().download(controller, descriptor(packId(1, 'a')))
    await flush()
    expect(logEvent).not.toHaveBeenCalled()
  })
})
