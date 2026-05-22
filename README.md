# EODB2

A Matrix-backed, event-sourced database app — rebuilt from the floor up.

EODB2 is a pure client-side app. There's no server. All data lives in
Matrix room events on the user's homeserver. Each event is an EO record
(operator + site + resolution); the client folds the timeline into the
materialized state shown in the UI.

This is **v2**, rebuilt from the sanity-check (`docs/sanity-check.html`)
that proved Matrix is a sufficient transport. v1 is preserved on the
`archive/v1` branch.

## Development

```bash
cd app
npm install
npm run dev      # vite dev server
npm run build    # tsc -b && vite build → ../docs
npm test         # vitest
```

## Architecture

- **`app/src/matrix/rest.ts`** — raw fetch helpers (no SDK). Login, room
  join/create, `sendEvent`, `getMessages`, media upload/download. Direct
  port of the sanity-check flow.
- **`app/src/db/fold.ts`** — pure fold reducer. Applies an EO event to a
  record map. Last-writer-wins by `ts`.
- **`app/src/store/eo-store.ts`** — single Zustand store. Holds session,
  events, materialized records. `dispatch()` is the one write path:
  optimistic local apply → REST PUT → stamp `event_id` on ack.
  `hydrate()` paginates `/messages` backward and folds.
- **`app/src/components/`** — `Login`, `Layout`, `CollectionSidebar`,
  `RecordList`, `RecordDrawer`. Nothing else.

## Reference

- `docs/sanity-check.html` — the original plain-HTML proof of the REST
  flow. Open it directly in a browser; it logs every Matrix call.
- `archive/v1` branch — the previous codebase (~70k LOC) preserved for
  reference. Not deployed.
