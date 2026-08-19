import { autoMount, createScope, mount, Runtime } from './runtime.js';
import { evaluateExpression } from './evaluator.js';

export type { ScopeHandle, ScopeProxy } from './scope.js';
export { Runtime, createScope, mount } from './runtime.js';
export { evaluateExpression } from './evaluator.js';
export * from './types.js';
export * from './directives/index.js';

export const Lyap = {
  mount,
  scope: createScope,
  evaluate: evaluateExpression
};

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  autoMount();
  (window as any).Lyap = Lyap;
}

export default Lyap;
