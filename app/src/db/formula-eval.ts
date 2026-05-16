/**
 * Safe formula expression evaluator.
 *
 * EVA formulas arrive via Matrix-synced events (untrusted peers), so they
 * must never reach `eval` / `new Function` — and the page's Content
 * Security Policy blocks those constructs anyway, which silently broke
 * formula fields in production.
 *
 * This is a small tokenizer + recursive-descent evaluator for the formula
 * sub-language: numeric / boolean / null literals, the parameter
 * identifiers supplied in `scope`, arithmetic / comparison / logical /
 * ternary operators, parentheses, and a fixed allowlist of `Math.*`
 * members. There is no code execution — only arithmetic. It cannot read
 * globals, index into objects/arrays, walk a prototype chain, or call
 * anything but allowlisted `Math` functions. Any unsupported or malformed
 * construct makes the whole evaluation return `null`.
 */

const MATH_METHODS = new Set([
  'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh',
  'cbrt', 'ceil', 'clz32', 'cos', 'cosh', 'exp', 'expm1', 'floor',
  'fround', 'hypot', 'imul', 'log', 'log10', 'log1p', 'log2', 'max',
  'min', 'pow', 'round', 'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh',
  'trunc',
]);

const MATH_CONSTS: Record<string, number> = {
  E: Math.E, LN2: Math.LN2, LN10: Math.LN10, LOG2E: Math.LOG2E,
  LOG10E: Math.LOG10E, PI: Math.PI, SQRT1_2: Math.SQRT1_2, SQRT2: Math.SQRT2,
};

const MAX_DEPTH = 64;

// ─── Tokenizer ────────────────────────────────────────────────────────────

type Tok =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

const RE_NUM = /\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?/y;
const RE_ID = /[A-Za-z_$][A-Za-z0-9_$]*/y;
const OPS3 = ['===', '!=='];
const OPS2 = ['==', '!=', '<=', '>=', '&&', '||'];
const OPS1 = '+-*/%<>!(),.?:';

class FormulaError extends Error {}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }

    if ((c >= '0' && c <= '9') || (c === '.' && /\d/.test(src[i + 1] ?? ''))) {
      RE_NUM.lastIndex = i;
      const m = RE_NUM.exec(src);
      if (!m || m.index !== i) throw new FormulaError('bad number');
      toks.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }

    if (/[A-Za-z_$]/.test(c)) {
      RE_ID.lastIndex = i;
      const m = RE_ID.exec(src);
      if (!m || m.index !== i) throw new FormulaError('bad identifier');
      toks.push({ t: 'id', v: m[0] });
      i += m[0].length;
      continue;
    }

    const three = src.slice(i, i + 3);
    if (OPS3.includes(three)) { toks.push({ t: 'op', v: three }); i += 3; continue; }
    const two = src.slice(i, i + 2);
    if (OPS2.includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
    if (OPS1.includes(c)) { toks.push({ t: 'op', v: c }); i += 1; continue; }

    throw new FormulaError(`unexpected character: ${c}`);
  }
  return toks;
}

// ─── Recursive-descent evaluator ──────────────────────────────────────────

class Parser {
  private pos = 0;
  private depth = 0;

  constructor(
    private readonly toks: Tok[],
    private readonly scope: Record<string, unknown>,
  ) {}

  evaluate(): unknown {
    const v = this.ternary();
    if (this.pos !== this.toks.length) throw new FormulaError('trailing tokens');
    return v;
  }

  private peek(): Tok | undefined { return this.toks[this.pos]; }

  private isOp(v: string): boolean {
    const t = this.toks[this.pos];
    return t !== undefined && t.t === 'op' && t.v === v;
  }

  private eatOp(v: string): void {
    if (!this.isOp(v)) throw new FormulaError(`expected '${v}'`);
    this.pos++;
  }

  private enter(): void {
    if (++this.depth > MAX_DEPTH) throw new FormulaError('expression too deep');
  }

  private ternary(): unknown {
    this.enter();
    const cond = this.logicalOr();
    if (this.isOp('?')) {
      this.pos++;
      const whenTrue = this.ternary();
      this.eatOp(':');
      const whenFalse = this.ternary();
      this.depth--;
      return cond ? whenTrue : whenFalse;
    }
    this.depth--;
    return cond;
  }

  private logicalOr(): unknown {
    let v = this.logicalAnd();
    while (this.isOp('||')) { this.pos++; const r = this.logicalAnd(); v = v || r; }
    return v;
  }

  private logicalAnd(): unknown {
    let v = this.equality();
    while (this.isOp('&&')) { this.pos++; const r = this.equality(); v = v && r; }
    return v;
  }

