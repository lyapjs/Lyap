import { walkTree } from './walker.js';
import { createScope, getScope, destroyScope } from './scope.js';
import { evaluateExpression, executeStatement } from './evaluator.js';
import { signal, effect, store, computed, untrack } from '@lyapjs/reactive';

export const Lyap = {
  version: '2.0.0-proto',
  walk: (root: Node = document.body) => {
    walkTree(root);
  },
  boot: () => {
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          walkTree(document.body);
        });
      } else {
        walkTree(document.body);
      }
    }
  },
  evaluate: evaluateExpression,
  execute: executeStatement,
  walkTree,
  createScope,
  getScope,
  evaluateExpression,
  executeStatement,
  signal,
  effect,
  store,
  computed,
  untrack,
  destroyScope,
  destroy: (root: Element) => {
    const scope = getScope(root);
    if (scope) destroyScope(scope);
    return root;
  },
  unmount: (root: Element) => {
    const scope = getScope(root);
    if (scope) destroyScope(scope);
    return root;
  }
};

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  Lyap.boot();
  (window as any).Lyap = Lyap;
}

export { walkTree, createScope, getScope, destroyScope, evaluateExpression, executeStatement, signal, effect, store, computed, untrack };
export default Lyap;
