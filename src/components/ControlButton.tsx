import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'

export function ControlButton({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode
  onPress: () => void
  accessibilityLabel: string
}) {
  const c = useTheme()
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.btn, { backgroundColor: c.controlSurface }]}
    >
      <View>{children}</View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: MapTokens.controlSize,
    height: MapTokens.controlSize,
    borderRadius: MapTokens.controlSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
})
