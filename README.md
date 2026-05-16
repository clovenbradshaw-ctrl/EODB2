# EODB2

A Matrix-backed, event-sourced database app — a clean rewrite of EO-DB.

EODB2 is a pure client-side application. It has no server: all data lives in
Matrix room events and the Matrix media store on `app.aminoimmigration.com`,
with one shared Matrix space for all users.

## Development

```bash
cd app
npm install
npm run dev      # vite dev server
npm run build    # tsc -b && vite build → ../docs
npm test         # vitest
```

## Status

Seeded from EO-DB's frontend. Google integrations and the natural-language
query stack were dropped on import. Remaining rewrite work — durability,
session lifecycle, single-space collapse, Matrix-only storage, and the
Airtable sync rebuild — is tracked in the rewrite plan.
