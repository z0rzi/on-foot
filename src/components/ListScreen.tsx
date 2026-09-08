import { ReactElement, ReactNode } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../theme/useTheme'

export function ListScreen<T>({
  title,
  items,
  keyOf,
  renderItem,
  emptyMessage,
  footer,
}: {
  title: string
  items: T[]
  keyOf: (item: T) => string
  renderItem: (item: T) => ReactElement
  emptyMessage: string
  footer?: ReactNode
}) {
  const c = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.screen, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: c.onSurface }]}>{title}</Text>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: c.onSurfaceVariant, fontSize: 16 }}>{emptyMessage}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyOf}
          renderItem={({ item }) => renderItem(item)}
          contentContainerStyle={styles.list}
        />
      )}
      {footer ? <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>{footer}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 8, paddingVertical: 8 },
})
