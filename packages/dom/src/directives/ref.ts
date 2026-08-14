import { ScopeContext } from '../scope.js';

export function handleRef(element: Element, refName: string, scopeCtx: ScopeContext): void {
  const name = refName.trim();
  if (name) {
    scopeCtx.refs[name] = element;
    scopeCtx.destroyHooks.push(() => {
      if (scopeCtx.refs[name] === element) {
        delete scopeCtx.refs[name];
      }
    });
  }
}
