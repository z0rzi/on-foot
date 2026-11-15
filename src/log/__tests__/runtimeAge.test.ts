describe('runtimeAgeMs', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('counts from the moment the runtime loaded the log', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    let runtimeAgeMs: () => number = () => NaN
    /* eslint-disable @typescript-eslint/no-require-imports -- jest.isolateModules needs a synchronous load, and this jest setup rejects dynamic import() */
    jest.isolateModules(() => {
      runtimeAgeMs = (require('../runtimeAge') as typeof import('../runtimeAge')).runtimeAgeMs
    })
    /* eslint-enable @typescript-eslint/no-require-imports */
    now.mockReturnValue(1_700_000_042_500)

    expect(runtimeAgeMs()).toBe(42_500)
  })
})
