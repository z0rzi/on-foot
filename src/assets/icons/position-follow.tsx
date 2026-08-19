import React from 'react'
import Svg, { G, Path } from 'react-native-svg'

// Ported from ../on-foot/app/src/main/res/drawable/ic_position_follow.xml (viewport 28x36.153).
// The original wraps its path in a <group android:translateX="-2393" android:translateY="-4">;
// pathData is copied verbatim and the same translate is applied via an <G transform>.
export const PositionFollowIcon = ({ size = 20, color = '#000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 28 36.153">
    <G transform="translate(-2393, -4)">
      <Path
        d="M2407,4.000000953674316L2393,40.15328598022461L2407,32L2421,39.999996185302734L2407,4.000000953674316"
        fill={color}
      />
    </G>
  </Svg>
)
