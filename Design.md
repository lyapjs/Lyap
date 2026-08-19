# Lyap DOM design specification

> Status: Prototype 3

> Purpose: Design and implementation reference for the Lyap DOM package.

> IMPORTANT:
> This document records architectural decisions already made.
> Do not introduce framework behavior, syntax, or architecture that contradicts
> these decisions without explicitly proposing it first.

---

# 1. Lyap Overview

Lyap is a lightweight, no-build-step JavaScript reactive DOM enhancement library.

The general philosophy is:

1. Structural over convenience.
2. Concise and explicit syntax.
3. Non-invasive DOM ownership.
4. CSP-safe operation.
5. Lightweight runtime.
6. Beginner-friendly API.
7. HTML-first development.
8. Reactive state is handled by a separate lyap reactivity core.

Lyap is inspired by ideas of Alpine.js, Petite-Vue, HTMX, and reactive libraries, but is not intended to be a clone of any of them.

# 2. Current Architecture

Lyap is divided conceptually into:

```text
@lyap/reactive
        ↓
@lyap/dom
        ↓
Lyap Public API
```

Currently, the reactive core is responsible for:

Signals, dependency tracking, derived values, effects, dependency graphs,
scheduling, scopes, cleanup, and disposal.

# 3. Current designs

### Mount

Lyap will initially be loaded through a CDN, preferably in the document
`head`. npm installation will be supported later. The library may also be
loaded elsewhere, as long as it is available before scope scripts execute.

After the document has been parsed, Lyap automatically mounts the document
root. If the library is loaded after `DOMContentLoaded`, it mounts immediately.

The public API is:

```js
const runtime = Lyap.mount();
```

`mount()` is idempotent for a root. Calling it repeatedly with the same root
does not create scopes, execute scripts, or register directives more than once;
it returns the existing runtime handle instead.

`Lyap.scope(name)` may be called by an inline scope script before automatic
mounting. Lyap creates a pending scope record using the executing script and its
nearest containing element. The next mount assigns that record to the runtime
whose root contains the element. Scope initialization does not begin until the
record is attached to a runtime.

The runtime exposes a readiness Promise:

```js
const runtime = Lyap.mount();

runtime.ready.then(() => {
    console.log('Lyap is initialized');
});
```

`mount()` itself remains synchronous. `runtime.ready` resolves after pending
scope registration, directive scanning, and `onMount` hooks have settled.

`Lyap.mount()` and `scope.onMount()` are different operations:

| API | Owner | Meaning |
| --- | --- | --- |
| `Lyap.mount(root?)` | Lyap runtime | Create or retrieve the runtime for a DOM root, scan it, and initialize its scopes. |
| `app.onMount(callback)` | One scope | Register a lifecycle callback that runs when that scope is attached and mounted. |

Calling `app.onMount(callback)` does not mount a DOM root and does not scan the
document. It only registers the callback for the runtime's mounting phase.

The `onMount` name distinguishes the scope lifecycle hook from the global
runtime mount operation. Prototype 3 uses the same event-oriented naming style
for `app.onDestroy` and `app.cleanup`.

An explicit root can be mounted for isolated applications and testing:

```js
const runtime = Lyap.mount(document.querySelector('#app'));
```

Each root has one runtime. Mounting a different root creates a separate runtime
and scope registry. The behavior for overlapping roots is not yet supported and
should produce an error.

### Dynamic DOM

Each mounted runtime observes DOM mutations with a `MutationObserver`.
Prototype 3 supports dynamic directive initialization and cleanup without
rescanning the entire document:

```text
Initial mount:
  scan the root once

Added nodes:
  scan only the added nodes

Removed nodes:
  dispose only the removed Lyap scopes and effects
```

Mutation processing is batched into one microtask. Nodes already owned by Lyap
are not initialized again.

Dynamic scope scripts are not supported in Prototype 3. Scripts inserted with
`innerHTML` do not execute as normal browser scripts, so dynamically creating a
scope requires the future component system or an explicit runtime API.

Mutation processing rules:

1. Added nodes are scanned only when they are connected to the mounted root.
2. Removed nodes are disposed only when they are still disconnected when the
   mutation batch is reconciled.
3. A node removed and reinserted before observer delivery keeps its ownership and
   is not initialized twice.
4. A node moved within the same runtime keeps its scope and directive resources.
5. Moving a node between runtimes is unsupported; the node is disposed and an
   error is reported.
6. Nested mutation records are deduplicated by processing the highest relevant
   added or removed ancestor once.
7. Mutations after `Runtime.destroy()` are ignored.

The observer callback performs reconciliation in a microtask and does not run
user actions synchronously from inside the observer callback.

