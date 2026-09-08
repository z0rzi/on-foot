import { Ionicons } from '@expo/vector-icons'
import { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'

export function EntityListItem({
  title,
  badge,
  lines,
  onPress,
  pressAccessibilityLabel,
  actions,
}: {
  title: string
  badge?: ReactNode
  lines: string[]
  onPress: () => void
  pressAccessibilityLabel: string
  actions: {
    accessibilityLabel: string
    icon: keyof typeof Ionicons.glyphMap
    color: string
    onPress: () => void
  }[]
}) {
  const c = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Pressable accessibilityLabel={pressAccessibilityLabel} onPress={onPress} style={styles.body}>
        <View style={[styles.thumb, { backgroundColor: c.background }]}>
          <Ionicons name="walk-outline" size={28} color={c.onSurfaceVariant} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: c.onSurface }]} numberOfLines={1}>{title}</Text>
          {badge}
          {lines.map((line, index) => (
            <Text key={index} style={[styles.line, { color: c.onSurfaceVariant }]}>
              {line}
            </Text>
          ))}
        </View>
      </Pressable>
      {actions.map((action) => (
        <Pressable
          key={action.accessibilityLabel}
          accessibilityLabel={action.accessibilityLabel}
          onPress={action.onPress}
          hitSlop={8}
          style={styles.action}
        >
          <Ionicons name={action.icon} size={22} color={action.color} />
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginHorizontal: 16 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: '700' },
  line: { fontSize: 13 },
  action: { padding: 8, marginLeft: 4 },
})
