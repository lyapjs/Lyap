import { walkTree } from './walker.js';
import { createScope, getScope } from './scope.js';
import { evaluateExpression, executeStatement } from './evaluator.js';

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
  getScope
};

// Auto-boot in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  Lyap.boot();
  (window as any).Lyap = Lyap;
}

export { walkTree, createScope, getScope, evaluateExpression, executeStatement };
