import React from 'react'
import Svg, { Rect } from 'react-native-svg'

export const StopIcon = ({ size = 20, color = '#000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="6" y="6" width="12" height="12" rx="2" fill={color} />
  </Svg>
)
