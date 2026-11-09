import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../theme/useTheme'
import type { ActionItem } from './actionItem'
import { menuPlacement } from './menuPlacement'

// The ⋮ button's frame in window coordinates: its right edge, top and bottom.
export interface MenuAnchor {
  right: number
  top: number
  bottom: number
}

const GAP = 6

// Rendered in a Modal so it escapes the bottom sheet and any list (neither can clip it). It lays
// out hidden once to learn its height, then opens up or down from the anchor to fit on screen.
export function ActionsMenu({
  items,
  anchor,
  onClose,
}: {
  items: ActionItem[]
  anchor: MenuAnchor
  onClose: () => void
}) {
  const c = useTheme()
  const win = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [menuHeight, setMenuHeight] = useState<number | null>(null)
  const placement =
    menuHeight == null
      ? null
      : menuPlacement({
          anchorTop: anchor.top,
          anchorBottom: anchor.bottom,
          menuHeight,
          windowHeight: win.height,
          gap: GAP,
          marginTop: insets.top + GAP,
          marginBottom: insets.bottom + GAP,
        })
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <View
        onLayout={(e) => setMenuHeight(e.nativeEvent.layout.height)}
        style={[
          styles.menu,
          {
            backgroundColor: c.surface,
            borderColor: c.panelDivider,
            right: win.width - anchor.right,
            top: placement?.top ?? 0,
            opacity: placement ? 1 : 0,
          },
        ]}
      >
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityLabel={item.label}
            onPress={() => {
              onClose()
              item.onPress()
            }}
            style={styles.item}
          >
            <Text style={{ color: item.danger ? c.danger : c.panelContent, fontSize: 15 }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute', minWidth: 200, borderWidth: 1, borderRadius: 10, paddingVertical: 4,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  item: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
})
