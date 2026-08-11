import { describe, it, expect, vi } from 'vitest';
import { signal, computed, effect } from '../src/index.js';

describe('Graph Topology Tests (Static, Dynamic, Diamond)', () => {
    describe('1. Static Graph Topology', () => {
        it('handles static multi-signal inputs', () => {
            const first = signal('John');
            const last = signal('Doe');
            const fullName = computed(() => `${first.value} ${last.value}`);

            expect(fullName.value).toBe('John Doe');

            first.set('Jane');
            expect(fullName.value).toBe('Jane Doe');

            last.set('Smith');
            expect(fullName.value).toBe('Jane Smith');
        });

        it('handles linear chain of computeds (A -> B -> C -> D)', () => {
            const count = signal(1);
            const double = computed(() => count.value * 2);
            const quad = computed(() => double.value * 2);
            const oct = computed(() => quad.value * 2);

            expect(oct.value).toBe(8);

            count.set(5);
            expect(oct.value).toBe(40);
        });
    });

    describe('2. Diamond Graph Topology', () => {
        it('evaluates diamond dependency correctly without stale intermediate evaluations', () => {
            const a = signal(2);
            const b = computed(() => a.value * 2);
            const c = computed(() => a.value * 3);

            const dEvalCount = vi.fn();
            const d = computed(() => {
                dEvalCount();
                return b.value + c.value;
            });

            expect(d.value).toBe(10);
            expect(dEvalCount).toHaveBeenCalledTimes(1);

            a.set(4);
            expect(d.value).toBe(20);
        });

        it('handles diamond dependency with effect at the bottom', async () => {
            const a = signal(1);
            const b = computed(() => a.value + 1);
            const c = computed(() => a.value + 2);

            let result = 0;
            const effectCalls = vi.fn();

            const e = effect(() => {
                effectCalls();
                result = b.value + c.value;
            });
            e.runEffect();

            expect(result).toBe(5);
            expect(effectCalls).toHaveBeenCalledTimes(1);

            a.set(10);
            await Promise.resolve();
            await new Promise((r) => setTimeout(r, 0));

            expect(result).toBe(23);
            expect(effectCalls).toHaveBeenCalledTimes(2);
        });
    });

    describe('3. Dynamic Graph Topology (Conditional Dependencies)', () => {
        it('dynamically switches tracking branch based on condition', () => {
            const cond = signal(true);
            const a = signal('Branch A');
            const b = signal('Branch B');

            const fn = vi.fn(() => (cond.value ? a.value : b.value));
            const result = computed(fn);

            expect(result.value).toBe('Branch A');
            expect(a.observers.has(result)).toBe(true);
            expect(b.observers.has(result)).toBe(false);

            b.set('Branch B Modified');
            expect(fn).toHaveBeenCalledTimes(1);
            expect(result.value).toBe('Branch A');

            cond.set(false);
            expect(result.value).toBe('Branch B Modified');
            expect(a.observers.has(result)).toBe(false);
            expect(b.observers.has(result)).toBe(true);

            a.set('Branch A Modified');
            expect(result.value).toBe('Branch B Modified');
        });

        it('cleans up obsolete dependencies when branching toggles back and forth', () => {
            const toggle = signal(true);
            const left = signal(10);
            const right = signal(20);

            const c = computed(() => (toggle.value ? left.value : right.value));

            expect(c.value).toBe(10);

            toggle.set(false);
            expect(c.value).toBe(20);

            toggle.set(true);
            expect(c.value).toBe(10);

            left.set(99);
            expect(c.value).toBe(99);
        });
    });
});
