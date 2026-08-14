import { createScope, ScopeContext, getScope } from './scope.js';
import { parseLyapScript } from './script-parser.js';
import { handleCloak } from './directives/cloak.js';
import { handleText } from './directives/text.js';
import { handleShow } from './directives/show.js';
import { handleClass } from './directives/class.js';
import { handleAttr } from './directives/attr.js';
import { handleOn } from './directives/on.js';
import { handleBind } from './directives/bind.js';
import { handleIf } from './directives/if.js';
import { handleFor } from './directives/for.js';
import { handleRef } from './directives/ref.js';

export function walkTree(root: Node, parentScopeCtx?: ScopeContext): void {
  if (root.nodeType !== 1) return; // Only Element nodes

  const element = root as Element;
  let currentScope = parentScopeCtx || getScope(element);

  // 1. Check for DIRECT child <script type="lyap"> tags inside element
  const directChildScripts = Array.from(element.children).filter(
    (child) => child.tagName === 'SCRIPT' && child.getAttribute('type') === 'lyap'
  );

  if (directChildScripts.length > 0) {
    // Build state directly on one shared object so the scope store, directive
    // reads/writes and the script's own context all see the same storage.
    let scopeRaw: Record<string, any> = parentScopeCtx ? Object.create(parentScopeCtx.state) : {};
    let initHooks: Array<() => void> = [];
    let mountHooks: Array<() => void> = [];
    let destroyHooks: Array<() => void> = [];

    directChildScripts.forEach((script) => {
      const parsed = parseLyapScript(script.textContent || '', element, scopeRaw);
      initHooks.push(...parsed.initHooks);
      mountHooks.push(...parsed.mountHooks);
      destroyHooks.push(...parsed.destroyHooks);
    });

    currentScope = createScope(element, {}, parentScopeCtx, true, scopeRaw);
    currentScope.destroyHooks.push(...destroyHooks);
    currentScope.mountHooks.push(...mountHooks);

    // Trigger init hooks
    initHooks.forEach((fn) => {
      try { fn.call(currentScope!.state); } catch (e) { console.error(e); }
    });
  }

  // Ensure fallback scope context exists
  if (!currentScope) {
    currentScope = createScope(element, {}, parentScopeCtx);
  }

  // 2. Un-cloak node
  handleCloak(element);

  // 3. Process ly-ref
  if (element.hasAttribute('ly-ref')) {
    handleRef(element, element.getAttribute('ly-ref')!, currentScope);
  }

  // 4. Process Structural Directives (ly-if & ly-for)
  if (element.tagName === 'TEMPLATE') {
    const templateEl = element as HTMLTemplateElement;
    if (templateEl.hasAttribute('ly-if')) {
      handleIf(templateEl, templateEl.getAttribute('ly-if')!, currentScope);
      return;
    }
    if (templateEl.hasAttribute('ly-for')) {
      handleFor(templateEl, templateEl.getAttribute('ly-for')!, currentScope);
      return;
    }
  }

  // 5. Process Directive Attributes
  const attributes = Array.from(element.attributes);
  for (const attr of attributes) {
    const { name, value } = attr;

    if (name === 'ly-text') {
      handleText(element, value, currentScope);
    } else if (name === 'ly-show') {
      handleShow(element as HTMLElement, value, currentScope);
    } else if (name === 'ly-class') {
      handleClass(element, value, currentScope);
    } else if (name.startsWith('ly-bind')) {
      const modifierStr = name.slice('ly-bind'.length); // e.g. ".trim" or ""
      const fullProp = value ? value + modifierStr : name.slice('ly-bind.'.length);
      handleBind(element, fullProp, currentScope);
    } else if (name.startsWith('ly-attr:')) {
      const targetAttr = name.slice('ly-attr:'.length);
      handleAttr(element, targetAttr, value, currentScope);
    } else if (name.startsWith('ly-on:')) {
      const rawEventName = name.slice('ly-on:'.length);
      handleOn(element, rawEventName, value, currentScope);
    }
  }

  // 6. Recursively Walk Children (excluding script tags & already-processed loop items)
  Array.from(element.children).forEach((child) => {
    if (child.tagName !== 'SCRIPT' && !(child as any).__lyap_processed) {
      walkTree(child, currentScope);
    }
  });

  // 7. Trigger mount hooks
  if (currentScope.mountHooks.length > 0) {
    currentScope.mountHooks.forEach((fn) => {
      try { fn.call(currentScope!.state); } catch (e) { console.error(e); }
    });
    currentScope.mountHooks = []; // Ensure mount runs once
  }
}