Because inline scope scripts execute when the browser reaches them, a normal
blocking CDN script must be loaded before those scripts. `async` and `defer`
loading are not compatible with ordinary inline scope scripts unless a future
bootstrap or queue mechanism is added.

### Script

Application state and scope behavior are declared in a script associated with a
DOM scope. `Lyap.scope(name)` creates a publicly named scope handle. The handle
owns state, derived values, actions, and lifecycle hooks for that DOM scope.

The JavaScript variable name and the public HTML scope name are independent:

```js
const appHandle = Lyap.scope('app');
```

JavaScript uses `appHandle`, while HTML uses `app.count`. They should normally
use the same name because that is easier for beginners to understand:

```js
const app = Lyap.scope('app');
```


```html
<div>
    <script>
        const app = Lyap.scope('app');

        app.state({
            count: 0,
            firstName: 'Alex',
            lastName: 'Smith'
        });

        app.derived({
            doubleCount: () => app.count * 2,
            fullName: () => `${app.firstName} ${app.lastName}`,
        });

        app.actions({
            increment() {
                app.count++;
            }
        });

        app.init(() => {
            // Runs before directives are initialized.
            console.log('Scope initialized');
        });

        app.onMount(() => {
            // Executed when element & scope are attached to the DOM
            console.log('Mounted container');

            const timer = setInterval(() => app.count++, 1000);

            // Register resources created during mount for scope cleanup.
            app.cleanup(() => {
                clearInterval(timer);
            });
        });

        app.onDestroy(() => {
            // Top-level script hook executed when the container scope is destroyed
            console.log('Container script scope destroyed');
        });
    </script>

    <p>Count: <span ly-text="app.count"></span> (Double: <span ly-text="app.doubleCount"></span>)</p>
    <p>User: <span ly-text="app.fullName"></span></p>
    <button ly-on:click=":app.count++"> + </button>
</div>
```

JavaScript and directives both use the explicit scope handle (`app.count`).
This avoids ambiguous scope lookup, makes nested state ownership visible in
HTML, and keeps the API CSP-safe.

Multiple independent scopes use separate handles:

```html
<section>
    <script>
        const panel = Lyap.scope('panel');

        panel.state({
            open: false
        });

    </script>

    <button ly-on:click=":panel.open = !panel.open">
        <span ly-text="panel.open ? 'Close' : 'Open'"></span>
    </button>
</section>
```

### State

`Lyap.scope(name)` creates the DOM-owned scope handle. Calling `state()` registers
reactive state on that scope and exposes the state through the scope handle.
State is backed by the reactive core's store primitive, so nested objects and
arrays are reactive as well.

```js
const app = Lyap.scope('app');

app.state({
    user: {
        name: 'Alex'
    },
    items: []
});

app.user.name = 'Taylor';
app.items.push('First item');
```

State ownership follows the DOM tree, while access uses the public scope name:

1. State belongs to the scope where it is declared.
2. A scope name is used explicitly in directives and expressions.
3. Descendant scopes may access an ancestor's named state.
4. Parent scopes cannot access state declared by descendants unless that state is
   explicitly exposed through another API.
5. Scope names must be unique within the mounted Lyap application.
6. JavaScript accesses state through its named scope handle.

Prototype 3 supports exactly one registration call for each scope namespace:

- One `state()` call.
- One `derived()` call.
- One `actions()` call.

Calling any of these methods more than once for the same scope is an error. The
three registration calls may appear in any order; Lyap finalizes the complete
scope namespace before directives initialize, so registration order does not
change behavior.

State must be a plain object. State, derived values, and actions share one
public member namespace. Any collision between them, a scope API, or a reserved
Lyap name is an error. Nested objects and arrays remain reactive through the
reactive core's store primitive.

For shared state, declare it on the nearest common ancestor and reference that
scope by name:

```html
<span ly-text="app.count"></span>
<button ly-on:click=":app.count++">+</button>
```

Named access replaces implicit parent and root traversal in Prototype 3. A
future design may add a separate API for intentionally exposing a scope to
another scope.

Derived values are read-only and are recalculated by the reactive core when
their dependencies change:

```js
app.derived({
    doubleCount: () => app.count * 2
});
```

Assigning to a derived value is an error. Derived values are available in HTML
through the same explicit scope name as state.

### Scope

Each DOM scope is attached to, or owned by, its nearest parent element. In the
example above, the state, derived values, and lifecycle hooks belong to the
containing `div` scope.

Child scopes can access named state from ancestor scopes. Parent scopes cannot
access state declared by their children. A scope handle is the JavaScript API
for one scope, and the same public name is used by HTML directives.

Lyap maintains a name-to-scope registry for each mounted application. Directive
expressions resolve a named scope only when that scope is visible from the
current DOM position. Names are unique within that application, so `app.count`
always identifies one predictable scope.

