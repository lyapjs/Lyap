import { effect } from '@lyapjs/reactive';
import { evaluateExpression } from '../evaluator.js';
import { ScopeContext } from '../scope.js';

export function handleShow(element: HTMLElement, expression: string, scopeCtx: ScopeContext): void {
  const originalDisplay = element.style.display === 'none' ? '' : element.style.display;

  effect(() => {
    const isVisible = Boolean(
      evaluateExpression(expression, {
        scope: scopeCtx.state,
        element,
        refs: scopeCtx.refs
      })
    );

    if (isVisible) {
      element.style.display = originalDisplay;
    } else {
      element.style.display = 'none';
    }
  }).runEffect();
}
