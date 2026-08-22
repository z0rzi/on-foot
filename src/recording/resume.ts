import { RecordingSession } from '../data/activities'

export type ResumeAction = 'none' | 'resume' | 'save'

export function resumeActionFor(session: RecordingSession | null): ResumeAction {
  if (!session) return 'none'
  return session.endedAt == null ? 'resume' : 'save'
}
