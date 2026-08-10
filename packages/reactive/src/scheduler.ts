import { runEffect } from "./effect.js";
import type { Listener } from "./signal.js";

export type JobQueue = Set<Listener>

export const jobQueue: JobQueue = new Set();

let isFlushing = false;

function flushJobs() {
    if (isFlushing) return;

    isFlushing = true;

    for (const effect of jobQueue) {
        runEffect(effect);
    }

    jobQueue.clear();

    isFlushing = false;
}

export function queueFlush() {
    Promise.resolve().then(flushJobs);
}