### Scope Association

`Lyap.scope(name)` associates the new scope with the currently executing script
and the nearest containing DOM element. The element must belong to the root
being mounted, even though automatic mounting occurs after document parsing.
Calling `Lyap.scope()` outside an associated script or without a valid scope
name is an error.

Scope visibility follows the DOM tree:

1. A scope can access its own state.
2. A child scope can access named state from its ancestors.
3. Sibling scopes cannot access each other's state.
4. A parent scope cannot access state declared by a child.
5. Scope names must be unique within one mounted application.

The local JavaScript variable and the public HTML name may differ:

```js
const appHandle = Lyap.scope('app');
```

```html
<span ly-text="app.count"></span>
```

Matching names are recommended for beginner-friendly code:

```js
const app = Lyap.scope('app');
```

### Lifecycle Order

For each scope, Lyap follows this order:

1. Create the scope handle.
2. Register state, derived values, and actions.
3. Run `init` hooks before directive initialization.
4. Scan and register directives.
5. Run `onMount` hooks when the scope is attached to the DOM.

The associated scope script runs during normal JavaScript registration. Use
`init` for scope setup that should complete before directives initialize. Use
`onMount` for work that needs the element, refs, rendered directives, or a
mounted runtime.

When a scope is destroyed, Lyap runs its `onDestroy` hooks, disposes reactive
resources, and then runs registered cleanup callbacks.

Lifecycle hooks accept either a regular function or an async function:

```js
app.init(loadUser);

app.onMount(() => {
    console.log('The scope is mounted');
});
```

Lifecycle callbacks may return a Promise. Hooks of the same type run in
registration order and are awaited sequentially:

```text
init hooks -> directive initialization -> onMount hooks
```

An `init` rejection is reported, then the next init hook and later phases run. An
`onMount` rejection is reported, then the next mount hook runs. `onDestroy` hooks
and cleanup callbacks follow the same continue-after-error rule. `runtime.ready`
resolves after all initialization work has settled; it does not reject because
lifecycle errors are reported through the runtime error channel.

`Runtime.destroy()` returns a Promise that resolves after destruction has
settled. Repeated calls return the same Promise and do not repeat cleanup.

### Directive syntax

The current directive syntax model is:

```text
ly-NAME
ly-NAME:ARGUMENT
ly-NAME:ARGUMENT.MODIFIER
```

Examples:

```text
ly-text
ly-on:click
ly-on:click.prevent.stop
```

### Inline Event Expressions

An event directive can contain either a named action or an inline expression.
The leading `:` explicitly marks the value as an inline expression:

```html
<button ly-on:click=":app.count++">+</button>
<button ly-on:click=":panel.open = !panel.open">Toggle</button>
```

Inline expressions must remain on one line and contain one expression or one
assignment. They must not contain declarations, blocks, loops, or multiple
statements. This keeps inline behavior readable, predictable, and compatible
with the CSP-safe expression evaluator.

Reusable behavior should be registered as a named action and called without the
inline marker:

```js
app.actions({
    increment() {
        app.count++;
    }
});
```

```html
<button ly-on:click="app.increment()">+</button>
```

The distinction is:

```text
:app.count++       inline expression
app.increment()     named action
```

The `:` belongs to the directive value. It is not part of the scope name or
JavaScript expression itself.

### Directive Principles

Prototype 3 directives follow these rules:

1. A directive is registered when its element is scanned.
2. A directive runs once with its initial value.
3. Reactive directives create an effect owned by the element's scope.
4. An effect updates only the DOM property or attribute it owns.
5. Event directives register one listener and remove it during cleanup.
6. Removed elements dispose all directive effects and listeners.
7. Invalid expressions report an error without breaking unrelated directives.
8. Directive expressions can access only visible, named Lyap scopes and their
   registered members.

Directives do not execute arbitrary JavaScript. They use the CSP-safe expression
evaluator and registered actions described earlier in this document.

### Core Directives

Prototype 3 includes a small set of core directives:

| Directive | Purpose |
| --- | --- |
| `ly-text` | Set reactive text content. |
| `ly-show` | Toggle an element's visibility. |
| `ly-bind:NAME` | Bind a reactive value to a property or attribute. |
| `ly-model` | Synchronize form controls with writable state. |
| `ly-on:EVENT` | Listen for DOM events and invoke an action or inline expression. |
| `ly-ref:NAME` | Register an element reference in the current scope. |
| `ly-if` | Conditionally render one block. |
| `ly-if-else` | Conditionally render an alternative block. |
| `ly-else` | Render the final alternative block. |
| `ly-for` | Render a block for each item in a collection. |
| `ly-key` | Identify a stable keyed loop iteration. |

