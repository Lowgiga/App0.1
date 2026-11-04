# Context-sensitive assistance: first vertical slice

## What is implemented

The existing Studio graph now offers local, object-specific explanations above its existing Inspector. The 2D SVG, graph list, Inspector relation buttons, and 3D renderer use the same confirmed selection callback. Restoring a saved graph selection is passive: assistance starts after an actual selection, not merely from loading a preference. Hovering, mouse movement, and arbitrary text selection are not observed.

The card first explains the selected object, then gives observed context and one concrete next-step idea. Unknown source age and unresolved relationships are reported as unknown or unresolved. The card is labelled **Offline-Regeln**; no model adapter or provider is connected. Nothing in this slice calls a network API, modifies project/work/draft records, grants execution rights, or invokes an external app.

**Auswahl erklären** is an explicit local read action available even when proactive hints are muted or in cooldown. It does not turn automatic hints on or alter their quota. Selection/revision changes immediately hide both manual and automatic content. Technical evidence and trigger rules are expandable. Controls use native labelled inputs/buttons and 48 CSS-pixel minimum target height; this is a project convention, not a claimed device measurement.

## Semantic scope

`lowquantflow.selection-context/v1` contains:

- `project`: an existing room ID and creation time, or `null`
- `objectId`, `objectKind`, `selectionKind: object`
- `source`: snapshot kind, reference, observed source time (which may be unknown)
- `workRevision`: the loaded, saved work timestamp
- `focus`: graph or Inspector selection origin

A room object identifies its own room. A mission identifies a room only when its actual `roomId` resolves to an existing room. Global tasks, sources, profiles, and unrelated objects do not become project facts by selection. An unconfirmed work revision visibly disables explanations rather than inventing a revision.

## Controls and bounded rules

Preferences use the existing PreferencesStore and its revision checks. The additive optional `contextAssistance` field preserves legacy records without injecting defaults during parsing. Only explicit control changes save preferences.

Default: hints on, balanced frequency, compact details.

| Frequency | Debounce | Minimum interval | Maximum automatic hints per 10 minutes |
|---|---:|---:|---:|
| Rare | 900 ms | 120 seconds | 3 |
| Balanced | 600 ms | 30 seconds | 5 |
| Frequent | 350 ms | 8 seconds | 10 |

Same-source dedupe includes project incarnation, work revision, source reference, source type and observed source time. Aliases of the same source version stay quiet. A new work revision can enable a fresh hint after cooldown, including changed relationships. Dedupe and quota are bounded to the current mounted view; leaving and re-entering the graph starts a new view session. Dismissal suppresses the current source/version within that ten-minute window. Muting persists the disabled preference. A save failure is visible and leaves this view muted.

Debounced or asynchronous results carry a generation token. Changed selection, paused/hidden view, cleared selection, missing object, or different revision invalidates the old generation. Render-time identity checks prevent an old answer from flashing before React effects run. Cleanup supports StrictMode's replay.

## Verification and boundaries

Focused tests cover controller timing, quick A/B/A changes, late asynchronous results, missing objects, revision/incarnation changes, source-alias dedupe, cooldown/budget, StrictMode, visibility, manual muted assistance, preference persistence/failure, semantic selection routing and read-only behavior. The renderer test exercises the 3D callback bridge with a test renderer; it does not claim GPU, touch hardware, Android or physical-device validation.

Remaining scope: app-wide object adapters, source-bound text selection, a user-authored rule editor, richer project-memory explanations, and a genuine model adapter. Frequency presets are structured rules, not a completed arbitrary rule authoring system. Existing assistant transactions and persistent draft implementation remain separate.

## Integration

Keep the pinned vendor and upstream files unchanged. `scripts/build-graph-overlay.mjs` generates the GraphExplorer extension from the pinned source. Studio supplies current graph/room identities and the existing preference-save callback. When merging the separate draft-panel work, retain that task's hidden/inert persistent ProjectMemoryPanel mount; this slice does not change the memory tab lifecycle.
