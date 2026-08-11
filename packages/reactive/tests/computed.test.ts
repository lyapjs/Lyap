import { describe, it, expect, vi } from 'vitest';
import { signal } from '../src/signal.js';
import { Computed } from '../src/computed.js';
import { NodeKind, hasFlag, NodeFlags } from '../src/core/flags.js';

describe('Computed Tests', () => {
    it('creates a Computed instance with NodeKind.COMPUTED and DIRTY flag', () => {
        const c = new Computed(() => 42);
        expect(c).toBeInstanceOf(Computed);
        expect(c.kind).toBe(NodeKind.COMPUTED);
        expect(hasFlag(c, NodeFlags.DIRTY)).toBe(true);
    });

    it('evaluates computation lazily on first .value read', () => {
        const fn = vi.fn(() => 100);
        const c = new Computed(fn);

        expect(fn).not.toHaveBeenCalled();
        expect(c.value).toBe(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('computes derived values from reactive signals', () => {
        const count = signal(5);
        const double = new Computed(() => count.value * 2);

        expect(double.value).toBe(10);
    });

    it('updates derived value when source signal updates', () => {
        const count = signal(3);
        const double = new Computed(() => count.value * 2);

        expect(double.value).toBe(6);

        count.set(10);
        expect(double.value).toBe(20);
    });

    it('caches value and does not re-run function if dirty flag is clear', () => {
        const count = signal(4);
        const fn = vi.fn(() => count.value * 10);
        const c = new Computed(fn);

        expect(c.value).toBe(40);
        expect(fn).toHaveBeenCalledTimes(1);

        // Second read without signal update should hit cache
        expect(c.value).toBe(40);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
