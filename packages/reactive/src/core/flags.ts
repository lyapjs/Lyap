export const enum NodeFlags {
    //scheduler flags
    CLEAN = 0,
    DIRTY = 1 << 0,
    RUNNING = 1 << 1,
    QUEUED = 1 << 2,

    //lifecycle flags
    DISPOSED = 1 << 3,

    //later
    PENDING = 1 << 6,
}

export interface Flagged {
    flags: NodeFlags;
}


export function addFlag(obj: Flagged, flag: NodeFlags): void {
    obj.flags |= flag;
}


export function removeFlag(obj: Flagged, flag: NodeFlags): void {
    obj.flags &= ~flag;
}


export function hasFlag(obj: Flagged, flag: NodeFlags): boolean {
    return (obj.flags & flag) !== 0;
}

export const enum NodeKind {
    SIGNAL,
    COMPUTED,
    EFFECT,
}
