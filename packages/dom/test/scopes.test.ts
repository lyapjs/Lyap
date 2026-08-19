/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { Lyap } from '../src/index.js';

describe('Scopes & Lifecycle', () => {
  it('throws on duplicate state, derived, or actions registration calls', () => {
    const div = document.createElement('div');
    const script = document.createElement('script');
    div.appendChild(script);
    document.body.appendChild(div);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const scope = Lyap.scope('scopeDup');

    scope.state({ count: 0 });
    expect(() => scope.state({ other: 1 })).toThrow('Scope scopeDup already registered state');

    scope.derived({ double: () => scope.count * 2 });
    expect(() => scope.derived({ triple: () => scope.count * 3 })).toThrow('Scope scopeDup already registered derived values');

    scope.actions({ inc: () => scope.count++ });
    expect(() => scope.actions({ dec: () => scope.count-- })).toThrow('Scope scopeDup already registered actions');
  });

  it('throws on member collision and reserved keywords', () => {
    const div = document.createElement('div');
    const script = document.createElement('script');
    div.appendChild(script);
    document.body.appendChild(div);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const scope = Lyap.scope('scopeCol');

    expect(() => scope.state({ cleanup: 1 })).toThrow('Scope member collision: scopeCol.cleanup');
  });

  it('enforces read-only derived values', () => {
    const div = document.createElement('div');
    const script = document.createElement('script');
    div.appendChild(script);
    document.body.appendChild(div);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const scope = Lyap.scope('scopeDer');

    scope.state({ num: 5 }).derived({ double: () => scope.num * 2 });

    expect(scope.double).toBe(10);
    expect(() => {
      scope.double = 20;
    }).toThrow('Cannot assign to derived value: scopeDer.double');
  });

  it('supports ancestor scope access by name', async () => {
    const parent = document.createElement('div');
    const parentScript = document.createElement('script');
    parent.appendChild(parentScript);

    const child = document.createElement('div');
    const childScript = document.createElement('script');
    child.appendChild(childScript);
    parent.appendChild(child);

    const targetText = document.createElement('p');
    targetText.setAttribute('ly-text', 'parentScope.title');
    child.appendChild(targetText);

    document.body.appendChild(parent);

    Object.defineProperty(document, 'currentScript', { value: parentScript, configurable: true });
    const parentScope = Lyap.scope('parentScope');
    parentScope.state({ title: 'Parent Title' });

    Object.defineProperty(document, 'currentScript', { value: childScript, configurable: true });
    const childScope = Lyap.scope('childScope');
    childScope.state({ childVal: 123 });

    const runtime = Lyap.mount(parent);
    await runtime.ready;

    expect(targetText.textContent).toBe('Parent Title');
    void runtime.destroy();
  });
});
