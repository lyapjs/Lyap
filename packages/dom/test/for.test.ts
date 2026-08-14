// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { walkTree, getScope } from '../src/index.js';

describe('ly-for Loop Directive Unit Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders array items with ly-for="item in items"', () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({ items: ['Apple', 'Banana', 'Cherry'] });
        </script>
        <template ly-for="item in items">
          <div class="item-row" ly-text="item"></div>
        </template>
      </div>
    `;

    walkTree(document.body);

    const rows = document.querySelectorAll('.item-row');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toBe('Apple');
    expect(rows[1].textContent).toBe('Banana');
    expect(rows[2].textContent).toBe('Cherry');
  });

  it('supports index binding with ly-for="(item, index) in items"', () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({ list: ['A', 'B'] });
        </script>
        <template ly-for="(item, idx) in list">
          <div class="idx-row" ly-text="idx + ': ' + item"></div>
        </template>
      </div>
    `;

    walkTree(document.body);

    const rows = document.querySelectorAll('.idx-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toBe('0: A');
    expect(rows[1].textContent).toBe('1: B');
  });

  it('dynamically updates DOM nodes when array state changes', async () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({ colors: ['Red', 'Green'] });
        </script>
        <template ly-for="color in colors">
          <span class="color-tag" ly-text="color"></span>
        </template>
      </div>
    `;

    walkTree(document.body);
    const app = document.getElementById('app')!;
    const scope = getScope(app)!;

    expect(document.querySelectorAll('.color-tag').length).toBe(2);

    // Update state to 3 items
    scope.state.colors = ['Red', 'Green', 'Blue'];
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.color-tag').length).toBe(3);

    // Clear array
    scope.state.colors = [];
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.color-tag').length).toBe(0);
  });

  it('handles multi-node template contents without orphan DOM nodes', async () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({ users: ['Alice', 'Bob'] });
        </script>
        <template ly-for="user in users">
          <h4 class="user-title" ly-text="user"></h4>
          <p class="user-desc">User Card</p>
        </template>
      </div>
    `;

    walkTree(document.body);
    expect(document.querySelectorAll('.user-title').length).toBe(2);
    expect(document.querySelectorAll('.user-desc').length).toBe(2);

    const app = document.getElementById('app')!;
    const scope = getScope(app)!;

    // Shrink array to 1 item
    scope.state.users = ['Charlie'];
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelectorAll('.user-title').length).toBe(1);
    expect(document.querySelectorAll('.user-desc').length).toBe(1);
    expect(document.querySelector('.user-title')?.textContent).toBe('Charlie');
  });

  it('supports number ranges like ly-for="n in 3"', () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({ count: 3 });
        </script>
        <template ly-for="num in count">
          <div class="num-row" ly-text="num"></div>
        </template>
      </div>
    `;

    walkTree(document.body);
    const rows = document.querySelectorAll('.num-row');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toBe('1');
    expect(rows[1].textContent).toBe('2');
    expect(rows[2].textContent).toBe('3');
  });

  it('supports nested ly-for loops', () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({
            groups: [
              { name: 'G1', members: ['m1', 'm2'] },
              { name: 'G2', members: ['m3'] }
            ]
          });
        </script>
        <template ly-for="g in groups">
          <div class="group-card">
            <h3 class="g-name" ly-text="g.name"></h3>
            <template ly-for="m in g.members">
              <span class="member" ly-text="m"></span>
            </template>
          </div>
        </template>
      </div>
    `;

    walkTree(document.body);

    const groupCards = document.querySelectorAll('.group-card');
    expect(groupCards.length).toBe(2);

    const members = document.querySelectorAll('.member');
    expect(members.length).toBe(3);
    expect(members[0].textContent).toBe('m1');
    expect(members[1].textContent).toBe('m2');
    expect(members[2].textContent).toBe('m3');
  });

  it('supports interactive button actions inside loop items', async () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({
            tasks: [
              { id: 1, text: 'Task 1', done: false },
              { id: 2, text: 'Task 2', done: false }
            ]
          });
          function toggleTask(idx) {
            tasks[idx].done = !tasks[idx].done;
          }
        </script>
        <template ly-for="(t, i) in tasks">
          <div class="task-row">
            <span class="task-status" ly-text="t.done ? 'Done' : 'Pending'"></span>
            <button class="btn-toggle" ly-on:click="toggleTask(i)">Toggle</button>
          </div>
        </template>
      </div>
    `;

    walkTree(document.body);

    const statuses = document.querySelectorAll('.task-status');
    const buttons = document.querySelectorAll('.btn-toggle');

    expect(statuses[0].textContent).toBe('Pending');

    buttons[0].dispatchEvent(new Event('click'));
    await new Promise((r) => setTimeout(r, 0));

    expect(statuses[0].textContent).toBe('Done');
    expect(statuses[1].textContent).toBe('Pending');
  });

  it('re-renders on in-place array mutation (push/pop/sort/reverse)', async () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({ colors: ['Red', 'Green'] });
        </script>
        <template ly-for="color in colors">
          <span class="color-tag" ly-text="color"></span>
        </template>
      </div>
    `;

    walkTree(document.body);
    const scope = getScope(document.getElementById('app')!)!;

    expect(document.querySelectorAll('.color-tag').length).toBe(2);

    scope.state.colors.push('Blue');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.color-tag').length).toBe(3);
    expect(document.querySelectorAll('.color-tag')[2].textContent).toBe('Blue');

    scope.state.colors.pop();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.color-tag').length).toBe(2);

    scope.state.colors.reverse();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.color-tag')[0].textContent).toBe('Green');
    expect(document.querySelectorAll('.color-tag')[1].textContent).toBe('Red');
  });

  it('child scopes react to parent primitive updates', async () => {
    document.body.innerHTML = `
      <div id="app">
        <script type="lyap">
          state({ label: 'Hello', items: ['A', 'B'] });
        </script>
        <template ly-for="item in items">
          <div class="row">
            <span class="lbl" ly-text="label"></span>
            <span class="it" ly-text="item"></span>
          </div>
        </template>
      </div>
    `;

    walkTree(document.body);
    const scope = getScope(document.getElementById('app')!)!;

    expect(document.querySelectorAll('.lbl').length).toBe(2);
    expect(document.querySelectorAll('.lbl')[0].textContent).toBe('Hello');

    scope.state.label = 'World';
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelectorAll('.lbl')[0].textContent).toBe('World');
    expect(document.querySelectorAll('.lbl')[1].textContent).toBe('World');
  });
});