Structural directives use templates and internal comment anchors. The original
element is converted into a template block during scanning, while an anchor
marks the block's position in the live DOM. This allows Lyap to insert, remove,
and reconcile rendered content without taking ownership of unrelated siblings.

#### `ly-if`, `ly-if-else`, and `ly-else`

Conditional directives render adjacent branches:

```html
<p ly-if="app.status === 'ready'">Ready</p>
<p ly-if-else="app.status === 'loading'">Loading...</p>
<p ly-else>Unable to load.</p>
```

The rules are:

1. `ly-if` starts a conditional chain.
2. `ly-if-else` adds a conditional branch and must immediately follow the chain.
3. `ly-else` adds the final fallback branch and must be the last branch.
4. A chain may contain any number of `ly-if-else` branches but only one
   `ly-else` branch.
5. A branch renders at most one live instance at a time.
6. When a branch is removed, its effects, listeners, refs, and child scopes are
   disposed.
7. When a branch is rendered again, it is created from its template and
   initialized again.

Conditional chains must be contiguous element siblings. Whitespace-only text
nodes and comments between branches are ignored. Any other text node or element
breaks the chain. A chain that contains invalid ordering is an error.

The scanner groups a conditional chain before replacing its branch elements with
one anchor and branch templates. Branch attributes are marked as processed, so
the mutation observer does not initialize the same templates a second time.

#### `ly-for`

`ly-for` renders a block for each item in a collection:

```html
<template ly-for="(name, index) in app.names" ly-key="name.id">
    <li>
        <span ly-text="name.label"></span>
    </li>
</template>
```

The supported loop forms are:

```text
item in collection
(item, index) in collection
(value, key) in object
(value, key, index) in object
```

The collection is read reactively. Each iteration receives a local item value
and, when requested, its numeric index. The loop's local values are available
only inside that iteration's template. Local loop variables are the one
intentional exception to the named-scope rule.

Prototype 3 accepts arrays and plain JSON-like objects:

- Reactive store arrays are supported.
- Normal JavaScript arrays are supported.
- Reactive store objects with string keys are supported.
- Normal plain objects are supported.
- `null` and `undefined` render zero iterations.
- Strings, `Map`, `Set`, and arbitrary iterables are errors.

The collection expression is read-only. Array mutations and replacements are
tracked by the reactive core, and the loop's numeric index is the current array
position for that update. Object loops iterate `Object.keys(object)` in native
property order. The object key is a string, and the optional index is the
current position in that key list.

For object loops, `ly-key` should normally use the exposed property key:

```html
<template ly-for="(user, id) in app.users" ly-key="id">
    <article ly-text="user.name"></article>
</template>
```

Values added or deleted from a reactive object update the loop. Objects with
custom prototypes are not valid loop collections; convert them to a plain
object or array first.

Nested loop variable shadowing is undefined behavior. Nested loops should use
distinct variable names; Lyap does not guarantee which value a shadowed name
resolves to.

`ly-key` identifies the stable identity of each loop iteration. It belongs on
the same element as `ly-for`:

```html
<template ly-for="item in app.items" ly-key="item.id">
    <article ly-text="item.title"></article>
</template>
```

Key rules:

1. A loop must have `ly-key` on the same element as `ly-for`.
2. Keys must be unique within one collection update.
3. Keys should be stable across updates and should not use the loop index for
   reorderable collections.
4. Duplicate or invalid keys are errors.
5. Existing keyed blocks are moved and updated instead of being recreated.
6. Removed blocks dispose their effects, listeners, refs, and child scopes.

Keys are evaluated in the loop-local context before reconciliation. Prototype 3
accepts only primitive string and finite number keys. Key equality uses the
normalized primitive value; object keys, `NaN`, `Infinity`, and `undefined` are
invalid. A numeric key and an equivalent string key remain distinct.

The template form is the canonical form for loops because it makes the loop
boundary explicit and can render one or more root nodes per iteration. A loop
on a normal element is also allowed:

```html
<li ly-for="item in app.items" ly-key="item.id" ly-text="item.title"></li>
```

#### `ly-text`

`ly-text` sets `textContent` and updates reactively:

```html
<p ly-text="app.fullName"></p>
```

Conversion rules:

- `null` and `undefined` render as an empty string.
- All other values use normal string conversion.
- HTML is never interpreted.

This is the default safe output directive. An HTML injection directive is not
part of Prototype 3.

#### `ly-show`

`ly-show` toggles the element's `hidden` property:

```html
<p ly-show="app.isLoggedIn">Welcome back</p>
```

Truthy values show the element; falsy values hide it. The element remains in the
DOM and keeps its directive state.

#### `ly-bind`

`ly-bind:NAME` reactively binds a value to a DOM property or attribute:

