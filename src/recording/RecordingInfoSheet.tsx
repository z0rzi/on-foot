import { StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Trail } from '../data/trails/types'
import type { RouteDisplay } from '../elevation/routeDisplay'
import { trailAhead } from '../elevation/trailAhead'
import { useTheme } from '../theme/useTheme'
import { IconButton } from '../components/IconButton'
import { showToast } from '../components/toast'
import { TrailDescription } from '../trails/TrailDescription'
import { TrailSummaryRow } from '../trails/TrailSummaryRow'
import { formatTrailAhead, type AheadLineKind } from '../trails/format'
import { usePersonalFactor } from './usePersonalFactor'

const AHEAD_ICONS: Record<AheadLineKind, keyof typeof MaterialCommunityIcons.glyphMap> = {
  end: 'flag-checkered',
  climb: 'image-filter-hdr',
  offTrail: 'map-marker-off',
}

// The open sheet's details while recording along a trail: that trail with its summary as the Trails
// list shows it and a way to end it, what is ahead on it from the graph's puck, and its description
// set apart. The figures and the location state are the top pill's. A trail with no elevation
// profile has no route display, so no ahead lines; with a display but no puck, the one line says
// the walk is not on the trail. Their icons are decorative, out of the accessibility tree: the text
// carries the meaning.
export function RecordingInfoSheet({
  trail,
  display,
  puck,
  onRemoveTrail,
}: {
  trail: Trail
  display: RouteDisplay | null
  puck: number | null
  onRemoveTrail: () => void
}) {
  const c = useTheme()
  const personalFactor = usePersonalFactor()
  return (
    <>
      <View style={styles.along}>
        <View style={styles.trail}>
          <Text style={[styles.alongText, { color: c.onSurface }]}>
            Along {trail.name}
          </Text>
          <TrailSummaryRow trail={trail} />
        </View>
        <IconButton
          icon="close"
          color={c.onSurfaceVariant}
          accessibilityLabel="Stop recording along this trail"
          onPress={() => {
            onRemoveTrail()
            showToast('Recording without a trail')
          }}
        />
      </View>

      {display && (
        <View style={styles.ahead}>
          {formatTrailAhead(puck === null ? null : trailAhead(display, puck, personalFactor)).map((line) => (
            <View key={line.kind} style={styles.aheadLine}>
              <MaterialCommunityIcons
                name={AHEAD_ICONS[line.kind]}
                size={18}
                color={c.onSurface}
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={[styles.aheadText, { color: c.onSurface }]}>{line.text}</Text>
            </View>
          ))}
        </View>
      )}

      <TrailDescription trail={trail} setApart />
    </>
  )
}

const styles = StyleSheet.create({
  along: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trail: { flexShrink: 1, gap: 2 },
  alongText: { fontSize: 15, fontWeight: '600' },
  ahead: { gap: 4 },
  aheadLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aheadText: { fontSize: 15, flexShrink: 1 },
})
