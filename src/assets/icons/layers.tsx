import React from 'react'
import Svg, { G, Path } from 'react-native-svg'

// Ported from ../on-foot/app/src/main/res/drawable/ic_layers.xml (viewport 67x67).
// The original wraps its path in a <group android:translateX="-2250" android:translateY="5">;
// pathData is copied verbatim and the same translate is applied via an <G transform>.
export const LayersIcon = ({ size = 20, color = '#000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 67 67">
    <G transform="translate(-2250, 5)">
      <Path
        d="M2308.625 34.08361053466797L2283.5 45.250274658203125L2258.375 34.08361053466797M2308.625 22.916942596435547L2283.5 34.08361053466797L2258.375 22.916942596435547L2283.5 11.750335693359375L2308.625 22.916942596435547Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
  </Svg>
)
