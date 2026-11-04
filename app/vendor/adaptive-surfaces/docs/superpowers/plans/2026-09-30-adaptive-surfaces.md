# Adaptive Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans; this is an isolated candidate, not the main branch.

**Goal:** Implement an offline, strictly bounded surface renderer behind a trusted host boundary.
**Architecture:** Closed JSON Schema → bounded JSON parser and atomic session admission → keyed React renderer with host-only bindings/actions/slots. Plain text and visible provenance throughout.
**Tech Stack:** TypeScript 5.9, React 19.2.6, Vite 8, Node test, HappyDOM (DOM simulation only).
**Spec:** `docs/SPEC.md`

## Global constraints
Only adaptive-surfaces files change. No publication, external protocol runtime, OAuth, network binding, writes or third-party code. Registered host components/data/actions are separate trusted inputs. JSON uses the exact v1 schema. Existing graph/skill code remains untouched.

## 1. Contract and admission
- [x] Write tests in `tests/contract.test.ts` against `createSurfaceSession`, `getSnapshot`, `submit`, and `getIntent`; fixture in `tests/fixture.ts`
- [x] Create a deliberately unimplemented entrypoint and run tests, record red result
- [x] Implement `src/types.ts`, `schema/surface-v1.schema.json`, `src/json.ts`, `src/validate.ts`, `src/session.ts`; input `submit(raw:string)` returns `{ok,code?}` and `getSnapshot()` returns stable frozen record `{revision,proposal,error}`
- [x] Verify schema versions, unknown type/property, dangerous text-as-text vs forbidden fields, actions/approval, path keys, JSON duplicate keys/size/depth, graph invariants, stale/session mismatch, throttling and atomic failure

## 2. React surface
- [x] Write `tests/ui.test.tsx` exercising `SurfaceRenderer({session,data,slots,onIntent})` with real DOM buttons, missing/zero/stale data, escaped text and safe rejection
- [x] Run tests red, preserve log
- [x] Implement `src/SurfaceRenderer.tsx`, `src/styles.css`: typed host projection rendering, stable keys, focus restoration, limited group layouts, accessible native controls, caught callback errors, host slots
- [x] Run DOM tests including layout/reparent/remove focus, action replay, keyboard semantic contract, host slot errors and host data updates

## 3. Demo and handoff
- [x] Implement `src/demo.tsx` + `index.html` using immutable fixture data and inert hostslots; show fixed shell and layout buttons outside surface
- [x] Write `README.md`, `docs/INTEGRATION.md`, `docs/TEST-MATRIX.md` covering mount/unmount, explicit data/actions, origin, adapter non-goals and real Android gates
- [x] Run `npm test`, `npm run build` against final tree; preserve evidence in docs
- [x] Return exact paths, results and limitations for independent review

No commits or publication requested; no external branch operations.
