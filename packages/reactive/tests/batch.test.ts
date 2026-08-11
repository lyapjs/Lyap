import { describe, it, expect, vi } from 'vitest';
import { signal, effect, batch } from '../src/index.js';

describe('Batch Update Tests', () => {
    it('returns the value from the batch callback', () => {
        const res = batch(() => 42);
        expect(res).toBe(42);
    });

    it('defers effect execution until batch completes', () => {
        const first = signal('John');
        const last = signal('Doe');
        const effectCalls = vi.fn();

        const e = effect(() => {
            effectCalls(first.value, last.value);
        });
        e.runEffect();

        expect(effectCalls).toHaveBeenCalledTimes(1);
        expect(effectCalls).toHaveBeenLastCalledWith('John', 'Doe');

        batch(() => {
            first.set('Jane');
            last.set('Smith');
            expect(effectCalls).toHaveBeenCalledTimes(1);
        });

        expect(effectCalls).toHaveBeenCalledTimes(2);
        expect(effectCalls).toHaveBeenLastCalledWith('Jane', 'Smith');
    });

    it('handles nested batch() calls correctly', () => {
        const count = signal(0);
        const effectSpy = vi.fn();

        const e = effect(() => {
            effectSpy(count.value);
        });
        e.runEffect();

        expect(effectSpy).toHaveBeenCalledTimes(1);

        batch(() => {
            count.set(1);
            batch(() => {
                count.set(2);
                expect(effectSpy).toHaveBeenCalledTimes(1);
            });
            expect(effectSpy).toHaveBeenCalledTimes(1);
        });

        expect(effectSpy).toHaveBeenCalledTimes(2);
        expect(effectSpy).toHaveBeenLastCalledWith(2);
    });
});
