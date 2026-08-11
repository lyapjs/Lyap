import { currentObserver, setCurrentObserver } from "./core/tracking.js";

export function untrack(fn: () => void) {
    const prevObserver = currentObserver;

    setCurrentObserver([]);
    try {
        return fn();
    } finally {
        setCurrentObserver(prevObserver);
    }
}