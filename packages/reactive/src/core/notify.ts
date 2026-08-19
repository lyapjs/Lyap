import { batchDepth } from "../utils/batch.js";
import type { Computed } from "../primitives/computed.js";
import { hasFlag, NodeFlags, NodeKind } from "./flags.js";
import type { Observer } from "./node.js";
import type { Effect } from "../primitives/effect.js";
import { queueJob, queueFlush } from "./scheduler.js";

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
                queueJob(observer as Effect);
            }
        } else {
            const computed = observer as Computed<any>;
            if (type === NotifyType.DIRTY) computed.markDirty();
            else computed.markPending();
        }
    }
    if (isEffectSet && batchDepth === 0) {
        queueFlush();
    }
}
