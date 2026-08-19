import { createOwnedEffect, type ScopeHandle } from '../scope.js';
import { parseForExpression } from '../evaluator.js';
import type { Runtime } from '../runtime.js';

export type LoopBlock = {
  key: string | number;
  nodes: Node[];
  locals: Record<string, any>;
  cleanups: (() => void)[];
};

export function handleForLoop(
  runtime: Runtime,
  scope: ScopeHandle,
  element: Element,
  locals: Record<string, any> | undefined,
  scanElement: (element: Element, locals?: Record<string, any>) => void,
  markProcessed: (element: Element) => void
) {
  const forExpr = element.getAttribute('ly-for')!;
  const keyExpr = element.getAttribute('ly-key');

  if (!keyExpr) {
    throw new Error('ly-for requires ly-key on the same element');
  }

  markProcessed(element);

  const parsed = parseForExpression(forExpr);

  const isTemplate = element.tagName.toLowerCase() === 'template';
  const templateElement = isTemplate
    ? (element as HTMLTemplateElement).content.cloneNode(true)
    : (element.cloneNode(true) as Element);

  if (!isTemplate) {
    (templateElement as Element).removeAttribute('ly-for');
    (templateElement as Element).removeAttribute('ly-key');
  }

  const parentNode = element.parentNode;
  if (!parentNode) return;

  const anchor = document.createComment('ly-for');
  parentNode.insertBefore(anchor, element);
  parentNode.removeChild(element);

  let activeBlocks: LoopBlock[] = [];

  const cleanupAllBlocks = () => {
    for (const block of activeBlocks) {
      for (const cb of block.cleanups) {
        try {
          cb();
        } catch (e) {
          runtime.reportError(e);
        }
      }
      for (const node of block.nodes) {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    }
    activeBlocks = [];
  };

  scope.cleanup(() => cleanupAllBlocks());

  createOwnedEffect(scope, () => {
    const rawCollection = runtime.evaluate(
      parsed.collectionExpr,
      anchor.parentElement ?? scope.element,
      undefined,
      locals
    );
    const items: { item: any; keyVal: any; index: number; objKey?: string }[] = [];

    if (rawCollection == null) {
      // 0 iterations
    } else if (Array.isArray(rawCollection)) {
      for (let i = 0; i < rawCollection.length; i++) {
        items.push({ item: rawCollection[i], keyVal: rawCollection[i], index: i });
      }
    } else if (typeof rawCollection === 'object' && Object.getPrototypeOf(rawCollection) === Object.prototype) {
      const keys = Object.keys(rawCollection);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]!;
        items.push({ item: rawCollection[k], keyVal: rawCollection[k], index: i, objKey: k });
      }
    } else {
      throw new Error(`Invalid collection for ly-for: ${typeof rawCollection}`);
    }

    const seenKeys = new Set<string | number>();
    const nextBlocks: LoopBlock[] = [];
    const blockMap = new Map<string | number, LoopBlock>();
    for (const b of activeBlocks) blockMap.set(b.key, b);

    for (let i = 0; i < items.length; i++) {
      const entry = items[i]!;
      const loopLocals: Record<string, any> = { ...locals };
      loopLocals[parsed.itemVar] = entry.item;

      if (entry.objKey !== undefined) {
        if (parsed.var2) loopLocals[parsed.var2] = entry.objKey;
        if (parsed.var3) loopLocals[parsed.var3] = entry.index;
      } else {
        if (parsed.var3) {
          if (parsed.var2) loopLocals[parsed.var2] = entry.objKey ?? entry.index;
          loopLocals[parsed.var3] = entry.index;
        } else if (parsed.var2) {
          loopLocals[parsed.var2] = entry.index;
        }
      }

      const keyVal = runtime.evaluate(keyExpr, anchor.parentElement ?? scope.element, undefined, loopLocals);
      if (typeof keyVal !== 'string' && (typeof keyVal !== 'number' || !Number.isFinite(keyVal))) {
        throw new Error(`Invalid loop key: ${String(keyVal)}`);
      }
      if (seenKeys.has(keyVal)) {
        throw new Error(`Duplicate loop key: ${String(keyVal)}`);
      }
      seenKeys.add(keyVal);

      let block = blockMap.get(keyVal);
      if (block) {
        Object.assign(block.locals, loopLocals);
        blockMap.delete(keyVal);
      } else {
        const nodes: Node[] = [];
        let fragment: Node;

        if (isTemplate) {
          fragment = (templateElement as DocumentFragment).cloneNode(true);
          nodes.push(...Array.from(fragment.childNodes));
        } else {
          const clone = (templateElement as Element).cloneNode(true);
          fragment = clone;
          nodes.push(clone);
        }

        const blockCleanups: (() => void)[] = [];
        block = { key: keyVal, nodes, locals: loopLocals, cleanups: blockCleanups };

        anchor.parentNode?.insertBefore(fragment, anchor);

        for (const n of nodes) {
          if (n.nodeType === Node.ELEMENT_NODE) {
            scanElement(n as Element, block.locals);
          }
        }
      }
      nextBlocks.push(block);
    }

    for (const [, oldBlock] of blockMap) {
      for (const cb of oldBlock.cleanups) {
        try {
          cb();
        } catch (e) {
          runtime.reportError(e);
        }
      }
      for (const node of oldBlock.nodes) {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    }

    for (let i = 0; i < nextBlocks.length; i++) {
      const block = nextBlocks[i]!;
      for (const node of block.nodes) {
        anchor.parentNode?.insertBefore(node, anchor);
      }
    }

    activeBlocks = nextBlocks;
  });
}
