import type { DirectiveContext } from '../types.js';

export function refDirective(context: DirectiveContext) {
  const { scope, element, attributeName, value } = context;
  const refName = (attributeName.startsWith('ly-ref:') ? attributeName.slice('ly-ref:'.length) : value).trim();

  if (!refName) throw new Error('ly-ref requires a name');

  scope.setRef(refName, element);
  scope.cleanup(() => scope.deleteRef(refName, element));
}
