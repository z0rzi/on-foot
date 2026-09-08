export interface PlanRow {
  styleId: string
  downloaded: boolean
  estimateBytes: number | null
}

export interface OfflinePlan {
  adds: string[]
  removes: string[]
  toDownloadBytes: number
  hasChanges: boolean
}

export function seedSelection(downloadedIds: string[], currentStyleId: string): Set<string> {
  return new Set(downloadedIds.length ? downloadedIds : [currentStyleId])
}

export function planOfflineChanges(rows: PlanRow[], selected: ReadonlySet<string>): OfflinePlan {
  const addRows = rows.filter((r) => selected.has(r.styleId) && !r.downloaded)
  const removes = rows.filter((r) => !selected.has(r.styleId) && r.downloaded).map((r) => r.styleId)
  const adds = addRows.map((r) => r.styleId)
  const toDownloadBytes = addRows.reduce((sum, r) => sum + (r.estimateBytes ?? 0), 0)
  return { adds, removes, toDownloadBytes, hasChanges: adds.length > 0 || removes.length > 0 }
}
