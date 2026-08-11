import { batchDepth } from "./batch.js";
import type { Computed } from "./computed.js";
import { hasFlag, NodeFlags, NodeKind } from "./core/flags.js";
import type { Observer } from "./core/node.js";
import type { Effect } from "./effect.js";
import { jobQueue, queueFlush } from "./scheduler.js";

export const enum NotifyType {
    DIRTY,
    PENDING,
}

export function notify<T>(observers: Set<Observer>, type: NotifyType) {
    let isEffectSet = false;
    for (const observer of observers) {
        if (observer.kind === NodeKind.EFFECT) {
            if (!hasFlag(observer, NodeFlags.DISPOSED)) {
                if (!isEffectSet) isEffectSet = true;
                jobQueue.add(observer as Effect);
            }
        } else {
            const computed = observer as Computed<any>;
            if (type === NotifyType.DIRTY) computed.markDirty();
            else computed.markPending();
        }
    }
    if (isEffectSet && batchDepth === 0) {
        queueFlush();
        isEffectSet = false;
    }
}