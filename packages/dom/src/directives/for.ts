import { effect, scope as createOwnerScope, untrack } from '@lyapjs/reactive';
import { evaluateExpression } from '../evaluator.js';
import { ScopeContext, createScope, setScopeForElement } from '../scope.js';
import { walkTree } from '../walker.js';

function cloneFragment(frag: DocumentFragment): DocumentFragment {
  const clone = document.createDocumentFragment();
  Array.from(frag.childNodes).forEach((child) => {
    clone.appendChild(child.cloneNode(true));
  });
  return clone;
}

export function handleFor(templateEl: HTMLTemplateElement, expression: string, scopeCtx: ScopeContext): void {
  if ((templateEl as any).__lyap_processed) return;
  (templateEl as any).__lyap_processed = true;

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

  // 1. Preserve template content into standalone fragment BEFORE template removal
  const templateContent = document.createDocumentFragment();
  const sourceNodes = templateEl.content && templateEl.content.childNodes.length > 0
    ? Array.from(templateEl.content.childNodes)
    : Array.from(templateEl.childNodes);

  sourceNodes.forEach((node) => {
    templateContent.appendChild(node.cloneNode(true));
  });

  // 2. Replace template element with anchor comment node
  const anchor = document.createComment('ly-for-anchor');
  parent.insertBefore(anchor, templateEl);
  templateEl.remove();

  let renderedNodes: Array<{ nodes: Node[]; dispose: () => void }> = [];

  // 3. Create outer loop effect
  const forEffect = effect(() => {
    const list = evaluateExpression(collectionExpr, {
      scope: scopeCtx.state,
      element: parent,
      refs: scopeCtx.refs
    });

    let items: Array<any> = [];
    if (Array.isArray(list)) {
      items = list;
      // Track the array's content-version so in-place mutation
      // (push/pop/splice/sort/reverse/...) re-runs this effect.
      list.length;
    } else if (typeof list === 'number' && list > 0) {
      items = Array.from({ length: list }, (_, i) => i + 1);
    } else if (list && typeof list === 'object') {
      items = Object.entries(list).map(([key, val]) => ({ key, val }));
    }

    untrack(() => {
      // Clean up previous iteration rendered nodes and owners
      renderedNodes.forEach(({ nodes, dispose }) => {
        dispose();
        nodes.forEach((node) => {
          if (node.parentNode) {
            node.parentNode.removeChild(node);
          }
        });
      });
      renderedNodes = [];

      items.forEach((item, index) => {
        const clone = cloneFragment(templateContent);

        // Record insertion position before anchor
        const previousSibling = anchor.previousSibling;

        // A. Insert clone into parent DOM
        parent.insertBefore(clone, anchor);

        // B. Collect exact active DOM nodes inserted into document
        const insertedNodes: Node[] = [];
        let curr = previousSibling ? previousSibling.nextSibling : parent.firstChild;
        while (curr && curr !== anchor) {
          insertedNodes.push(curr);
          curr = curr.nextSibling;
        }

        if (insertedNodes.length > 0) {
          const itemState: Record<string, any> = {
            [itemName]: item,
            [indexName]: index
          };

          const targetEl = insertedNodes.find((n): n is Element => n.nodeType === Node.ELEMENT_NODE) || parent;

          // C. Create reactive owner and item scope for this iteration
          const ownerScope = createOwnerScope(() => {
            const itemScope = createScope(targetEl, itemState, scopeCtx, false);

            insertedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                (node as any).__lyap_processed = true;
                setScopeForElement(node as Element, itemScope);
                walkTree(node as Element, itemScope);
              }
            });
          });

          renderedNodes.push({ nodes: insertedNodes, dispose: () => ownerScope.dispose() });
        }
      });
    });
  });

  // Register outer effect disposer on parent scope destroy hooks
  scopeCtx.destroyHooks.push(() => {
    renderedNodes.forEach(({ dispose }) => dispose());
    forEffect.dispose();
  });

  forEffect.runEffect();
}
