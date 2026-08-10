import { cleanup } from "./cleanup.js";
import type { Listener } from "./signal.js";

export let currentListener: Listener[] = [];

function createEffect(fn: () => void): Listener {
  return {
    fn,
    deps: new Set(),
  }
}

export function effect(fn: () => void) {
  const effect = createEffect(fn);
  runEffect(effect);
}

export function runEffect(effect: Listener) {
  cleanup(effect);
  currentListener.push(effect);
  effect.fn();
  currentListener.pop();
}