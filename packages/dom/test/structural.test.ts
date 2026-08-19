/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { Lyap } from '../src/index.js';

async function tick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Structural Directives (ly-if, ly-if-else, ly-else, ly-for, ly-key)', () => {
  it('renders conditional chains ly-if, ly-if-else, ly-else', async () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);

    const b1 = document.createElement('p');
    b1.setAttribute('ly-if', "ifApp.status === 'ready'");
    b1.textContent = 'Ready';

    const b2 = document.createElement('p');
    b2.setAttribute('ly-if-else', "ifApp.status === 'loading'");
    b2.textContent = 'Loading...';

    const b3 = document.createElement('p');
    b3.setAttribute('ly-else', '');
    b3.textContent = 'Fallback';

    root.appendChild(b1);
    root.appendChild(b2);
    root.appendChild(b3);
    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const app = Lyap.scope('ifApp');
    app.state({ status: 'ready' });

    const runtime = Lyap.mount(root);
    await runtime.ready;

    expect(root.querySelector('p')?.textContent).toBe('Ready');

    app.status = 'loading';
    await tick();
    expect(root.querySelector('p')?.textContent).toBe('Loading...');

    app.status = 'error';
    await tick();
    expect(root.querySelector('p')?.textContent).toBe('Fallback');

    void runtime.destroy();
  });

  it('renders keyed loops ly-for and ly-key for arrays and reorders blocks', async () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);

    const template = document.createElement('template');
    template.setAttribute('ly-for', '(item, index) in forApp.items');
    template.setAttribute('ly-key', 'item.id');

    const li = document.createElement('li');
    li.setAttribute('ly-text', 'item.name');
    template.content.appendChild(li);

    root.appendChild(template);
    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const app = Lyap.scope('forApp');
    app.state({
      items: [
        { id: 'a', name: 'First' },
        { id: 'b', name: 'Second' }
      ]
    });

    const runtime = Lyap.mount(root);
    await runtime.ready;

    let lis = root.querySelectorAll('li');
    expect(lis.length).toBe(2);
    expect(lis[0]!.textContent).toBe('First');
    expect(lis[1]!.textContent).toBe('Second');

    // Reorder items
    app.items = [
      { id: 'b', name: 'Second' },
      { id: 'a', name: 'First' }
    ];
    await tick();

    lis = root.querySelectorAll('li');
    expect(lis[0]!.textContent).toBe('Second');
    expect(lis[1]!.textContent).toBe('First');

    void runtime.destroy();
  });

  it('throws error when ly-key is missing on ly-for', async () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);

    const li = document.createElement('li');
    li.setAttribute('ly-for', 'item in noKeyApp.items');
    root.appendChild(li);
    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    Lyap.scope('noKeyApp').state({ items: [1, 2] });

    expect(() => Lyap.mount(root)).toThrow('ly-for requires ly-key on the same element');
  });

  it('throws error on duplicate loop keys', async () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);

    const li = document.createElement('li');
    li.setAttribute('ly-for', 'item in dupKeyApp.items');
    li.setAttribute('ly-key', 'item.id');
    root.appendChild(li);
    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    Lyap.scope('dupKeyApp').state({
      items: [
        { id: 1, name: 'A' },
        { id: 1, name: 'B' }
      ]
    });

    expect(() => Lyap.mount(root)).toThrow('Duplicate loop key: 1');
  });
});
