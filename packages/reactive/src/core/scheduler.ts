import type { Effect } from "../primitives/effect.js";

export type JobQueue = Set<Effect>;

export const jobQueue: JobQueue = new Set();

let isFlushing = false;

export function flushJobs() {
    if (isFlushing) return;

    isFlushing = true;

    while (jobQueue.size > 0) {
        const jobs = Array.from(jobQueue);
        jobQueue.clear();
        for (const effect of jobs) {
            effect.runEffect();
        }
    }

    isFlushing = false;
}

export function queueFlush() {
    Promise.resolve().then(flushJobs);
}
