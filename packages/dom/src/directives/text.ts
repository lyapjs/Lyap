import { createOwnedEffect } from '../scope.js';
import type { DirectiveContext } from '../types.js';

export function textDirective(context: DirectiveContext) {
  const { runtime, scope, element, value, locals } = context;
  createOwnedEffect(scope, () => {
    const val = runtime.evaluate(value, element, undefined, locals);
    element.textContent = val == null ? '' : String(val);
  });
}
