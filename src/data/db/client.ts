import { drizzle } from 'drizzle-orm/expo-sqlite'
import { openDatabaseSync } from 'expo-sqlite'
import * as schema from './schema'

const sqliteDatabase = openDatabaseSync('onfoot.db')
export const db = drizzle(sqliteDatabase, { schema })
