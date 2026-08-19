import { createOwnedEffect } from '../scope.js';
import type { DirectiveContext } from '../types.js';

export function bindDirective(context: DirectiveContext) {
  const { runtime, scope, element, attributeName, value, locals } = context;
  const property = attributeName.slice('ly-bind:'.length);

  if (property === 'innerHTML' || property === 'outerHTML' || property.startsWith('on')) {
    throw new Error(`Forbidden ly-bind property: ${property}`);
  }

  createOwnedEffect(scope, () => {
    const val = runtime.evaluate(value, element, undefined, locals);
    runtime.bindValue(element, property, val);
  });
}
