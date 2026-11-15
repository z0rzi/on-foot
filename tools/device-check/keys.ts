import { serial, shell } from './adb'
import { settledText, settleAfter } from './look'
import { readScreen, requireForeground } from './screen'
import { typingScript } from './typing'

// Presses the back key, then waits for the screen to settle as a tap with no outcome named does.
export async function pressBack() {
  const id = await serial()
  await requireForeground()
  const before = await readScreen(id)
  await shell('input keyevent KEYCODE_BACK')
  return settleAfter(before.nodes)
}

export async function back(): Promise<string> {
  return settledText('pressed back', await pressBack())
}

// Closes the on-screen keyboard; the screen under it stays as it is.
export async function hideKeyboard(): Promise<void> {
  await requireForeground()
  await shell('input keyevent KEYCODE_ESCAPE')
}

// Types into the field that has the focus.
export async function typeText(text: string): Promise<string> {
  const script = typingScript(text)
  await requireForeground()
  await shell(script)
  return `typed "${text}"`
}
