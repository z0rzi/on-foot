import { buildVerdict, launchFromCapture, uncommittedHash, type BuildIdentity, type Launch } from '../buildIdentity'

const COMMIT = 'c7f942b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7'
const HEAD = 'e6d51be0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
const FINGERPRINT = '5f0c1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b'
const clean: BuildIdentity = { commit: COMMIT, uncommitted: null, fingerprint: FINGERPRINT }
const launch = (identity: BuildIdentity | null) => ({ time: '11-15 23:10:05.120', identity })
const INSTALLED_AT = '2026-11-15 23:09:58'
const fromCapture = (launched: Launch | null) => ({ from: 'capture' as const, launch: launched, installedAt: INSTALLED_AT })

describe('buildVerdict', () => {
  describe("from a build with hooks, its state's identity", () => {
    it('holds a commit the installed build descends from', () => {
      const verdict = buildVerdict({ wanted: 'T-49', read: { from: 'state', identity: clean }, holds: true, tree: { commit: HEAD, uncommitted: null } })
      expect(verdict).toEqual({
        held: true,
        report: `holds T-49: the installed build is c7f942b1d2e3, clean (native fingerprint ${FINGERPRINT}, as its \`state\` says)`,
      })
    })

    it('cannot tell from a build with hooks but no identity', () => {
      const verdict = buildVerdict({ wanted: 'T-49', read: { from: 'state', identity: null }, holds: null, tree: { commit: HEAD, uncommitted: null } })
      expect(verdict).toEqual({
        held: false,
        report: 'cannot tell whether it holds T-49: the installed build carries no identity (as its `state` says), so it was not made by `devcheck build`; build needed',
      })
    })
  })

  it('holds a commit the clean installed build descends from', () => {
    const verdict = buildVerdict({ wanted: 'T-49', read: fromCapture(launch(clean)), holds: true, tree: { commit: HEAD, uncommitted: null } })
    expect(verdict).toEqual({
      held: true,
      report: `holds T-49: the installed build is c7f942b1d2e3, clean (native fingerprint ${FINGERPRINT}, launched 11-15 23:10:05.120)`,
    })
  })

  it('does not hold a commit the clean installed build lacks', () => {
    const verdict = buildVerdict({ wanted: 'T-49', read: fromCapture(launch(clean)), holds: false, tree: { commit: HEAD, uncommitted: null } })
    expect(verdict).toEqual({
      held: false,
      report: `does not hold T-49: the installed build is c7f942b1d2e3, clean (native fingerprint ${FINGERPRINT}, launched 11-15 23:10:05.120); build needed`,
    })
  })

  describe('a build made with uncommitted changes', () => {
    const dirty = { ...clean, uncommitted: '9a8b7c6d5e4f' }

    it('counts when the working tree stands on its commit with the same changes', () => {
      const verdict = buildVerdict({ wanted: 'HEAD', read: fromCapture(launch(dirty)), holds: true, tree: { commit: COMMIT, uncommitted: '9a8b7c6d5e4f' } })
      expect(verdict).toEqual({
        held: true,
        report: `holds HEAD: the installed build is c7f942b1d2e3 with the working tree's uncommitted changes 9a8b7c6d5e4f (native fingerprint ${FINGERPRINT}, launched 11-15 23:10:05.120)`,
      })
    })

    it.each([
      ['other changes', { commit: COMMIT, uncommitted: '0f1e2d3c4b5a' }, "the working tree's are 0f1e2d3c4b5a"],
      ['a clean tree', { commit: COMMIT, uncommitted: null }, 'the working tree is clean'],
      ['the same changes on another commit', { commit: HEAD, uncommitted: '9a8b7c6d5e4f' }, 'the working tree stands on e6d51be0a1b2'],
    ])('does not count against %s, even when its commit descends from the one wanted', (_case, tree, why) => {
      const verdict = buildVerdict({ wanted: 'T-49', read: fromCapture(launch(dirty)), holds: true, tree })
      expect(verdict).toEqual({
        held: false,
        report: `cannot tell whether it holds T-49: the installed build is c7f942b1d2e3 with uncommitted changes 9a8b7c6d5e4f (native fingerprint ${FINGERPRINT}, launched 11-15 23:10:05.120), and ${why}; build needed`,
      })
    })
  })

  it('cannot tell from a build that carries no identity', () => {
    const verdict = buildVerdict({ wanted: 'T-49', read: fromCapture(launch(null)), holds: null, tree: { commit: HEAD, uncommitted: null } })
    expect(verdict).toEqual({
      held: false,
      report: 'cannot tell whether it holds T-49: the installed build carries no identity (launched 11-15 23:10:05.120), so it was not made by `devcheck build`; build needed',
    })
  })

  it('cannot tell from a commit this repository does not have', () => {
    const verdict = buildVerdict({ wanted: 'T-49', read: fromCapture(launch(clean)), holds: null, tree: { commit: HEAD, uncommitted: null } })
    expect(verdict).toEqual({
      held: false,
      report: `cannot tell whether it holds T-49: the installed build is c7f942b1d2e3, clean (native fingerprint ${FINGERPRINT}, launched 11-15 23:10:05.120), a commit this repository does not have; build needed`,
    })
  })

  it('reads no identity from a launch older than the install, which was of the build before', () => {
    const verdict = buildVerdict({ wanted: 'T-49', read: { from: 'capture', launch: launch(clean), installedAt: '2026-11-15 23:10:06' }, holds: true, tree: { commit: HEAD, uncommitted: null } })
    expect(verdict).toEqual({
      held: false,
      report: "cannot tell whether it holds T-49: the last launch in the capture (11-15 23:10:05.120) is older than the install (2026-11-15 23:10:06); relaunch On Foot as the skill's Rules say and run this again",
    })
  })

  it('cannot tell when the capture holds no launch', () => {
    const verdict = buildVerdict({ wanted: 'T-49', read: fromCapture(null), holds: null, tree: { commit: HEAD, uncommitted: null } })
    expect(verdict).toEqual({
      held: false,
      report: "cannot tell whether it holds T-49: the capture holds no launch of On Foot; relaunch it as the skill's Rules say and run this again",
    })
  })
})

