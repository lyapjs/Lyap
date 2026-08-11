import { describe, it, expect, vi } from 'vitest';
import { signal } from '../src/signal.js';
import { Effect, effect } from '../src/effect.js';
import { scope } from '../src/owner.js';

describe('Effect Return Cleanup Tests', () => {
    it('executes returned cleanup function before effect re-runs', async () => {
        const count = signal(0);
        const executionLog: string[] = [];

        const e = effect(() => {
            const current = count.value;
            executionLog.push(`run:${current}`);

            return () => {
                executionLog.push(`cleanup:${current}`);
            };
        });

        e.runEffect();
        expect(executionLog).toEqual(['run:0']);

        // Update signal
        count.set(1);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));

        // Cleanup for run:0 should execute before run:1
        expect(executionLog).toEqual(['run:0', 'cleanup:0', 'run:1']);

        // Update signal again
        count.set(2);
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));

        expect(executionLog).toEqual(['run:0', 'cleanup:0', 'run:1', 'cleanup:1', 'run:2']);
    });

    it('executes returned cleanup function when effect is disposed', () => {
        const count = signal(10);
        const cleanupSpy = vi.fn();

        const e = effect(() => {
            count.value;
            return cleanupSpy;
        });

        e.runEffect();
        expect(cleanupSpy).not.toHaveBeenCalled();

        // Dispose effect
        e.dispose();
        expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('executes returned cleanup when parent Owner scope is disposed', () => {
        const count = signal(100);
        const cleanupSpy = vi.fn();

        const owner = scope(() => {
            effect(() => {
                count.value;
                return cleanupSpy;
            });
        });

        owner.run();

        // Manually run initial effect
        for (const res of owner.resources) {
            if (res instanceof Effect) res.runEffect();
        }

        expect(cleanupSpy).not.toHaveBeenCalled();

        // Dispose parent owner
        owner.dispose();
        expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('handles effects returning void or non-function gracefully', () => {
        const count = signal(5);
        const fn = vi.fn(() => {
            count.value;
            // Return nothing
        });

        const e = effect(fn);
        e.runEffect();

        expect(() => {
            count.set(10);
            e.dispose();
        }).not.toThrow();
    });
});
