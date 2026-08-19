import React from 'react'
import Svg, { G, Path } from 'react-native-svg'

// Ported from ../on-foot/app/src/main/res/drawable/ic_position.xml (viewport 47x47).
// The original wraps its 5 paths in a <group android:translateX="-2324" android:translateY="2">;
// each pathData string is copied verbatim and the same translate is applied via an <G transform>.
export const PositionIcon = ({ size = 20, color = '#000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 47 47">
    <G transform="translate(-2324, 2)">
      <Path
        d="M2347.5 35.208335876464844C2355.07080078125 35.208335876464844 2361.208251953125 29.0709171295166 2361.208251953125 21.5C2361.208251953125 13.92910385131836 2355.07080078125 7.791666507720947 2347.5 7.791666507720947C2339.92919921875 7.791666507720947 2333.791748046875 13.92910385131836 2333.791748046875 21.5C2333.791748046875 29.0709171295166 2339.92919921875 35.208335876464844 2347.5 35.208335876464844Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M2347.5 35.208335876464844L2347.5 39.125"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M2333.791748046875 21.5L2329.875 21.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M2347.5 7.791666507720947L2347.5 3.875"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M2361.208251953125 21.5L2365.125 21.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
  </Svg>
)
