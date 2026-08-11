import { describe, it, expect, vi } from 'vitest';
import { signal } from '../src/signal.js';
import { computed } from '../src/computed.js';
import { watch } from '../src/watch.js';

describe('Watch Reactive Utility Tests', () => {
    it('does not trigger callback initially by default', () => {
        const count = signal(0);
        const cb = vi.fn();

        watch(count, cb);
        expect(cb).not.toHaveBeenCalled();
    });

    it('triggers callback with newValue and oldValue when signal changes', async () => {
        const count = signal(10);
        const cb = vi.fn();

        watch(count, cb);

        count.set(20);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(20, 10);

        count.set(30);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));

        expect(cb).toHaveBeenCalledTimes(2);
        expect(cb).toHaveBeenCalledWith(30, 20);
    });

    it('triggers callback immediately when immediate: true is specified', () => {
        const count = signal(5);
        const cb = vi.fn();

        watch(count, cb, { immediate: true });

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(5, undefined);
    });

    it('watches getter function sources () => value', async () => {
        const first = signal('John');
        const last = signal('Doe');
        const cb = vi.fn();

        watch(() => `${first.value} ${last.value}`, cb);

        first.set('Jane');
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith('Jane Doe', 'John Doe');
    });

    it('watches array of multiple sources [sourceA, sourceB]', async () => {
        const a = signal(1);
        const b = signal(2);
        const cb = vi.fn();

        watch([a, b], cb);

        a.set(10);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith([10, 2], [1, 2]);
    });

    it('watches Computed nodes', async () => {
        const count = signal(2);
        const double = computed(() => count.value * 2);
        const cb = vi.fn();

        watch(double, cb);

        count.set(5);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(10, 4);
    });

    it('stops watching when returned unwatch disposer is called', async () => {
        const count = signal(0);
        const cb = vi.fn();

        const unwatch = watch(count, cb);

        count.set(1);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));
        expect(cb).toHaveBeenCalledTimes(1);

        // Dispose watcher
        unwatch();

        count.set(2);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));

        // Callback should NOT be called again
        expect(cb).toHaveBeenCalledTimes(1);
    });
});
