import React from 'react'
import Svg, { Path } from 'react-native-svg'

// Ported from ../on-foot/app/src/main/res/drawable/ic_north.xml (viewport 28x72.153).
// The compass needle is inherently two-tone in the original asset (red north tip,
// gray south tail), so the fixed fillColors are preserved rather than tinted by `color`.
// `color` is accepted for API parity with the other icons but is intentionally unused here.
export const NorthIcon = ({ size = 20 }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 28 72.153">
    <Path d="M14 0L0 36.153289794921875L28 36L14 0" fill="#CF0101" />
    <Path d="M14 72.15328979492188L28 36L0 36.153289794921875L14 72.15328979492188" fill="#BBBBBB" />
  </Svg>
)
