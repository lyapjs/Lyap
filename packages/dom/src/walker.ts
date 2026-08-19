import type { Runtime } from './runtime.js';
import type { ScopeHandle } from './scope.js';
import {
  handleIfChain,
  handleForLoop,
  getPreviousContiguousSibling,
  textDirective,
  showDirective,
  bindDirective,
  modelDirective,
  onDirective,
  refDirective
} from './directives/index.js';

const processedElements = new WeakSet<Element>();

export function isProcessed(element: Element): boolean {
  return processedElements.has(element);
}

export function markProcessed(element: Element) {
  processedElements.add(element);
}

export function scanDOM(runtime: Runtime, root: Node) {
  if (root.nodeType === Node.ELEMENT_NODE) {
    scanElementNode(runtime, root as Element);
  } else if (root.nodeType === Node.DOCUMENT_NODE || root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    const walker = (root.ownerDocument ?? (root as Document)).createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    const elements: Element[] = [];
    while (node) {
      elements.push(node as Element);
      node = walker.nextNode();
    }
    for (const el of elements) {
      if (el.isConnected && !isProcessed(el)) {
        scanElementNode(runtime, el);
      }
    }
  }
}

export function scanElementNode(runtime: Runtime, element: Element, locals?: Record<string, any> | undefined) {
  if (isProcessed(element) || !element.isConnected) return;

  const scope = runtime.scopeFor(element);
  if (!scope) return;

  const attrs = [...element.attributes];
  validateDirectives(element, attrs);

  const ifAttr = attrs.find((a) => a.name === 'ly-if');
  const forAttr = attrs.find((a) => a.name === 'ly-for');

  if (ifAttr) {
    handleIfChain(
      runtime,
      scope,
      element,
      locals,
      (el, loc) => scanElementNode(runtime, el, loc),
      markProcessed
    );
    return;
  }

  if (forAttr) {
    handleForLoop(
      runtime,
      scope,
      element,
      locals,
      (el, loc) => scanElementNode(runtime, el, loc),
      markProcessed
    );
    return;
  }

  processNormalDirectives(runtime, scope, element, locals);

  const children = [...element.children];
  for (const child of children) {
    if (!isProcessed(child)) {
      scanElementNode(runtime, child, locals);
    }
  }
}

function validateDirectives(element: Element, attrs: Attr[]) {
  const lyAttrs = attrs.filter((a) => a.name.startsWith('ly-'));
  let hasIf = false;
  let hasIfElse = false;
  let hasElse = false;
  let hasFor = false;
  let hasKey = false;

  for (const attr of lyAttrs) {
    const name = attr.name;
    if (name === 'ly-if') hasIf = true;
    else if (name === 'ly-if-else') hasIfElse = true;
    else if (name === 'ly-else') hasElse = true;
    else if (name === 'ly-for') hasFor = true;
    else if (name === 'ly-key') hasKey = true;
    else if (
      name === 'ly-text' ||
      name === 'ly-show' ||
      name.startsWith('ly-bind:') ||
      name === 'ly-model' ||
      name.startsWith('ly-model.') ||
      name.startsWith('ly-on:') ||
      name === 'ly-ref' ||
      name.startsWith('ly-ref:')
    ) {
      // Valid built-in directive
    } else {
      throw new Error(`Unknown directive: ${name}`);
    }
  }

  if (hasIf && hasFor) {
    throw new Error('ly-if and ly-for cannot be combined on the same element');
  }

  if (hasKey && !hasFor) {
    throw new Error('ly-key is valid only on an element with ly-for');
  }

  if ((hasIfElse || hasElse) && !hasIf) {
    const prev = getPreviousContiguousSibling(element);
    if (!prev || (!prev.hasAttribute('ly-if') && !prev.hasAttribute('ly-if-else'))) {
      throw new Error(`${hasElse ? 'ly-else' : 'ly-if-else'} must belong to a valid adjacent conditional chain`);
    }
  }
}

function processNormalDirectives(runtime: Runtime, scope: ScopeHandle, element: Element, locals?: Record<string, any> | undefined) {
  const attributes = [...element.attributes];

  for (const attr of attributes) {
    const name = attr.name;
    const value = attr.value;
    const ctx = { runtime, scope, element, attributeName: name, value, locals };

    if (name === 'ly-text') {
      textDirective(ctx);
      element.removeAttribute(name);
    } else if (name === 'ly-show') {
      showDirective(ctx);
      element.removeAttribute(name);
    } else if (name.startsWith('ly-bind:')) {
      bindDirective(ctx);
      element.removeAttribute(name);
    } else if (name === 'ly-model' || name.startsWith('ly-model.')) {
      modelDirective(ctx);
      element.removeAttribute(name);
    } else if (name.startsWith('ly-on:')) {
      onDirective(ctx);
      element.removeAttribute(name);
    } else if (name === 'ly-ref' || name.startsWith('ly-ref:')) {
      refDirective(ctx);
      element.removeAttribute(name);
    }
  }
}