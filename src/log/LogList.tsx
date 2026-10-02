import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Share, StyleSheet, Text, View } from 'react-native'
import { LogEntry, logRepository } from '../data/log'
import { AccentButton } from '../components/AccentButton'
import { useTheme } from '../theme/useTheme'
import { formatClockSeconds } from '../activities/format'
import { deviceInfo } from './deviceInfo'
import { logExportText } from './logExportText'
import { LOG_MAX_ENTRIES } from './retention'

export function LogList() {
  const c = useTheme()
  const [entries, setEntries] = useState<LogEntry[] | null>(null)

  const load = useCallback(() => {
    logRepository
      .list(LOG_MAX_ENTRIES)
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [])

  useEffect(load, [load])

  const share = useCallback(() => {
    if (!entries) return
    void Share.share({ message: logExportText(entries, deviceInfo()) })
  }, [entries])

  const clear = useCallback(() => {
    Alert.alert('Clear the debug log?', 'Every entry is deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          logRepository
            .clear()
            .then(() => setEntries([]))
            .catch(() => Alert.alert('Could not clear the log', 'Please try again.'))
        },
      },
    ])
  }, [])

  if (!entries) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.controlAccent} />
      </View>
    )
  }

  const levelColour = (level: LogEntry['level']) =>
    level === 'error' ? c.danger : level === 'warn' ? c.warning : c.onSurface

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <AccentButton label="Share" onPress={share} />
        <AccentButton label="Clear" onPress={clear} />
      </View>
      <FlatList
        data={entries}
        keyExtractor={(entry) => String(entry.id)}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.onSurfaceVariant }]}>Nothing logged yet.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: c.panelDivider }]}>
            <Text style={[styles.head, { color: levelColour(item.level) }]}>
              {formatClockSeconds(item.t)}  {item.area}  {item.message}
            </Text>
            {item.detail ? (
              <Text style={[styles.detail, { color: c.onSurfaceVariant }]}>{item.detail}</Text>
            ) : null}
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 12 },
  row: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1 },
  head: { fontSize: 13, fontWeight: '600' },
  detail: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 14, textAlign: 'center', padding: 24 },
})
