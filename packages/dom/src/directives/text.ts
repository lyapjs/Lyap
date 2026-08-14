import { effect } from '@lyapjs/reactive';
import { evaluateExpression } from '../evaluator.js';
import { ScopeContext } from '../scope.js';

export function handleText(element: Element, expression: string, scopeCtx: ScopeContext): void {
  const e = effect(() => {
    const val = evaluateExpression(expression, {
      scope: scopeCtx.state,
      element,
      refs: scopeCtx.refs
    });
    element.textContent = val !== undefined && val !== null ? String(val) : '';
  });
  scopeCtx.destroyHooks.push(() => e.dispose());
  e.runEffect();
}
