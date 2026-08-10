import { describe, it, expect, vi } from 'vitest';
import { Signal, signal } from '../src/signal.js';

describe('Signal Tests', () => {
    // A. Instantiation & Initial Value
    it('Create a single instance via signal() factory function', () => {
        const count = signal(10);
        expect(count).toBeInstanceOf(Signal);
        expect(count.value).toBe(10);
    });

    it('Handle different data types (strings, booleans, objects)', () => {
        const text = signal('hello');
        const bool = signal(true);
        const user = signal({ name: 'Bald', age: 20 });

        expect(text.value).toBe('hello');
        expect(bool.value).toBe(true);
        expect(user.value).toEqual({ name: 'Bald', age: 20 });
    });

    // B. Updating Value via Setter
    it('should update value via the value setter', () => {
        const count = signal(0);
        count.set(5);
        expect(count.value).toBe(5);
    });
})