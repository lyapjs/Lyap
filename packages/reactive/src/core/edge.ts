// will be used in later versions
import type { Node } from "./Node.js";

export class Edge {
    source: Node | null = null;
    observer: Node | null = null;

    prevSource: Edge | null = null;
    prevObserver: Edge | null = null;

    nextSource: Edge | null = null;
    nextObserver: Edge | null = null;

    reset() {
        this.source = null;
        this.observer = null;
        this.prevSource = null;
        this.prevObserver = null;
        this.nextSource = null;
        this.nextObserver = null;
    }
}

export class EdgePool {
    private readonly free: Edge[] = [];

    acquire(): Edge {
        return this.free.pop() ?? new Edge();
    }

    release(edge: Edge) {
        edge.reset();
        this.free.push(edge);
    }
}