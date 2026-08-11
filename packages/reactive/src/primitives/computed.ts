import { cleanup } from "../core/cleanup.js";
import { addFlag, hasFlag, NodeFlags, NodeKind, removeFlag } from "../core/flags.js";
import { Node, type ComputedFn, type Observer, type Source } from "../core/node.js";
import { currentObserver } from "../core/tracking.js";
import { notify, NotifyType } from "../core/notify.js";
import { currentOwner } from "./owner.js";

export class Computed<T> extends Node implements Source, Observer {
    private fn: ComputedFn<T>;
    _value: T = undefined as unknown as T;
    sources = new Set<Source>();
    observers = new Set<Observer>();

    get value(): T {
        if (hasFlag(this, NodeFlags.DIRTY) || hasFlag(this, NodeFlags.PENDING)) this.update();
        if (currentObserver.length !== 0) {
            const observer = currentObserver[currentObserver.length - 1] as Observer;
            this.observers.add(observer);
            observer.sources.add(this);
        }
        return this._value;
    }

    constructor(fn: ComputedFn<T>) {
        super(NodeKind.COMPUTED);
        this.fn = fn;
        addFlag(this, NodeFlags.DIRTY);
    }

    update(): void {
        if (hasFlag(this, NodeFlags.DIRTY)) {
            cleanup(this);
            currentObserver.push(this);
            let value: T;
            try {
                value = this.fn();
            } finally {
                currentObserver.pop();
            }
            if (!Object.is(value, this._value)) {
                this._value = value;
                this.version++;
                notify(this.observers, NotifyType.DIRTY);
            }
            removeFlag(this, NodeFlags.DIRTY);
            return;
        }

        if (hasFlag(this, NodeFlags.PENDING)) {
            for (const source of this.sources) {
                if (source.kind === NodeKind.COMPUTED) {
                    const computed = source as Computed<any>;
                    if (hasFlag(computed, NodeFlags.DIRTY) || hasFlag(computed, NodeFlags.PENDING)) {
                        const lastVersion = computed.version;
                        computed.update();
                        if (computed.version !== lastVersion) {
                            cleanup(this);
                            currentObserver.push(this);
                            let value: T;
                            try {
                                value = this.fn();
                            } finally {
                                currentObserver.pop();
                            }
                            if (!Object.is(value, this._value)) {
                                this._value = value;
                                this.version++;
                                notify(this.observers, NotifyType.DIRTY);
                            }
                            removeFlag(this, NodeFlags.PENDING);
                            return;
                        }
                    }
                }
            }
            removeFlag(this, NodeFlags.PENDING);
        }
    }

    dispose() {
        cleanup(this);
    }

    markDirty() {
        if (hasFlag(this, NodeFlags.DIRTY)) return;
        addFlag(this, NodeFlags.DIRTY);
        notify(this.observers, NotifyType.PENDING);
    }

    markPending() {
        if (hasFlag(this, NodeFlags.DIRTY) || hasFlag(this, NodeFlags.PENDING)) return;
        addFlag(this, NodeFlags.PENDING);
        notify(this.observers, NotifyType.PENDING);
    }
}

export function computed<T>(fn: ComputedFn<T>) {
    const c = new Computed(fn);
    currentOwner?.resources.add(c);
    return c;
}
