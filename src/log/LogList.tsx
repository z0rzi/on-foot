import { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Share, StyleSheet, Text, View } from 'react-native'
import { LogEntry, logRepository } from '../data/log'
import { AccentButton } from '../components/AccentButton'
import { LoadingScreen } from '../components/LoadingScreen'
import { useTheme } from '../theme/useTheme'
import { formatActivityDate, formatClockSeconds } from '../activities/format'
import { deviceInfo } from './deviceInfo'
import { logEvent } from './logEvent'
import { logExportText } from './logExportText'
import { LOG_MAX_ENTRIES } from './retention'

// The list is newest-first, so an entry opens a day whenever the entry above it falls on another one:
// the date is stated once per day instead of on all 5,000 rows.
function startsADay(entries: LogEntry[], index: number): boolean {
  if (index === 0) return true
  return formatActivityDate(entries[index - 1].t) !== formatActivityDate(entries[index].t)
}

export function LogList() {
  const c = useTheme()
  const [entries, setEntries] = useState<LogEntry[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const load = useCallback(() => {
    logRepository
      .list(LOG_MAX_ENTRIES)
      .then((result) => {
        setLoadFailed(false)
        setEntries(result)
      })
      .catch(() => {
        setLoadFailed(true)
        setEntries([])
      })
  }, [])

  useEffect(load, [load])

  const share = useCallback(() => {
    if (!entries) return
    void Share.share({ message: logExportText(entries, { ...deviceInfo(), exportedAt: Date.now() }) })
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
            .catch((error) => {
              logEvent('error', 'error', 'clearing the log failed', { error: String(error) })
              Alert.alert('Could not clear the log', 'Please try again.')
            })
        },
      },
    ])
  }, [])

  if (!entries) return <LoadingScreen />

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
          <Text style={[styles.empty, { color: c.onSurfaceVariant }]}>
            {loadFailed ? 'Could not load the log.' : 'Nothing logged yet.'}
          </Text>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.row, { borderColor: c.panelDivider }]}>
            {startsADay(entries, index) ? (
              <Text style={[styles.day, { color: c.onSurfaceVariant }]}>{formatActivityDate(item.t)}</Text>
            ) : null}
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
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 12 },
  row: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1 },
  day: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  head: { fontSize: 13, fontWeight: '600' },
  detail: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 14, textAlign: 'center', padding: 24 },
})