```html
<button ly-bind:disabled="app.loading">Save</button>
<a ly-bind:href="app.profileUrl">Profile</a>
<div ly-bind:class="app.activeClass"></div>
```

For standard form and element properties, Lyap updates the property. For
unknown names, Lyap updates the attribute. A `null` or `undefined` value removes
an attribute and resets a bound property to its default behavior where
possible.

Prototype 3 uses an explicit property map for common properties, including
`value`, `checked`, `selected`, `disabled`, `hidden`, `multiple`, `class`, and
`for`. `class` and `for` map to their HTML attributes and `className` and
`htmlFor` are not special aliases. Unknown names use `setAttribute` and
`removeAttribute`.

Boolean properties are assigned booleans. Nullish values remove unknown
attributes and reset mapped properties to their documented default value.
Event-handler properties, `innerHTML`, `outerHTML`, and other unsafe HTML
properties cannot be bound.

The bound name is static. Dynamic attribute names are not supported by this
directive. SVG property handling uses attributes unless a documented SVG
property is explicitly supported.

#### `ly-model`

`ly-model` provides two-way binding for writable state paths:

```html
<input ly-model="app.email">
<input type="checkbox" ly-model="app.subscribed">
```

The directive reads the initial value from the state path and writes user input
back to that path. Supported controls are text inputs, checkboxes, radio
buttons, selects, and textareas.

Control value rules are:

- Text inputs and textareas read and write strings.
- A single checkbox reads and writes a boolean.
- A group of checkboxes bound to an array adds or removes each control's
  `value` from that array.
- A radio group reads and writes the selected control's `value`.
- A single select reads and writes a string.
- A multiple select reads and writes an array of selected values.
- File inputs cannot use `ly-model`; file selection requires an action and the
  `FileList` API.
- Unsupported controls are errors during directive registration.

Optional modifiers are:

```html
<input ly-model.trim="app.email">
<input ly-model.number="app.age">
<input ly-model.trim.number="app.age">
<input ly-model.lazy="app.query">
```

- `.trim` removes surrounding whitespace from text values.
- `.number` converts numeric input to a number when conversion succeeds.
- `.lazy` writes on `change` instead of `input`.

Model modifiers may be chained. Normalization always follows this order,
regardless of the order in which modifiers are written:

```text
raw input -> trim -> number conversion -> state assignment
```

Therefore, `ly-model.trim.number` is the canonical form for numeric text input.
An empty value remains an empty string, and an invalid numeric value remains the
trimmed string instead of becoming `0` or `NaN`. A valid conversion must produce
a finite number. Each modifier may appear only once; duplicate modifiers are
errors.

Text controls defer writes while the user is composing an IME value and resume
after `compositionend`. `.lazy` uses `change` and does not write on `input`.

The target must be assignable. Binding to a derived value or a literal is an
error.

#### `ly-on`

`ly-on:EVENT` registers an event listener:

```html
<button ly-on:click="app.increment()">+</button>
<button ly-on:click=":app.count++">+</button>
```

The handler receives the event as `$event`. Registered actions may be async;
the event runtime observes returned Promises and reports rejected actions using
the lifecycle error behavior.

Supported modifiers in Prototype 3 are:

| Modifier | Behavior |
| --- | --- |
| `.prevent` | Call `event.preventDefault()`. |
| `.stop` | Call `event.stopPropagation()`. |
| `.self` | Run only when the event target is the element itself. |
| `.once` | Remove the listener after its first invocation. |
| `.capture` | Register the listener in capture mode. |
| `.passive` | Register the listener as passive. |

Modifiers are applied before the action or inline expression runs. Invalid
modifier combinations, such as `.passive.prevent`, are errors.

#### `ly-ref`

`ly-ref:NAME` registers an element reference on the current scope:

```html
<input ly-ref:email>
<button ly-on:click="app.focusEmail()">Focus</button>
```

The reference is available through the `$refs` magic value in expressions and
through the scope handle for registered actions. References are non-reactive
and are removed when their elements leave the DOM.

### Directive Lifecycle

The directive lifecycle is:

1. Parse and validate the directive name, argument, and modifiers.
2. Resolve the visible named scope and registered expression members.
3. Apply the initial DOM value or register the event listener.
4. Create reactive effects for state-dependent directives.
5. Register cleanup with the owning DOM scope.
6. Dispose the effect or listener when the element is removed.

Directives are processed in document order. A directive must not depend on a
later directive having already run.

### Directive Composition

Structural directives control DOM ownership and are processed before normal
directives.

The composition rules are:

1. An element may have at most one structural directive.
2. `ly-if` and `ly-for` cannot be combined on the same element.
3. `ly-key` is valid only on an element that also has `ly-for`.
4. `ly-if-else` and `ly-else` must belong to a valid adjacent conditional chain.
5. Normal directives on a structural template are initialized for each rendered
   instance.
