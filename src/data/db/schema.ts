import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const trails = sqliteTable('trails', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  difficulty: text('difficulty').notNull(),
  distanceMeters: real('distance_meters').notNull(),
  elevationGainMeters: real('elevation_gain_meters'),
  elevationLossMeters: real('elevation_loss_meters'),
  description: text('description'),
  geometry: text('geometry').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const activities = sqliteTable('activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  effort: text('effort').notNull(),
  comments: text('comments'),
  linkedTrailId: integer('linked_trail_id'),
  geometry: text('geometry').notNull(),
  distanceMeters: real('distance_meters').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  elevationGainMeters: real('elevation_gain_meters'),
  elevationLossMeters: real('elevation_loss_meters'),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at').notNull(),
  createdAt: integer('created_at').notNull(),
})

// The singleton column carries a constant 1 and is uniquely indexed, so at most one
// recording session can ever exist — the durable "an unfinished activity exists" invariant
// enforced structurally, not by convention.
export const recordingSessions = sqliteTable(
  'recording_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    linkedTrailId: integer('linked_trail_id'),
    pausedAt: integer('paused_at'),
    pausedMs: integer('paused_ms').notNull().default(0),
    currentSegment: integer('current_segment').notNull().default(0),
    singleton: integer('singleton').notNull().default(1),
  },
  (table) => ({
    singletonUnique: uniqueIndex('recording_sessions_singleton_unique').on(table.singleton),
  }),
)

export const recordingPoints = sqliteTable('recording_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  ele: real('ele'),
  t: integer('t').notNull(),
  segment: integer('segment').notNull().default(0),
})
