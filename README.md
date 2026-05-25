# EODB2

A Matrix-backed, event-sourced database app. Pure client-side: no server.
All data lives in Matrix room events on `app.aminoimmigration.com`.

## Architecture

```
┌─────────────────────────────────────────────┐
│             React app (App.tsx)             │
├─────────────────────────────────────────────┤
│            src/foundation/                  │
│   operators   │   fold                       │
│   emit(INS/…) │   state = fold(events)       │
│   rooms       │   client                     │
│   create/…    │   auth · sync · E2EE         │
│   pack        │   store                      │
│   binary log  │   OPFS persistence           │
├─────────────────────────────────────────────┤
│         matrix-js-sdk + Rust Crypto         │
├─────────────────────────────────────────────┤
│              Matrix Homeserver              │
└─────────────────────────────────────────────┘
```

Everything below `src/foundation/` is the bare-metal substrate. Everything
above it is the app. The foundation was ported from
[bare-metal-eo-matrix-app](https://github.com/clovenbradshaw-ctrl/bare-metal-eo-matrix-app).

## The nine operators

Every state change decomposes into one of these. Dependency-ordered:

| Op | Glyph | What it does |
|----|-------|--------------|
| NUL | ∅ | Observation (ephemeral) |
| SIG | ○ | Attention (ephemeral) |
| INS | ● | Instantiate — create a new entity with a content-addressed anchor |
| SEG | ｜ | Segment — move an entity across a partition boundary |
| CON | ⋈ | Connect — typed relationship between two anchors |
| SYN | △ | Synthesize — merge inputs into a whole |
| DEF | ⊢ | Define — set a value within the current frame |
| EVA | ⊨ | Evaluate — test a particular against a general |
| REC | ⊛ | Recontextualize — change what the data means |

The seven stored operators become Matrix timeline events. The fold replays
them deterministically into the current state.

## Development

```bash
cd app
npm install
npm run dev      # vite dev server
npm run build    # tsc -b && vite build → ../docs
npm test         # vitest
```

## Status

The account/encryption/room-sharing foundation has been replaced with the
bare-metal prototype. The MVP app on top covers: login + recovery key, room
create/discover/invite, and a table view that emits INS/DEF/SEG events and
re-renders from the fold. Airtable sync and other features will be rebuilt
on this foundation in follow-up work.
