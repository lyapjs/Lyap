import type { Effect } from "../primitives/effect.js";
import { addFlag, hasFlag, NodeFlags } from "./flags.js";

export type JobQueue = Set<Effect>;

export const jobQueue: JobQueue = new Set();

let isFlushing = false;
let isFlushPending = false;

export function queueJob(effect: Effect) {
    if (hasFlag(effect, NodeFlags.DISPOSED) || hasFlag(effect, NodeFlags.QUEUED)) return;

    addFlag(effect, NodeFlags.QUEUED);
    jobQueue.add(effect);
}

export function flushJobs(throwErrors = true) {
    if (isFlushing) return;

    isFlushing = true;

    let firstError: unknown;
    let didError = false;
    try {
        while (jobQueue.size > 0) {
            const jobs = Array.from(jobQueue);
            jobQueue.clear();
            for (const effect of jobs) {
                try {
                    effect.runEffect();
                } catch (error) {
                    if (!didError) firstError = error;
                    didError = true;
                }
            }
        }
    } finally {
        isFlushing = false;
    }

    if (didError) {
        if (throwErrors) throw firstError;
        console.error(firstError);
    }
}

export function queueFlush() {
    if (isFlushPending) return;
    isFlushPending = true;
    Promise.resolve().then(() => {
        isFlushPending = false;
        flushJobs(false);
    });
}
