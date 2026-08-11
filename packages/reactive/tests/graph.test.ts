import { describe, it, expect, vi } from 'vitest';
import { signal } from '../src/signal.js';
import { Computed } from '../src/computed.js';
import { Effect } from '../src/effect.js';

describe('Graph Topology Tests (Static, Dynamic, Diamond)', () => {
    describe('1. Static Graph Topology', () => {
        it('handles static multi-signal inputs', () => {
            const first = signal('John');
            const last = signal('Doe');
            const fullName = new Computed(() => `${first.value} ${last.value}`);

            expect(fullName.value).toBe('John Doe');

            first.set('Jane');
            expect(fullName.value).toBe('Jane Doe');

            last.set('Smith');
            expect(fullName.value).toBe('Jane Smith');
        });

        it('handles linear chain of computeds (A -> B -> C -> D)', () => {
            const count = signal(1);
            const double = new Computed(() => count.value * 2);
            const quad = new Computed(() => double.value * 2);
            const oct = new Computed(() => quad.value * 2);

            expect(oct.value).toBe(8);

            count.set(5);
            expect(oct.value).toBe(40);
        });
    });

    describe('2. Diamond Graph Topology', () => {
        it('evaluates diamond dependency correctly without stale intermediate evaluations', () => {
            //       A (signal)
            //      / \
            //     B   C (computed)
            //      \ /
            //       D (computed)
            const a = signal(2);
            const b = new Computed(() => a.value * 2);
            const c = new Computed(() => a.value * 3);

            const dEvalCount = vi.fn();
            const d = new Computed(() => {
                dEvalCount();
                return b.value + c.value;
            });

            expect(d.value).toBe(10); // (2*2) + (2*3) = 10
            expect(dEvalCount).toHaveBeenCalledTimes(1);

            a.set(4);
            expect(d.value).toBe(20); // (4*2) + (4*3) = 20
        });

        it('handles diamond dependency with effect at the bottom', async () => {
            const a = signal(1);
            const b = new Computed(() => a.value + 1);
            const c = new Computed(() => a.value + 2);

            let result = 0;
            const effectCalls = vi.fn();

            const e = new Effect(() => {
                effectCalls();
                result = b.value + c.value;
            });
            e.runEffect();

            expect(result).toBe(5); // (1+1) + (1+2) = 5
            expect(effectCalls).toHaveBeenCalledTimes(1);

            a.set(10);
            await Promise.resolve();
            await new Promise((r) => setTimeout(r, 0));

            expect(result).toBe(23); // (10+1) + (10+2) = 23
            expect(effectCalls).toHaveBeenCalledTimes(2);
        });
    });

    describe('3. Dynamic Graph Topology (Conditional Dependencies)', () => {
        it('dynamically switches tracking branch based on condition', () => {
            const cond = signal(true);
            const a = signal('Branch A');
            const b = signal('Branch B');

            const fn = vi.fn(() => (cond.value ? a.value : b.value));
            const result = new Computed(fn);

            // Initially condition is true -> tracks cond & a
            expect(result.value).toBe('Branch A');
            expect(a.observers.has(result)).toBe(true);
            expect(b.observers.has(result)).toBe(false);

            // Changing inactive branch B should NOT trigger re-eval
            b.set('Branch B Modified');
            expect(fn).toHaveBeenCalledTimes(1);
            expect(result.value).toBe('Branch A');

            // Switch condition to false -> tracks cond & b
            cond.set(false);
            expect(result.value).toBe('Branch B Modified');
            expect(a.observers.has(result)).toBe(false);
            expect(b.observers.has(result)).toBe(true);

            // Now changing A should NOT trigger re-eval
            a.set('Branch A Modified');
            expect(result.value).toBe('Branch B Modified');
        });

        it('cleans up obsolete dependencies when branching toggles back and forth', () => {
            const toggle = signal(true);
            const left = signal(10);
            const right = signal(20);

            const c = new Computed(() => (toggle.value ? left.value : right.value));

            expect(c.value).toBe(10);

            // Toggle to right
            toggle.set(false);
            expect(c.value).toBe(20);

            // Toggle back to left
            toggle.set(true);
            expect(c.value).toBe(10);

            // Mutate left
            left.set(99);
            expect(c.value).toBe(99);
        });
    });
});
