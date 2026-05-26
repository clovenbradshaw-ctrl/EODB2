/**
 * Foundation — the substrate from bare-metal-eo-matrix-app.
 *
 *   client     — auth, session, Megolm E2EE, recovery key
 *   operators  — the nine operators (INS / DEF / SEG / CON / SYN / EVA / REC)
 *   fold       — deterministic state projection from events
 *   rooms      — create / discover / invite / timeline / local-echo
 *   pack       — binary 24-byte-header event serialization
 *   store      — vault-encrypted OPFS append-only log per room
 *   vault      — local-at-rest AES-GCM key derived from password
 *   outbox     — offline-first IndexedDB send queue + flusher
 *   network    — online / degraded / offline observation
 *   media      — large-payload hoisting via Matrix media endpoint
 *
 * Everything above this directory is the app. Nothing inside this directory
 * imports from outside it.
 */

export * from './client.js';
export * from './operators.js';
export * from './fold.js';
export * from './rooms.js';
export * from './pack.js';
export * from './store.js';
export * from './vault.js';
export * from './outbox.js';
export * from './network.js';
export * from './media.js';
