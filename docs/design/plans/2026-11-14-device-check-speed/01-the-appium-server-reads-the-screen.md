---
status: open
blocked_by: []
closes: []
---
# 01: the Appium server reads the screen

**What to build:** every command that reads the screen (`tap`, `shot`, `wait-for`, `crop`'s dump,
the import, save and delete flows) gets its tree from the Appium UiAutomator2 server instead of
`uiautomator dump`, with the server's idle wait at zero. The commands keep their interface and
their output; they are faster, and a read no longer fails on a map that never idles. The toolkit
asks the server for its status before a read and starts it when it does not answer, under a
per-phone start lock kept with the walker's state; it sets the port forward again when it is gone;
`cleanup` stops the server once no walk moves. The server is always started with the argument that
leaves accessibility services running, and one found running without it is restarted. The
installed version is read and held to the pinned one; a missing app or another version fails
pointing at Phone setup. The server's page source goes through the existing dump parser, widened to
elements named by widget class. A lost phone seen over HTTP takes the same `phone gone` path as
adb. `uiautomator dump` is removed. The recording and moving-walk refusals stay as they are until
02. Calls that worked by hand are in the spec's Further Notes.

- [ ] The server's state from what it answers: running, not answering, app missing, another
      version, started without the accessibility argument (tests)
- [ ] The server's page source through the dump parser gives the nodes, labels and bounds a
      platform dump of the same screen gives; fixtures captured from the phone with the server:
      the idle map, a list, the picker (tests). The existing dump fixtures still pass
- [ ] No `uiautomator dump` call left in the toolkit
- [ ] Skill: Phone setup names the two server APKs, the release, the install date and the install
      command; "Leave the package and the phone intact" names the three Appium packages as the
      toolkit's own; Clean up says `cleanup` stops the server and the report says whether it runs
- [ ] Device: ten reads under 1 s on the idle map, timed through the toolkit; a cold start under
      10 s; the server killed between two commands and the next read succeeding; `cleanup`
      leaving no server process; the owner's accessibility service still bound while the server
      runs and after; `import-gpx`, `save-activity` and `cleanup` working end to end
- [ ] Device: a check of half an hour without the server dying, or the restarts counted; a read
      after a phone reboot with no manual step. If either fails, stop and report to the owner
- [ ] `npm run verify` green
