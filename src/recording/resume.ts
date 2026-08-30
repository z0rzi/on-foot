import { RecordingSession } from '../data/activities/types'

export type ResumeAction = 'none' | 'resume' | 'paused'

export function resumeActionFor(session: RecordingSession | null): ResumeAction {
  if (!session) return 'none'
  if (session.pausedAt != null) return 'paused'
  return 'resume'
}
