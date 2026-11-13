import { checkBurst, frameFile, MAX_FRAMES, stripArgs } from '../framesPlan'

describe('checkBurst', () => {
  it('takes two frames up to the cap, at any whole interval', () => {
    expect(() => checkBurst(2, 0)).not.toThrow()
    expect(() => checkBurst(MAX_FRAMES, 500)).not.toThrow()
  })

  it('refuses a count outside two to the cap, or not whole', () => {
    expect(() => checkBurst(1, 500)).toThrow('--count')
    expect(() => checkBurst(MAX_FRAMES + 1, 500)).toThrow('--count')
    expect(() => checkBurst(3.5, 500)).toThrow('--count')
  })

  it('refuses a negative interval and a burst longer than a minute', () => {
    expect(() => checkBurst(4, -1)).toThrow('--every')
    expect(() => checkBurst(4, 20_001)).toThrow('a minute')
  })
})

describe('frameFile', () => {
  it('names frames after the shot, out of the way of shot numbering and crop', () => {
    expect(frameFile('07-sheet-opens', 0)).toBe('07-sheet-opens.frame-01.png')
    expect(frameFile('07-sheet-opens', 9)).toBe('07-sheet-opens.frame-10.png')
  })
})

describe('stripArgs', () => {
  it('halves every frame and stacks them left to right', () => {
    expect(stripArgs(['a.png', 'b.png', 'c.png'], 'strip.png')).toEqual([
      '-i', 'a.png', '-i', 'b.png', '-i', 'c.png',
      '-filter_complex', '[0:v]scale=iw/2:-1[f0];[1:v]scale=iw/2:-1[f1];[2:v]scale=iw/2:-1[f2];[f0][f1][f2]hstack=inputs=3',
      'strip.png',
    ])
  })
})
