import { computed, effect, Owner, store, type Computed, type Effect } from '@lyapjs/reactive';
import type { ScopeCallback, Cleanup } from './types.js';

export type { ScopeCallback, Cleanup } from './types.js';

export const IS_LYAP_ACTION = Symbol('IS_LYAP_ACTION');

export class ScopeHandle {
  readonly name: string;
  readonly element: Element;
  readonly owner = new Owner(() => undefined);
  private stateRegistered = false;
  private derivedRegistered = false;
  private actionsRegistered = false;
  private stateStore: Record<string, any> = {};
  private derivedValues = new Map<string, Computed<any>>();
  private actionValues = new Map<string, (...args: any[]) => any>();
  private initCallbacks: ScopeCallback[] = [];
  private mountCallbacks: ScopeCallback[] = [];
  private destroyCallbacks: ScopeCallback[] = [];
  private refs = new Map<string, Element>();
  private publicProxy?: ScopeProxy;

  constructor(name: string, element: Element) {
    this.name = name;
    this.element = element;
  }

  state(values: Record<string, any>): this {
    if (this.stateRegistered) throw new Error(`Scope ${this.name} already registered state`);
    this.assertMembers(Object.keys(values));
    this.stateRegistered = true;
    this.stateStore = store(values);
    return this;
  }

  derived(values: Record<string, () => any>): this {
    if (this.derivedRegistered) throw new Error(`Scope ${this.name} already registered derived values`);
    this.derivedRegistered = true;
    this.assertMembers(Object.keys(values));
    this.owner.run(() => {
      for (const [name, getter] of Object.entries(values)) this.derivedValues.set(name, computed(getter));
    });
    return this;
  }

  actions(values: Record<string, (...args: any[]) => any>): this {
    if (this.actionsRegistered) throw new Error(`Scope ${this.name} already registered actions`);
    this.actionsRegistered = true;
    this.assertMembers(Object.keys(values));
    for (const [name, action] of Object.entries(values)) {
      const wrapped = (...args: any[]) => action.apply(this.proxy, args);
      (wrapped as any)[IS_LYAP_ACTION] = true;
      this.actionValues.set(name, wrapped);
    }
    return this;
  }

  init(callback: ScopeCallback): this {
    this.initCallbacks.push(callback);
    return this;
  }

  onMount(callback: ScopeCallback): this {
    this.mountCallbacks.push(callback);
    return this;
  }

  onDestroy(callback: ScopeCallback): this {
    this.destroyCallbacks.push(callback);
    return this;
  }

  cleanup(callback: Cleanup): this {
    this.owner.addCleanup(callback);
    return this;
  }

  setRef(name: string, element: Element) {
    this.refs.set(name, element);
  }

  deleteRef(name: string, element: Element) {
    if (this.refs.get(name) === element) this.refs.delete(name);
  }

  getRefs() {
    return Object.fromEntries(this.refs.entries());
  }

  getMember(name: string): any {
    if (name === '$refs') return this.getRefs();
    if (name === '$el') return this.element;
    if (name in this.stateStore) return this.stateStore[name];
    const derived = this.derivedValues.get(name);
    if (derived) return derived.value;
    return this.actionValues.get(name);
  }

  hasMember(name: string): boolean {
    return name === '$refs' || name === '$el' || name in this.stateStore || this.derivedValues.has(name) || this.actionValues.has(name);
  }

  get proxy(): ScopeProxy {
    return this.publicProxy ?? (this as unknown as ScopeProxy);
  }

  get initHooks() { return this.initCallbacks; }
  get mountHooks() { return this.mountCallbacks; }
  get destroyHooks() { return this.destroyCallbacks; }
  get effects() { return this.owner.resources; }

  isStateMember(name: string) {
    return name in this.stateStore;
  }

  isDerivedMember(name: string) {
    return this.derivedValues.has(name);
  }

  setStateMember(name: string, value: any) {
    if (!this.isStateMember(name)) return false;
    this.stateStore[name] = value;
    return true;
  }

  setPublicProxy(proxy: ScopeProxy) {
    this.publicProxy = proxy;
  }

  private assertMembers(names: string[]) {
    const reserved = new Set(['state', 'derived', 'actions', 'init', 'onMount', 'onDestroy', 'cleanup', 'name', 'element', 'owner']);
    for (const name of names) {
      if (reserved.has(name) || this.hasMember(name)) throw new Error(`Scope member collision: ${this.name}.${name}`);
    }
  }
}

export type ScopeProxy = ScopeHandle & Record<string, any>;

export function createScopeProxy(scope: ScopeHandle): ScopeProxy {
  const proxy = new Proxy(scope as ScopeProxy, {
    get(target, property, receiver) {
      if (typeof property === 'string' && !(property in target)) {
        return target.getMember(property);
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (typeof property === 'string' && target.isDerivedMember(property)) {
        throw new Error(`Cannot assign to derived value: ${target.name}.${property}`);
      }
      if (typeof property === 'string' && target.setStateMember(property, value)) {
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    },
    has(target, property) {
      return Reflect.has(target, property) || (typeof property === 'string' && target.hasMember(property));
    }
  });
  scope.setPublicProxy(proxy);
  return proxy;
}

export function createOwnedEffect(scope: ScopeHandle, fn: () => any): Effect {
  let result!: Effect;
  scope.owner.run(() => {
    result = effect(fn);
  });
  result.runEffect();
  return result;
}
