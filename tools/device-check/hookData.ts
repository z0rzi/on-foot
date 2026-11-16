import { shell, sleep } from './adb'
import { broadcastCommand, parseBroadcast } from './hookReply'
import { launchOnFoot, onFootInFront } from './screen'
import { sendHook, type HookIo } from './sendHook'

// Past the receiver's 8 s deadline, so `am broadcast` returns before adb is given up on.
const BROADCAST_TIMEOUT_MS = 15_000

const phone: HookIo = {
  broadcast: async (hook, args) => parseBroadcast(await shell(broadcastCommand(hook, args), BROADCAST_TIMEOUT_MS)),
  launch: launchOnFoot,
  onFootInFront,
  sleep,
  now: Date.now,
}

// A check hook's data; a refusal fails the command with the app's reason.
export async function hookData(hook: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const answer = await sendHook(hook, args, phone)
  if (answer.reply === 'refused') throw new Error(`${hook} refused: ${answer.reason}`)
  return answer.data
}