describe('launchFromCapture', () => {
  const identity = `{"commit":"${COMMIT}","uncommitted":"","fingerprint":"${FINGERPRINT}"}`
  const capture = [
    '11-15 22:01:00.000 9001 info launch cold start {"appVersion":"1.0.0"}',
    '11-15 22:01:00.300 9001 info launch launch action none {}',
    '--- gap in the recording from 11-15 22:30:00.000 to 11-15 23:09:00.000 (host clock): an entry older than logcat\'s buffer at its end is missing',
    `11-15 23:10:05.120 9102 info launch cold start {"appVersion":"1.0.0","build":${identity}}`,
    '11-15 23:10:06.000 9102 info map heading watch {"on":false}',
  ].join('\n')

  it('reads the latest cold start and the identity it carries', () => {
    expect(launchFromCapture(capture)).toEqual({ time: '11-15 23:10:05.120', identity: clean })
  })

  it('reads a cold start of a build without an identity as one', () => {
    expect(launchFromCapture(capture.split('\n').slice(0, 3).join('\n'))).toEqual({ time: '11-15 22:01:00.000', identity: null })
  })

  it.each([
    ['a commit that is not one', identity.replace(COMMIT, 'main')],
    ['no fingerprint', identity.replace(`,"fingerprint":"${FINGERPRINT}"`, '')],
    ['uncommitted changes neither a hash nor empty', identity.replace('"uncommitted":""', '"uncommitted":null')],
  ])('reads an identity with %s as none', (_case, broken) => {
    expect(launchFromCapture(`11-15 23:10:05.120 9102 info launch cold start {"appVersion":"1.0.0","build":${broken}}`)).toEqual({ time: '11-15 23:10:05.120', identity: null })
  })

  it('finds no launch in a capture without a cold start', () => {
    expect(launchFromCapture('11-15 23:10:06.000 9102 info map heading watch {"on":false}')).toBeNull()
  })
})

describe('uncommittedHash', () => {
  const diff = Buffer.from('diff --git a/src/a.ts b/src/a.ts\n-old\n+new\n')
  const file = (path: string, content: string) => ({ path, content: Buffer.from(content) })

  it('is null for a clean tree', () => {
    expect(uncommittedHash(Buffer.alloc(0), [])).toBeNull()
  })

  it('is a short hash of the changes, the same for the same changes in any order', () => {
    const hash = uncommittedHash(diff, [file('src/b.ts', 'b'), file('src/c.ts', 'c')])
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
    expect(uncommittedHash(diff, [file('src/c.ts', 'c'), file('src/b.ts', 'b')])).toBe(hash)
  })

  it.each([
    ['a changed diff', Buffer.from('diff --git a/src/a.ts b/src/a.ts\n-old\n+newer\n'), [file('src/b.ts', 'b')]],
    ['a new file changed', diff, [file('src/b.ts', 'bb')]],
    ['a new file moved', diff, [file('src/d.ts', 'b')]],
    ['a new file only', Buffer.alloc(0), [file('src/b.ts', 'b')]],
  ])('changes with %s', (_case, otherDiff, untracked) => {
    expect(uncommittedHash(otherDiff, untracked)).not.toBe(uncommittedHash(diff, [file('src/b.ts', 'b')]))
  })
})
