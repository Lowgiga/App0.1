# Cue Command Mesh: offline skill core v0.1

## Purpose and explicit boundaries
An original, isolated implementation of the skill-packaging and progressive-disclosure ideas in the cited Gemini CLI/Agent Skills documentation. It does not implement Gemini Web, install skills, call a model, connect tools, execute package scripts, publish anything, or edit the dashboard. Existing mesh catalog data is untrusted descriptive snapshot data, never evidence of installed tools.

## Contracts
- A directory contains standard `SKILL.md` (YAML frontmatter `name`, `description`, optional `compatibility`) and a separate `cue-skill.json` custom contract. Standard fields keep standard meanings. A strict JSON-string-valued subset of YAML frontmatter is supported; other YAML forms fail explicitly.
- Custom namespace `cue.command-mesh.skill/v1`: `id`, semantic `version`, `versionHash`, metadata, structured trigger tags, strict input/output schema subset, declared tool requirements, static handler name, declared file paths and SHA-256 hashes. `versionHash` is the SHA-256 of canonical JSON of all other manifest fields including per-file hashes. It pins content; it is not a publisher signature.
- Metadata is loaded alone at discovery. Instructions and individual references are loaded explicitly; every file read verifies its declared hash. Full verification is explicit and needed before readiness/execution. Path traversal, absolute paths, backslashes, encoded paths, symlinks, special files, unlisted files, executable resource types, duplicate IDs and unknown contract fields are rejected.
- Schema subset: objects with properties/required/additionalProperties=false, bounded arrays, strings, numbers, integers, booleans, null, enum. Unsupported keywords fail closed; no remote refs or executable validators.
- Routing accepts host-normalized exact `intent`, `tags`, `nodeTypes`. Negative tags veto; required tags must all match; positive tags are exact set intersections. Score and ID tie-break are stable and reasons explicit. Free text is never interpreted as a permission or executed.
- Capability statuses are separate: catalogued, configured, authenticated, authorized, checked, ready, unknown. Each dimension is `yes`, `no`, `unknown`, or `not-required` where meaningful. No inferred upgrade from catalogued to installed/ready.
- Host-only authority issues opaque, in-process evidence handles with issue/expiry times, tool identity, test evidence and permission list. The kernel accepts only handles minted by the supplied authority; JSON copies and lookalike objects are not evidence. The factory is trusted host code, not exposed to package text. Same-process hostile JS is outside the boundary; a production host must isolate it.
- Local builtins require explicit host evidence, exact skill version approval, a passing version-pinned skill test and tool check. Evidence expires. External writes always blocked. External reads also non-executable in this offline candidate, even if readiness evidence is supplied.
- Prompt bundle is JSON with host policy instructions separate from untrusted skill instructions, resources, request and input data. It is not a messages array or a system-role adapter. UTF-8 whole-envelope byte limit fails closed, no truncation. Prompt separation is defense-in-depth, not a claim of LLM injection immunity.
- Inspector returns selected/rejected candidates, selection reasons, all readiness dimensions, missing tools/permissions and actual host test status. A separate monotonic-sequence in-memory event log records loading/routing/runs without raw prompts or secrets; retention is capped at 4096 entries and paginated (default 256, maximum 1024) with visible dropped counts.

## Original examples
`cue.mission-check`: deterministic field/completion audit of supplied mission data.
`cue.graph-explain`: counts and sorted adjacency of supplied graph; reports dangling edges.
`cue.backup-plan`: a static verification plan for a supplied backup description; never claims a restore/test occurred.
`cue.source-status`: classifies supplied source records as snapshot/live-claim/unknown; never verifies a connector or installed-tool count.

## Limits
No persistent log storage, connector bridge, model adapter, remote execution, dashboard integration, signing infrastructure, or secure hostile multi-user filesystem mount. Root and ancestors must be trusted and immutable during load. Files are opened with NOFOLLOW and checked before/after read; host must prevent concurrent directory replacement (portable Node cannot supply openat2 directory confinement).
