import { store } from '@lyapjs/reactive';

export interface ScopeContext {
  element: Element;
  state: Record<string, any>;
  parent?: ScopeContext;
  refs: Record<string, Element>;
  destroyHooks: Array<() => void>;
  mountHooks: Array<() => void>;
  children: Set<ScopeContext>;
}

const elementScopeMap = new WeakMap<Element, ScopeContext>();

export function createScope(element: Element, initialState: Record<string, any> = {}, parent?: ScopeContext, trackChild: boolean = true, stateObject?: Record<string, any>): ScopeContext {
  const parentState = parent ? parent.state : {};

  // Prototypal scope inheritance: fall through to the PARENT's reactive store
  // (not its raw target) so reads of inherited primitives track the parent's
  // signal and stay reactive.
  let scopeState: Record<string, any>;
  if (stateObject) {
    // Reuse the caller-provided object (the script parser's raw state) so that
    // script-context reads, directive reads and reactive writes all share the
    // SAME property storage.
    scopeState = stateObject;
    Object.setPrototypeOf(scopeState, parentState);
  } else {
    scopeState = Object.create(parentState);
    Object.assign(scopeState, initialState);
  }

  // Wrap scope state in reactive Proxy store
  const reactiveStore = store(scopeState);

  const scopeCtx: ScopeContext = {
    element,
    state: reactiveStore,
    parent,
    refs: parent ? parent.refs : {},
    destroyHooks: [],
    mountHooks: [],
    children: new Set<ScopeContext>()
  };

  if (parent && trackChild) {
    parent.children.add(scopeCtx);
  }

  elementScopeMap.set(element, scopeCtx);
  return scopeCtx;
}

export function getScope(element: Element): ScopeContext | undefined {
  let current: Element | null = element;
  while (current) {
    if (elementScopeMap.has(current)) {
      return elementScopeMap.get(current);
    }
    current = current.parentElement;
  }
  return undefined;
}

export function setScopeForElement(element: Element, scope: ScopeContext): void {
  elementScopeMap.set(element, scope);
}

export function destroyScope(scopeCtx: ScopeContext): void {
  if (scopeCtx.parent) {
    scopeCtx.parent.children.delete(scopeCtx);
  }

  // Destroy nested scopes first.
  for (const child of Array.from(scopeCtx.children)) {
    destroyScope(child);
  }
  scopeCtx.children.clear();

  // Run teardown hooks (listeners, structural-directive disposers) in reverse.
  for (let i = scopeCtx.destroyHooks.length - 1; i >= 0; i--) {
    try {
      scopeCtx.destroyHooks[i]();
    } catch (err) {
      console.error('[Lyap] Error during scope teardown:', err);
    }
  }
  scopeCtx.destroyHooks = [];
  scopeCtx.mountHooks = [];

  elementScopeMap.delete(scopeCtx.element);
}

export function createFormAssistant(formElement: Element, scopeCtx: ScopeContext) {
  const initialValues: Record<string, any> = {};

  // Collect initial form values
  const inputs = formElement.querySelectorAll('input, select, textarea');
  inputs.forEach((input: any) => {
    if (input.name) {
      initialValues[input.name] = input.type === 'checkbox' ? input.checked : input.value;
    }
  });

  let isDirty = false;
  formElement.addEventListener('input', () => {
    isDirty = true;
  });

  return {
    get data() {
      const currentData: Record<string, any> = {};
      const currentInputs = formElement.querySelectorAll('input, select, textarea');
      currentInputs.forEach((input: any) => {
        if (input.name) {
          currentData[input.name] = input.type === 'checkbox' ? input.checked : input.value;
        }
      });
      return currentData;
    },
    get isDirty() {
      return isDirty;
    },
    get isValid() {
      if ('checkValidity' in formElement && typeof (formElement as any).checkValidity === 'function') {
        return (formElement as any).checkValidity();
      }
      return true;
    },
    reset() {
      inputs.forEach((input: any) => {
        if (input.name && input.name in initialValues) {
          if (input.type === 'checkbox') {
            input.checked = initialValues[input.name];
          } else {
            input.value = initialValues[input.name];
          }
        }
      });
      isDirty = false;
    }
  };
}
