import { Signal } from "./signal.js";
import { Computed } from "./computed.js";
import { effect } from "./effect.js";
import { untrack } from "./untrack.js";

export type WatchSource<T = any> = Signal<T> | Computed<T> | (() => T);

export interface WatchOptions {
    immediate?: boolean;
}

export function watch<T>(
    source: WatchSource<T> | WatchSource<T>[],
    cb: (newValue: any, oldValue: any) => void,
    options: WatchOptions = {}
): () => void {
    // 1. Create a getter function for single or array sources
    const getter = Array.isArray(source)
        ? () => source.map((s) => (typeof s === "function" ? s() : s.value))
        : () => (typeof source === "function" ? source() : source.value);

    let oldValue: any;
    let isFirstRun = true;

    // 2. Create underlying effect
    const e = effect(() => {
        // Read source to subscribe effect
        const newValue = getter();

        if (isFirstRun) {
            isFirstRun = false;
            oldValue = Array.isArray(newValue) ? [...newValue] : newValue;
            if (options.immediate) {
                untrack(() => cb(newValue, undefined));
            }
            return;
        }

        // On subsequent signal updates:
        const prev = oldValue;
        oldValue = Array.isArray(newValue) ? [...newValue] : newValue;

        // Execute callback untracked to avoid cyclic subscriptions
        untrack(() => cb(newValue, prev));
    });
    e.runEffect();

    // 3. Return disposer
    return () => e.dispose();
}      