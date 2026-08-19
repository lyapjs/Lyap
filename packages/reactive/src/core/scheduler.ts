import type { Effect } from "../primitives/effect.js";

export type JobQueue = Set<Effect>;

export const jobQueue: JobQueue = new Set();

let isFlushing = false;

export function flushJobs(throwErrors = true) {
    if (isFlushing) return;

    isFlushing = true;

    let firstError: unknown;
    try {
        while (jobQueue.size > 0) {
            const jobs = Array.from(jobQueue);
            jobQueue.clear();
            for (const effect of jobs) {
                try {
                    effect.runEffect();
                } catch (error) {
                    if (firstError === undefined) firstError = error;
                }
            }
        }
    } finally {
        isFlushing = false;
    }

    if (firstError !== undefined) {
        if (throwErrors) throw firstError;
        console.error(firstError);
    }
}

export function queueFlush() {
    Promise.resolve().then(() => flushJobs(false));
}
