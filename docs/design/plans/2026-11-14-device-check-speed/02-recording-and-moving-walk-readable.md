---
status: open
blocked_by: ["[[01-the-appium-server-reads-the-screen]]"]
closes: []
---
# 02: the recording screen and a moving walk are readable

**What to build:** while On Foot records, and while a walk moves, the screen is read like any
other: `tap` reaches every control by its label, `wait-for` waits, and `shot` writes its dump so
`crop` works on those shots. Everything built around the screen that could not be dumped is
deleted: the screen read's `recording` outcome, the remembered record button and its field in the
per-phone state, the pause confirmation by recording state, the refusal of every label but the
record button's, and the refusals of `tap` and `wait-for` during a move. `save-activity` pauses by
label like any tap.

- [ ] The tap-target cases for the remembered button and "the recording screen cannot be dumped"
      are removed with the code; a label on a recording-screen fixture captured with the server
      is found like any other (tests)
- [ ] A fixture of the recording screen with the map card open and one with it closed (tests)
- [ ] Skill: "The recording screen cannot be dumped" and "During a walk `shot` skips the dump" are
      gone; the Test activities steps no longer say to see the record button first; the line
      about collapsing the map card before pausing goes if the device shows the pause found by
      label with the card open
- [ ] Device: while recording, `tap` on a control other than the record button, `wait-for` on a
      label, a `shot` with its dump and a `crop` from it; the pause held by label with the map
      card open and with it closed, the next read showing **Resume recording**; a `tap` and a
      `wait-for` during a `fast` walk; `save-activity` from a running recording
- [ ] `npm run verify` green
