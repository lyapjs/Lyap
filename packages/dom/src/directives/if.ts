import { effect, scope as createOwnerScope } from '@lyapjs/reactive';
import { evaluateExpression } from '../evaluator.js';
import { ScopeContext, setScopeForElement } from '../scope.js';
import { walkTree } from '../walker.js';

export function handleIf(templateEl: HTMLTemplateElement, expression: string, scopeCtx: ScopeContext): void {
  const parent = templateEl.parentElement;
  if (!parent) return;

  const chain: Array<{ template: HTMLTemplateElement; expression?: string }> = [
    { template: templateEl, expression }
  ];

  let next = templateEl.nextElementSibling;
  while (next) {
    if (next.tagName === 'TEMPLATE' && next.hasAttribute('ly-else-if')) {
      chain.push({
        template: next as HTMLTemplateElement,
        expression: next.getAttribute('ly-else-if') || ''
      });
      next = next.nextElementSibling;
    } else if (next.tagName === 'TEMPLATE' && next.hasAttribute('ly-else')) {
      chain.push({
        template: next as HTMLTemplateElement
      });
      break;
    } else if (next.nodeType === 3 && !next.textContent?.trim()) {
      next = next.nextElementSibling;
    } else {
      break;
    }
  }

  const anchor = document.createComment('ly-if-anchor');
  parent.insertBefore(anchor, templateEl);

  let currentElement: Element | null = null;
  let currentDisposeFn: (() => void) | null = null;

  const ifEffect = effect(() => {
    let matchedBranchIndex = -1;

    for (let i = 0; i < chain.length; i++) {
      const branch = chain[i];
      if (branch && branch.expression !== undefined) {
        const result = Boolean(
          evaluateExpression(branch.expression, {
            scope: scopeCtx.state,
            element: templateEl,
            refs: scopeCtx.refs
          })
        );
        if (result) {
          matchedBranchIndex = i;
          break;
        }
      } else {
        matchedBranchIndex = i;
        break;
      }
    }

    if (currentDisposeFn) {
      currentDisposeFn();
      currentDisposeFn = null;
    }

    if (currentElement) {
      currentElement.remove();
      currentElement = null;
    }

    if (matchedBranchIndex !== -1 && chain[matchedBranchIndex]) {
      const matchedTemplate = chain[matchedBranchIndex]!.template;
      const clone = matchedTemplate.content.cloneNode(true) as DocumentFragment;
      const firstChild = clone.firstElementChild;

      if (firstChild) {
        currentElement = firstChild;
        parent.insertBefore(clone, anchor);

        const ownerScope = createOwnerScope(() => {
          setScopeForElement(firstChild, scopeCtx);
          walkTree(firstChild, scopeCtx);
        });

        currentDisposeFn = () => ownerScope.dispose();
      }
    }
  });

  scopeCtx.destroyHooks.push(() => {
    if (currentDisposeFn) {
      currentDisposeFn();
      currentDisposeFn = null;
    }
    if (currentElement) {
      currentElement.remove();
      currentElement = null;
    }
    ifEffect.dispose();
  });

  ifEffect.runEffect();
}
