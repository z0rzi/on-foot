import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { appLogEntries } from '../appLog'

const logcat = readFileSync(join(__dirname, '..', 'fixtures', 'logcat-app-log.txt'), 'utf8')

describe('appLogEntries', () => {
  it("keeps the app's entries under ReactNativeJS, oldest first, with their process", () => {
    expect(appLogEntries(logcat)).toEqual([
      { time: '11-15 09:12:01.640', pid: 21603, area: 'launch', text: 'info launch cold start {"appVersion":"1.0.0"}' },
      { time: '11-15 09:12:02.010', pid: 21603, area: 'map', text: 'info map launch camera' },
      { time: '11-15 09:14:30.200', pid: 21603, area: null, text: '(cut by logcat) {"t":1763194470200,"level":"error","area":"error","message":"uncaught error","detail":{"message":"boom","stack":"Error: boom\\n    at f (index.bundle:1:2)' },
      { time: '11-15 09:15:06.120', pid: 23111, area: 'recording', text: 'warn recording fix batch write failed {"class":"SQLiteError","near":"<position>"}' },
    ])
  })

})
