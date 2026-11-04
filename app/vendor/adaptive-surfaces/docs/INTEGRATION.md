# Integration contract v1

## Ownership and trust

The shell owns navigation, identity/connection/security status, approval dialogs, secrets, execution and source assignment. It mounts `SurfaceRenderer` inside a bounded content region. Never put those authorities into a SurfaceProposal or a hostslot rendered on behalf of an untrusted source. The proposal may change only its admitted surface tree.

The host separately creates:
1. One `SurfaceSession` for one source/session/surface namespace
2. A trusted component registration Set, fixed for that session
3. A trusted navigation/suggestion registry, fixed for that session
4. A surface-scoped Map of allowed projections, without secrets or approval handles
5. Stable, bundled Graph/Skills React components, when needed
6. A host callback that receives typed intents and independently controls effects

Never deserialize these six trusted inputs from model JSON. Do not pass the full WorkState, all account state or another surface's projection Map. Binding a key means the entire associated projection may be displayed; the host must minimize it first. Projection values are not evaluated as paths or URLs.

## Minimal mount

```tsx
import { COMPONENT_TYPES, createSurfaceSession, SurfaceRenderer } from '@cue/adaptive-surfaces';
import '@cue/adaptive-surfaces/styles.css';

const session = createSurfaceSession({
  sessionId: 'localRun1', surfaceId: 'overview',
  provenance: { sourceLabel: 'Local offline skill', runLabel: 'Run 1' },
  registeredComponents: new Set(COMPONENT_TYPES),
  actions: new Map([
    ['open_tasks', { kind: 'navigate', label: 'Aufgaben ansehen', target: { view: 'tasks' } }]
  ])
});
// The transport supplies only a bounded JSON string. Its returned status is not tool success.
const admission = session.submit(rawProposalJson);

<SurfaceRenderer
  session={session}
  data={new Map([['task_count', { kind: 'metric', state: 'known', value: 0 }]])}
  onIntent={intent => {
    if (session.getSnapshot().revision !== intent.surfaceRevision) return;
    // Host-owned switch: show existing screen or review a suggestion.
    // Never interpret this object as execution permission or an arbitrary method call.
    showHostIntentPreview(intent);
  }}
/>
```

Create the session outside the React render path and keep it stable. Recreate it on account/source/permission changes; unmount the old renderer using a host key for that session. Updating the data Map requires a normal host React render. Keep Map/value ownership under host control and provide a fresh Map or React state update when projections change.

`submit` returns `{ok, code?}`. `getSnapshot()` is a stable immutable object between notifications and holds `revision`, `proposal`, host `provenance`, and a safe error code. Rejection changes only the error state; it never partially applies the tree. Repeated identical rejection codes do not trigger repeated notifications. A successful update clears the error and increments the host revision. Require exact `baseRevision` on every update.

`getIntent(componentId, revision)` is consumed at most once per component per admitted revision. It verifies the current surface/action binding and refuses a component whose host delivery is pending. It never executes a target. This low-level method does not itself invoke or track an external receiver; integrations that deliver callbacks should use `dispatchIntent(componentId, revision, receiver)` as the React renderer does.

`dispatchIntent` owns the delivery lifecycle in the host session, keyed by stable component ID. It marks a delivery pending before invoking the receiver, blocks a second delivery across newer revisions, reparenting, removal/readdition and whole-renderer remount, and catches/redacts receiver errors. `getActionState` plus `subscribeActions` expose immutable delivery status. The pending state, `aria-busy` and visible pending message remain until the promise settles, even on a newer surface revision. An old result only releases its exact pending record and cannot appear as success/error of a newer revision. At most `maxComponents` deliveries may be pending in one session; excess attempts do not invoke receivers.

The React button calls this only on native activation. Rejected callbacks do not auto-retry. On the same revision the consumed action remains disabled; a new valid revision is needed to retry. If a newer revision was already admitted while the callback was pending, its action becomes available only after that callback settles. A host may impose stricter deduplication and current authorization, especially if its downstream workflow eventually writes.

The library does not provide approval evidence, idempotent executors, cancellation of host promises, or an external run store. A pending promise belongs to the host; unmounting the renderer does not cancel it. Check scope/revision again before any delayed consequential host operation.

## Data projection contracts

All bound components show their source type separately from proposed labels. Untrusted text and labels are always plain React text and are visibly marked as proposals. Source provenance comes exclusively from session config.

- Status: `{kind:'status', state:'known'|'stale', value:string}`
- Metric: `{kind:'metric', state:'known'|'stale', value:number, unit?:string}`; finite numbers only, including zero
- TaskList/SourceList/EventList: `{kind:'tasks'|'sources'|'events', state:'known'|'stale', value:[{id,label,detail?}]}`; max 200 rows and unique row IDs
- GraphSlot/SkillSuggestionSlot: `{kind:'graph'|'skills', state:'known'|'stale', value:hostOwnedValue}`
- Any projection may instead have `{kind, state:'unknown'}` with no value

