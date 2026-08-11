import { cleanup } from "../core/cleanup.js";
import { addFlag, hasFlag, NodeFlags, NodeKind } from "../core/flags.js";
import { Node, type EffectFn, type Observer, type Source } from "../core/node.js";
import { currentObserver } from "../core/tracking.js";
import { currentOwner } from "./owner.js";

export class Effect extends Node implements Observer {
  sources = new Set<Source>();
  private fn: EffectFn;
  private cleanupFn?: (() => void) | undefined;

  constructor(fn: EffectFn) {
    super(NodeKind.EFFECT);
    this.fn = fn;
  }

  dispose() {
    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = undefined;
    }
    cleanup(this);
    addFlag(this, NodeFlags.DISPOSED);
  }

  runEffect() {
    if (hasFlag(this, NodeFlags.DISPOSED)) return;
    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = undefined;
    }
    cleanup(this);
    currentObserver.push(this);
    try {
      const res = this.fn();
      if (typeof res === 'function') {
        this.cleanupFn = res;
      }
    } finally {
      currentObserver.pop();
    }
  }
}

export function effect(fn: EffectFn) {
  const e = new Effect(fn);
  currentOwner?.resources.add(e);
  return e;
}
