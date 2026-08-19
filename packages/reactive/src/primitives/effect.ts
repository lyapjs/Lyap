import { cleanup } from "../core/cleanup.js";
import { addFlag, hasFlag, NodeFlags, NodeKind, removeFlag } from "../core/flags.js";
import { Node, type EffectFn, type Observer, type Source } from "../core/node.js";
import { currentObserver } from "../core/tracking.js";
import { currentOwner } from "./owner.js";
import { jobQueue } from "../core/scheduler.js";

export class Effect extends Node implements Observer {
  sources = new Set<Source>();
  private fn: EffectFn;
  private cleanupFn?: (() => void) | undefined;

  constructor(fn: EffectFn) {
    super(NodeKind.EFFECT);
    this.fn = fn;
  }

  dispose() {
    if (hasFlag(this, NodeFlags.DISPOSED)) return;

    jobQueue.delete(this);
    removeFlag(this, NodeFlags.QUEUED);

    let firstError: unknown;
    try {
      this.cleanupFn?.();
    } catch (error) {
      firstError = error;
    } finally {
      this.cleanupFn = undefined;
      cleanup(this);
      addFlag(this, NodeFlags.DISPOSED);
    }

    if (firstError !== undefined) throw firstError;
  }

  runEffect() {
    if (hasFlag(this, NodeFlags.DISPOSED)) return;

    jobQueue.delete(this);
    removeFlag(this, NodeFlags.QUEUED);

    let cleanupError: unknown;
    try {
      this.cleanupFn?.();
    } catch (error) {
      cleanupError = error;
    } finally {
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

    if (cleanupError !== undefined) throw cleanupError;
  }
}

export function effect(fn: EffectFn) {
  const e = new Effect(fn);
  currentOwner?.resources.add(e);
  return e;
}
