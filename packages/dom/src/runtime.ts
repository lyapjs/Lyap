import { ScopeHandle, createScopeProxy } from './scope.js';
import { evaluateExpression } from './evaluator.js';
import { scanDOM } from './walker.js';
import type { Root, MountOptions, EvaluationContext, ScopeProxy } from './types.js';

export type { Root, MountOptions } from './types.js';

const runtimes = new WeakMap<object, Runtime>();
const pendingScopes = new Set<ScopeHandle>();
const pendingRuntimes = new Set<Runtime>();

function contains(root: Root, element: Node) {
  if (root === element) return true;
  if ('contains' in root && typeof root.contains === 'function') {
    return root.contains(element);
  }
  return false;
}

function report(runtime: Runtime, error: unknown, element?: Element) {
  const wrapped = error instanceof Error ? error : new Error(String(error));
  if (element) wrapped.message = `[Lyap ${element.tagName.toLowerCase()}] ${wrapped.message}`;
  runtime.options.onError?.(wrapped);
  if (!runtime.options.onError) console.error(wrapped);
}

export class Runtime {
  readonly root: Root;
  readonly options: MountOptions;
  readonly scopes = new Map<string, ScopeHandle>();
  readonly ready: Promise<void>;
  private resolveReady!: () => void;
  private observer?: MutationObserver;
  private destroyed = false;
  private destroyPromise?: Promise<void>;
  private initialized = false;

  constructor(root: Root, options: MountOptions = {}) {
    this.root = root;
    this.options = options;
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  addScope(scope: ScopeHandle) {
    if (!contains(this.root, scope.element)) throw new Error(`Scope ${scope.name} is outside the mounted root`);
    if (this.scopes.has(scope.name)) throw new Error(`Duplicate scope name: ${scope.name}`);
    this.scopes.set(scope.name, scope);
    pendingScopes.delete(scope);
  }

  resolveScope(name: string, element: Element): ScopeProxy | undefined {
    const scope = this.scopes.get(name);
    if (!scope || !contains(scope.element, element)) return undefined;
    return scope.proxy;
  }

  scopeFor(element: Element): ScopeHandle | undefined {
    let result: ScopeHandle | undefined;
    for (const scope of this.scopes.values()) {
      if (contains(scope.element, element) && (!result || result.element.contains(scope.element))) result = scope;
    }
    return result;
  }

  start() {
    if (this.initialized) return this;
    this.initialized = true;
    this.initializeSyncOrAsync();
    return this;
  }

  private initializeSyncOrAsync() {
    const scopes = [...this.scopes.values()].sort((a, b) => depth(a.element) - depth(b.element));

    const runInitHooks = (): Promise<void> | void => {
      for (const scope of scopes) {
        for (const callback of scope.initHooks) {
          try {
            const res = callback(scope.proxy);
            if (res && typeof res.then === 'function') {
              return res.catch((err) => report(this, err, scope.element));
            }
          } catch (error) {
            report(this, error, scope.element);
          }
        }
      }
    };

    const finishMount = () => {
      this.scan(this.root);

      for (const scope of scopes) {
        for (const callback of scope.mountHooks) {
          try {
            const res = callback(scope.proxy);
            if (res && typeof res.then === 'function') {
              res.catch((err) => report(this, err, scope.element));
            }
          } catch (error) {
            report(this, error, scope.element);
          }
        }
      }
      if (typeof MutationObserver !== 'undefined') {
        this.observer = new MutationObserver((records) => this.processMutations(records));
        this.observer.observe(this.root, { childList: true, subtree: true });
      }
      this.resolveReady();
    };

    const maybePromise = runInitHooks();
    if (maybePromise && typeof maybePromise.then === 'function') {
      void maybePromise.then(finishMount);
    } else {
      finishMount();
    }
  }

  scan(root: Root | Node) {
    if (this.destroyed) return;
    scanDOM(this, root);
  }

  reportError(error: unknown, element?: Element) {
    report(this, error, element);
  }

  createEvaluationContext(element?: Element, event?: Event, locals?: Record<string, any>): EvaluationContext {
    const scope = element ? this.scopeFor(element) : undefined;
    return {
      element,
      event,
      locals,
      refs: scope?.getRefs(),
      resolveScope: (name: string) => (element ? this.resolveScope(name, element) : undefined),
      nextTick: (cb: () => void) => {
        void Promise.resolve().then(cb);
      }
    };
  }

  evaluate(expression: string, element: Element, event?: Event, locals?: Record<string, any>) {
    const context = this.createEvaluationContext(element, event, locals);
    return evaluateExpression(expression, context);
  }

  bindValue(element: Element, property: string, value: any) {
    if (property === 'class' || property === 'for') {
      if (value == null) element.removeAttribute(property);
      else element.setAttribute(property, String(value));
      return;
    }
    if (property in element && !property.startsWith('on') && property !== 'innerHTML' && property !== 'outerHTML') {
      (element as any)[property] = value ?? defaultPropertyValue(property);
    } else if (value == null) {
      element.removeAttribute(property);
    } else {
      element.setAttribute(property, String(value));
    }
  }

  private processMutations(records: MutationRecord[]) {
    if (this.destroyed) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && contains(this.root, node)) {
          this.scan(node);
        }
      }
    }
  }

  destroy(): Promise<void> {
    if (this.destroyPromise) return this.destroyPromise;

    this.destroyPromise = (async () => {
      this.destroyed = true;
      this.observer?.disconnect();
      for (const scope of [...this.scopes.values()].reverse()) {
        for (const callback of [...scope.destroyHooks].reverse()) {
          try {
            await callback(scope.proxy);
          } catch (error) {
            report(this, error, scope.element);
          }
        }
        try {
          scope.owner.dispose();
        } catch (error) {
          report(this, error, scope.element);
        }
      }
      this.scopes.clear();
      pendingRuntimes.delete(this);
    })();

    return this.destroyPromise;
  }
}

