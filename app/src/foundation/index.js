/**
 * Foundation — the four-layer base from bare-metal-eo-matrix-app.
 *
 * client.js     — auth, session, Megolm E2EE, recovery key
 * operators.js  — the nine operators (INS / DEF / SEG / CON / SYN / EVA / REC)
 * fold.js       — deterministic state projection from events
 * rooms.js      — create / discover / invite / timeline
 * pack.js       — binary 24-byte-header event serialization
 * store.js      — OPFS-backed append-only log per room
 *
 * Everything above this layer is the app. Everything in this directory is
 * the universal substrate. Do not import from outside `src/foundation/`
 * within these files.
 */

export * from './client.js';
export * from './operators.js';
export * from './fold.js';
export * from './rooms.js';
export * from './pack.js';
export * from './store.js';
