/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { Lyap } from '../src/index.js';

async function tick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Dynamic DOM & MutationObserver', () => {
  it('scans dynamically added elements connected to root', async () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);
    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const app = Lyap.scope('dynApp');
    app.state({ text: 'Dynamic Text' });

    const runtime = Lyap.mount(root);
    await runtime.ready;

    // Dynamically insert an element with directive
    const dynElement = document.createElement('span');
    dynElement.setAttribute('ly-text', 'dynApp.text');
    root.appendChild(dynElement);

    await tick();

    expect(dynElement.textContent).toBe('Dynamic Text');

    // Update state reactively on dynamic element
    app.text = 'Updated Dynamic Text';
    await tick();

    expect(dynElement.textContent).toBe('Updated Dynamic Text');

    void runtime.destroy();
  });
});
