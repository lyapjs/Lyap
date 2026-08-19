import { describe, it, expect } from 'vitest';
import { store, isStore, toRaw, effect } from '../src/index.js';

describe('Reactive Store Tests', () => {
  it('tracks fine-grained property reads and updates', async () => {
    const user = store({ name: 'Alice', age: 25 });
    let nameRuns = 0;
    let lastSeenName = '';

    const e = effect(() => {
      nameRuns++;
      lastSeenName = user.name;
    });
    e.runEffect();

    expect(nameRuns).toBe(1);
    expect(lastSeenName).toBe('Alice');

    // Updating age should NOT trigger name effect
    user.age = 26;
    await Promise.resolve();
    expect(nameRuns).toBe(1);

    // Updating name MUST trigger name effect
    user.name = 'Bob';
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(nameRuns).toBe(2);
    expect(lastSeenName).toBe('Bob');
  });

  it('supports deep reactive objects', async () => {
    const state = store({
      settings: {
        theme: 'light'
      }
    });

    let themeRuns = 0;
    let currentTheme = '';

    const e = effect(() => {
      themeRuns++;
      currentTheme = state.settings.theme;
    });
    e.runEffect();

    expect(themeRuns).toBe(1);
    expect(currentTheme).toBe('light');

    state.settings.theme = 'dark';
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(themeRuns).toBe(2);
    expect(currentTheme).toBe('dark');
  });

  it('supports array mutations (push, splice)', async () => {
    const list = store([1, 2, 3]);
    let lenRuns = 0;

    const e = effect(() => {
      lenRuns++;
      const _ = list.length;
    });
    e.runEffect();

    expect(lenRuns).toBe(1);

    list.push(4);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(lenRuns).toBe(2);
    expect(list.length).toBe(4);
    expect(list[3]).toBe(4);
  });

  it('provides isStore and toRaw helpers', () => {
    const rawObj = { a: 1 };
    const sObj = store(rawObj);

    expect(isStore(sObj)).toBe(true);
    expect(isStore(rawObj)).toBe(false);
    expect(toRaw(sObj)).toBe(rawObj);
  });

  it('re-runs effects tracking Object.keys when keys are added/removed', async () => {
    const state = store<{ [key: string]: number | undefined }>({ a: 1 });
    let runs = 0;

    const e = effect(() => {
      runs++;
      const _ = Object.keys(state).length;
    });
    e.runEffect();
    expect(runs).toBe(1);

    state.b = 2;
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(runs).toBe(2);

    delete state.a;
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(runs).toBe(3);
  });

  it('tracks adding an undefined property through has and Object.keys', async () => {
    const state = store<{ value?: undefined }>({});
    let present = false;
    let keyCount = 0;

    const e = effect(() => {
      present = 'value' in state;
      keyCount = Object.keys(state).length;
    });
    e.runEffect();

    state.value = undefined;
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(present).toBe(true);
    expect(keyCount).toBe(1);
  });

  it('updates indexed dependencies when an array is truncated', async () => {
    const list = store([1, 2, 3]);
    let value: number | undefined = list[2];

    const e = effect(() => {
      value = list[2];
    });
    e.runEffect();

    list.length = 1;
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(value).toBeUndefined();
  });

  it('tracks symbol properties and array key deletion', async () => {
    const key = Symbol('key');
    const state = store({ [key]: 1 });
    const list = store([1, 2]);
    let symbolValue = 0;
    let keys: string[] = [];

    const e = effect(() => {
      symbolValue = state[key];
      keys = Object.keys(list);
    });
    e.runEffect();

    state[key] = 2;
    delete list[1];
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(symbolValue).toBe(2);
    expect(keys).toEqual(['0']);
  });

  it('does not proxy native collections into incompatible receivers', () => {
    const map = new Map([['name', 'Lyap']]);
    const state = store({ map });

    expect(state.map).toBe(map);
    expect(state.map.get('name')).toBe('Lyap');
  });
});
