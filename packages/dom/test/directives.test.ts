/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { Lyap } from '../src/index.js';

async function tick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Core Directives (ly-text, ly-show, ly-bind, ly-model, ly-on, ly-ref)', () => {
  it('handles ly-text and ly-show reactively', async () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);

    const p = document.createElement('p');
    p.setAttribute('ly-text', 'app.msg');
    root.appendChild(p);

    const box = document.createElement('div');
    box.setAttribute('ly-show', 'app.visible');
    root.appendChild(box);

    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const app = Lyap.scope('app');
    app.state({ msg: 'Hello', visible: true });

    const runtime = Lyap.mount(root);
    await runtime.ready;

    expect(p.textContent).toBe('Hello');
    expect(box.hidden).toBe(false);

    app.msg = 'Updated';
    app.visible = false;
    await tick();

    expect(p.textContent).toBe('Updated');
    expect(box.hidden).toBe(true);

    void runtime.destroy();
  });

  it('handles ly-bind with property mapping and rejects forbidden properties', async () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);

    const btn = document.createElement('button');
    btn.setAttribute('ly-bind:disabled', 'bindApp.isDisabled');
    btn.setAttribute('ly-bind:class', 'bindApp.className');
    root.appendChild(btn);

    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const app = Lyap.scope('bindApp');
    app.state({ isDisabled: true, className: 'active-btn' });

    const runtime = Lyap.mount(root);
    await runtime.ready;

    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('class')).toBe('active-btn');

    app.isDisabled = false;
    await tick();

    expect(btn.disabled).toBe(false);

    void runtime.destroy();
  });

  it('handles ly-model with text input, modifiers, and IME composition', async () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);

    const input = document.createElement('input');
    input.setAttribute('ly-model.trim.number', 'modelApp.age');
    root.appendChild(input);

    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const app = Lyap.scope('modelApp');
    app.state({ age: 25 });

    const runtime = Lyap.mount(root);
    await runtime.ready;

    expect(input.value).toBe('25');

    input.value = ' 30 ';
    input.dispatchEvent(new Event('input'));
    await tick();

    expect(app.age).toBe(30);

    // Test IME composition deferral
    input.dispatchEvent(new Event('compositionstart'));
    input.value = ' 40 ';
    input.dispatchEvent(new Event('input'));
    expect(app.age).toBe(30); // Not written during IME

    input.dispatchEvent(new Event('compositionend'));
    await tick();
    expect(app.age).toBe(40);

    void runtime.destroy();
  });

  it('handles ly-on with inline expressions, event modifiers, and magic context', async () => {
    const root = document.createElement('div');
    const script = document.createElement('script');
    root.appendChild(script);

    const btn = document.createElement('button');
    btn.setAttribute('ly-on:click.prevent', ':onApp.count++');
    root.appendChild(btn);

    const refInput = document.createElement('input');
    refInput.setAttribute('ly-ref:myInput', '');
    root.appendChild(refInput);

    const actionBtn = document.createElement('button');
    actionBtn.setAttribute('ly-on:click', 'onApp.focusInput()');
    root.appendChild(actionBtn);

    document.body.appendChild(root);

    Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
    const app = Lyap.scope('onApp');
    app.state({ count: 0, focused: false }).actions({
      focusInput(this: any) {
        expect(this.$refs?.myinput).toBe(refInput);
        this.focused = true;
      }
    });

    const runtime = Lyap.mount(root);
    await runtime.ready;

    const event = new MouseEvent('click', { cancelable: true });
    btn.dispatchEvent(event);
    await tick();

    expect(event.defaultPrevented).toBe(true);
    expect(app.count).toBe(1);

    const actionEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    actionBtn.dispatchEvent(actionEvent);
    expect(app.focused).toBe(true);

    void runtime.destroy();
  });
});
