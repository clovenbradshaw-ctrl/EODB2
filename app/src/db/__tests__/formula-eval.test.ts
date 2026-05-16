/**
 * Safe formula evaluator — replaces the CSP-blocked `new Function` path.
 */

import { describe, it, expect } from 'vitest';
import { evaluateFormulaExpression } from '../formula-eval';

describe('evaluateFormulaExpression', () => {
  it('evaluates arithmetic with operator precedence', () => {
    expect(evaluateFormulaExpression('1 + 2 * 3', {})).toBe(7);
    expect(evaluateFormulaExpression('(1 + 2) * 3', {})).toBe(9);
    expect(evaluateFormulaExpression('10 / 4', {})).toBe(2.5);
    expect(evaluateFormulaExpression('10 % 3', {})).toBe(1);
    expect(evaluateFormulaExpression('-5 + 2', {})).toBe(-3);
  });

  it('resolves parameter identifiers from scope', () => {
    expect(evaluateFormulaExpression('a + b', { a: 2, b: 5 })).toBe(7);
    expect(evaluateFormulaExpression('price * qty', { price: 3, qty: 4 })).toBe(12);
  });

  it('evaluates comparisons, logic, and ternaries', () => {
    expect(evaluateFormulaExpression('a > b', { a: 5, b: 3 })).toBe(true);
    expect(evaluateFormulaExpression('a >= 5 && b < 10', { a: 5, b: 3 })).toBe(true);
    expect(evaluateFormulaExpression('a > b ? a : b', { a: 2, b: 9 })).toBe(9);
    expect(evaluateFormulaExpression('!(a == b)', { a: 1, b: 2 })).toBe(true);
  });

  it('allows allowlisted Math members and rejects others', () => {
    expect(evaluateFormulaExpression('Math.max(3, 7, 1)', {})).toBe(7);
    expect(evaluateFormulaExpression('Math.floor(3.9)', {})).toBe(3);
    expect(evaluateFormulaExpression('Math.PI > 3', {})).toBe(true);
    // `random` is not on the allowlist — whole evaluation fails to null.
    expect(evaluateFormulaExpression('Math.random()', {})).toBeNull();
  });

  it('returns null instead of executing code or touching globals', () => {
    expect(evaluateFormulaExpression('globalThis', {})).toBeNull();
    expect(evaluateFormulaExpression('a.constructor', { a: 1 })).toBeNull();
    expect(evaluateFormulaExpression('1 +', {})).toBeNull();
    expect(evaluateFormulaExpression('', {})).toBeNull();
    // An unknown bare identifier resolves to null, not a crash.
    expect(evaluateFormulaExpression('unknownParam', {})).toBeNull();
  });

  it('does not resolve identifiers via the prototype chain', () => {
    // `toString` exists on Object.prototype but is not an own property of
    // the scope, so it must resolve to null, not the function.
    expect(evaluateFormulaExpression('toString', {})).toBeNull();
  });
});
