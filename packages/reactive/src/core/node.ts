import { NodeFlags, NodeKind } from "./flags.js";

export class Node {
    flags: NodeFlags = NodeFlags.CLEAN;
    kind: NodeKind;
    version: number = 0;

    constructor(kind: NodeKind) {
        this.kind = kind;
    }
}