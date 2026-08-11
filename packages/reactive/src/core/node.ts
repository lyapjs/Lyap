import { NodeFlags, NodeKind } from "./flags.js";

export class Node {
    flags: NodeFlags = NodeFlags.CLEAN;
    kind: NodeKind;
    version: number = 1;

    constructor(kind: NodeKind) {
        this.kind = kind;
    }
}

export interface Source {
    version: number;
    flags: NodeFlags;
    kind: NodeKind;
    observers: Set<Observer>;
}

export interface Observer {
    flags: NodeFlags;
    kind: NodeKind;
    sources: Set<Source>;
}

export type EffectFn = () => any;
export type ComputedFn<T> = () => T;