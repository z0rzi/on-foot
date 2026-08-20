import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const trails = sqliteTable('trails', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  difficulty: text('difficulty').notNull(),
  distanceMeters: real('distance_meters').notNull(),
  elevationGainMeters: real('elevation_gain_meters').notNull(),
  elevationLossMeters: real('elevation_loss_meters').notNull(),
  description: text('description'),
  geometry: text('geometry').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})