6. A structural block owns all directives, refs, effects, listeners, and child
   scopes created inside that block.
7. Removing a structural block disposes its complete owned subtree.
8. Invalid directive combinations are reported during scanning and do not
   partially initialize the invalid element.

Use nested templates when multiple structural behaviors are needed:

```html
<template ly-for="item in app.items" ly-key="item.id">
    <template ly-if="item.visible">
        <span ly-text="item.name"></span>
    </template>
</template>
```

The processing order is:

```text
Parse directive attributes
Validate structural combinations
Create template and anchor ownership
Render structural blocks
Initialize normal directives inside rendered blocks
Remove registered ly-* attributes
```

### Directive Registry

Directives are registered independently from the DOM walker. The walker parses
attributes, validates them, and delegates behavior to the matching handler.

```ts
type DirectiveHandler = (context: DirectiveContext) => Cleanup | void;

registerDirective('text', textDirective);
registerDirective('on', onDirective);
registerDirective('if', ifDirective);
registerDirective('for', forDirective);
```

Each handler receives the element, directive name, argument, modifiers, raw
value, owning scope, evaluator, and a cleanup registration function. A handler
may return an additional cleanup function. Directive handlers must not access
the walker internals or register resources outside the provided owner.

The registry is runtime-local. A custom directive registered for one mounted
application is not visible to another mounted application unless it is
explicitly registered there.

Unknown directives are errors by default. A runtime may support an explicit
custom directive registration API later, but silently ignoring misspelled
`ly-*` attributes is not allowed.

The `ly-*` namespace is reserved for Lyap directives. Registering a custom
directive with an existing built-in name, or registering the same directive name
twice in one runtime, is an error. A directive attribute may not collide with a
scope member in an expression because directive names and expression members
are resolved in separate namespaces.

### Runtime Ownership

Lyap uses three ownership levels:

```text
Runtime
  Scope
    Element / structural block
      Directive effects, listeners, refs, and cleanups
```

Ownership rules:

1. Every scope belongs to exactly one runtime.
2. Every scope has one DOM owner element.
3. Every directive resource belongs to the nearest element or structural block
   owner.
4. Disposing an owner disposes its descendants before the owner itself.
5. Disposing a runtime disposes all scopes, blocks, effects, listeners, refs,
   and observers created by that runtime.
6. Cleanup is idempotent; repeated disposal never runs user cleanup twice.

The runtime, scope, and directive layers must not retain removed DOM nodes after
cleanup. WeakMaps may be used for element metadata, while active ownership
collections must be explicitly cleared during disposal.

### Runtime Errors

Runtime errors are isolated by scope and directive. A failure in one directive,
action, or lifecycle callback must not prevent unrelated scopes from running.

Every reported error should include:

- The error phase: mount, lifecycle, directive, event, or cleanup.
- The public scope name, when available.
- The directive name and argument, when available.
- The original expression, when available.
- The owning element, when available.
- The original thrown value.

The default behavior reports the error through `console.error`. Applications
may provide an error hook when mounting:

```js
const runtime = Lyap.mount(document, {
    onError(error) {
        reportToMonitoring(error);
    }
});
```

An error hook is observational. It must not be able to prevent cleanup or leave
the runtime in a partially owned state. Errors thrown by cleanup are reported
after the remaining cleanup callbacks have been attempted.

### Security Contract

The DOM runtime is CSP-safe by construction:

1. The evaluator never uses `eval`, `new Function`, `with`, or generated code.
2. Expressions are parsed and interpreted from an allowlisted grammar.
3. Browser globals and unsafe identifiers are unavailable to HTML expressions.
4. Unsafe properties such as `constructor`, `prototype`, and `__proto__` are
   rejected at every access level.
5. `ly-text` always writes `textContent`; it never interprets HTML.
6. Network access belongs to JavaScript actions, not HTML expressions.
7. Scope and action registration never creates globals on `window`.

User JavaScript remains subject to the browser's CSP and normal JavaScript
security rules. Lyap does not attempt to sandbox code inside user-owned script
tags. The evaluator is CSP-safe, but inline scope scripts still require the
application's CSP to allow inline scripts through a nonce or hash. Applications
with strict `script-src` rules must use nonce-bearing scope scripts or external
JavaScript files.

### HTML Access Boundary

HTML expressions can access only values explicitly registered on a visible
named scope:

1. State registered with `scope.state()` is readable and writable.
2. Values registered with `scope.derived()` are readable but read-only.
3. Functions registered with `scope.actions()` are callable actions.
4. Inline expressions may mutate registered state but may not call arbitrary
   JavaScript functions.
