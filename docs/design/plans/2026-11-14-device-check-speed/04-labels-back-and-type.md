---
status: open
blocked_by: ["[[01-the-appium-server-reads-the-screen]]"]
closes: []
---
# 04: `labels`, `back` and `type`

**What to build:** `labels` takes the foreground guard, reads once and prints the labels line and
the time the read took; it writes no file and takes no screenshot. `back` sends the back key.
`type <text>` types plain text, escaping what the phone's `input text` needs, and refuses a
character it cannot send, naming it. Both take the foreground guard, so no key press of a check
reaches another app. `labels` shares the summary line with `shot`; `save-activity` types the
activity name through the same function as `type`.

- [ ] Text escaping: spaces, quotes, the characters `input text` mangles, a character refused by
      name (tests)
- [ ] Skill: the command table gains the three commands; the raw `input text` and
      `input keyevent 4` lines go, and raw `input` stays only for the app switcher and waking the
      screen
- [ ] Device: `labels` on the map, timed; `back` from a list to the map; `type` of a name with
      spaces and an apostrophe into the activity name field, read back by `labels`; `back` and
      `type` refused with another app in front
- [ ] `npm run verify` green
