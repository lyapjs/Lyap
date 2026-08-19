import { createOwnedEffect } from '../scope.js';
import type { DirectiveContext } from '../types.js';

export function showDirective(context: DirectiveContext) {
  const { runtime, scope, element, value, locals } = context;
  createOwnedEffect(scope, () => {
    const val = runtime.evaluate(value, element, undefined, locals);
    (element as HTMLElement).hidden = !Boolean(val);
  });
}
