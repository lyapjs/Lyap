import { createOwnedEffect } from '../scope.js';
import type { DirectiveContext } from '../types.js';

export function showDirective(context: DirectiveContext) {
  const { runtime, scope, element, value, locals } = context;
  const el = element as HTMLElement;
  const initialDisplay = el.style && el.style.display !== 'none' ? el.style.display : '';
  createOwnedEffect(scope, () => {
    const val = runtime.evaluate(value, element, undefined, locals);
    const isShown = Boolean(val);
    el.hidden = !isShown;
    if (el.style) {
      el.style.display = isShown ? initialDisplay : 'none';
    }
  });
}
