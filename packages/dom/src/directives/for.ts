import { effect, scope as createOwnerScope } from '@lyapjs/reactive';
import { evaluateExpression } from '../evaluator.js';
import { ScopeContext, createScope, setScopeForElement } from '../scope.js';
import { walkTree } from '../walker.js';

export function handleFor(templateEl: HTMLTemplateElement, expression: string, scopeCtx: ScopeContext): void {
  const parent = templateEl.parentElement;
  if (!parent) return;

  const match = expression.match(/^\s*(?:\(([^,]+),\s*([^)]+)\)|([^\s]+))\s+in\s+(.+)$/);
  if (!match) {
    console.error(`[Lyap Error] Invalid ly-for expression syntax: "${expression}"`);
    return;
  }

  const itemName = (match[1] || match[3] || '$item').trim();
  const indexName = match[2] ? match[2].trim() : '$index';
  const collectionExpr = (match[4] || '').trim();

  const anchor = document.createComment('ly-for-anchor');
  parent.insertBefore(anchor, templateEl);

  let renderedNodes: Array<{ node: Element; dispose: () => void }> = [];

  effect(() => {
    const list = evaluateExpression(collectionExpr, {
      scope: scopeCtx.state,
      element: templateEl,
      refs: scopeCtx.refs
    });

    const items = Array.isArray(list) ? list : [];

    renderedNodes.forEach(({ node, dispose }) => {
      dispose();
      node.remove();
    });
    renderedNodes = [];

    items.forEach((item, index) => {
      const clone = templateEl.content.cloneNode(true) as DocumentFragment;
      const firstChild = clone.firstElementChild;

      if (firstChild) {
        const itemState: Record<string, any> = {
          [itemName]: item,
          [indexName]: index
        };

        const itemScope = createScope(firstChild, itemState, scopeCtx);

        const ownerScope = createOwnerScope(() => {
          setScopeForElement(firstChild, itemScope);
          walkTree(firstChild, itemScope);
        });

        parent.insertBefore(clone, anchor);
        renderedNodes.push({ node: firstChild, dispose: () => ownerScope.dispose() });
      }
    });
  }).runEffect();
}
