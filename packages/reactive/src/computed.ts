

export function computed<T>(fn: () => T) {
    let cacheValue: T;
    let dirty = true;

    return {
        get value(): T {
            if (dirty) {
                cacheValue = fn();
                dirty = false;
            }
            return cacheValue;
        }
    }
}