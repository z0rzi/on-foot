import { resumeActionFor } from '../resume'

const session = { id: 1, startedAt: 0, endedAt: null as number | null, linkedTrailId: null as number | null, pausedAt: null as number | null, pausedMs: 0 }

describe('resumeActionFor', () => {
  it('no session → none', () => {
    expect(resumeActionFor(null)).toBe('none')
  })
  it('open session → resume', () => {
    expect(resumeActionFor(session)).toBe('resume')
  })
  it('paused session → paused', () => {
    expect(resumeActionFor({ ...session, pausedAt: 500 })).toBe('paused')
  })
})
