import { describe, it, expect, vi } from 'vitest';
import { signal } from '../src/signal.js';
import { Computed } from '../src/computed.js';
import { Effect } from '../src/effect.js';

describe('Production Edge Cases & Glitch-Free Verification', () => {
    it('handles multiple computed observers listening to the same signal', () => {
        const count = signal(2);
        const double = new Computed(() => count.value * 2);
        const triple = new Computed(() => count.value * 3);
        const sum = new Computed(() => double.value + triple.value);

        expect(sum.value).toBe(10); // (2*2) + (2*3) = 10

        count.set(5);
        expect(double.value).toBe(10);
        expect(triple.value).toBe(15);
        expect(sum.value).toBe(25); // (5*2) + (5*3) = 25
    });

    it('handles signal mutation from inside an effect without infinite loops', async () => {
        const count = signal(0);
        const log: number[] = [];

        const e = new Effect(() => {
            log.push(count.value);
            if (count.value < 3) {
                count.set(count.value + 1);
            }
        });
        e.runEffect();

        // Allow queued microtask jobs to flush
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));

        expect(log).toEqual([0, 1, 2, 3]);
        expect(count.value).toBe(3);
    });

    it('ensures no glitched intermediate states during diamond evaluation', () => {
        // Glitch test: Ensure intermediate values are never read
        const base = signal(1);
        const timesTwo = new Computed(() => base.value * 2);
        const timesTen = new Computed(() => base.value * 10);

        const observedStates: number[] = [];
        const combined = new Computed(() => {
            const val = timesTwo.value + timesTen.value;
            observedStates.push(val);
            return val;
        });

        expect(combined.value).toBe(12); // (1*2) + (1*10) = 12
        expect(observedStates).toEqual([12]);

        base.set(2);
        expect(combined.value).toBe(24); // (2*2) + (2*10) = 24
        // Should evaluate cleanly with new value 24, never an intermediate state like 2+10=12 or 4+10=14
        expect(observedStates).toEqual([12, 24]);
    });

    it('handles array and object signal state updates', () => {
        const list = signal<number[]>([1, 2, 3]);
        const sum = new Computed(() => list.value.reduce((acc, curr) => acc + curr, 0));

        expect(sum.value).toBe(6);

        // Replace array reference
        list.set([...list.value, 4]);
        expect(sum.value).toBe(10);
    });
});
