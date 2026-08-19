/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { Lyap } from '../src/index.js';

describe('Mounting and Runtime Isolation', () => {
  it('mounts idempotently for the same DOM root', () => {
    const app = document.createElement('div');
    document.body.appendChild(app);

    const runtime1 = Lyap.mount(app);
    const runtime2 = Lyap.mount(app);

    expect(runtime1).toBe(runtime2);
    void runtime1.destroy();
  });

  it('rejects overlapping roots', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const runtimeParent = Lyap.mount(parent);
    expect(() => Lyap.mount(child)).toThrow('Overlapping roots are not supported');

    void runtimeParent.destroy();
  });

  it('queues pre-mount scopes and resolves runtime.ready', async () => {
    const container = document.createElement('div');
    container.id = 'app';
    const script = document.createElement('script');
    container.appendChild(script);
    document.body.appendChild(container);

    let initialized = false;
    let mounted = false;

    // Simulate script execution inside container
    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const scope = Lyap.scope('preApp');
    scope
      .state({ count: 1 })
      .init(() => {
        initialized = true;
      })
      .onMount(() => {
        mounted = true;
      });

    const runtime = Lyap.mount(container);
    await runtime.ready;

    expect(initialized).toBe(true);
    expect(mounted).toBe(true);

    void runtime.destroy();
  });

  it('disposes runtime and all scope resources idempotently', async () => {
    const container = document.createElement('div');
    const script = document.createElement('script');
    container.appendChild(script);
    document.body.appendChild(container);

    let destroyed = false;
    let cleanedUp = false;

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const scope = Lyap.scope('destroyApp');
    scope
      .onDestroy(() => {
        destroyed = true;
      })
      .cleanup(() => {
        cleanedUp = true;
      });

    const runtime = Lyap.mount(container);
    await runtime.ready;

    const promise1 = runtime.destroy();
    const promise2 = runtime.destroy();
    expect(promise1).toBe(promise2);

    await promise1;
    expect(destroyed).toBe(true);
    expect(cleanedUp).toBe(true);
  });
});
