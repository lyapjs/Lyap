import { describe, it, expect, vi } from 'vitest';
import { signal, Computed, computed, effect, watch } from '../src/index.js';

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

    it('does not leave stale PENDING flags leaking into future updates', async () => {
        const s1 = signal(1);
        const s2 = signal(10);
        const u = computed(() => s1.value);
        const x = computed(() => s2.value + u.value);
        const p = computed(() => x.value);
        let result = 0;
        const e = effect(() => {
            result = p.value;
        });
        e.runEffect();
        expect(result).toBe(11);

        s1.set(2);
        s2.set(9);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));
        expect(result).toBe(11);

        s1.set(3);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));
        expect(result).toBe(12);
    });

    it('throws a useful error for circular computed dependencies', () => {
        let value: any;
        value = computed(() => value.value + 1);

        expect(() => value.value).toThrow('Circular computed dependency detected');
    });

    it('stops a disposed computed from tracking source updates', () => {
        const source = signal(1);
        const doubled = computed(() => source.value * 2);

        expect(doubled.value).toBe(2);
        doubled.dispose();
        source.set(2);

        expect(doubled.value).toBe(2);
        expect(source.observers.has(doubled)).toBe(false);
    });

    it('does not notify watch when a computed value remains equal', async () => {
        const source = signal(0);
        const parity = computed(() => source.value % 2);
        const callback = vi.fn();
        const stop = watch(parity, callback);

        source.set(2);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));

        expect(callback).not.toHaveBeenCalled();
        stop();
    });
});
