# EODB2 — Claude Code Development Rules

EODB2 is a Matrix-backed, event-sourced database app. Pure client-side, no
server. All data lives in Matrix room events on `app.aminoimmigration.com`.
The substrate is the [bare-metal-eo-matrix-app](https://github.com/clovenbradshaw-ctrl/bare-metal-eo-matrix-app)
foundation, ported into `app/src/foundation/`.

## MANDATORY: TypeScript Build Check

After editing ANY `.ts`, `.tsx`, or `.js` file under `app/`, you MUST run:

```bash
cd app && npx tsc -b --noEmit
```

Run this BEFORE committing. Do NOT commit if it fails. Fix all errors first.

CI runs `tsc -b && vite build` and `vitest` on every push — the same errors
will fail the pipeline.

## Layer Rules

- **`app/src/foundation/`** is the substrate. It's authored in plain JS with
  sibling `.d.ts` files. Do NOT import anything from outside this directory
  inside foundation files. The foundation owns: auth, sync, crypto, the
  operator algebra, the fold, room management, packing, and OPFS storage.
- **Everything above `app/src/foundation/`** is the app. It imports from the
  foundation but never modifies it directly. If a foundation change is
  needed, port it back from bare-metal or extend it deliberately — and
  update the sibling `.d.ts`.

## TypeScript Error Checklist

These patterns recur and break CI. Verify each one when editing TypeScript:

### 1. Interface completeness
When adding a field to an interface or type, grep for every place that
constructs an object of that type and add the new field to each one.

### 2. Union type narrowing
When accessing a property that only exists on some members of a union type,
use an `in` guard before accessing it. Never cast a union directly to access
a member-specific property.

### 3. Stale references after deletions
When deleting code, search the entire file for every reference to the
deleted identifier before committing. Partial deletions are the #1 cause of
CI failures.

### 4. Dead code after early returns
If you add an early `return` to disable a function body, delete all code
below it. For unused parameters, add `void paramName;` before the return.

### 5. Browser API type mismatches
`Uint8Array` is NOT assignable to `BufferSource` or `BodyInit` in strict
mode. Wrap in `new Blob([data])` for `fetch` bodies; cast explicitly for
`SubtleCrypto`.

### 6. Duplicate exports
Before adding a named export, verify the same name isn't already exported
from that file.

## Project Layout

| Path | Description |
|------|-------------|
| `app/src/foundation/` | Bare-metal substrate: `client` / `operators` / `fold` / `rooms` / `pack` / `store` (JS + sibling `.d.ts`) |
| `app/src/App.tsx` | Top-level state machine: initializing → logged_out → active |
| `app/src/components/` | React UI: `Login`, `MainShell`, `RoomList`, `TableView`, `RecoveryModals`, `Log` |
| `app/src/styles.css` | Single global stylesheet |
| `app/tsconfig.json` | Strict mode, ES2022, `allowJs: true`, `checkJs: false`, bundler resolution |
| `.github/workflows/ci.yml` | Builds + tests `app/`; publishes `docs/` on `main` |

## The Nine Operators

| Op | Glyph | Order | Stored | Meaning |
|----|-------|-------|--------|---------|
| NUL | ∅ | 0 | no | Observation |
| SIG | ○ | 1 | no | Attention |
| INS | ● | 2 | yes | Instantiate an entity (anchor is content-addressed) |
| SEG | ｜ | 3 | yes | Move an entity across a partition |
| CON | ⋈ | 4 | yes | Typed relationship between two anchors |
| SYN | △ | 5 | yes | Merge entities into a synthesized whole |
| DEF | ⊢ | 6 | yes | Set a value at a path within an entity |
| EVA | ⊨ | 7 | yes | Evaluate an entity against a criterion |
| REC | ⊛ | 8 | yes | Recontextualize: change what the data means |

The seven stored operators become Matrix timeline events. The fold replays
them deterministically into state. Same events in, same state out. State is
never persisted directly; it is always derived from the event log.

## Status

The account/encryption/room-sharing foundation has been replaced with the
bare-metal prototype. The MVP app on top covers: login + recovery key, room
create/discover/invite, and a table view that emits INS/DEF/SEG and
re-renders from the fold. Airtable sync (an "Airtable killer" import +
writeback) and other features will be rebuilt on this foundation in
follow-up work. Chat / messaging / collab-editing are intentionally not
coming back.
