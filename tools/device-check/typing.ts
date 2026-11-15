import { quote } from './adb'

// `input text` maps each character through the virtual keyboard's key map, which holds the
// printable ASCII characters; any other character makes the whole call fail.
const TYPABLE = /^[\x20-\x7e]$/

const codePoint = (ch: string) => `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`

function refuseUntypable(text: string): void {
  if (text.length === 0) throw new Error('nothing to type')
  for (const ch of text) {
    if (TYPABLE.test(ch)) continue
    const shown = /\p{Cc}/u.test(ch) ? codePoint(ch) : `"${ch}" (${codePoint(ch)})`
    throw new Error(`cannot type ${shown}: the phone's \`input text\` sends printable ASCII only`)
  }
}

// One `adb shell` line typing the text into the focused field. `input text` takes one argument and
// reads `%s` in it as a space, so a literal `%s` is cut between two calls.
export function typingScript(text: string): string {
  refuseUntypable(text)
  return text
    .split(/(?<=%)(?=s)/)
    .map((part) => `input text ${quote(part)}`)
    .join(' && ')
}
