import { store, computed, onCleanup as registerReactiveCleanup } from '@lyapjs/reactive';

export interface ScriptScopeResult {
  state: Record<string, any>;
  derived: Record<string, any>;
  functions: Record<string, Function>;
  initHooks: Array<() => void>;
  mountHooks: Array<() => void>;
  destroyHooks: Array<() => void>;
}

export function parseLyapScript(scriptContent: string, containerElement?: Element, stateTarget?: Record<string, any>): ScriptScopeResult {
  const rawState: Record<string, any> = stateTarget || {};
  const derivedFns: Record<string, () => any> = {};
  const functionsObj: Record<string, Function> = {};
  const initHooks: Array<() => void> = [];
  const mountHooks: Array<() => void> = [];
  const destroyHooks: Array<() => void> = [];

  const init = (fn: () => void) => {
    if (typeof fn === 'function') initHooks.push(fn);
  };

  const mount = (fn: () => void) => {
    if (typeof fn === 'function') mountHooks.push(fn);
  };

  const cleanup = (fn: () => void) => {
    if (typeof fn === 'function') {
      registerReactiveCleanup(fn);
    }
  };

  const destroy = (fn: () => void) => {
    if (typeof fn === 'function') destroyHooks.push(fn);
  };

  const transformedContent = scriptContent.replace(
    /function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/g,
    (_, name, args, body) => `function ${name}(${args}) { with(this) { ${body} } }`
  );

  const fnNameMatches = Array.from(scriptContent.matchAll(/(?:function|const|let|var)\s+([a-zA-Z0-9_$]+)/g));
  const declaredFnNames = fnNameMatches.map((m) => m[1]).filter(
    (name) => !['state', 'derived', 'init', 'mount', 'cleanup', 'destroy'].includes(name)
  );

  const scopeTarget: Record<string, any> = {
    state: (initialState: Record<string, any>) => {
      Object.assign(rawState, initialState);
    },
    derived: (derivedMap: Record<string, () => any>) => {
      Object.assign(derivedFns, derivedMap);
    },
    init,
    mount,
    cleanup,
    destroy
  };

  // Reactive store wraps the same object script code reads/writes, created
  // up-front so scopeProxy reads can route through it and participate in
  // observer tracking (required for derived recomputation).
  const reactiveState = store(rawState);

  const scopeProxy = new Proxy(scopeTarget, {
    has(target, prop) {
      if (typeof prop === 'string' && (prop in target || prop in rawState || prop in derivedFns)) {
        return true;
      }
      return false;
    },
    get(target, prop, receiver) {
      if (prop in target) return target[prop as string];
      if (prop in rawState) return reactiveState[prop as string];
      if (prop in derivedFns) return derivedFns[prop as string].call(receiver);
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      if (prop in rawState) {
        reactiveState[prop as string] = value;
        return true;
      }
      target[prop as string] = value;
      return true;
    }
  });

  try {
    const bindCode = declaredFnNames
      .map((name) => `try { if (typeof ${name} !== 'undefined') $scope['${name}'] = ${name}; } catch(e) {}`)
      .join('\n');

    const evaluatorFn = new Function(
      '$scope',
      `
      with ($scope) {
        ${transformedContent}
        ${bindCode}
      }
      `
    );

    evaluatorFn(scopeProxy);
  } catch (err) {
    console.error('[Lyap Script Error] Failed to parse <script type="lyap">:', err);
  }

  // Move top-level functions defined on scopeTarget to rawState and functionsObj
  for (const [key, val] of Object.entries(scopeTarget)) {
    if (typeof val === 'function' && !['state', 'derived', 'init', 'mount', 'cleanup', 'destroy'].includes(key)) {
      functionsObj[key] = val;
      rawState[key] = val;
    }
  }

  const reactiveDerived: Record<string, any> = {};
  for (const [key, getter] of Object.entries(derivedFns)) {
    const comp = computed(() => {
      const evalProxy = new Proxy(reactiveState, {
        has(target, prop) {
          return prop in target || prop in reactiveDerived;
        },
        get(target, prop, receiver) {
          if (prop in reactiveDerived) return reactiveDerived[prop as string];
          return target[prop as string];
        }
      });
      return getter.call(evalProxy);
    });

    // Define the accessor on the underlying target (not the store proxy) so the
    // store's get trap (Reflect.get on target) actually hits it.
    Object.defineProperty(rawState, key, {
      get: () => comp.value,
      enumerable: true,
      configurable: true
    });
  }

  return {
    state: reactiveState,
    derived: reactiveDerived,
    functions: functionsObj,
    initHooks,
    mountHooks,
    destroyHooks
  };
}
