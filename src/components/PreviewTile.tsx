import React from 'react'
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/useTheme'
import { rowsOf } from './rowsOf'

const COLUMNS = 3

// A choice shown by its preview, its title under it: one of a set (radio) or on or off (checkbox).
export function PreviewTile({
  preview,
  title,
  role,
  checked,
  accessibilityLabel,
  onPress,
  children,
}: {
  preview: ImageSourcePropType
  title: string
  role: 'radio' | 'checkbox'
  checked: boolean
  accessibilityLabel: string
  onPress: () => void
  // Under the title, as a status line.
  children?: React.ReactNode
}) {
  const c = useTheme()
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.tile}
    >
      <View style={[styles.frame, { borderColor: checked ? c.controlAccent : c.panelDivider }]}>
        <Image source={preview} style={styles.preview} resizeMode="cover" />
        {role === 'checkbox' ? (
          <View style={[styles.mark, { backgroundColor: c.panelBackground }]}>
            <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? c.controlAccent : c.onSurfaceVariant} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.title, { color: checked ? c.controlAccent : c.panelContent }]} numberOfLines={1}>
        {title}
      </Text>
      {children}
    </Pressable>
  )
}

// Tiles side by side, three to a row, as wide in a short row as in a full one.
export function PreviewTileGrid({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.grid}>
      {rowsOf(React.Children.toArray(children), COLUMNS).map((row, index) => (
        <View key={index} style={styles.row}>
          {row}
          {Array.from({ length: COLUMNS - row.length }, (_, i) => (
            <View key={`spacer-${i}`} style={styles.tile} />
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, alignItems: 'center', gap: 4 },
  frame: { width: '100%', aspectRatio: 1, borderWidth: 2, borderRadius: 12, overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
  mark: { position: 'absolute', top: 4, right: 4, borderRadius: 4 },
  title: { fontSize: 13, fontWeight: '600' },
})
