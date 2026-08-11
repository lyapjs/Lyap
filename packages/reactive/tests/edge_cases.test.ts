import { describe, it, expect } from 'vitest';
import { signal, computed, effect } from '../src/index.js';

describe('Production Edge Cases & Glitch-Free Verification', () => {
    it('handles multiple computed observers listening to the same signal', () => {
        const count = signal(2);
        const double = computed(() => count.value * 2);
        const triple = computed(() => count.value * 3);
        const sum = computed(() => double.value + triple.value);

        expect(sum.value).toBe(10);

        count.set(5);
        expect(double.value).toBe(10);
        expect(triple.value).toBe(15);
        expect(sum.value).toBe(25);
    });

    it('handles signal mutation from inside an effect without infinite loops', async () => {
        const count = signal(0);
        const log: number[] = [];

        const e = effect(() => {
            log.push(count.value);
            if (count.value < 3) {
                count.set(count.value + 1);
            }
        });
        e.runEffect();

        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));

        expect(log).toEqual([0, 1, 2, 3]);
        expect(count.value).toBe(3);
    });

    it('ensures no glitched intermediate states during diamond evaluation', () => {
        const base = signal(1);
        const timesTwo = computed(() => base.value * 2);
        const timesTen = computed(() => base.value * 10);

        const observedStates: number[] = [];
        const combined = computed(() => {
            const val = timesTwo.value + timesTen.value;
            observedStates.push(val);
            return val;
        });

        expect(combined.value).toBe(12);
        expect(observedStates).toEqual([12]);

        base.set(2);
        expect(combined.value).toBe(24);
        expect(observedStates).toEqual([12, 24]);
    });

    it('handles array and object signal state updates', () => {
        const list = signal<number[]>([1, 2, 3]);
        const sum = computed(() => list.value.reduce((acc, curr) => acc + curr, 0));

        expect(sum.value).toBe(6);

        list.set([...list.value, 4]);
        expect(sum.value).toBe(10);
    });
});
