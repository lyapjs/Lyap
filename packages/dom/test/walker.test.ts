// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { walkTree } from '../src/walker.js';

describe('Walker Module (Prototype 2)', () => {
  it('walks DOM trees and initializes reactive scope from <script type="lyap">', () => {
    document.body.innerHTML = `
      <div id="container">
        <script type="lyap">
          state({ title: 'Lyap Engine' });
        </script>
        <h1 id="title" ly-text="title"></h1>
      </div>
    `;

    walkTree(document.body);
    const title = document.getElementById('title')!;
    expect(title.textContent).toBe('Lyap Engine');
  });
});
