import { architectureEnv, phoneArchitecture } from '../buildArchitecture'

describe('phoneArchitecture', () => {
  it("is the phone's first ABI React Native builds for", () => {
    expect(phoneArchitecture('arm64-v8a,armeabi-v7a,armeabi\n')).toBe('arm64-v8a')
  })

  it('skips an ABI React Native does not build for', () => {
    expect(phoneArchitecture('armeabi,armeabi-v7a')).toBe('armeabi-v7a')
  })

  it('is null when the phone lists none React Native builds for', () => {
    expect(phoneArchitecture('mips,armeabi')).toBeNull()
    expect(phoneArchitecture('')).toBeNull()
  })
})

describe('architectureEnv', () => {
  it("narrows React Native's Gradle build to one architecture", () => {
    expect(architectureEnv('arm64-v8a')).toEqual({ ORG_GRADLE_PROJECT_reactNativeArchitectures: 'arm64-v8a' })
  })

  it('leaves every architecture built when the phone names none', () => {
    expect(architectureEnv(null)).toEqual({})
  })
})
