import { describe, it, expect } from 'vitest';
import { Signal, signal } from '../src/index.js';

describe('Signal Tests', () => {
    it('creates a Signal instance via signal() factory function', () => {
        const count = signal(10);
        expect(count).toBeInstanceOf(Signal);
        expect(count.value).toBe(10);
    });

    it('handles primitive and reference data types', () => {
        const text = signal('hello');
        const bool = signal(true);
        const user = signal({ name: 'Bald', age: 20 });

        expect(text.value).toBe('hello');
        expect(bool.value).toBe(true);
        expect(user.value).toEqual({ name: 'Bald', age: 20 });
    });

    it('updates value and increments version via set()', () => {
        const count = signal(0);
        const initialVersion = count.version;

        count.set(5);
        expect(count.value).toBe(5);
        expect(count.version).toBe(initialVersion + 1);
    });

    it('does not update or increment version when set to identical value (Object.is)', () => {
        const count = signal(42);
        const initialVersion = count.version;

        count.set(42);
        expect(count.value).toBe(42);
        expect(count.version).toBe(initialVersion);
    });
});