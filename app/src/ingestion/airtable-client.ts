/**
 * Re-export shim. The real implementation lives in `src/shared/airtable/`.
 * Typed error classes are re-exported so callers can `instanceof`-check
 * them instead of pattern-matching error strings.
 */

export * from '../shared/airtable/client';
export * from '../shared/airtable/errors';
