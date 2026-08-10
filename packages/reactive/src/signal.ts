import { NodeKind } from "./core/flags.js";
import { Node } from "./core/Node.js";
import { currentListener } from "./effect.js";
import { jobQueue, queueFlush } from "./scheduler.js";

export interface Listener {
  fn: () => void;
  deps: Set<Signal<any>>
}

export class Signal<T> extends Node{
  private _value: T;
  subscribers: Set<Listener> = new Set();

  constructor(initialValue: T) {
    super(NodeKind.SIGNAL);
    this._value = initialValue;
  }

  get value(): T {
    if (currentListener.length !== 0) {
      const listener = currentListener[currentListener.length - 1] as Listener;
      this.subscribers.add(listener);
      listener.deps.add(this);
    }
    return this._value;
  }

  set(newValue: T): void {
    if (Object.is(this._value, newValue)) return;

    this._value = newValue;
    for (const listener of this.subscribers) {
      jobQueue.add(listener);
    }
    queueFlush();
  }
}

export function signal<T>(initialValue: T): Signal<T> {
  return new Signal<T>(initialValue);
}