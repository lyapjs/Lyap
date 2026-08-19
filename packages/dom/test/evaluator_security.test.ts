/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { evaluateExpression } from '../src/evaluator.js';

describe('Evaluator Security & Restrictions', () => {
  const dummyContext = {
    resolveScope: (name: string) => (name === 'app' ? { count: 1 } : undefined)
  };

  it('rejects forbidden identifiers and properties', () => {
    expect(() => evaluateExpression('window', dummyContext)).toThrow('Forbidden identifier: window');
    expect(() => evaluateExpression('document', dummyContext)).toThrow('Forbidden identifier: document');
    expect(() => evaluateExpression('app.constructor', dummyContext)).toThrow('Forbidden property: constructor');
    expect(() => evaluateExpression('app.__proto__', dummyContext)).toThrow('Forbidden property: __proto__');
  });

  it('evaluates valid arithmetic, logical, ternary, and member expressions', () => {
    expect(evaluateExpression('app.count + 5', dummyContext)).toBe(6);
    expect(evaluateExpression('app.count > 0 ? "yes" : "no"', dummyContext)).toBe('yes');
    expect(evaluateExpression('!false && true', dummyContext)).toBe(true);
  });

  it('rejects arbitrary non-action function calls', () => {
    const scopeCtx = {
      resolveScope: (name: string) => (name === 'app' ? { str: 'test' } : undefined)
    };
    expect(() => evaluateExpression('app.str.toUpperCase()', scopeCtx)).toThrow('Only registered actions may be called');
  });
});
