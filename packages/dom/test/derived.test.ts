// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { walkTree, getScope } from '../src/index.js';

describe('derived reactivity', () => {
  it('recomputes when a dependency changes', async () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({ count: 0 });
          derived({ doubleCount() { return count * 2; } });
        </script>
        <p>Count: <strong id="c" ly-text="count"></strong> | Double: <strong id="d" ly-text="doubleCount"></strong></p>
        <button id="plus" ly-on:click=":count++">+</button>
      </div>
    `;

    walkTree(document.body);
    const app = document.getElementById('app')!;
    const scope = getScope(app)!;
    const c = document.getElementById('c')!;
    const d = document.getElementById('d')!;

    expect(c.textContent).toBe('0');
    expect(d.textContent).toBe('0');

    document.getElementById('plus')!.dispatchEvent(new Event('click'));
    await new Promise((r) => setTimeout(r, 30));

    expect(c.textContent).toBe('1');
    expect(d.textContent).toBe('2');

    scope.state.count = 5;
    await new Promise((r) => setTimeout(r, 30));
    expect(d.textContent).toBe('10');
  });
});
