import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { answerError, createdSession, frozenByBatteryManager, installedReader, pageSource, PINNED_READER_VERSION, readerSession, readerState } from '../readerState'

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8')

const status = fixture('reader-status.json')
const servicesBound = fixture('accessibility-reader-running.txt')

describe('readerState', () => {
  it('is running when the server answers ready at the pinned version and the services stay bound', () => {
    expect(PINNED_READER_VERSION).toBe('10.6.6')
    expect(readerState(status, servicesBound)).toEqual({ kind: 'running' })
  })

  it('is running when the services were not looked at', () => {
    expect(readerState(status, null)).toEqual({ kind: 'running' })
  })

  it('is not answering when nothing answers, or the answer is not a ready status', () => {
    expect(readerState(null, null)).toEqual({ kind: 'not-answering' })
    expect(readerState('', null)).toEqual({ kind: 'not-answering' })
    expect(readerState('<html>', null)).toEqual({ kind: 'not-answering' })
    expect(readerState(status.replace('"ready":true', '"ready":false'), null)).toEqual({ kind: 'not-answering' })
  })

  it('names another version than the pinned one', () => {
    expect(readerState(status.replace('"version":"10.6.6"', '"version":"10.7.0"'), servicesBound)).toEqual({ kind: 'other-version', version: '10.7.0' })
  })

  it('reads a server started without the accessibility argument from the enabled services it unbound', () => {
    expect(readerState(status, fixture('accessibility-suppressed.txt'))).toEqual({ kind: 'suppressing' })
  })

  it('cannot tell suppression when no service is enabled, and lets the server run', () => {
    const noneEnabled = servicesBound
      .replace(/Bound services:\{.*\}$/m, 'Bound services:{}')
      .replace(/Enabled services:\{.*\}$/m, 'Enabled services:{}')
    expect(readerState(status, noneEnabled)).toEqual({ kind: 'running' })
  })
})

describe('frozenByBatteryManager', () => {
  const hans = fixture('logcat-hans-reader.txt')

  it('finds OxygenOS freezing the reader process', () => {
    expect(frozenByBatteryManager(hans, 30503)).toBe(true)
  })

  it('leaves another process of the reader alone, and reads an unfreeze as no freeze', () => {
    expect(frozenByBatteryManager(hans, 31981)).toBe(false)
    expect(frozenByBatteryManager(hans.split('\n').filter((l) => !/\sfreeze uid/.test(l)).join('\n'), 30503)).toBe(false)
  })
})

describe('installedReader', () => {
  const both = 'package:io.appium.uiautomator2.server.test\npackage:io.appium.uiautomator2.server\n'

  it('is installed with both apps at the pinned version', () => {
    expect(installedReader(both, '    versionName=10.6.6\n')).toEqual({ kind: 'installed' })
  })

  it('names the apps missing', () => {
    expect(installedReader('package:io.appium.uiautomator2.server\n', '    versionName=10.6.6\n')).toEqual({
      kind: 'missing',
      packages: ['io.appium.uiautomator2.server.test'],
    })
    expect(installedReader('', 'Unable to find package: io.appium.uiautomator2.server\n')).toEqual({
      kind: 'missing',
      packages: ['io.appium.uiautomator2.server', 'io.appium.uiautomator2.server.test'],
    })
  })

  it('names another version than the pinned one', () => {
    expect(installedReader(both, '    versionName=10.7.0\n')).toEqual({ kind: 'other-version', version: '10.7.0' })
  })
})

describe('readerSession', () => {
  it('takes the session the server holds', () => {
    expect(readerSession('{"sessionId":"None","value":[{"id":"630eea72","capabilities":{},"sessionId":"630eea72"}]}')).toBe('630eea72')
  })

  it('is null when the server holds none', () => {
    expect(readerSession('{"sessionId":"None","value":[]}')).toBeNull()
  })
})

describe('createdSession', () => {
  it('takes the id of the session just opened', () => {
    expect(createdSession('{"sessionId":"00e8d670","value":{"capabilities":{},"sessionId":"00e8d670"}}')).toBe('00e8d670')
  })

  it('is null when the server refused one', () => {
    expect(createdSession('{"sessionId":"None","value":{"error":"session not created","message":"…"}}')).toBeNull()
    expect(createdSession('')).toBeNull()
  })
})

describe('answerError', () => {
  it('is null for an answer without an error, as the settings call gives', () => {
    expect(answerError('{"sessionId":"831c1673","value":null}')).toBeNull()
  })

  it('names the error and its message', () => {
    expect(answerError('{"sessionId":"a","value":{"error":"unknown error","message":"boom","stacktrace":"…"}}')).toBe('unknown error: boom')
  })
})

describe('pageSource', () => {
  it('takes the XML out of the answer', () => {
    const answer = JSON.stringify({ sessionId: 'a', value: "<?xml version='1.0' ?>\r\n<hierarchy index=\"0\">\r\n</hierarchy>" })
    expect(pageSource(answer)).toEqual({ kind: 'tree', xml: "<?xml version='1.0' ?>\r\n<hierarchy index=\"0\">\r\n</hierarchy>" })
  })

  it('tells a lost session from another error, and passes the message on', () => {
    const lost = '{"sessionId":"b","value":{"error":"invalid session id","message":"The session identified by b is not known","stacktrace":"…"}}'
    expect(pageSource(lost)).toEqual({ kind: 'no-session' })
    const other = '{"sessionId":"a","value":{"error":"unknown error","message":"Could not get the root node","stacktrace":"…"}}'
    expect(pageSource(other)).toEqual({ kind: 'error', message: 'unknown error: Could not get the root node' })
  })

  it('reads an answer with no tree as an error', () => {
    expect(pageSource('')).toEqual({ kind: 'error', message: 'no tree in the answer' })
    expect(pageSource('{"value":""}')).toEqual({ kind: 'error', message: 'no tree in the answer' })
  })
})
