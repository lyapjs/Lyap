import { Signal, signal } from './signal.js';

const STORE_RAW = Symbol('STORE_RAW');
const proxyMap = new WeakMap<object, any>();
const rawMap = new WeakMap<object, object>();

export function isStore(target: any): boolean {
  return target !== null && typeof target === 'object' && rawMap.has(target);
}

export function toRaw<T>(target: T): T {
  return (target && (target as any)[STORE_RAW]) || target;
}

export function store<T extends object>(initialTarget: T): T {
  if (typeof initialTarget !== 'object' || initialTarget === null) {
    return initialTarget;
  }

  if (rawMap.has(initialTarget)) {
    return initialTarget as T;
  }
  if (proxyMap.has(initialTarget)) {
    return proxyMap.get(initialTarget);
  }

  const signalMap = new Map<string | symbol, Signal<any>>();

  function getSignal(prop: string | symbol, initVal: any): Signal<any> {
    let sig = signalMap.get(prop);
    if (!sig) {
      sig = signal(initVal);
      signalMap.set(prop, sig);
    }
    return sig;
  }

  const proxy = new Proxy(initialTarget, {
    get(target, prop, receiver) {
      if (prop === STORE_RAW) {
        return target;
      }

      const val = Reflect.get(target, prop, receiver);

      if (typeof prop !== 'symbol' || prop === Symbol.iterator) {
        const sig = getSignal(prop, val);
        sig.value;
      }

      if (typeof val === 'object' && val !== null && !(val instanceof Date) && !(val instanceof RegExp)) {
        return store(val);
      }

      if (typeof val === 'function' && Array.isArray(target)) {
        if (['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].includes(prop as string)) {
          return function (...args: any[]) {
            const res = (Array.prototype as any)[prop].apply(target, args);
            for (const [p, sig] of signalMap.entries()) {
              sig.set((target as any)[p]);
            }
            const lengthSig = signalMap.get('length');
            if (lengthSig) lengthSig.set(target.length);
            return res;
          };
        }
      }

      return val;
    },

    set(target, prop, value, receiver) {
      const oldVal = Reflect.get(target, prop, receiver);
      const isNew = !Reflect.has(target, prop);
      const oldLength = Array.isArray(target) ? target.length : 0;

      const rawVal = toRaw(value);
      const result = Reflect.set(target, prop, rawVal, receiver);

      if (result && !Object.is(oldVal, rawVal)) {
        const sig = signalMap.get(prop);
        if (sig) {
          sig.set(rawVal);
        }
        if (Array.isArray(target) && (isNew || target.length !== oldLength)) {
          const lengthSig = signalMap.get('length');
          if (lengthSig) lengthSig.set(target.length);
        }
      }

      return result;
    },

    deleteProperty(target, prop) {
      const hasKey = Reflect.has(target, prop);
      const result = Reflect.deleteProperty(target, prop);
      if (hasKey && result) {
        const sig = signalMap.get(prop);
        if (sig) {
          sig.set(undefined);
        }
        signalMap.delete(prop);
      }
      return result;
    },

    has(target, prop) {
      const sig = getSignal(prop, Reflect.get(target, prop));
      sig.value;
      return Reflect.has(target, prop);
    },

    ownKeys(target) {
      const lengthSig = getSignal(Array.isArray(target) ? 'length' : 'keys', null);
      lengthSig.value;
      return Reflect.ownKeys(target);
    }
  });

  proxyMap.set(initialTarget, proxy);
  rawMap.set(proxy, initialTarget);

  return proxy;
}
