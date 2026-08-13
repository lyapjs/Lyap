import { effect } from '@lyapjs/reactive';
import { evaluateExpression } from '../evaluator.js';
import { ScopeContext } from '../scope.js';

export function handleText(element: Element, expression: string, scopeCtx: ScopeContext): void {
  effect(() => {
    const val = evaluateExpression(expression, {
      scope: scopeCtx.state,
      element,
      refs: scopeCtx.refs
    });
    element.textContent = val !== undefined && val !== null ? String(val) : '';
  }).runEffect();
}
