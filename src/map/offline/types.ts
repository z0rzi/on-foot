export type LngLatBounds = { ne: [number, number]; sw: [number, number] }

export type LayerKind = 'vector' | 'raster'

export interface SizeEstimate {
  bytes: number
  tileCount: number
}

export interface OfflineLayerRow {
  styleId: string
  sizeBytes: number
}

export interface OfflineTrailGroup {
  trailId: number
  trailName: string | null
  layers: OfflineLayerRow[]
  totalBytes: number
}

export type OfflineBadgeState =
  | { kind: 'none' }
  | { kind: 'downloading'; pct: number }
  | { kind: 'available'; styleIds: string[] }
  | { kind: 'failed' }

export interface LiveProgress {
  percentage: number
  failed: boolean
}
