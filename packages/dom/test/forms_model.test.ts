/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { Lyap } from '../src/index.js';

async function tick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Form Controls & ly-model', () => {
  it('handles checkbox group binding to array', async () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);

    const cb1 = document.createElement('input');
    cb1.type = 'checkbox';
    cb1.value = 'apple';
    cb1.setAttribute('ly-model', 'formApp.fruits');

    const cb2 = document.createElement('input');
    cb2.type = 'checkbox';
    cb2.value = 'banana';
    cb2.setAttribute('ly-model', 'formApp.fruits');

    root.appendChild(cb1);
    root.appendChild(cb2);
    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const app = Lyap.scope('formApp');
    app.state({ fruits: ['apple'] });

    const runtime = Lyap.mount(root);
    await runtime.ready;

    expect(cb1.checked).toBe(true);
    expect(cb2.checked).toBe(false);

    // User checks cb2
    cb2.checked = true;
    cb2.dispatchEvent(new Event('change'));
    await tick();

    expect(app.fruits).toEqual(['apple', 'banana']);

    // User unchecks cb1
    cb1.checked = false;
    cb1.dispatchEvent(new Event('change'));
    await tick();

    expect(app.fruits).toEqual(['banana']);

    void runtime.destroy();
  });

  it('handles select and multiple select controls', async () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);

    const select = document.createElement('select');
    select.setAttribute('ly-model', 'selectApp.color');
    const opt1 = document.createElement('option');
    opt1.value = 'red';
    opt1.text = 'Red';
    const opt2 = document.createElement('option');
    opt2.value = 'blue';
    opt2.text = 'Blue';
    select.appendChild(opt1);
    select.appendChild(opt2);

    root.appendChild(select);
    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const app = Lyap.scope('selectApp');
    app.state({ color: 'blue' });

    const runtime = Lyap.mount(root);
    await runtime.ready;

    expect(select.value).toBe('blue');

    select.value = 'red';
    select.dispatchEvent(new Event('change'));
    await tick();

    expect(app.color).toBe('red');

    void runtime.destroy();
  });

  it('rejects file inputs for ly-model', () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.setAttribute('ly-model', 'fileApp.file');
    root.appendChild(fileInput);
    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    Lyap.scope('fileApp').state({ file: null });

    expect(() => Lyap.mount(root)).toThrow('File inputs cannot use ly-model');
  });
});
