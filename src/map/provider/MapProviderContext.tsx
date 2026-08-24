import React, { createContext, useContext } from 'react'
import type { MapProvider, MapCapabilities, OfflineController } from './types'

const Ctx = createContext<MapProvider | null>(null)

export function MapProviderProvider({
  provider, children,
}: { provider: MapProvider; children: React.ReactNode }) {
  return <Ctx.Provider value={provider}>{children}</Ctx.Provider>
}

export function useMapProvider(): MapProvider {
  const p = useContext(Ctx)
  if (!p) throw new Error('useMapProvider must be used within MapProviderProvider')
  return p
}

export function useMapCapabilities(): MapCapabilities {
  return useMapProvider().capabilities
}

export function useOfflineController(): OfflineController {
  return useMapProvider().offline
}
