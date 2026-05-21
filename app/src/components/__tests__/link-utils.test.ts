import { describe, it, expect } from 'vitest';
import { extractLinkIds, extractLinkTargets } from '../link-utils';

describe('extractLinkIds', () => {
  it('returns [] for null/undefined/empty', () => {
    expect(extractLinkIds(null)).toEqual([]);
    expect(extractLinkIds(undefined)).toEqual([]);
    expect(extractLinkIds('')).toEqual([]);
    expect(extractLinkIds([])).toEqual([]);
  });

  it('returns short ids unchanged from a plain array', () => {
    expect(extractLinkIds(['EVT-001', 'EVT-002'])).toEqual(['EVT-001', 'EVT-002']);
  });

  it('shortens full target paths from a plain array', () => {
    expect(extractLinkIds(['import.cases.CASE-001', 'import.cases.CASE-002']))
      .toEqual(['CASE-001', 'CASE-002']);
  });

  it('unwraps Airtable { linked: [...] } objects to short ids', () => {
    expect(extractLinkIds({ linked: ['at.appA.tblB.rec001', 'at.appA.tblB.rec002'] }))
      .toEqual(['rec001', 'rec002']);
  });

  it('parses JSON-stringified arrays', () => {
    expect(extractLinkIds('["EVT-001","EVT-002"]')).toEqual(['EVT-001', 'EVT-002']);
  });

  it('wraps a single id string as a one-element array', () => {
    expect(extractLinkIds('EVT-001')).toEqual(['EVT-001']);
  });
});

describe('extractLinkTargets', () => {
  it('returns only strings that look like target paths', () => {
    expect(extractLinkTargets(['EVT-001', 'import.cases.CASE-001']))
      .toEqual(['import.cases.CASE-001']);
  });

  it('unwraps { linked: [...] } and keeps full paths', () => {
    expect(extractLinkTargets({ linked: ['at.appA.tblB.rec001', 'at.appA.tblB.rec002'] }))
      .toEqual(['at.appA.tblB.rec001', 'at.appA.tblB.rec002']);
  });

  it('returns [] for non-link shapes', () => {
    expect(extractLinkTargets(null)).toEqual([]);
    expect(extractLinkTargets('EVT-001')).toEqual([]);
    expect(extractLinkTargets({})).toEqual([]);
  });
});
