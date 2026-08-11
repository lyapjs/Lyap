import { describe, it, expect, vi } from 'vitest';
import { signal, Computed, computed } from '../src/index.js';

describe('Computed Tests', () => {
    it('creates a Computed instance', () => {
        const c = computed(() => 42);
        expect(c).toBeInstanceOf(Computed);
    });

    it('evaluates computation lazily on first .value read', () => {
        const fn = vi.fn(() => 100);
        const c = computed(fn);

        expect(fn).not.toHaveBeenCalled();
        expect(c.value).toBe(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('computes derived values from reactive signals', () => {
        const count = signal(5);
        const double = computed(() => count.value * 2);

        expect(double.value).toBe(10);
    });

    it('updates derived value when source signal updates', () => {
        const count = signal(3);
        const double = computed(() => count.value * 2);

        expect(double.value).toBe(6);

        count.set(10);
        expect(double.value).toBe(20);
    });

    it('caches value and does not re-run function if clear', () => {
        const count = signal(4);
        const fn = vi.fn(() => count.value * 10);
        const c = computed(fn);

        expect(c.value).toBe(40);
        expect(fn).toHaveBeenCalledTimes(1);

        expect(c.value).toBe(40);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
