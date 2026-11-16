const mockAddTrail = jest.fn()

jest.mock('../../data/trails/gpx/readFile', () => ({
  ...jest.requireActual('../../data/trails/gpx/readFile'),
  readGpxFile: jest.fn(),
}))
jest.mock('../../store/trailsStore', () => ({
  useTrailsStore: { getState: () => ({ addTrail: mockAddTrail }) },
}))
jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))

import { GpxReadError, readGpxFile } from '../../data/trails/gpx/readFile'
import { logEvent } from '../../log'
import { importTrail, readTrailFile } from '../importTrail'

const read = jest.mocked(readGpxFile)

const titled = `<?xml version="1.0"?>
<gpx><trk><name>Col de la Croix</name><trkseg>
<trkpt lat="45.0" lon="6.0"><ele>1000</ele></trkpt>
<trkpt lat="45.01" lon="6.0"><ele>1100</ele></trkpt>
</trkseg></trk></gpx>`

const untitled = titled.replace('<name>Col de la Croix</name>', '')

beforeEach(() => {
  jest.clearAllMocks()
  mockAddTrail.mockResolvedValue(42)
})

describe('readTrailFile', () => {
  it('names the trail after the GPX title over the file name', async () => {
    read.mockResolvedValue(titled)
    const reading = await readTrailFile('file:///a.gpx', 'a.gpx')
    expect(reading.ok && reading.file.name).toBe('Col de la Croix')
  })

  it('falls back to the file name when the GPX has no title', async () => {
    read.mockResolvedValue(untitled)
    const reading = await readTrailFile('file:///a.gpx', 'a.gpx')
    expect(reading.ok && reading.file.name).toBe('a.gpx')
  })

  it('measures the route it read', async () => {
    read.mockResolvedValue(titled)
    const reading = await readTrailFile('file:///a.gpx', null)
    if (!reading.ok) throw new Error('expected a reading')
    expect(reading.file.metrics.distanceMeters).toBeCloseTo(1112, -1)
    expect(reading.file.metrics.elevationGainMeters).toBe(100)
    expect(reading.file.geometry.segments).toHaveLength(1)
  })

  it('refuses an unreadable file and logs it', async () => {
    read.mockRejectedValue(new GpxReadError(new Error('Permission Denial')))
    expect(await readTrailFile('file:///gone.gpx', null)).toEqual({ ok: false, failure: 'read' })
    expect(logEvent).toHaveBeenCalledWith('error', 'error', 'gpx import failed, file could not be read', {
      errorClass: 'Error',
    })
  })

  it('refuses a file that is not GPX', async () => {
    read.mockResolvedValue('<html></html>')
    expect(await readTrailFile('file:///a.gpx', null)).toEqual({ ok: false, failure: 'format' })
  })
})

describe('importTrail', () => {
  it('adds the trail under the name the request gives, with its difficulty', async () => {
    read.mockResolvedValue(titled)
    const result = await importTrail({ uri: 'file:///a.gpx', name: 'DEVCHECK climb', difficulty: 'hard' })
    expect(result).toEqual({ ok: true, id: 42 })
    expect(mockAddTrail).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'DEVCHECK climb', difficulty: 'hard', description: null }),
    )
  })

  it('adds nothing for an unreadable file', async () => {
    read.mockRejectedValue(new GpxReadError(new Error('ENOENT')))
    const result = await importTrail({ uri: 'file:///gone.gpx', name: 'DEVCHECK climb', difficulty: 'easy' })
    expect(result).toEqual({ ok: false, failure: 'read' })
    expect(mockAddTrail).not.toHaveBeenCalled()
  })
})
