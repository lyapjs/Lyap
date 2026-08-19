export let currentOwner: Owner | null = null;

export class Owner {
    resources = new Set<any>();
    fn: () => void;
    cleanups: (() => void)[] = [];

    constructor(fn: () => void) {
        this.fn = fn;
    }

    addCleanup(fn: () => void) {
        this.cleanups.push(fn);
    }

    dispose() {
        let firstError: unknown;

        for (const cleanup of this.cleanups) {
            try {
                cleanup();
            } catch (error) {
                if (firstError === undefined) firstError = error;
            }
        }
        this.cleanups = [];

        for (const node of this.resources) {
            if (typeof node.dispose === 'function') {
                try {
                    node.dispose();
                } catch (error) {
                    if (firstError === undefined) firstError = error;
                }
            }
        }
        this.resources.clear();

        if (firstError !== undefined) throw firstError;
    }

    run() {
        const prev = currentOwner;
        currentOwner = this;
        try {
            return this.fn();
        } finally {
            currentOwner = prev;
        }
    }
}

export function scope(fn: () => void) {
    const owner = new Owner(fn);
    currentOwner?.resources.add(owner);
    return owner;
}

export function onCleanup(fn: () => void) {
    if (currentOwner) {
        currentOwner.addCleanup(fn);
    }
}
