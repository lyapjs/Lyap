import { describe, it, expect, vi } from 'vitest';
import { signal } from '../src/signal.js';
import { computed } from '../src/computed.js';
import { effect, Effect } from '../src/effect.js';
import { scope, Owner, currentOwner } from '../src/owner.js';
import { hasFlag, NodeFlags } from '../src/core/flags.js';

describe('Owner & Scope Lifecycle Tests', () => {
    it('creates an Owner instance via scope()', () => {
        const owner = scope(() => {});
        expect(owner).toBeInstanceOf(Owner);
    });

    it('sets currentOwner while scope is running', () => {
        let insideOwner: Owner | null = null;
        const owner = scope(() => {
            insideOwner = currentOwner;
        });

        expect(currentOwner).toBeNull();
        owner.run();
        expect(insideOwner).toBe(owner);
        expect(currentOwner).toBeNull();
    });

    it('automatically registers effects created inside owner.run()', () => {
        const count = signal(0);
        let eff: Effect | null = null;

        const owner = scope(() => {
            eff = effect(() => {
                count.value;
            });
        });
        owner.run();

        expect(owner.resources.size).toBe(1);
        expect(owner.resources.has(eff)).toBe(true);
    });

    it('automatically registers computed nodes created inside owner.run()', () => {
        const count = signal(5);
        let comp: any = null;

        const owner = scope(() => {
            comp = computed(() => count.value * 2);
        });
        owner.run();

        expect(owner.resources.size).toBe(1);
        expect(owner.resources.has(comp)).toBe(true);
    });

    it('disposes all registered resources when owner.dispose() is called', () => {
        const count = signal(10);
        let eff: Effect | null = null;

        const owner = scope(() => {
            eff = effect(() => {
                count.value;
            });
        });
        owner.run();

        eff!.runEffect();
        expect(count.observers.has(eff!)).toBe(true);

        // Dispose the scope
        owner.dispose();

        // Effect should be cleaned up and marked DISPOSED
        expect(count.observers.has(eff!)).toBe(false);
        expect(hasFlag(eff!, NodeFlags.DISPOSED)).toBe(true);
        expect(owner.resources.size).toBe(0);
    });

    it('handles nested owner scopes and restores parent owner context', () => {
        const parentLog: (Owner | null)[] = [];
        const childLog: (Owner | null)[] = [];

        const parentOwner = scope(() => {
            parentLog.push(currentOwner);

            const childOwner = scope(() => {
                childLog.push(currentOwner);
            });
            childOwner.run();

            parentLog.push(currentOwner);
        });

        parentOwner.run();

        expect(parentLog[0]).toBe(parentOwner);
        expect(childLog[0]).not.toBeNull();
        expect(childLog[0]).not.toBe(parentOwner);
        expect(parentLog[1]).toBe(parentOwner);
        expect(currentOwner).toBeNull();
    });
});
