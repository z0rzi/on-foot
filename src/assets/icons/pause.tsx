import React from 'react'
import Svg, { Rect } from 'react-native-svg'

export const PauseIcon = ({ size = 20, color = '#000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="6" y="5" width="4" height="14" rx="1.5" fill={color} />
    <Rect x="14" y="5" width="4" height="14" rx="1.5" fill={color} />
  </Svg>
)
