import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { IconButton } from '../components/IconButton'
import { RecordingFigures } from '../recording/RecordingFigures'
import { RecordingWarningLine } from '../recording/RecordingWarningLine'
import type { PillContent } from './pillContent'

const PILL_TOP_GAP = 8
const PILL_MARGIN = 12

// The Map's top slot, one sentence per state (pillContent). It reports its bottom edge, which the
// camera keeps the framed or followed subject below.
export function MapStatusPill({
  content,
  onClear,
  onMeasure,
}: {
  content: Exclude<PillContent, { kind: 'none' }>
  onClear: () => void
  onMeasure: (bottom: number) => void
}) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const paused = content.kind === 'paused'
  return (
    <View
      style={[styles.wrap, { top: insets.top + PILL_TOP_GAP }]}
      pointerEvents="box-none"
      onLayout={(e) => onMeasure(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
    >
      <View
        style={[
          styles.pill,
          content.kind === 'figures' || paused ? styles.figuresPill : styles.sentencePill,
          { backgroundColor: paused ? c.pillPausedSurface : c.pillSurface },
        ]}
      >
        {content.kind === 'trail' || content.kind === 'activity' ? (
          <View style={styles.sentence}>
            <Text style={[styles.name, { color: c.onSurface }]} numberOfLines={1}>{content.name}</Text>
            <Text style={[styles.detail, { color: c.onSurfaceVariant }]} numberOfLines={1}> · {content.detail}</Text>
            <IconButton icon="close" color={c.onSurfaceVariant} accessibilityLabel={content.clearLabel} onPress={onClear} />
          </View>
        ) : (
          <>
            {paused && <Text style={[styles.paused, { color: c.onSurface }]}>⏸ Paused</Text>}
            <RecordingFigures />
            {content.kind === 'figures' && content.warning && <RecordingWarningLine warning={content.warning} />}
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: PILL_MARGIN, right: PILL_MARGIN, alignItems: 'center' },
  pill: { maxWidth: '100%', borderRadius: 24, boxShadow: MapTokens.floatingShadow },
  figuresPill: { alignSelf: 'stretch', paddingVertical: 8, paddingHorizontal: 12 },
  // The ✕'s own 44 dp target is the sentence's height and right edge.
  sentencePill: { paddingLeft: 16 },
  sentence: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  detail: { fontSize: 15 },
  paused: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
})
