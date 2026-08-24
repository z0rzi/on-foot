import { useOfflineStore } from '../offlineStore'
import { packId } from '../packId'
import type { OfflineController, OfflinePackInfo } from '../../provider/types'

const flush = () => new Promise<void>((r) => setImmediate(r))

const info = (id: string, state: OfflinePackInfo['state'] = 'complete', percentage = 100): OfflinePackInfo => ({
  id, meta: null, state, percentage, sizeBytes: 1,
})

// Fake controller. `subscribe` immediately drives the provided script of progress/error calls,
// so the store's completion/error wiring runs synchronously within a flushed microtask.
function makeController(opts: {
  packs?: OfflinePackInfo[]
  onSubscribe?: (id: string, onProgress: (i: OfflinePackInfo) => void, onError: (id: string, m: string) => void) => void
} = {}): OfflineController & { deleted: string[]; downloaded: string[]; resumed: string[] } {
  const deleted: string[] = []
  const downloaded: string[] = []
  const resumed: string[] = []
  return {
    deleted, downloaded, resumed,
    downloadPack: async (d) => { downloaded.push(d.id) },
    resumePack: async (id) => { resumed.push(id) },
    deletePack: async (id) => { deleted.push(id) },
    listPacks: async () => opts.packs ?? [],
    subscribe: (id, onProgress, onError) => {
      opts.onSubscribe?.(id, onProgress, onError)
      return () => {}
    },
  }
}

beforeEach(() => useOfflineStore.setState({ packs: [], progress: {} }))

describe('offlineStore ownership', () => {
  test('init loads the registry', async () => {
    await useOfflineStore.getState().init(makeController({ packs: [info(packId(1, 'a'))] }))
    expect(useOfflineStore.getState().packs).toHaveLength(1)
  })

  test('download: optimistic progress, then completion clears progress and reloads packs', async () => {
    const controller = makeController({
      packs: [info(packId(1, 'a'))],
      onSubscribe: (id, onProgress) => onProgress(info(id, 'complete', 100)),
    })
    useOfflineStore.getState().download(controller, {
      id: packId(1, 'a'), styleUrl: 'u', bounds: [[1, 1], [0, 0]], minZoom: 10, maxZoom: 16, meta: { trailId: 1, styleId: 'a' },
    })
    await flush()
    expect(controller.downloaded).toEqual([packId(1, 'a')])
    expect(useOfflineStore.getState().progress[packId(1, 'a')]).toBeUndefined()
    expect(useOfflineStore.getState().packs).toHaveLength(1)
  })

  test('download error marks the pack failed', async () => {
    const controller = makeController({ onSubscribe: (id, _p, onError) => onError(id, 'boom') })
    useOfflineStore.getState().download(controller, {
      id: packId(1, 'a'), styleUrl: 'u', bounds: [[1, 1], [0, 0]], minZoom: 10, maxZoom: 16, meta: { trailId: 1, styleId: 'a' },
    })
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

  test('remove deletes the given ids, clears their progress, and reloads', async () => {
    const id = packId(1, 'a')
    useOfflineStore.setState({ progress: { [id]: { percentage: 50, failed: false } } })
    const controller = makeController({ packs: [] })
    await useOfflineStore.getState().remove(controller, [id])
    expect(controller.deleted).toEqual([id])
    expect(useOfflineStore.getState().progress[id]).toBeUndefined()
    expect(useOfflineStore.getState().packs).toEqual([])
  })

  test('removeForTrail deletes only that trail\'s packs', async () => {
    const controller = makeController({ packs: [info(packId(5, 'a')), info(packId(5, 'b')), info(packId(6, 'a'))] })
    await useOfflineStore.getState().removeForTrail(controller, 5)
    expect(controller.deleted.sort()).toEqual([packId(5, 'a'), packId(5, 'b')])
  })
})
