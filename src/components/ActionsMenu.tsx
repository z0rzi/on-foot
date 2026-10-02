import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'

export interface ActionItem {
  label: string
  danger?: boolean
  onPress: () => void
}

// Rendered in a Modal so it escapes the bottom sheet and the tab bar (neither can clip it), then
// positioned so its bottom-right sits just above the anchor (the ⋮ button) — the menu opens upward.
export function ActionsMenu({
  items,
  anchor,
  onClose,
}: {
  items: ActionItem[]
  anchor: { x: number; y: number }
  onClose: () => void
}) {
  const c = useTheme()
  const win = Dimensions.get('window')
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <View
        style={[
          styles.menu,
          { backgroundColor: c.surface, borderColor: c.panelDivider, right: win.width - anchor.x, bottom: win.height - anchor.y + 6 },
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
            <Text style={{ color: item.danger ? c.danger : c.panelContent, fontSize: 13 }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute', minWidth: 190, borderWidth: 1, borderRadius: 10, paddingVertical: 4,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  item: { paddingVertical: 10, paddingHorizontal: 14 },
})
