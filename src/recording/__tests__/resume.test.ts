import { resumeActionFor } from '../resume'

describe('resumeActionFor', () => {
  it('no session → none', () => {
    expect(resumeActionFor(null)).toBe('none')
  })
  it('endedAt null → resume', () => {
    expect(resumeActionFor({ id: 1, startedAt: 0, endedAt: null, linkedTrailId: null })).toBe('resume')
  })
  it('endedAt set → save', () => {
    expect(resumeActionFor({ id: 1, startedAt: 0, endedAt: 10, linkedTrailId: 2 })).toBe('save')
  })
})
