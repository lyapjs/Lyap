import { describe, it, expect, vi } from 'vitest';
import { signal, Effect, effect, computed } from '../src/index.js';

describe('Effect Tests', () => {
    it('creates an Effect instance', () => {
        const fn = vi.fn();
        const e = effect(fn);
        expect(e).toBeInstanceOf(Effect);
    });

    it('tracks signal dependencies when runEffect() is executed', () => {
        const count = signal(1);
        let dummy = 0;

        const e = effect(() => {
            dummy = count.value;
        });

        expect(dummy).toBe(0);
        expect(count.observers.has(e)).toBe(false);

        e.runEffect();
        expect(dummy).toBe(1);
        expect(count.observers.has(e)).toBe(true);
        expect(e.sources.has(count)).toBe(true);
    });

    it('re-executes effect asynchronously when tracked signal changes', async () => {
        const count = signal(10);
        let dummy = 0;

        const e = effect(() => {
            dummy = count.value;
        });
        e.runEffect();
        expect(dummy).toBe(10);

        count.set(20);

        await Promise.resolve();
        await new Promise((res) => setTimeout(res, 0));

        expect(dummy).toBe(20);
    });

    it('tracks computed dependencies inside effects', async () => {
        const count = signal(2);
        const double = computed(() => count.value * 2);
        let result = 0;

        const e = effect(() => {
            result = double.value;
        });
        e.runEffect();

        expect(result).toBe(4);

        count.set(5);
        await Promise.resolve();
        await new Promise((res) => setTimeout(res, 0));

        expect(result).toBe(10);
    });
});
