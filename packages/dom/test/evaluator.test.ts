import { describe, it, expect } from 'vitest';
import { evaluateExpression } from '../src/evaluator.js';
import { parseLyapScript } from '../src/script-parser.js';

describe('AST Micro-Evaluator (Prototype 2)', () => {
  it('evaluates primitive literals', () => {
    const scope = {};
    expect(evaluateExpression('42', { scope })).toBe(42);
    expect(evaluateExpression("'hello'", { scope })).toBe('hello');
    expect(evaluateExpression('true', { scope })).toBe(true);
    expect(evaluateExpression('null', { scope })).toBe(null);
  });

  it('parses <script type="lyap"> state via script-parser', () => {
    const script = `
      state({ count: 10, title: 'Lyap Engine' });
    `;
    const parsed = parseLyapScript(script);
    expect(parsed.state.count).toBe(10);
    expect(parsed.state.title).toBe('Lyap Engine');
    expect(evaluateExpression('title', { scope: parsed.state })).toBe('Lyap Engine');
  });

  it('strips leading colon from inline actions', () => {
    const scope = { count: 0 };
    evaluateExpression(':count++', { scope });
    expect(scope.count).toBe(1);
  });

  it('evaluates arithmetic and logical operations', () => {
    const scope = { a: 10, b: 5 };
    expect(evaluateExpression('a + b', { scope })).toBe(15);
    expect(evaluateExpression('a > b', { scope })).toBe(true);
    expect(evaluateExpression('a == 10 && b == 5', { scope })).toBe(true);
  });

  it('evaluates ternary expressions', () => {
    const scope = { active: true };
    expect(evaluateExpression("active ? 'yes' : 'no'", { scope })).toBe('yes');
  });

  it('supports magic variables', () => {
    const fakeEvent = { target: { value: 'test' } } as any;
    const scope = { search: '' };
    evaluateExpression(':search = $event.target.value', { scope, event: fakeEvent });
    expect(scope.search).toBe('test');
  });

  it('blocks banned identifiers', () => {
    const scope = {};
    expect(() => evaluateExpression('window.location', { scope })).toThrow(/Forbidden identifier/);
    expect(() => evaluateExpression('fetch("/api")', { scope })).toThrow(/Forbidden identifier/);
  });
});
