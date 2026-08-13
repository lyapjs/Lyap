// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { Lyap, walkTree } from '../src/index.js';

describe('Prototype 2 Directives & Script Integration Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('parses <script type="lyap"> state and text binding', () => {
    document.body.innerHTML = `
      <div>
        <script type="lyap">
          state({ count: 10 });
        </script>
        <span id="counter" ly-text="count"></span>
      </div>
    `;

    walkTree(document.body);
    const counter = document.getElementById('counter')!;
    expect(counter.textContent).toBe('10');
  });

  it('evaluates derived({}) computed state', () => {
    document.body.innerHTML = `
      <div>
        <script type="lyap">
          state({ firstName: 'Alice', lastName: 'Smith' });
          derived({
            fullName() {
              return firstName + ' ' + lastName;
            }
          });
        </script>
        <span id="name" ly-text="fullName"></span>
      </div>
    `;

    walkTree(document.body);
    const nameSpan = document.getElementById('name')!;
    expect(nameSpan.textContent).toBe('Alice Smith');
  });

  it('supports reusable named actions and inline :expr actions', async () => {
    document.body.innerHTML = `
      <div>
        <script type="lyap">
          state({ count: 0 });
          function increment() {
            count++;
          }
        </script>
        <span id="count" ly-text="count"></span>
        <button id="btn-named" ly-on:click="increment">+</button>
        <button id="btn-inline" ly-on:click=":count--">-</button>
      </div>
    `;

    walkTree(document.body);
    const countSpan = document.getElementById('count')!;
    const btnNamed = document.getElementById('btn-named')!;
    const btnInline = document.getElementById('btn-inline')!;

    expect(countSpan.textContent).toBe('0');

    btnNamed.dispatchEvent(new Event('click'));
    await new Promise((res) => setTimeout(res, 0));
    expect(countSpan.textContent).toBe('1');

    btnInline.dispatchEvent(new Event('click'));
    await new Promise((res) => setTimeout(res, 0));
    expect(countSpan.textContent).toBe('0');
  });

  it('handles ly-class=":condition class1 class2" preserving static classes', () => {
    document.body.innerHTML = `
      <div>
        <script type="lyap">
          state({ isActive: true, isDisabled: false });
        </script>
        <button id="btn" class="btn btn-base" ly-class=":isActive active highlight :isDisabled disabled"></button>
      </div>
    `;

    walkTree(document.body);
    const btn = document.getElementById('btn')!;
    expect(btn.getAttribute('class')).toBe('btn btn-base active highlight');
  });

  it('handles ly-show display visibility toggling', () => {
    document.body.innerHTML = `
      <div>
        <script type="lyap">
          state({ open: true });
        </script>
        <div id="box" ly-show="open">Box Content</div>
      </div>
    `;

    walkTree(document.body);
    const box = document.getElementById('box') as HTMLElement;
    expect(box.style.display).not.toBe('none');
  });

  it('handles ly-if / ly-else conditional templates', () => {
    document.body.innerHTML = `
      <div>
        <script type="lyap">
          state({ loggedIn: false });
        </script>
        <template ly-if="loggedIn">
          <div id="dashboard">Dashboard</div>
        </template>
        <template ly-else>
          <div id="login">Login Form</div>
        </template>
      </div>
    `;

    walkTree(document.body);
    expect(document.getElementById('dashboard')).toBeNull();
    expect(document.getElementById('login')).not.toBeNull();
  });

  it('supports $refs magic variable', async () => {
    document.body.innerHTML = `
      <div>
        <script type="lyap">
          state({ message: '' });
        </script>
        <input ly-ref="myInput" value="Ref Value" />
        <button id="btn" ly-on:click=":message = $refs.myInput.value"></button>
        <span id="output" ly-text="message"></span>
      </div>
    `;

    walkTree(document.body);
    const btn = document.getElementById('btn')!;
    const output = document.getElementById('output')!;

    btn.dispatchEvent(new Event('click'));
    await new Promise((res) => setTimeout(res, 0));
    expect(output.textContent).toBe('Ref Value');
  });

  it('supports ly-bind two-way input binding with .trim modifier', async () => {
    document.body.innerHTML = `
      <div>
        <script type="lyap">
          state({ username: 'Initial' });
        </script>
        <input id="input" ly-bind.trim="username" />
        <span id="val" ly-text="username"></span>
      </div>
    `;

    walkTree(document.body);
    const input = document.getElementById('input') as HTMLInputElement;
    const valSpan = document.getElementById('val')!;

    expect(input.value).toBe('Initial');

    input.value = '  NewUser  ';
    input.dispatchEvent(new Event('input'));
    await new Promise((res) => setTimeout(res, 0));

    expect(valSpan.textContent).toBe('NewUser');
  });
});
