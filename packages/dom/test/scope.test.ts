// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Lyap, walkTree, getScope } from '../src/index.js';

describe('Scope teardown (destroy/unmount)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('destroy() disposes effects and removes the scope', async () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({ count: 0 });
        </script>
        <span id="out" ly-text="count"></span>
      </div>
    `;

    walkTree(document.body);
    const app = document.getElementById('app')!;
    const scope = getScope(app)!;
    const out = document.getElementById('out')!;

    expect(out.textContent).toBe('0');
    expect(getScope(app)).toBe(scope);

    Lyap.destroy(app);

    // The #app scope is removed from the registry (getScope now resolves to the
    // fallback body scope, not the destroyed component scope).
    expect(getScope(app)).not.toBe(scope);

    // The reactive effect is disposed: mutating state no longer touches the DOM.
    scope.state.count = 99;
    await new Promise((r) => setTimeout(r, 0));
    expect(out.textContent).toBe('0');
  });

  it('destroy() removes event listeners registered via ly-on', async () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({ n: 0 });
          function inc() { n++; }
        </script>
        <span id="out" ly-text="n"></span>
        <button id="btn" ly-on:click="inc()">+</button>
      </div>
    `;

    walkTree(document.body);
    const app = document.getElementById('app')!;
    const btn = document.getElementById('btn')!;
    const out = document.getElementById('out')!;

    btn.dispatchEvent(new Event('click'));
    await new Promise((r) => setTimeout(r, 0));
    expect(out.textContent).toBe('1');

    const removeSpy = vi.spyOn(btn, 'removeEventListener');
    Lyap.destroy(app);
    expect(removeSpy).toHaveBeenCalled();

    // Listener gone + effect disposed: further clicks are no-ops.
    btn.dispatchEvent(new Event('click'));
    await new Promise((r) => setTimeout(r, 0));
    expect(out.textContent).toBe('1');
  });
});
