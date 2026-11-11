---
status: open
blocked_by: ["[[04-focus-selection-and-recording]]"]
closes: []
---
# 05: the Layers menu is tiles, with Trails and Activities toggles

**What to build:** the Layers menu shows two rows of tiles, a preview with its title under it:
"Map", the layers, one chosen; "Show on map", Trails and Activities, each on or off, both off
allowed (D119). Choosing a layer or flipping a toggle applies at once on the map behind and the
menu stays open until its backdrop, a swipe or back closes it; its height follows its content; the
layer tiles are radios and the toggles checkboxes, each labelled; the swipe quick-switch on the
layers button is unchanged (D130). The toggles are persisted in the map store's `partialize`,
written only after hydration, both on by default (D124), and change the lines through the line
focus. The modal shell shared with the offline layer chooser (backdrop, back-dismiss, content
height) and the layer preview tile are extracted once and used by both (D135). The layer
quick-switch spec's text is updated to the menu that stays open.

- [ ] The toggles: `partialize` holds them, a stored state without them hydrates to both on,
      nothing is written before hydration (tests)
- [ ] Toggles change the line focus, not the lines file (test)
- [ ] The offline layer chooser uses the extracted shell and tile; no copy of either remains
- [ ] Device: Verification 11 (tiles, both rows, stays open, survives a relaunch, TalkBack reads
      radios and checkboxes)
- [ ] `npm run verify` green
