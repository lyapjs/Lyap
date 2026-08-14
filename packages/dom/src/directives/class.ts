import { effect } from '@lyapjs/reactive';
import { evaluateExpression } from '../evaluator.js';
import { ScopeContext } from '../scope.js';

export function handleClass(element: Element, expression: string, scopeCtx: ScopeContext): void {
  const initialStaticClasses = Array.from(element.classList);

  const e = effect(() => {
    const raw = expression.trim();
    if (!raw) return;

    const activeDynamicClasses = new Set<string>();
    const parts = raw.split(/\s+(?=:)/);

    for (const part of parts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;

      if (trimmedPart.startsWith(':')) {
        const spaceIndex = trimmedPart.search(/\s/);
        let condExpr = '';
        let classListStr = '';

        if (spaceIndex === -1) {
          condExpr = trimmedPart.slice(1);
          classListStr = '';
        } else {
          condExpr = trimmedPart.slice(1, spaceIndex);
          classListStr = trimmedPart.slice(spaceIndex).trim();
        }

        let isTruthy = false;
        if (condExpr === 'true') {
          isTruthy = true;
        } else if (condExpr === 'false') {
          isTruthy = false;
        } else {
          isTruthy = Boolean(
            evaluateExpression(condExpr, {
              scope: scopeCtx.state,
              element,
              refs: scopeCtx.refs
            })
          );
        }

        if (isTruthy && classListStr) {
          const classes = classListStr.split(/\s+/).filter(Boolean);
          classes.forEach((c) => activeDynamicClasses.add(c));
        }
      } else {
        if (trimmedPart.startsWith('{')) {
          const map = evaluateExpression(trimmedPart, {
            scope: scopeCtx.state,
            element,
            refs: scopeCtx.refs
          });
          if (map && typeof map === 'object') {
            for (const [cls, condition] of Object.entries(map)) {
              if (condition) activeDynamicClasses.add(cls);
            }
          }
        }
      }
    }

    const finalClassList = Array.from(new Set([...initialStaticClasses, ...activeDynamicClasses]));
    if (finalClassList.length > 0) {
      element.setAttribute('class', finalClassList.join(' '));
    } else {
      element.removeAttribute('class');
    }
  });
  scopeCtx.destroyHooks.push(() => e.dispose());
  e.runEffect();
}
