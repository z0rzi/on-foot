---
severity: investigate
category: enhancement
size:
triage:
origin: owner
filed: 2026-11-15
from: "owner, test-phone discussion, 2026-11-15"
blocked_by: ["[[T-95-new-recording-takes-no-fixes]]"]
---
# T-111: a recording is checked against one manufacturer's battery manager only

The app is meant to record a hike on any Android phone. Manufacturers add their own background
killers on top of stock Android's Doze and app standby: Samsung's sleeping and deep-sleeping apps,
Xiaomi's autostart and battery saver, Huawei's app launch manager, Oppo/OnePlus battery
optimisation (dontkillmyapp.com ranks them). They can stop a foreground service, refuse to restart
a killed process, or hold location deliveries, all of which stock Android allows.

Every recording so far was checked on one phone, the owner's OnePlus DN2103 (Android 13,
OxygenOS). The only manufacturer-specific handling in the app is the `setPersisted(false)` patch on
`expo-task-manager`, for a crash on ColorOS/OxygenOS
(`docs/design/specs/2026-08-22-onfoot-rn-record-activity-design.md`, "Patch `expo-task-manager`").
Nothing in `src/` or `app.json` asks for a battery-optimisation exemption or tells the walker about
the manufacturer's setting.

The process-death design ([[2026-11-14-recording-survives-process-death-design]]) depends on the
system restarting a killed process: "the fused provider's pending intent outliving the process".
Whether a manufacturer that blocks background starts lets that restart happen was not checked on
any phone.

The debug log cannot tell manufacturers apart yet. Its header has `model` and `androidVersion`
(`src/log/deviceInfo.ts`), not `Platform.constants.Manufacturer`. A kill shows up only as the gap
the relaunch reports ("No position between …", `src/recording/interruption.ts`).

A device check cannot show any of this while the phone is on a cable. Charging lifts Doze, and
most manufacturer killers ignore a charging app. Measuring needs an unplugged phone, the screen
off, for an hour or more.

Feature-sized: it goes brainstorm → spec → plan once T-95 has landed, since a kill on any phone
loses the track until then. What the spec has to settle:

- which manufacturers, in what order (by market share: Samsung, then Xiaomi);
- how each is measured: a field walk, or an unplugged phone at home under a mock walk;
- the response: ask for the battery-optimisation exemption (check Play's policy on
  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` before choosing it over the settings screen), a
  per-manufacturer hint pointing at the right setting, or both, and where the walker sees it;
- adding the manufacturer to the debug log's header, so a field gap can be read per brand.
