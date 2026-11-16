import { REFUSED, STEPS, USAGE, UsageError } from '../commandLine'
import { parseSteps, runSteps } from '../steps'

const commands = (texts: string[]) => parseSteps(texts).map((s) => s.command)

describe('parseSteps', () => {
  it('splits each step as the shell would, quotes kept together', () => {
    expect(commands([`tap 'Start recording'`, `wait-for "Don't save" --gone`, 'labels'])).toEqual([
      { command: 'tap', label: 'Start recording', options: { holdMs: undefined, until: undefined, timeoutS: undefined } },
      { command: 'wait-for', label: "Don't save", gone: true, timeoutS: 20 },
      { command: 'labels' },
    ])
  })

  it('keeps an escaped quote and a backslash inside double quotes, and a quoted word joined to a bare one', () => {
    expect(commands([String.raw`type "say \"hi\" \\ there"`, String.raw`type it\'s`, `type DEVCHECK' 'walk`])).toEqual([
      { command: 'type', text: String.raw`say "hi" \ there` },
      { command: 'type', text: "it's" },
      { command: 'type', text: 'DEVCHECK walk' },
    ])
  })

  it("reads a step's options as the command line does", () => {
    expect(commands([`tap 'Pause recording (press and hold)' --hold 1500 --until 'Stop and save recording' --timeout 5`, 'zoom in --at 540,1200'])).toEqual([
      {
        command: 'tap',
        label: 'Pause recording (press and hold)',
        options: { holdMs: 1500, until: { label: 'Stop and save recording', gone: false }, timeoutS: 5 },
      },
      { command: 'zoom', direction: 'in', at: { x: 540, y: 1200 }, steps: 10 },
    ])
    expect(commands(['scroll down', 'scroll up'])).toEqual([
      { command: 'scroll', direction: 'down' },
      { command: 'scroll', direction: 'up' },
    ])
    expect(commands([`tap Close --until-gone 'Map layers'`])[0]).toMatchObject({ options: { until: { label: 'Map layers', gone: true } } })
  })

  it.each([
    ['an unknown option', `tap 'Trails' --untill 'Trails'`, /step 2 \(tap 'Trails' --untill 'Trails'\): .*--untill/],
    ['a number that is not', 'wait-for Trails --timeout soon', /step 2 .*--timeout must be a number/],
    ['a missing argument', 'shot', /step 2 \(shot\): expected shot <name>/],
    ['a scroll with no way', 'scroll sideways', /step 2 \(scroll sideways\): expected scroll up\|down/],
    ['a burst out of range', 'frames sheet --count 40 --every 100', /step 2 .*--count must be/],
    ['text the phone cannot type', 'type café', /step 2 .*cannot type "é"/],
    ['an unclosed quote', `tap 'Trails`, /step 2 .*quote is not closed/],
    ['an unknown command', 'tpa Trails', /step 2 \(tpa Trails\): unknown command "tpa"/],
    ['nothing', '  ', /step 2 .*: it is empty/],
  ])('refuses %s, naming the step by its place', (_, faulty, message) => {
    const parse = () => parseSteps(['labels', faulty, 'labels'])
    expect(parse).toThrow(UsageError)
    expect(parse).toThrow(message)
  })

  it.each([
    ['walk to 300 --pace fast', /step 1 .*walk.*background/],
    ['import-gpx DEVCHECK-x.gpx', /step 1 .*import-gpx.*on its own/],
    ["record save 'x'", /step 1 .*record.*on its own/],
    ['record pause', /step 1 .*record.*on its own/],
    ['delete trail 5', /step 1 .*delete.*on its own/],
    ['cleanup', /step 1 .*cleanup.*on its own/],
    ["build-has 'x'", /step 1 .*build-has.*background/],
    ['build', /step 1 .*build.*background/],
    ['do labels', /step 1 .*do.*another list/],
  ])('refuses %s as a step, with the reason', (refused, message) => {
    expect(() => parseSteps([refused, 'labels'])).toThrow(message)
  })

  it('refuses an empty list', () => {
    expect(() => parseSteps([])).toThrow('do needs at least one step')
  })
})

describe('runSteps', () => {
  const steps = parseSteps(['labels', `tap 'Trails' --until 'Import GPX'`, 'back', 'shot map'])

  class Lost extends Error {}

  function runner(failing?: { command: string; error: Error }) {
    const ran: string[] = []
    const printed: string[] = []
    const reported: unknown[] = []
    return {
      ran,
      printed,
      reported,
      run: async (command: { command: string }) => {
        ran.push(command.command)
        if (command.command === failing?.command) throw failing.error
        return `${command.command} done`
      },
      print: (text: string) => printed.push(text),
      failed: (error: unknown) => {
        reported.push(error)
        return error instanceof Lost ? 3 : 1
      },
    }
  }

  it('runs every step in order, each under a header naming it, and exits 0', async () => {
    const r = runner()
    expect(await runSteps(steps, r)).toBe(0)
    expect(r.ran).toEqual(['labels', 'tap', 'back', 'shot'])
    expect(r.printed).toEqual([
      `[1/4] labels`, 'labels done',
      `[2/4] tap 'Trails' --until 'Import GPX'`, 'tap done',
      `[3/4] back`, 'back done',
      `[4/4] shot map`, 'shot done',
    ])
  })

  it('stops at the first failure with its exit code, saying how many steps were not run', async () => {
    const lost = new Lost('phone gone')
    const r = runner({ command: 'back', error: lost })
    expect(await runSteps(steps, r)).toBe(3)
    expect(r.ran).toEqual(['labels', 'tap', 'back'])
    expect(r.reported).toEqual([lost])
    expect(r.printed.slice(-2)).toEqual(['[3/4] back', 'step 3 of 4 failed (exit 3): 1 step not run'])
  })

  it('counts the steps left after a failure, none after the last', async () => {
    const early = runner({ command: 'labels', error: new Error('another app is in front') })
    expect(await runSteps(steps, early)).toBe(1)
    expect(early.printed.at(-1)).toBe('step 1 of 4 failed (exit 1): 3 steps not run')
    const last = runner({ command: 'shot', error: new Error('no') })
    await runSteps(steps, last)
    expect(last.printed.at(-1)).toBe('step 4 of 4 failed (exit 1): 0 steps not run')
  })
})

describe('the step policy', () => {
  it('names every command of the usage text either a step or a refused step, never both', () => {
    const commands = [...new Set(USAGE.split('\n').filter((line) => /^ {2}[a-z]/.test(line)).map((line) => line.trim().split(/\s/)[0]))]
    const unplaced = commands.filter((name) => STEPS.includes(name) === (REFUSED[name] !== undefined))
    expect(unplaced).toEqual([])
  })
})
