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
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
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
  menu: {
    position: 'absolute', top: 34, right: 0, minWidth: 190, borderWidth: 1, borderRadius: 10,
    paddingVertical: 4, elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, zIndex: 10,
  },
  item: { paddingVertical: 10, paddingHorizontal: 14 },
})
