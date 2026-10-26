---
severity: should-fix
category: bug
size: S
triage: needs-triage
source: "device check, 2026-10-26"
blocked_by: []
---
# PROP-41: GPX import leaves numeric character references undecoded in names

Three of the owner's trails show raw entities in the Trails list, e.g.
`Lac d&#039;Orédon, les Laquettes, le Lac d&#039;Aubert et d&#039;-19363462`. A numeric character
reference is plain XML, which any parser must decode.

`src/data/trails/gpx/parse.ts:19-26` builds `XMLParser` with fast-xml-parser 5.11's defaults
for entities, which decode the five named XML entities but not numeric references. Reproduced
with the app's exact options: `<name>Lac d&#039;Or&eacute; &apos;x&apos; &amp;</name>` parses to
`Lac d&#039;Or&eacute; 'x' &`; with `htmlEntities: true` the parser gives `d'O '` for `d&#039;O &#x27;`.
Whether `htmlEntities` (which also turns on HTML-named entities like `&eacute;`) or a narrower
numeric-only decode is right is a design choice for the fix. A parse test with a numeric reference
belongs with it.

The names already stored keep their raw text: decoding at import fixes new files only, so existing
rows need either a one-off migration or the owner renaming them. Evidence:
`.scratch/device-checks/2026-10-26/B/08-*`.
