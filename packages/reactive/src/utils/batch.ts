import { flushJobs } from "../core/scheduler.js";

export let batchDepth = 0;

export function batch<T>(fn: () => T): T {
    batchDepth++;
    try {
        return fn();
    } finally {
        batchDepth--;
        if (batchDepth === 0) {
            flushJobs();
        }
    }
}
