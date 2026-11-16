// What the app is still loading at launch, each named as the toolkit prints it.
export type Loading = 'launch' | 'trails' | 'activities' | 'offline packs' | 'recording'

// A hook's one answer: done with its data, refused with the reason, or not yet loaded.
export type HookReply =
  | { reply: 'ok'; data: unknown }
  | { reply: 'refused'; reason: string }
  | { reply: 'not-ready'; loading: Loading[] }

// The broadcast's result data, read by the toolkit's parser (tools/device-check/hookReply.ts); the
// cross-check test holds the two together.
export const replyText = (reply: HookReply): string => JSON.stringify(reply)