  private equality(): unknown {
    let v = this.relational();
    for (;;) {
      const t = this.peek();
      if (t?.t !== 'op' || !['==', '!=', '===', '!=='].includes(t.v)) break;
      this.pos++;
      const r = this.relational();
      // eslint-disable-next-line eqeqeq
      if (t.v === '==') v = v == r;
      else if (t.v === '!=') v = v != r;
      else if (t.v === '===') v = v === r;
      else v = v !== r;
    }
    return v;
  }

  private relational(): unknown {
    let v = this.additive();
    for (;;) {
      const t = this.peek();
      if (t?.t !== 'op' || !['<', '>', '<=', '>='].includes(t.v)) break;
      this.pos++;
      const r = this.additive();
      const a = v as number; const b = r as number;
      if (t.v === '<') v = a < b;
      else if (t.v === '>') v = a > b;
      else if (t.v === '<=') v = a <= b;
      else v = a >= b;
    }
    return v;
  }

  private additive(): unknown {
    let v = this.multiplicative();
    for (;;) {
      const t = this.peek();
      if (t?.t !== 'op' || (t.v !== '+' && t.v !== '-')) break;
      this.pos++;
      const r = this.multiplicative();
      // `+` keeps JS semantics (numeric add or string concat), mirroring
      // the previous Function-based evaluator.
      v = t.v === '+'
        ? (v as number) + (r as number)
        : (v as number) - (r as number);
    }
    return v;
  }

  private multiplicative(): unknown {
    let v = this.unary();
    for (;;) {
      const t = this.peek();
      if (t?.t !== 'op' || !['*', '/', '%'].includes(t.v)) break;
      this.pos++;
      const r = this.unary();
      const a = v as number; const b = r as number;
      if (t.v === '*') v = a * b;
      else if (t.v === '/') v = a / b;
      else v = a % b;
    }
    return v;
  }

  private unary(): unknown {
    const t = this.peek();
    if (t?.t === 'op' && (t.v === '-' || t.v === '+' || t.v === '!')) {
      this.pos++;
      const operand = this.unary();
      if (t.v === '-') return -(operand as number);
      if (t.v === '+') return +(operand as number);
      return !operand;
    }
    return this.primary();
  }

  private primary(): unknown {
    const t = this.peek();
    if (t === undefined) throw new FormulaError('unexpected end of expression');

    if (t.t === 'num') { this.pos++; return t.v; }

    if (t.t === 'op' && t.v === '(') {
      this.pos++;
      const v = this.ternary();
      this.eatOp(')');
      return v;
    }

    if (t.t === 'id') {
      this.pos++;
      switch (t.v) {
        case 'true': return true;
        case 'false': return false;
        case 'null': return null;
        case 'undefined': return undefined;
      }
      if (t.v === 'Math') return this.mathMember();
      // A parameter identifier — resolved ONLY as an own property of the
      // supplied scope, never via the prototype chain.
      if (Object.prototype.hasOwnProperty.call(this.scope, t.v)) {
        return this.scope[t.v];
      }
      // Unknown identifier — treat as null rather than crashing the fold.
      return null;
    }

    throw new FormulaError(`unexpected token: ${t.v}`);
  }

  /** Parse a `Math.member` access or `Math.method(args...)` call. */
  private mathMember(): unknown {
    this.eatOp('.');
    const member = this.peek();
    if (member?.t !== 'id') throw new FormulaError('expected Math member');
    this.pos++;

    if (this.isOp('(')) {
      if (!MATH_METHODS.has(member.v)) {
        throw new FormulaError(`Math.${member.v} is not allowed`);
      }
      this.pos++;
      const args: number[] = [];
      if (!this.isOp(')')) {
        args.push(this.ternary() as number);
        while (this.isOp(',')) { this.pos++; args.push(this.ternary() as number); }
      }
      this.eatOp(')');
      const fn = (Math as unknown as Record<string, (...a: number[]) => number>)[member.v];
      return fn(...args);
    }

    if (member.v in MATH_CONSTS) return MATH_CONSTS[member.v];
    throw new FormulaError(`Math.${member.v} is not allowed`);
  }
}

/**
 * Evaluate a formula expression against a set of named inputs. Returns the
 * computed value, or `null` if the expression is malformed or uses an
 * unsupported construct. Never throws, never executes code.
 */
export function evaluateFormulaExpression(
  expr: string,
  scope: Record<string, unknown>,
): unknown {
  try {
    const toks = tokenize(expr);
    if (toks.length === 0) return null;
    return new Parser(toks, scope).evaluate();
  } catch {
    return null;
  }
}
