import AsyncStorage from '@react-native-async-storage/async-storage'
import { Directory, File } from 'expo-file-system'
import { copyDatabaseInto } from '../data/db/client'
import { fileUri, hookFolderPath } from './hookFolder'
import type { SnapshotFiles } from './hooks'
import { preferencesSnapshot } from './preferencesSnapshot'

const DATABASE = 'snapshot.db'
const PREFERENCES = 'snapshot-preferences.json'

function removeIfPresent(path: string): void {
  const file = new File(fileUri(path))
  if (file.exists) file.delete()
}

// The database's consistent copy and the stored preferences, into the hook folder for the toolkit
// to pull and delete. A snapshot left there by an earlier one is replaced.
export async function takeSnapshot(): Promise<SnapshotFiles> {
  const folder = hookFolderPath()
  const files = { database: `${folder}/${DATABASE}`, preferences: `${folder}/${PREFERENCES}` }
  removeIfPresent(files.database)
  removeIfPresent(files.preferences)
  copyDatabaseInto(files.database)
  const preferences = preferencesSnapshot(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys()))
  // Created through the folder: a file that does not exist yet fails expo-file-system's write check.
  new Directory(fileUri(folder)).createFile(PREFERENCES, 'application/json').write(JSON.stringify(preferences, null, 2))
  return files
}