function depth(element: Element) {
  let value = 0;
  for (let current: Element | null = element; current; current = current.parentElement) value++;
  return value;
}

function defaultPropertyValue(property: string) {
  return ['checked', 'disabled', 'hidden', 'multiple', 'selected'].includes(property) ? false : '';
}

export function createScope(name: string, targetElement?: Element): ScopeProxy {
  const script = typeof document !== 'undefined' ? document.currentScript : null;
  const element = targetElement ?? script?.parentElement;
  if (!element) throw new Error('Lyap.scope() must be called from an associated scope script or provided an element');
  const scope = new ScopeHandle(name, element);
  const proxy = createScopeProxy(scope);
  pendingScopes.add(scope);
  for (const runtime of activeRuntimes()) {
    if (contains(runtime.root, element)) runtime.addScope(scope);
  }
  return proxy;
}

let autoMountedRuntime: Runtime | undefined;

export function mount(
  root: Root = typeof document !== 'undefined'
    ? document
    : (() => {
        throw new Error('Lyap.mount() requires a document');
      })(),
  options: MountOptions = {}
) {
  const existing = runtimes.get(root);
  if (existing) return existing;

  if (autoMountedRuntime && root !== document && autoMountedRuntime.root === document) {
    for (const scope of autoMountedRuntime.scopes.values()) {
      pendingScopes.add(scope);
    }
    autoMountedRuntime.scopes.clear();
    pendingRuntimes.delete(autoMountedRuntime);
    autoMountedRuntime = undefined;
  }

  for (const rt of pendingRuntimes) {
    if (rt !== autoMountedRuntime && (contains(rt.root, root) || contains(root, rt.root))) {
      throw new Error('Overlapping roots are not supported');
    }
  }

  const runtime = new Runtime(root, options);
  runtimes.set(root, runtime);
  pendingRuntimes.add(runtime);
  for (const scope of [...pendingScopes]) {
    if (contains(root, scope.element)) runtime.addScope(scope);
  }
  return runtime.start();
}

function activeRuntimes() {
  return [...pendingRuntimes];
}

export function autoMount() {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        if (!autoMountedRuntime && pendingRuntimes.size === 0) {
          autoMountedRuntime = mount(document);
        }
      },
      { once: true }
    );
  } else {
    Promise.resolve().then(() => {
      if (!autoMountedRuntime && pendingRuntimes.size === 0) {
        autoMountedRuntime = mount(document);
      }
    });
  }
}