Missing Map key and explicit unknown show “Datenstand unbekannt”. Stale is labelled visibly. A known empty list says “Keine Einträge (bekannter Datenstand)”. Invalid or oversized scalar/list projections are rejected as a whole, never silently truncated. Sources are labels/details, not automatically clickable URLs. Graph/Skills opaque values and their resource budgets must be validated by their existing host modules; this layer deliberately does not reinterpret those values.

## Existing graph and skill modules

No source import or copy of `mesh-extensions` or `skill-core` is present. The integration point is a host-owned React slot:

```tsx
// Define stable component identities outside render.
const slots = {
  Graph: function GraphHostSlot({ value, reducedMotion }) {
    // value must already be the permitted projection accepted by the existing module.
    return <ExistingGraphBridge graphProjection={value} reducedMotion={reducedMotion} />;
  },
  Skills: function SkillHostSlot({ value }) {
    return <ExistingSkillInspector validatedResult={value} />;
  }
};
```

The bridge is an integration example, not an exported or implemented component. The integrating host adapts real WorkState with the existing graph adapter and validated local skill results using the existing skill-core API. It retains graph selection/view state and skill decisions outside the proposal tree when these must survive reparenting/unmount. Switching Stack/Split/Focus on the same Group preserves the DOM/component identity; arbitrary reparenting may remount a hostslot. No graph selection-preservation claim for arbitrary reparenting is made.

Slots receive `{value,state,componentId,surfaceRevision,reducedMotion}`. They receive no model props, action callback, permission or credentials through this interface. They are trusted code and retain their own security/accessibility/resource obligations. A caught slot render error resets when the host supplies a new projection object, admits a new surface revision, or changes another explicit slot input. Keep projection objects immutable and replace them for corrected data. Unrelated parent renders with unchanged slot inputs do not retry the failed slot.

Catch and redact production root `onCaughtError` telemetry as the demo does; React may otherwise log a caught trusted-slot exception even when the UI fallback is redacted.

## Layout and accessibility

Group supports Stack, Split and Focus. Split/Focus use one column at a 44rem breakpoint. Focus emphasizes its specified immediate child without hiding siblings or changing DOM reading order. Native buttons have host labels, keyboard activation semantics, visible focus, busy/disabled state and minimum 2.75rem height. Text and controls scale with the root font; nothing accepts an arbitrary size, position, z-index or stylesheet.

Stable IDs are required across updates. Reordering and layout changes preserve native keyed controls. When a focused action is reparented, focus is restored by its stable key; when removed, it goes to the host provenance anchor. External focus is not stolen. A trusted slot can give an internal control a unique `data-focus-key` based on component ID to participate in restoration; it must still implement its own internal keyboard/focus policy. Real TalkBack, Android font scaling, zoom and touch validation remain release gates.

`reducedMotion` defaults true and is passed to slots; CSS also disables motion under the system preference. The surface itself has no animation. The host should pass its already resolved reduced-motion preference to complex graph slots, since CSS cannot disable a canvas/GPU animation loop.

## Budgets and host responsibilities

Defaults: 256 KiB raw UTF-8, JSON nesting 32, 200 components, tree depth 12, 8 KiB per decoded text, 200 rows, 50ms minimum snapshot interval. The host may only lower size/depth/count limits. The interval may be configured or disabled with 0 for deterministic tests. Rate-limited snapshots are dropped with a visible code, not queued. Transport byte limits should also apply before constructing a giant string. This package does not allocate a global scheduler; host caps simultaneous mounts (recommended maximum four), backpressure and transport cancellation remain host responsibilities. No performance measurement is claimed.

## External protocol adapters are future work

An adapter must validate a pinned external version and translate its supported subset into complete v1 snapshots before admission. It cannot import code, accept a remote catalog URL as permission, change the action registry, add data access, or weaken this boundary.

- A2UI: a future 0.9.1-pinned adapter can translate supported catalog/data updates. Unsupported operations must fail explicitly. No current wire compatibility.
- AG-UI: a future bounded event reducer may drive snapshots. Events do not authorize execution.
- MCP Tasks: requires its own explicit protocol generation and durable host run lifecycle; UI completion is not business success.
- MCP Apps: requires a separately reviewed sandbox, origin/message/CSP enforcement and real Android bridge isolation. Never load its HTML into this React tree.
- OAuth, remote MCP and A2A are absent and require separately authorized integrations.

No protocol compliance or installed Android support follows from this internal schema or from package build success.
