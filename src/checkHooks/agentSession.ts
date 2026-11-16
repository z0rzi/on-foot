import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AgentSessionRecord } from './hook'

const KEY = 'onfoot-agent-session'

// The one id a recording can have at a time (the sessions table holds one row), and session ids are
// never reused, so a kept id left by a save through the screen matches no later session. Read and
// written directly, not through a store: only the hooks read it, and a hook's reply waits for its
// write.
export const agentSessionRecord: AgentSessionRecord = {
  read: async () => {
    const value = Number(await AsyncStorage.getItem(KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  },
  keep: (sessionId) => AsyncStorage.setItem(KEY, String(sessionId)),
  drop: () => AsyncStorage.removeItem(KEY),
}
