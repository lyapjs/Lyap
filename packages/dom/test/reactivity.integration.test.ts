/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { batch, computed, effect, signal } from '@lyapjs/reactive';

async function flushReactiveJobs() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('DOM reactivity integration', () => {
  it('updates a real DOM text node from reactive state', async () => {
    const element = document.createElement('span');
    const count = signal(0);
    const render = effect(() => {
      element.textContent = String(count.value);
    });

    render.runEffect();
    expect(element.textContent).toBe('0');

    count.set(1);
    await flushReactiveJobs();

    expect(element.textContent).toBe('1');
  });

  it('renders the final batched value once', () => {
    const element = document.createElement('span');
    const count = signal(0);
    let renders = 0;
    const render = effect(() => {
      renders++;
      element.textContent = String(count.value);
    });

    render.runEffect();
    batch(() => {
      count.set(1);
      count.set(2);
      count.set(3);
    });

    expect(element.textContent).toBe('3');
    expect(renders).toBe(2);
  });

  it('updates DOM from computed state without stale final output', async () => {
    const element = document.createElement('span');
    const count = signal(2);
    const doubled = computed(() => count.value * 2);
    const render = effect(() => {
      element.textContent = String(doubled.value);
    });

    render.runEffect();
    count.set(4);
    await flushReactiveJobs();

    expect(element.textContent).toBe('8');
  });

  it('stops mutating the DOM after the render effect is disposed', async () => {
    const element = document.createElement('span');
    const count = signal(0);
    const render = effect(() => {
      element.textContent = String(count.value);
    });

    render.runEffect();
    render.dispose();
    count.set(1);
    await flushReactiveJobs();

    expect(element.textContent).toBe('0');
  });
});
