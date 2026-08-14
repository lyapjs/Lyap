import { Signal } from "../primitives/signal.js";
import { Computed } from "../primitives/computed.js";
import { effect } from "../primitives/effect.js";
import { untrack } from "./untrack.js";

function snapshot(value: any): any {
    if (Array.isArray(value)) return [...value];
    if (value !== null && typeof value === 'object') return { ...value };
    return value;
}

export type WatchSource<T = any> = Signal<T> | Computed<T> | (() => T);

export interface WatchOptions {
    immediate?: boolean;
}

export function watch<T>(
    source: WatchSource<T> | WatchSource<T>[],
    cb: (newValue: any, oldValue: any) => void,
    options: WatchOptions = {}
): () => void {
    const getter = Array.isArray(source)
        ? () => source.map((s) => (typeof s === "function" ? s() : s.value))
        : () => (typeof source === "function" ? source() : source.value);

    let oldValue: any;
    let isFirstRun = true;

    const e = effect(() => {
        const newValue = getter();

        if (isFirstRun) {
            isFirstRun = false;
            oldValue = snapshot(newValue);
            if (options.immediate) {
                untrack(() => cb(newValue, undefined));
            }
            return;
        }

        const prev = oldValue;
        oldValue = snapshot(newValue);

        untrack(() => cb(newValue, prev));
    });
    e.runEffect();

    return () => e.dispose();
}
