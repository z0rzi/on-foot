import { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'
import type { MenuAnchor } from './ActionsMenu'
import { ActionsMenuButton } from './ActionsMenuButton'
import { EnumBadge } from './EnumBadge'
import { EnumField } from './enumField'

// An entity card's first row: its name, wrapping, then any marks of its state, then its ⋮.
export function CardTitleRow({
  name,
  actions,
  children,
}: {
  name: string
  actions: { accessibilityLabel: string; onOpen: (anchor: MenuAnchor) => void }
  children?: ReactNode
}) {
  const c = useTheme()
  return (
    <View style={styles.titleRow}>
      <Text style={[styles.name, { color: c.panelContent }]}>{name}</Text>
      {children}
      <ActionsMenuButton accessibilityLabel={actions.accessibilityLabel} onOpen={actions.onOpen} />
    </View>
  )
}

// The row under it: the entity's badge, and beside it a line in the secondary text when given. Not
// EntitySummary: the card sets the badge apart in a row, where a list row runs it into its first line.
export function CardSummaryRow<T extends string>({
  badge,
  text,
}: {
  badge: { field: EnumField<T>; value: T }
  text?: string
}) {
  const c = useTheme()
  return (
    <View style={styles.summaryRow}>
      <EnumBadge field={badge.field} value={badge.value} />
      {text != null && <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>{text}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontWeight: '700', flex: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { fontSize: 13, flexShrink: 1 },
})
