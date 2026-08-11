import { NodeFlags, NodeKind } from "./flags.js";

export class Node {
    flags: NodeFlags = NodeFlags.CLEAN;
    kind: NodeKind;
    version: number = 1;
    //sources and observers set in each one

    constructor(kind: NodeKind) {
        this.kind = kind;
    }
}

export interface Source {
    version: number;
    kind: NodeKind;
    observers: Set<Observer>;
}

export interface Observer {
    flags: NodeFlags,
    kind: NodeKind;
    sources: Set<Source>;
}

export type EffectFn = () => void | (() => void);
export type ComputedFn<T> = () => T;