import { describe, it, expect, vi } from 'vitest';
import { signal, computed, effect, untrack } from '../src/index.js';

describe('Untrack Primitives Tests', () => {
    it('returns the result of the function passed to untrack()', () => {
        const val = untrack(() => 100);
        expect(val).toBe(100);
    });

    it('prevents effect from subscribing to signals read inside untrack()', async () => {
        const trackedSig = signal(1);
        const untrackedSig = signal(10);

        const effectFn = vi.fn();

        const e = effect(() => {
            effectFn();
            const trackedVal = trackedSig.value;
            const untrackedVal = untrack(() => untrackedSig.value);
            return `${trackedVal}-${untrackedVal}`;
        });
        e.runEffect();

        expect(effectFn).toHaveBeenCalledTimes(1);

        untrackedSig.set(20);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));
        expect(effectFn).toHaveBeenCalledTimes(1);

        trackedSig.set(2);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));
        expect(effectFn).toHaveBeenCalledTimes(2);
    });

    it('prevents computed from subscribing to signals read inside untrack()', () => {
        const trackedSig = signal('a');
        const untrackedSig = signal('b');

        const c = computed(() => {
            return trackedSig.value + untrack(() => untrackedSig.value);
        });

        expect(c.value).toBe('ab');

        untrackedSig.set('z');
        expect(c.value).toBe('ab');

        trackedSig.set('x');
        expect(c.value).toBe('xz');
    });

    it('restores observer stack even if untracked callback throws an error', () => {
        const sig = signal(5);
        let errorCaught = false;

        const e = effect(() => {
            sig.value;
            try {
                untrack(() => {
                    throw new Error('Test error');
                });
            } catch {
                errorCaught = true;
            }
        });
        e.runEffect();

        expect(errorCaught).toBe(true);
        expect(sig.observers.has(e)).toBe(true);
    });
});
