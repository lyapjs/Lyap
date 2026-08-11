import type { Observer } from "./node.js";

export function cleanup(observer: Observer) {
    for (const source of observer.sources) {
        source.observers.delete(observer);
    }
    observer.sources.clear();
}
