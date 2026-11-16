import { isSnapshotFile, pulledNames, snapshotFiles } from '../snapshotFiles'

const files = {
  database: '/storage/emulated/0/Android/data/com.zorzi.onfootrn/files/hooks/snapshot.db',
  preferences: '/storage/emulated/0/Android/data/com.zorzi.onfootrn/files/hooks/snapshot-preferences.json',
}

describe("the snapshot hook's answer", () => {
  it('names the two files on the phone', () => {
    expect(snapshotFiles(files)).toEqual(files)
  })

  it.each([null, 'snapshot.db', { database: files.database }, { database: 3, preferences: files.preferences }])(
    'is unreadable without both paths: %p',
    (data) => {
      expect(() => snapshotFiles(data)).toThrow('the snapshot hook answered without the paths of its two files')
    },
  )
})

describe("a snapshot's files in the evidence folder", () => {
  it('are numbered as the next evidence, the database and its preferences side by side', () => {
    expect(pulledNames(['01-map.png', '02-app-log.txt'])).toEqual({ database: '03-snapshot.db', preferences: '03-snapshot.preferences.json' })
  })

  it('are what cleanup deletes', () => {
    expect(['03-snapshot.db', '03-snapshot.preferences.json', '12-snapshot.db'].every(isSnapshotFile)).toBe(true)
  })

  it.each(['01-map.png', '01-map.dump.xml', '02-app-log.txt', 'DEVCHECK-climb.gpx', '04-snapshot-of-the-sheet.png', 'snapshot.db'])(
    'leave the rest of the evidence to cleanup alone: %s',
    (name) => {
      expect(isSnapshotFile(name)).toBe(false)
    },
  )
})
