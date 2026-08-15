// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { walkTree } from '../src/walker.js';
import { getScope, destroyScope } from '../src/scope.js';

describe('Cleanup Hook', () => {
  it('runs cleanup() registered inside mount() when the scope is destroyed', () => {
    document.body.innerHTML = `
      <div id="container">
        <script type="lyap">
          state({ ran: false });
          mount(() => {
            cleanup(() => { ran = true; });
          });
        </script>
      </div>
    `;

    walkTree(document.body);
    const container = document.getElementById('container')!;
    const scope = getScope(container)!;
    expect(scope.state.ran).toBe(false);

    destroyScope(scope);
    expect(scope.state.ran).toBe(true);
  });
});