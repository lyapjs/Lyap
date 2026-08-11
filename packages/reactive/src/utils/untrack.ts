import { currentObserver, setCurrentObserver } from "../core/tracking.js";

export function untrack<T>(fn: () => T): T {
    const prevObserver = currentObserver;

    setCurrentObserver([]);
    try {
        return fn();
    } finally {
        setCurrentObserver(prevObserver);
    }
}
