import { typingScript } from '../typing'

describe('typingScript', () => {
  it('types a text with spaces as one argument, the spaces kept', () => {
    expect(typingScript('DEVCHECK ridge walk')).toBe("input text 'DEVCHECK ridge walk'")
  })

  it("hands quotes and the phone shell's own characters through as they are", () => {
    expect(typingScript(`it's a "loop" $HOME \`x\` \\ ; & | * ~`)).toBe(`input text 'it'\\''s a "loop" $HOME \`x\` \\ ; & | * ~'`)
  })

  it('types a literal %s in two calls, since one call reads %s as a space', () => {
    expect(typingScript('50%sure')).toBe("input text '50%' && input text 'sure'")
    expect(typingScript('%%s')).toBe("input text '%%' && input text 's'")
  })

  it('types a % before any other character in one call', () => {
    expect(typingScript('100% up, 5%ish')).toBe("input text '100% up, 5%ish'")
  })

  it('refuses a character the phone cannot type, naming it', () => {
    expect(() => typingScript('DEVCHECK café')).toThrow('cannot type "é" (U+00E9)')
    expect(() => typingScript('summit 🏔')).toThrow('cannot type "🏔" (U+1F3D4)')
  })

  it('refuses a control character, which is a key and not text', () => {
    expect(() => typingScript('two\nlines')).toThrow('cannot type U+000A')
    expect(() => typingScript('a\tb')).toThrow('cannot type U+0009')
  })

  it('refuses an empty text', () => {
    expect(() => typingScript('')).toThrow('nothing to type')
  })
})