5. Unregistered variables, functions, and browser globals are unavailable to
   HTML expressions.

JavaScript inside the associated script remains regular JavaScript. It may
mutate the scope handle directly and may use ordinary JavaScript APIs subject
to the application's CSP:

```js
app.count++;
app.user.name = 'Taylor';
```

This keeps HTML declarative and controlled while allowing JavaScript lifecycle
hooks, actions, timers, and other application code to manage state freely.

### Expression Evaluator Contract

The CSP-safe evaluator supports a deliberately limited expression language. It
must support:

- Named scope access, such as `app.count` and `app.user.name`.
- Local loop variables, such as `item` and `index`.
- State reads, comparisons, logical operators, arithmetic, and ternaries.
- Registered action calls, such as `app.submit($event)`.
- Assignable state paths for `ly-model`.
- One-line assignment expressions for inline event values.

The evaluator must reject:

- Arbitrary JavaScript function calls.
- Unregistered variables and functions.
- Browser globals and unsafe identifiers.
- Declarations, blocks, loops, and multiple statements.
- `await` inside inline expressions.
- Access to forbidden properties such as `constructor`, `prototype`, and
  `__proto__`.

Expression permissions depend on the directive:

| Directive | Permission |
| --- | --- |
| `ly-text` | Read-only expression. |
| `ly-show` | Read-only expression. |
| `ly-bind` | Read-only expression. |
| `ly-if` and `ly-if-else` | Read-only condition. |
| `ly-for` | Read-only collection plus local loop variables. |
| `ly-model` | One writable state path. |
| `ly-on:EVENT` with `:` | One-line inline expression; registered state writes allowed. |
| `ly-on:EVENT` without `:` | One registered action call. |

Expression errors are reported with the element, directive name, and original
expression. One invalid directive must not stop unrelated directives or scopes
from initializing.

### Expression Context

Lyap provides a small set of context values. They are available only in the
contexts listed below:

| Value | Availability | Meaning |
| --- | --- | --- |
| `$event` | `ly-on:EVENT` | The current DOM event. |
| `$el` | All directive expressions | The current DOM element, read-only. |
| `$refs` | Actions and directive expressions | The current scope's element refs, read-only. |
| `$form` | Form-related expressions | The nearest containing form, or `undefined`. |
| `$nextTick` | Actions and lifecycle callbacks | Schedule a callback after the current reactive flush. |

`$scope` is not exposed to HTML expressions. Scope access must use the explicit
public name, such as `app.count`. `$refs` exposes elements for reading and
passing to registered actions; arbitrary methods on referenced elements cannot
be called from HTML expressions.

Action arguments are ordinary read-only expressions, except for `$event` and
assignable state paths used by the directive that owns the expression. Only the
registered action member at the end of a named scope path may be called:

```text
app.submit($event)       allowed
app.user.save()          rejected unless save is a registered action
```

### Async Actions and Events

Registered actions may be asynchronous. Inline expressions remain synchronous
and should not contain `await`; asynchronous work belongs in an action.

```html
<div>
    <script>
        const app = Lyap.scope('app');

        app.state({
            loading: false,
            error: null,
            user: null
        });

        app.actions({
            async loadUser() {
                app.loading = true;
                app.error = null;

                try {
                    const response = await fetch('/api/user');
                    if (!response.ok) {
                        throw new Error(`Request failed: ${response.status}`);
                    }
                    app.user = await response.json();
                } catch (error) {
                    app.error = error;
                } finally {
                    app.loading = false;
                }
            }
        });
    </script>

    <button ly-on:click="app.loadUser()" ly-bind:disabled="app.loading">
        Load user
    </button>
    <p ly-text="app.error && app.error.message"></p>
</div>
```

An event handler does not need to block while an action is pending. The action's
returned Promise is observed by the event runtime so rejected actions do not
become unhandled Promise rejections. The default error reporting behavior will
be defined with the broader error-handling design.

Form submission uses the same action model and can use the `prevent` modifier:

```html
<form ly-on:submit.prevent="app.submit($event)">
    <input name="email" ly-bind:value="app.email">
    <button type="submit">Submit</button>
</form>
```

The action receives the event and may read form data using normal JavaScript:

```js
app.actions({
    async submit(event) {
        const form = event.currentTarget;
        const data = new FormData(form);
        await fetch('/api/subscribe', {
            method: 'POST',
            body: data
        });
    }
});
```

### Reusing JavaScript Functions

A function can be declared as ordinary JavaScript and then registered as an
action when it should also be callable from HTML. Registration does not change
the function's normal JavaScript use:

