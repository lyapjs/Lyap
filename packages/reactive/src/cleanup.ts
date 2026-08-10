import type { Listener } from "./signal.js";

export function cleanup(listener: Listener) {

    for (const signal of listener.deps) {
        signal.subscribers.delete(listener);
    };

    listener.deps.clear();
}