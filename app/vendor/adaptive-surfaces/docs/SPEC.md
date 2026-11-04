# Adaptive surfaces v1: approved bounded candidate

Own internal interface: `cue.command-mesh.surface/v1`; catalog `cue.readonly/v1`. This is NOT A2UI, AG-UI, MCP Apps, or MCP Tasks. Android-first React shell remains authoritative and outside this package. No existing source or lockfile is modified.

## Inputs and boundary
- Untrusted input: a UTF-8 JSON snapshot string. Exact closed schema; no arbitrary JSX, HTML, CSS, URLs, fetch, scripts, expressions, permission declarations, or data in the spec.
- Trusted inputs: a host-created session controller, own registered component types, Map of exact opaque data references, Map of navigation/suggestion definitions, provenance and optional host Graph/Skill slots. The model cannot supply these inputs through the spec.
- Trusted shell navigation, connection/security state, secrets and approval dialogs are siblings outside the renderer and never components. Content always carries the host provenance banner and each component has an untrusted-label marker. Host-bound data is separately marked; neither source claims nor action clicks grant permission.
- Exact opaque DataRefs match `[a-z][a-z0-9_-]{0,63}`. No path evaluation or fallback lookup. `constructor`, `prototype`, `__proto__` are prohibited everywhere in JSON. Missing/ref-unknown differs from known zero, empty lists and stale projections.

## Wire contract
`{schema,catalogVersion,sessionId,surfaceId,baseRevision,rootId,components}`. Component IDs are unique and stable. Types: Group, Text, Status, Metric, TaskList, SourceList, GraphSlot, SkillSuggestionSlot, EventList. Group has children and layout `stack|split|focus`; focus emphasizes one immediate child but retains every child in DOM and reading order. Text has plain text. Other leaf components bind one dataRef. Optional actionRef resolves a host definition. Host Graph/Skill slots receive only host data and metadata; no generated code. No raw links.

## Admission
Bound raw bytes 256 KiB, JSON nesting 32, components 200, component tree depth 12, text 8 KiB UTF-8, max children 200 and host rows 200. Lower host-configured limits allowed. Reject duplicate JSON keys, non-JSON values, prototype keys, unsupported versions/properties/types, unknown registered components/actions, graph cycles, unreachable nodes, missing children, multiple parents and invalid focus. Validate atomically before increasing host revision. Session/surface IDs and baseRevision must match. Snapshots are deep-frozen. Invalid update retains exact last valid snapshot plus an explicit host rejection. Default update gate 50ms, host clock injection for tests. This is local backpressure, not a transport queue.

## Render and intents
Renderer subscribes to controller revision. Keyed components and group DOM do not change by layout; preserve focus by component ID for structural changes or move to host rejection/status anchor when removed. Native buttons support keyboard activation, busy deduplication, and safe callback rejection without raw error leaks. The delivery lock belongs to the host session, survives revisions/reparenting/remounts, and retains its visible pending state until its callback settles. Slot render errors retry only after an explicit host slot-input change. Controller verifies the current admitted snapshot/action/component at activation. Only typed navigation/suggestion intents leave via an explicit host callback; no executor, write action, approval, URL, auth or network API exists here. The host must reauthorize any eventual effect and must not blindly treat intents as writes.

Styles are bundled, scoped, relative font sizes, no fixed-height content clipping, mobile one-column fallback, visible focus. No animation; reduced-motion is respected by construction plus CSS override for descendants. Trusted slots own their accessibility, effects and GPU/resource cleanup.

## Verification boundaries
Node and HappyDOM test contract and DOM behavior only. No claim about installed Android, TalkBack, real browser focus/layout, GPU, WebView native bridge or production performance follows. Existing graph/skill modules are referenced in integration docs, never copied or edited. TASK/APP protocol tests remain outside scope until real adapters exist.
