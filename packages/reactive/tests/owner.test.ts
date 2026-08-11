import { describe, it, expect } from 'vitest';
import { signal, computed, effect, Effect, scope, Owner } from '../src/index.js';

describe('Owner & Scope Lifecycle Tests', () => {
    it('creates an Owner instance via scope()', () => {
        const owner = scope(() => {});
        expect(owner).toBeInstanceOf(Owner);
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

        owner.dispose();
        expect(count.observers.has(eff!)).toBe(false);
        expect(owner.resources.size).toBe(0);
    });
});
