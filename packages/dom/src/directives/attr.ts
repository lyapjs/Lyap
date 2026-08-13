import { effect } from '@lyapjs/reactive';
import { evaluateExpression } from '../evaluator.js';
import { ScopeContext } from '../scope.js';

export function handleAttr(element: Element, attrName: string, expression: string, scopeCtx: ScopeContext): void {
  effect(() => {
    const val = evaluateExpression(expression, {
      scope: scopeCtx.state,
      element,
      refs: scopeCtx.refs
    });

    if (val === true) {
      element.setAttribute(attrName, '');
    } else if (val === false || val === null || val === undefined) {
      element.removeAttribute(attrName);
    } else {
      element.setAttribute(attrName, String(val));
    }
  }).runEffect();
}
