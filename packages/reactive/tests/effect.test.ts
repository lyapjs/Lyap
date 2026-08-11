import { describe, it, expect, vi } from 'vitest';
import { signal } from '../src/signal.js';
import { Effect, effect } from '../src/effect.js';
import { NodeKind } from '../src/core/flags.js';
import { Computed } from '../src/computed.js';

describe('Effect Tests', () => {
    it('creates an Effect instance with NodeKind.EFFECT', () => {
        const fn = vi.fn();
        const e = effect(fn);
        expect(e).toBeInstanceOf(Effect);
        expect(e.kind).toBe(NodeKind.EFFECT);
    });

    it('tracks signal dependencies when runEffect() is executed', () => {
        const count = signal(1);
        let dummy = 0;

        const e = new Effect(() => {
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

        const e = new Effect(() => {
            dummy = count.value;
        });
        e.runEffect();
        expect(dummy).toBe(10);

        // Update signal value, which triggers notify -> jobQueue -> queueFlush
        count.set(20);

        // Wait for queued microtask flush
        await Promise.resolve();
        await new Promise((res) => setTimeout(res, 0));

        expect(dummy).toBe(20);
    });

    it('tracks computed dependencies inside effects', async () => {
        const count = signal(2);
        const double = new Computed(() => count.value * 2);
        let result = 0;

        const e = new Effect(() => {
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
