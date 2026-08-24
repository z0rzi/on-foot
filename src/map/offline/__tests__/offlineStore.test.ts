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

  test('removeForTrail deletes only that trail\'s packs', async () => {
    const controller = makeController({ packs: [info(packId(5, 'a')), info(packId(5, 'b')), info(packId(6, 'a'))] })
    await useOfflineStore.getState().removeForTrail(controller, 5)
    expect(controller.deleted.sort()).toEqual([packId(5, 'a'), packId(5, 'b')])
  })
})
