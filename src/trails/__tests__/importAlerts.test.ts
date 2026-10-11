import { classifyGpxFailure, gpxImportAlert } from '../importAlerts'
import { GpxReadError } from '../../data/trails/gpx/readFile'
import { GpxError } from '../../data/trails/gpx/parse'

describe('classifyGpxFailure', () => {
  it('names a read failure', () => {
    expect(classifyGpxFailure(new GpxReadError(new Error('Permission Denial')))).toBe('read')
  })

  it('names a format failure', () => {
    expect(classifyGpxFailure(new GpxError('format', 'GPX point missing lat/lon'))).toBe('format')
  })

  it('names an empty file', () => {
    expect(classifyGpxFailure(new GpxError('empty', 'no track or route points'))).toBe('empty')
  })

  it('falls back to format for anything unrecognised', () => {
    expect(classifyGpxFailure(new Error('boom'))).toBe('format')
    expect(classifyGpxFailure('not even an error')).toBe('format')
  })
})

describe('gpxImportAlert', () => {
  it('names a read failure instead of a format verdict', () => {
    expect(gpxImportAlert('read')).toEqual({
      title: 'Could not open the file',
      message: 'The file could not be read. It may have moved, or this app may not have permission to open it.',
    })
  })

  it('reports a format failure as not a GPX file', () => {
    expect(gpxImportAlert('format')).toEqual({
      title: 'Not a GPX file',
      message: 'This file could not be read as GPX.',
    })
  })

  it('reports an empty file as having no route', () => {
    expect(gpxImportAlert('empty')).toEqual({
      title: 'No route found',
      message: 'This GPX file has no route or track points to import.',
    })
  })
})