```js
const app = Lyap.scope('app');

async function loadUser() {
    app.loading = true;

    try {
        const response = await fetch('/api/user');
        app.user = await response.json();
    } finally {
        app.loading = false;
    }
}

app.actions({
    loadUser
});

app.onMount(loadUser);
```

JavaScript continues to call the original function directly:

```js
loadUser();
```

HTML uses the registered action through the named scope:

```html
<button ly-on:click="app.loadUser()">Reload user</button>
```

Registration is only the bridge that exposes the function to HTML. It does not
replace or wrap the original JavaScript function. Lyap uses the registered
action entry when handling the HTML event so it can preserve the owning scope
and observe returned Promises.

### Syntax removal

After scanning the DOM, Lyap will register the directives and remove the
`ly-*` attributes from the live DOM to leave a clean rendered document.

### Core Public API

The Prototype 3 core public API is intentionally small:

```ts
Lyap.mount(root?, options?): Runtime;
Lyap.scope(name): Scope;

Runtime.ready: Promise<void>;
Runtime.destroy(): Promise<void>;

Scope.state(values): Scope;
Scope.derived(values): Scope;
Scope.actions(actions): Scope;
Scope.cleanup(callback): Scope;
Scope.init(callback): Scope;
Scope.onMount(callback): Scope;
Scope.onDestroy(callback): Scope;
```

Scope registration methods return the scope handle to support setup chaining in
future versions, but the explicit statement form remains the recommended
beginner style. Runtime and scope disposal are idempotent.

### Core Production Readiness

The core is ready for a production release when the following requirements are
met:

- Automatic and manual mounting are idempotent.
- Scope names are validated, unique, and correctly associated with DOM roots.
- State, derived values, actions, and lifecycle hooks are disposed with scopes.
- Directive handlers are runtime-local and return reliable cleanup.
- Initial DOM scanning and dynamic mutation scanning share one code path.
- Structural blocks preserve anchors, keys, ownership, and cleanup correctly.
- Async action and lifecycle Promise rejections are reported.
- Expression evaluation remains CSP-safe and rejects unsupported syntax.
- `ly-text` never interprets HTML.
- Removed DOM nodes are not retained by runtime metadata or active collections.
- Errors include enough scope, directive, element, and expression context to
  diagnose failures.

### Developer Tooling

Lyap directives are intentionally custom HTML attributes. Browsers accept them
without element registration; editor red underlines come from HTML language
services or validators that do not know Lyap's directive vocabulary.

Prototype 3 should provide developer tooling rather than requiring users to
register every referenced element:

1. An HTML language-service schema for the core `ly-*` directives.
2. Expression diagnostics for scope names, state, derived values, and actions.
3. Modifier completion for `ly-on`, `ly-model`, and other directive families.
4. Development warnings for unknown directives, duplicate scope names, invalid
   `ly-if` chains, missing loop keys, and duplicate loop keys.
5. A validator configuration for projects using strict HTML validation.

`ly-ref:email` remains the canonical syntax:

```html
<input ly-ref:email>
```

The runtime does not register `email` as a custom element. It stores the element
reference in the owning scope's `$refs` collection and removes it when the
element leaves the DOM.

The core syntax will not be duplicated with `data-ly-*` aliases unless strict
HTML tooling proves that the developer tooling cannot provide sufficient
coverage.

### Verification Requirements

Before release, the core must have tests for:

1. Mounting the same root multiple times.
2. Mounting separate roots and rejecting overlapping roots.
3. Pre-mount scope queuing and `runtime.ready` resolution.
4. Scope name visibility and duplicate-name errors.
5. State, derived values, actions, and inherited state updates.
6. Lifecycle ordering, async hooks, disposal, and idempotent cleanup.
7. Initial and reactive behavior for every core directive.
8. Event modifiers, inline expressions, context values, registered actions, and
   async errors.
9. Form control types and chained `ly-model` modifiers, including IME input.
10. Conditional branch whitespace, insertion, replacement, and cleanup.
11. Keyed loop creation, reorder, insertion, deletion, invalid keys, and
    duplicate keys.
12. Dynamic DOM additions, removals, moves, and reinsertion through
    `MutationObserver`.
13. Property, attribute, boolean, SVG, and unsafe-property binding behavior.
14. Evaluator security restrictions and CSP-safe operation.
15. Error isolation between unrelated scopes and directives.
16. No retained DOM nodes after runtime disposal.

### Lyap Components

Components are a planned optional feature. The proposed `ly-use` directive
would fetch component HTML from the server, but the fetching mechanism and
component lifecycle are not yet decided. Components should remain separate from
the minimal DOM core.

### Lyap SPA

SPA behavior is a planned optional add-on and is not part of the core DOM
design.

### Lyap Data Fetching

Data fetching is not yet designed. It should be considered separately from
state and the core DOM runtime.
