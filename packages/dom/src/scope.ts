import { store } from '@lyapjs/reactive';

export interface ScopeContext {
  element: Element;
  state: Record<string, any>;
  parent?: ScopeContext;
  refs: Record<string, Element>;
  destroyHooks: Array<() => void>;
  mountHooks: Array<() => void>;
}

const elementScopeMap = new WeakMap<Element, ScopeContext>();

export function createScope(element: Element, initialState: Record<string, any> = {}, parent?: ScopeContext): ScopeContext {
  const parentState = parent ? parent.state : {};

  // Prototypal scope inheritance: child inherits parent state/derived/actions
  const scopeState = Object.create(parentState);
  Object.assign(scopeState, initialState);

  // Wrap scope state in reactive Proxy store
  const reactiveStore = store(scopeState);

  const scopeCtx: ScopeContext = {
    element,
    state: reactiveStore,
    parent,
    refs: parent ? parent.refs : {},
    destroyHooks: [],
    mountHooks: []
  };

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
