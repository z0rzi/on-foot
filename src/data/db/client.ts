import { drizzle } from 'drizzle-orm/expo-sqlite'
import { openDatabaseSync } from 'expo-sqlite'
import * as schema from './schema'

const sqliteDatabase = openDatabaseSync('onfoot.db')
export const db = drizzle(sqliteDatabase, { schema })

// A consistent copy of the whole database into a file that does not exist yet. Synchronous, as the
// app's transactions are, so it never lands inside one.
export function copyDatabaseInto(path: string): void {
  sqliteDatabase.runSync('VACUUM INTO ?', [path])
}
