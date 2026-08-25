import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme/useTheme'

export function OfflineActionsMenu({
  items,
  onClose,
}: {
  items: { label: string; danger?: boolean; onPress: () => void }[]
  onClose: () => void
}) {
  const c = useTheme()
  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[styles.menu, { backgroundColor: c.surface, borderColor: c.panelDivider }]}>
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
    </>
  )
}

const styles = StyleSheet.create({
  // Extends well beyond the small anchor so a tap anywhere on the sheet dismisses the menu.
  backdrop: { position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000 },
  // Opens upward from just above the ⋮ (bottom: '100%' of the anchor) so it never runs under the
  // bottom tab bar when the sheet sits low.
  menu: {
    position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, minWidth: 190, borderWidth: 1,
    borderRadius: 10, paddingVertical: 4, elevation: 8, shadowColor: '#000', shadowOpacity: 0.25,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, zIndex: 10,
  },
  item: { paddingVertical: 10, paddingHorizontal: 14 },
})
