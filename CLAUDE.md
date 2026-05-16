# EODB2 — Claude Code Development Rules

EODB2 is a clean rewrite of EO-DB: a Matrix-backed, event-sourced database app.
It is a **pure client-side app** — no server. All data lives in Matrix room
events and the Matrix media store on `app.aminoimmigration.com`. One shared
Matrix space serves all users.

## MANDATORY: TypeScript Build Check

After editing ANY `.ts` or `.tsx` file under `app/`, you MUST run:

```bash
cd app && npx tsc -b --noEmit
```

Run this BEFORE committing. Do NOT commit if it fails. Fix all errors first.

CI runs `tsc -b && vite build` and `vitest` on every push — the same errors
will fail the pipeline.

## TypeScript Error Checklist

These 6 patterns repeatedly broke CI in the predecessor repo. Verify each one
when editing TypeScript:

### 1. Interface completeness
When adding a field to an interface or type, grep for every place that
constructs an object of that type and add the new field to each one.

### 2. Union type narrowing
When accessing a property that only exists on some members of a union type,
use an `in` guard before accessing it. Never cast a union directly to access a
member-specific property.

### 3. Stale references after deletions
When deleting code (state variables, functions, imports, components), search
the entire file for every reference to the deleted identifier before
committing. Partial deletions are the #1 cause of CI failures.

### 4. Dead code after early returns
If you add an early `return` to disable a function body, delete all code below
it. For unused parameters, add `void paramName;` before the return.

### 5. Browser API type mismatches
`Uint8Array` is NOT assignable to `BufferSource` or `BodyInit` in strict mode.
Wrap in `new Blob([data])` for `fetch` bodies; cast explicitly for
`SubtleCrypto`.

### 6. Duplicate exports
Before adding a named export, verify the same name isn't already exported from
that file.

## Project Layout

| Path | Description |
|------|-------------|
| `app/` | React/Vite/TypeScript frontend (build: `tsc -b && vite build`) |
| `app/tsconfig.json` | Strict mode, ES2022, noEmit, bundler resolution |
| `app/src/db/` | EO event log + fold/projection engine + OPFS cache |
| `app/src/matrix/` | Matrix client, sync, event bridge, snapshots |
| `app/src/sync/` | Block sealer/hydration, P2P network-sync |
| `app/src/ingestion/` | Airtable sync (source + writeback) |
| `.github/workflows/ci.yml` | Builds + tests `app/`; deploys to GitHub Pages on `main` |

## Migration Notes

This repo was seeded from EO-DB's `github-matrix-dev/app/`. Dropped on import:
Google OAuth/Calendar and the natural-language query stack. Pending rewrite
phases (see the rewrite plan): durability barrier, session lifecycle state
machine, single-space collapse, Matrix-only storage (drop n8n/Drive), and the
Airtable sync rebuild around a single concurrency gate.
