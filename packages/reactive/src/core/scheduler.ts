import type { Effect } from "../primitives/effect.js";

export type JobQueue = Set<Effect>;

export const jobQueue: JobQueue = new Set();

let isFlushing = false;
let isFlushScheduled = false;

export function flushJobs() {
    if (isFlushing) return;

    isFlushing = true;
    let cycles = 0;
    const MAX_CYCLES = 100;

    while (jobQueue.size > 0) {
        if (++cycles > MAX_CYCLES) {
            console.warn('[Lyap Guard] Infinite reactive update loop detected. Clearing job queue.');
            jobQueue.clear();
            break;
        }

        const pendingJobs = Array.from(jobQueue);
        jobQueue.clear();

        for (let i = 0; i < pendingJobs.length; i++) {
            const job = pendingJobs[i];
            if (job) {
                job.runEffect();
            }
        }
    }

    isFlushing = false;
}

export function queueFlush() {
    if (isFlushScheduled) return;
    isFlushScheduled = true;

    if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => {
            isFlushScheduled = false;
            flushJobs();
        });
    } else {
        Promise.resolve().then(() => {
            isFlushScheduled = false;
            flushJobs();
        });
    }
}
