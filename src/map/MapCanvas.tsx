import React from 'react'
import { StyleSheet } from 'react-native'
import { useMapProvider, useMapCapabilities } from './provider'
import { useMapStore } from '../store/mapStore'
import { MapTokens } from '../theme/tokens'

export function MapCanvas() {
  const { components } = useMapProvider()
  const caps = useMapCapabilities()
  const styleId = useMapStore((s) => s.mapStyleId)
  const style = caps.styles.find((s) => s.id === styleId) ?? caps.styles[0]
  const { View: MapView, Camera, Terrain, UserPuck } = components

  return (
    <MapView style={StyleSheet.absoluteFill} styleURL={style.url}>
      <Camera followUserLocation={false} />
      {caps.supportsTerrain && <Terrain exaggeration={MapTokens.terrainExaggeration} />}
      <UserPuck />
    </MapView>
  )
}
