import { broadcastCommand, cleanupReport, parseBroadcast, stateReport } from '../hookReply'

const BROADCASTING = 'Broadcasting: Intent { act=com.zorzi.onfootrn.CHECK_HOOK flg=0x10400000 pkg=com.zorzi.onfootrn (has extras) }'

describe("a hook's broadcast", () => {
  it('is an ordered foreground broadcast to On Foot alone, the hook and its arguments as extras', () => {
    expect(broadcastCommand('state', {})).toBe(
      "am broadcast -a com.zorzi.onfootrn.CHECK_HOOK -p com.zorzi.onfootrn --receiver-foreground --es hook 'state' --es args '{}'",
    )
  })

  it("quotes arguments for the phone's shell", () => {
    expect(broadcastCommand('select', { name: "DEVCHECK it's" })).toBe(
      `am broadcast -a com.zorzi.onfootrn.CHECK_HOOK -p com.zorzi.onfootrn --receiver-foreground --es hook 'select' --es args '{"name":"DEVCHECK it'\\''s"}'`,
    )
  })
})

describe("what `am broadcast` printed", () => {
  it('is the reply the dispatcher set as the result', () => {
    const output = `${BROADCASTING}\nBroadcast completed: result=1, data="{"reply":"ok","data":{"screen":"/"}}"\n`
    expect(parseBroadcast(output)).toEqual({ kind: 'reply', reply: { reply: 'ok', data: { screen: '/' } } })
  })

  it('reads a refused and a not-ready reply', () => {
    expect(parseBroadcast(`${BROADCASTING}\nBroadcast completed: result=1, data="{"reply":"refused","reason":"busy: another hook is running; send it again"}"`)).toEqual({
      kind: 'reply',
      reply: { reply: 'refused', reason: 'busy: another hook is running; send it again' },
    })
    expect(parseBroadcast(`${BROADCASTING}\nBroadcast completed: result=1, data="{"reply":"not-ready","loading":["trails","recording"]}"`)).toEqual({
      kind: 'reply',
      reply: { reply: 'not-ready', loading: ['trails', 'recording'] },
    })
  })

  it('is no dispatcher when no receiver took the broadcast', () => {
    expect(parseBroadcast(`${BROADCASTING}\nBroadcast completed: result=0\n`)).toEqual({ kind: 'no-dispatcher' })
  })

  it("is no reply when the receiver's deadline closed it", () => {
    expect(parseBroadcast(`${BROADCASTING}\nBroadcast completed: result=2\n`)).toEqual({ kind: 'no-reply' })
  })

  it('fails on a result it cannot read', () => {
    expect(() => parseBroadcast('Error: Bad component name')).toThrow('`am broadcast` printed no result: Error: Bad component name')
    expect(() => parseBroadcast(`${BROADCASTING}\nBroadcast completed: result=1, data="{"reply":"maybe"}"`)).toThrow('an unreadable reply: {"reply":"maybe"}')
  })
})

describe("the state hook's answer, printed", () => {
  const identity = { commit: 'c7f942b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', uncommitted: '', fingerprint: '5f0c1a2b3c4d' }

  it('gives each reading on a line of its own', () => {
    const data = { screen: '/', selection: { kind: 'trail', id: 7 }, mapMode: 'trail', followMode: 'off', recording: 'idle', build: identity }
    expect(stateReport(data)).toBe(
      [
        'screen: /',
        'selection: trail 7',
        'map mode: trail',
        'follow mode: off',
        'recording: idle',
        'build: c7f942b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7, clean, native fingerprint 5f0c1a2b3c4d',
      ].join('\n'),
    )
  })

  it('says when nothing is selected and the build names no identity', () => {
    const data = { screen: '/settings', selection: null, mapMode: 'recording', followMode: 'position', recording: 'paused', agentSession: false, build: null }
    expect(stateReport(data)).toBe(
      ['screen: /settings', 'selection: none', 'map mode: recording', 'follow mode: position', 'recording: paused, not an agent session', 'build: no identity (not made by `devcheck build`)'].join(
        '\n',
      ),
    )
  })
})

describe("the cleanup hook's answer, printed", () => {
  it('says so when nothing was left to delete', () => {
    expect(cleanupReport({ deleted: [], failed: [] })).toEqual({ report: 'deleted 0', complete: true })
  })

  it('is complete when every DEVCHECK item went', () => {
    expect(cleanupReport({ deleted: [{ kind: 'trail', id: 5, name: 'DEVCHECK climb' }], failed: [] })).toEqual({
      report: 'deleted 1: trail 5 "DEVCHECK climb"',
      complete: true,
    })
  })
})
