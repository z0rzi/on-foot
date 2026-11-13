jest.mock('../client', () => ({ db: { select: jest.fn(), update: jest.fn() } }))

import { db } from '../client'
import { trails } from '../schema'
import { sqliteTrailsRepository } from '../trailsRepository'

const select = db.select as jest.Mock
const update = db.update as jest.Mock

// The row read for a fill, and the values the fill writes back.
function fillRead(geometry: string): jest.Mock {
  select.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ geometry }]) }) }) })
  const set = jest.fn(() => ({ where: () => Promise.resolve() }))
  update.mockReturnValue({ set })
  return set
}

const summaryRow = {
  id: 3, name: 'Ridge', difficulty: 'hard', distanceMeters: 1200,
  elevationGainMeters: 80, elevationLossMeters: 75, createdAt: 9,
  overviewGeometry: '{"type":"MultiLineString","coordinates":[[[6.1,45.2],[6.2,45.3]]]}',
  startLat: 45.2, startLng: 6.1,
}

beforeEach(() => {
  select.mockReset()
  update.mockReset()
  select.mockReturnValue({ from: () => ({ orderBy: () => Promise.resolve([summaryRow]) }) })
})

test('the trail overview rows read selects columns, never the geometry', async () => {
  await sqliteTrailsRepository.listOverviewRows()
  const selection = select.mock.calls[0][0]
  expect(selection).toBeDefined()
  expect(Object.values(selection)).not.toContain(trails.geometry)
})

test('the trail overview rows map from the selected columns', async () => {
  await expect(sqliteTrailsRepository.listOverviewRows()).resolves.toEqual([{
    id: 3, name: 'Ridge', difficulty: 'hard', createdAt: 9,
    metrics: { distanceMeters: 1200, elevationGainMeters: 80, elevationLossMeters: 75 },
    overviewGeometry: '{"type":"MultiLineString","coordinates":[[[6.1,45.2],[6.2,45.3]]]}',
    start: { lat: 45.2, lng: 6.1 },
  }])
})

test('a trail the backfill has not reached has no overview geometry and no start', async () => {
  select.mockReturnValue({ from: () => ({ orderBy: () => Promise.resolve([
    { ...summaryRow, overviewGeometry: null, startLat: null, startLng: null },
  ]) }) })
  const [row] = await sqliteTrailsRepository.listOverviewRows()
  expect(row.overviewGeometry).toBeNull()
  expect(row.start).toBeNull()
})

test('filling a row stores the overview of its geometry', async () => {
  const set = fillRead('{"segments":[[{"lat":45,"lng":6,"ele":null},{"lat":45,"lng":6.01,"ele":null}]]}')
  await expect(sqliteTrailsRepository.fillOverview(1)).resolves.toEqual({ kind: 'filled' })
  expect(set).toHaveBeenCalledWith({
    overviewGeometry: '{"type":"MultiLineString","coordinates":[[[6,45],[6.01,45]]]}', startLat: 45, startLng: 6,
  })
})

test('a row whose geometry cannot be read is stored with an empty overview', async () => {
  const set = fillRead('{not json')
  await expect(sqliteTrailsRepository.fillOverview(1)).resolves.toMatchObject({ kind: 'unreadable' })
  expect(set).toHaveBeenCalledWith({
    overviewGeometry: '{"type":"MultiLineString","coordinates":[]}', startLat: null, startLng: null,
  })
})

test('a row deleted since it was listed is missing, and nothing is written', async () => {
  select.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) })
  await expect(sqliteTrailsRepository.fillOverview(1)).resolves.toEqual({ kind: 'missing' })
  expect(update).not.toHaveBeenCalled()
})
