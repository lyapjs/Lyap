import { createOwnedEffect, type ScopeHandle } from '../scope.js';
import type { Runtime } from '../runtime.js';

export type IfBranch = {
  template: Node;
  conditionExpr?: string | undefined;
  type: 'if' | 'if-else' | 'else';
  isTemplate?: boolean;
};

export function handleIfChain(
  runtime: Runtime,
  scope: ScopeHandle,
  firstElement: Element,
  locals: Record<string, any> | undefined,
  scanElement: (element: Element, locals?: Record<string, any>) => void,
  markProcessed: (element: Element) => void
) {
  const branches: IfBranch[] = [];
  let currElement: Element | null = firstElement;

  while (currElement) {
    const ifVal = currElement.getAttribute('ly-if');
    const ifElseVal = currElement.getAttribute('ly-if-else');
    const hasElse = currElement.hasAttribute('ly-else');

    let branchType: 'if' | 'if-else' | 'else' | null = null;
    let condExpr: string | undefined;

    if (ifVal !== null && branches.length === 0) {
      branchType = 'if';
      condExpr = ifVal;
    } else if (ifElseVal !== null && branches.length > 0 && branches[branches.length - 1]!.type !== 'else') {
      branchType = 'if-else';
      condExpr = ifElseVal;
    } else if (hasElse && branches.length > 0 && branches[branches.length - 1]!.type !== 'else') {
      branchType = 'else';
    } else {
      break;
    }

    markProcessed(currElement);

    const isTemplate = currElement.tagName.toLowerCase() === 'template';
    const template = isTemplate
      ? ((currElement as HTMLTemplateElement).content
          ? (currElement as HTMLTemplateElement).content.cloneNode(true)
          : currElement.cloneNode(true))
      : (currElement.cloneNode(true) as Element);

    if (!isTemplate) {
      (template as Element).removeAttribute('ly-if');
      (template as Element).removeAttribute('ly-if-else');
      (template as Element).removeAttribute('ly-else');
    }

    branches.push({ template, conditionExpr: condExpr, type: branchType, isTemplate });

    const nextSibling = getNextContiguousElementSibling(currElement);
    if (!nextSibling || (!nextSibling.hasAttribute('ly-if-else') && !nextSibling.hasAttribute('ly-else'))) {
      break;
    }
    currElement = nextSibling;
  }

  const parentNode = firstElement.parentNode;
  if (!parentNode) return;

  const anchor = document.createComment('ly-if');
  parentNode.insertBefore(anchor, firstElement);

  const branchElementsToRemove: Element[] = [];
  let sibling: Element | null = firstElement;
  for (let i = 0; i < branches.length; i++) {
    if (sibling) {
      branchElementsToRemove.push(sibling);
      sibling = getNextContiguousElementSibling(sibling);
    }
  }

  for (const el of branchElementsToRemove) {
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  let activeBranchIndex = -1;
  let activeNodes: Node[] = [];
  let activeCleanups: (() => void)[] = [];

  const cleanupActive = () => {
    for (const cb of activeCleanups) {
      try {
        cb();
      } catch (e) {
        runtime.reportError(e);
      }
    }
    activeCleanups = [];
    for (const node of activeNodes) {
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    activeNodes = [];
  };

  scope.cleanup(() => cleanupActive());

  createOwnedEffect(scope, () => {
    let matchingIndex = -1;
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i]!;
      if (branch.type === 'else') {
        matchingIndex = i;
        break;
      }
      const cond = runtime.evaluate(branch.conditionExpr!, anchor.parentElement ?? scope.element, undefined, locals);
      if (Boolean(cond)) {
        matchingIndex = i;
        break;
      }
    }

    if (matchingIndex === activeBranchIndex) return;

    cleanupActive();
    activeBranchIndex = matchingIndex;

    if (matchingIndex !== -1) {
      const branch = branches[matchingIndex]!;
      if (branch.isTemplate) {
        const frag = branch.template.cloneNode(true) as DocumentFragment;
        const childNodes = Array.from(frag.childNodes);
        for (const child of childNodes) {
          anchor.parentNode?.insertBefore(child, anchor);
          activeNodes.push(child);
          if (child.nodeType === Node.ELEMENT_NODE) {
            scanElement(child as Element, locals);
          }
        }
      } else {
        const clone = (branch.template as Element).cloneNode(true) as Element;
        anchor.parentNode?.insertBefore(clone, anchor);
        activeNodes.push(clone);
        scanElement(clone, locals);
      }
    }
  });
}

export function getNextContiguousElementSibling(element: Element): Element | null {
  let curr = element.nextSibling;
  while (curr) {
    if (curr.nodeType === Node.ELEMENT_NODE) return curr as Element;
    if (curr.nodeType === Node.TEXT_NODE && curr.textContent?.trim() !== '') return null;
    curr = curr.nextSibling;
  }
  return null;
}

export function getPreviousContiguousSibling(element: Element): Element | null {
  let curr = element.previousSibling;
  while (curr) {
    if (curr.nodeType === Node.ELEMENT_NODE) return curr as Element;
    if (curr.nodeType === Node.TEXT_NODE && curr.textContent?.trim() !== '') return null;
    curr = curr.previousSibling;
  }
  return null;
}
