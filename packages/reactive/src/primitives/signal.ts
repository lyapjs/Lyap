import { NodeKind } from "../core/flags.js";
import { Node, type Observer, type Source } from "../core/node.js";
import { currentObserver } from "../core/tracking.js";
import { notify, NotifyType } from "../core/notify.js";

export class Signal<T> extends Node implements Source {
  private _value: T;
  observers: Set<Observer> = new Set();

  constructor(initialValue: T) {
    super(NodeKind.SIGNAL);
    this._value = initialValue;
  }

  get value(): T {
    if (currentObserver.length !== 0) {
      const observer = currentObserver[currentObserver.length - 1] as Observer;
      this.observers.add(observer);
      observer.sources.add(this);
    }
    return this._value;
  }

  set value(newValue: T) {
    this.set(newValue);
  }

  set(newValue: T): void {
    if (Object.is(this._value, newValue)) return;

    this._value = newValue;
    this.version++;
    notify(this.observers, NotifyType.DIRTY);
  }
}

export function signal<T>(initialValue: T): Signal<T> {
  return new Signal<T>(initialValue);
}
