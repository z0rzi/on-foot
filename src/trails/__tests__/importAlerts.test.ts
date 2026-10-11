import { gpxImportAlert } from '../importAlerts'
import { GpxReadError } from '../../data/trails/gpx/readFile'
import { GpxError } from '../../data/trails/gpx/parse'

describe('gpxImportAlert', () => {
  it('names a read failure instead of a format verdict', () => {
    expect(gpxImportAlert(new GpxReadError(new Error('Permission Denial')))).toEqual({
      title: 'Could not open the file',
      message: 'The file could not be read. It may have moved, or this app may not have permission to open it.',
    })
  })

  it('reports a format failure as not a GPX file', () => {
    expect(gpxImportAlert(new GpxError('format', 'GPX point missing lat/lon'))).toEqual({
      title: 'Not a GPX file',
      message: 'This file could not be read as GPX.',
    })
  })

  it('reports an empty file as having no route', () => {
    expect(gpxImportAlert(new GpxError('empty', 'no track or route points'))).toEqual({
      title: 'No route found',
      message: 'This GPX file has no route or track points to import.',
    })
  })

  it('falls back to the format wording for anything unrecognised', () => {
    expect(gpxImportAlert(new Error('boom'))).toEqual({
      title: 'Not a GPX file',
      message: 'This file could not be read as GPX.',
    })
    expect(gpxImportAlert('not even an error')).toEqual({
      title: 'Not a GPX file',
      message: 'This file could not be read as GPX.',
    })
  })
})
