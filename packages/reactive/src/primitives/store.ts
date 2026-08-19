import { Signal, signal } from './signal.js';

const STORE_RAW = Symbol('STORE_RAW');
const proxyMap = new WeakMap<object, any>();
const rawMap = new WeakMap<object, object>();

function canProxy(value: unknown): value is object {
  return value !== null && typeof value === 'object' &&
    !(value instanceof Date) &&
    !(value instanceof RegExp) &&
    !(value instanceof Map) &&
    !(value instanceof Set) &&
    !(value instanceof WeakMap) &&
    !(value instanceof WeakSet);
}

function isArrayIndex(prop: string | symbol): boolean {
  if (typeof prop !== 'string' || prop === '') return false;
  const index = Number(prop);
  return Number.isInteger(index) && index >= 0 && String(index) === prop;
}

export function isStore(target: any): boolean {
  return target !== null && typeof target === 'object' && rawMap.has(target);
}

export function toRaw<T>(target: T): T {
  return (target && (target as any)[STORE_RAW]) || target;
}

export function store<T extends object>(initialTarget: T): T {
  if (!canProxy(initialTarget)) {
    return initialTarget;
  }

  if (rawMap.has(initialTarget)) {
    return initialTarget as T;
  }
  if (proxyMap.has(initialTarget)) {
    return proxyMap.get(initialTarget);
  }

  const signalMap = new Map<string | symbol, Signal<any>>();
  const presenceMap = new Map<string | symbol, Signal<boolean>>();
  let keysSignal: Signal<PropertyKey[]> | undefined;

  function getSignal(prop: string | symbol, initVal: any): Signal<any> {
    let sig = signalMap.get(prop);
    if (!sig) {
      sig = signal(initVal);
      signalMap.set(prop, sig);
    }
    return sig;
  }

  function getPresenceSignal(prop: string | symbol): Signal<boolean> {
    let sig = presenceMap.get(prop);
    if (!sig) {
      sig = signal(Reflect.has(initialTarget, prop));
      presenceMap.set(prop, sig);
    }
    return sig;
  }

  function notifyKeys() {
    keysSignal?.set(Reflect.ownKeys(initialTarget));
  }

  const proxy = new Proxy(initialTarget, {
    get(target, prop, receiver) {
      if (prop === STORE_RAW) {
        return target;
      }

      const val = Reflect.get(target, prop, receiver);

      getSignal(prop, val).value;

      if (canProxy(val)) {
        return store(val);
      }

      if (typeof val === 'function' && Array.isArray(target)) {
        if (['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].includes(prop as string)) {
            return function (...args: any[]) {
              const res = (Array.prototype as any)[prop].apply(target, args);
              for (const [p, sig] of signalMap.entries()) {
                sig.set((target as any)[p]);
                if (isArrayIndex(p)) {
                  getPresenceSignal(p).set(Reflect.has(target, p));
                }
              }
              const lengthSig = signalMap.get('length');
              if (lengthSig) lengthSig.set(target.length);
              notifyKeys();
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

      if (result && (isNew || !Object.is(oldVal, rawVal))) {
        const sig = signalMap.get(prop);
        if (sig) {
          sig.set(rawVal);
        }
        if (isNew) {
          getPresenceSignal(prop).set(true);
          notifyKeys();
        }

        if (Array.isArray(target)) {
          const lengthSig = signalMap.get('length');
          if (lengthSig && target.length !== oldLength) lengthSig.set(target.length);

          if (prop === 'length' && target.length < oldLength) {
            for (const [key, indexSignal] of signalMap.entries()) {
              if (isArrayIndex(key) && Number(key) >= target.length) {
                indexSignal.set(undefined);
                getPresenceSignal(key).set(false);
              }
            }
            notifyKeys();
          }
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
        getPresenceSignal(prop).set(false);
        signalMap.delete(prop);
        notifyKeys();
      }
      return result;
    },

    has(target, prop) {
      getPresenceSignal(prop).value;
      return Reflect.has(target, prop);
    },

    ownKeys(target) {
      if (!keysSignal) keysSignal = signal(Reflect.ownKeys(target));
      keysSignal.value;
      return Reflect.ownKeys(target);
    }
  });

  proxyMap.set(initialTarget, proxy);
  rawMap.set(proxy, initialTarget);

  return proxy;
}
