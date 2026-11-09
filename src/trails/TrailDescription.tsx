import { StyleSheet, Text, View } from 'react-native'
import { Trail } from '../data/trails/types'
import { useTheme } from '../theme/useTheme'

// A trail's description, as the trail card and the recording card show it. Set apart, it reads as
// reference beside live figures: behind a divider, in the secondary text.
export function TrailDescription({ trail, setApart = false }: { trail: Trail; setApart?: boolean }) {
  const c = useTheme()
  if (trail.description == null) return null
  if (!setApart) {
    return <Text style={[styles.description, { color: c.panelContent }]}>{trail.description}</Text>
  }
  return (
    <View style={[styles.apart, { borderTopColor: c.panelDivider }]}>
      <Text style={[styles.apartText, { color: c.onSurfaceVariant }]}>{trail.description}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  description: { fontSize: 14, lineHeight: 20 },
  apart: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  apartText: { fontSize: 13, lineHeight: 18 },
})
