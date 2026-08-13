# Lyap Design Specification (Prototype 2)

## Philosophy

1. **Structural over convenience:** HTML structure and explicit scope boundaries dictate application behavior.
2. **Concise and effective syntax:** Prefer short, explicit syntax over ambiguous magic.
3. **Non-invasive DOM ownership:** We don't own DOM elements. We only own what is explicitly declared via `ly-` directives and `lyap` scripts.
4. **100% CSP Compliant & Safe:** Zero `eval()` or `new Function()`. Safe sandboxed micro-evaluation for inline expressions.

---

## Core Concepts

### 1. Lyap Script (`<script type="lyap">`)

State, derived values, lifecycle hooks, and action functions are declared inside `<script type="lyap">` blocks placed directly inside HTML container elements. Browsers natively ignore `<script type="lyap">` during initial HTML parsing.

```html
<div>
    <script type="lyap">
        state({
            count: 0,
            firstName: 'Alex',
            lastName: 'Smith'
        });

        derived({
            doubleCount() {
                return count * 2;
            },
            fullName() {
                return `${firstName} ${lastName}`;
            }
        });

        init(() => {
            // Executed during scope initialization
            console.log('Scope initialized');
        });

        mount(() => {
            // Executed when element & scope are attached to the DOM
            console.log('Mounted container');

            const timer = setInterval(() => count++, 1000);

            // cleanup() inside mount cleans up resources created during mount
            cleanup(() => {
                clearInterval(timer);
            });
        });

        destroy(() => {
            // Top-level script hook executed when the container scope is destroyed
            console.log('Container script scope destroyed');
        });

        function increment() {
            count++;
        }
    </script>

    <p>Count: <span ly-text="count"></span> (Double: <span ly-text="doubleCount"></span>)</p>
    <p>User: <span ly-text="fullName"></span></p>
    <button ly-on:click="increment"> + </button>
</div>
```

#### State & Derived Values
* **`state({})`**: Declares reactive state properties.
* **`derived({})`**: Declares read-only computed values derived from reactive state. Automatically updates when underlying state dependencies change.

#### Lifecycle Hooks & Resource Cleanups
* **`init(() => { ... })`**: Executed during initial scope creation.
* **`mount(() => { ... })`**: Executed immediately after the element and scope are attached to the active DOM tree.
* **`cleanup(() => { ... })`**: Registered inside `mount()` to clean up specific resources (timers, event listeners, subscriptions) instantiated during that mount cycle.
* **`destroy(() => { ... })`**: Top-level script lifecycle hook executed when the container element and its scope are unmounted and destroyed from the DOM.

#### Container Scope Binding & Inheritance
A `<script type="lyap">` binds its scope to its nearest parent HTML container element. Multiple scripts in the same container share the same scope context. Child containers inherit state and derived properties from ancestor containers via prototypal scope delegation.

```
child scope
  ↓ (inherits from)
parent scope
  ↓ (inherits from)
root scope
```

---

### 2. Text Binding (`ly-text`)

Binds element text content safely without HTML interpretation:

```html
<span ly-text="name"></span>
```

*Implementation detail:* Sets `element.textContent = value` (automatically escapes HTML to prevent XSS).

---

### 3. Events & Action Handlers (`ly-on:*`)

Event listeners are attached via `ly-on:<event>`.

#### Distinction between Reusable Functions & Inline Actions:
* **Reusable Named Actions:** Point to functions declared in `<script type="lyap">`.
* **Inline Actions:** Prefix the expression with a colon `:` to explicitly signal an inline micro-expression.

```html
<!-- Reusable logic function defined in script -->
<button ly-on:click="save">Save Profile</button>
<button ly-on:click="increment">Increase</button>

<!-- Inline micro-expressions (prefixed with :) -->
<button ly-on:click=":count++"> + </button>
<button ly-on:click=":open = !open"> Toggle </button>
<input ly-on:input=":search = $event.target.value">
```

#### Event Modifiers:
* **`.outside`** — Listens for clicks outside the current element container (useful for closing dropdowns/menus).
* **`.self`** — Triggers handler only if `$event.target` is the element itself (ignoring child element clicks).
* **`.prevent`** — Calls `$event.preventDefault()`.
* **`.stop`** — Calls `$event.stopPropagation()`.
* **`.once`** — Listens for the event at most once, then unbinds.
* **`.window`** — Attaches event listener to `window`.

```html
<!-- Click outside dropdown to close -->
<div class="dropdown-menu" ly-show="open" ly-on:click.outside=":open = false">
    <a href="#profile">Profile</a>
</div>

<!-- Modal backdrop overlay click self -->
<div class="modal-backdrop" ly-on:click.self=":open = false">
    <div class="modal-card">Content</div>
</div>

<!-- Form submit prevent default -->
<form ly-on:submit.prevent="handleSubmit">
    <input ly-on:keydown.enter="submitForm" />
</form>
```

---

### 4. Visibility (`ly-show`)

Toggles element display via CSS `display: none` without modifying the DOM tree structure:

```html
<p ly-show="open">This paragraph toggles visibility.</p>
```

---

### 5. Conditional Rendering (`ly-if`, `ly-else-if`, `ly-else`)

Conditionally omits or inserts elements in the DOM tree using `<template>` blocks:

```html
<template ly-if="loggedIn">
    <div>Welcome back, <span ly-text="username"></span>!</div>
</template>
<template ly-else-if="loading">
    <div>Authenticating...</div>
</template>
<template ly-else>
    <div>Please log in to continue.</div>
</template>
```

---

### 6. Loops (`ly-for`)

Iterates over array state using `<template>` containers. Supports index tracking and key tracking:

```html
<template ly-for="(item, index) in items">
    <div ly-key="item.id">
        <span ly-text="index + 1"></span>: <span ly-text="item.name"></span>
    </div>
</template>
```

---

### 7. Detailed Form Handling (`ly-bind`, Modifiers, & Validation)

`ly-bind` provides seamless two-way data synchronization across all HTML form controls.

```html
<div>
    <script type="lyap">
        state({
            username: '',
            age: 25,
            bio: '',
            agree: false,
            interests: ['coding'],
            role: 'developer'
        });

        derived({
            errors() {
                const errs = {};
                if (!username) errs.username = 'Username is required';
                if (age < 18) errs.age = 'Must be at least 18';
                return errs;
            },
            isValid() {
                return Object.keys(errors).length === 0;
            }
        });

        function handleSubmit($form) {
            if (!isValid) return;
            console.log('Submitted values:', $form.data);
            $form.reset();
        }
    </script>

    <form ly-on:submit.prevent="handleSubmit">
        <!-- Text Input with .trim modifier -->
        <label>Username:</label>
        <input type="text" ly-bind.trim="username" />
        <span class="error" ly-show="errors.username" ly-text="errors.username"></span>

        <!-- Number Input with .number modifier -->
        <label>Age:</label>
        <input type="number" ly-bind.number="age" />
        <span class="error" ly-show="errors.age" ly-text="errors.age"></span>

        <!-- Textarea -->
        <label>Bio:</label>
        <textarea ly-bind="bio"></textarea>

        <!-- Single Boolean Checkbox -->
        <label>
            <input type="checkbox" ly-bind="agree" /> Accept Terms
        </label>

        <!-- Array Checkbox Group -->
        <label><input type="checkbox" ly-bind="interests" value="coding" /> Coding</label>
        <label><input type="checkbox" ly-bind="interests" value="design" /> Design</label>
        <label><input type="checkbox" ly-bind="interests" value="music" /> Music</label>

        <!-- Radio Button Group -->
        <label><input type="radio" ly-bind="role" value="developer" /> Developer</label>
        <label><input type="radio" ly-bind="role" value="designer" /> Designer</label>

        <button type="submit" ly-attr:disabled="!isValid">Submit Profile</button>
    </form>
</div>
```

---

### 8. Dynamic Class Binding (`ly-class`)

Elements maintain their standard static HTML `class="..."` attributes. `ly-class` dynamically appends or toggles class names based on condition tokens prefixed with a colon `:`.

#### Syntax Format:
```html
ly-class=":condition1 classA classB :condition2 classC classD"
```

Each condition/variable is prefixed with `:` and followed by space-separated class names to apply when that condition evaluates to truthy.

```html
<button class="btn btn-base" ly-class=":isActive active highlight :isDisabled disabled muted">
    Click Me
</button>
```

---

### 9. Attribute Binding (`ly-attr:*`)

Dynamically updates non-class element attributes:

```html
<button ly-attr:disabled="!agree">Submit</button>
<img ly-attr:src="user.avatarUrl" />
```

---

### 10. Lifecycle Hooks & FOUC Prevention (`ly-cloak`)

To prevent Flash of Uncompiled Content (FOUC), include `ly-cloak`:

```html
<style>
  [ly-cloak] { display: none !important; }
</style>

<div ly-cloak>
    <script type="lyap">
        state({ count: 0 });

        mount(() => {
            console.log('Container scope mounted');
        });

        destroy(() => {
            console.log('Container scope destroyed');
        });
    </script>
    <h1 ly-text="count"></h1>
</div>
```

---

### 11. Magic Variables Reference (`$*`)

Magic variables are special context-aware objects injected into event handlers, inline expressions, and script functions.

#### 1. `$event` (Native DOM Event)
* **Context:** Inside event handlers (`ly-on:*`).
* **Spells & Capabilities:**
  * `$event.target` — The DOM element that triggered the event.
  * `$event.target.value` — Current value of the input element.
  * `$event.key` / `$event.code` — Keyboard key details for key events.
  * `$event.preventDefault()` & `$event.stopPropagation()`.

#### 2. `$el` (Current Element Reference)
* **Context:** Available in any directive or script callback.
* **Spells & Capabilities:** Direct reference to the element (`HTMLElement`).
  * `$el.focus()` / `$el.blur()` — Imperative focus control.
  * `$el.scrollIntoView()` — Smooth scrolling.
  * `$el.dataset` — Read native HTML `data-*` attributes.

#### 3. `$refs` (Named Element Reference Map)
* **Context:** Available across the entire container scope.
* **Spells & Capabilities:** Tag any element with `ly-ref="name"` to access it instantly via `$refs.name` without query selectors.
  ```html
  <input ly-ref="searchInput" />
  <button ly-on:click=":$refs.searchInput.focus()">Focus</button>
  ```

#### 4. `$scope` (Container State Proxy)
* **Context:** Available in action functions and callbacks.
* **Spells & Capabilities:** Direct access to the container's reactive state Proxy. Useful for logging state snapshots or passing state objects to utility functions.

#### 5. `$form` (Form Assistant Context)
* **Context:** Inside `<form>` elements and submit event handlers (`ly-on:submit`).
* **Spells & Capabilities:**
  * `$form.data` — Object snapshot of all form field values.
  * `$form.reset()` — Resets form inputs and scope state back to initial values.
  * `$form.isDirty` — Boolean flag (`true` if any input has been modified).
  * `$form.isValid` — Boolean flag (`true` if HTML5 input validations pass).

#### 6. `$nextTick` (Async DOM Flush Hook)
* **Context:** Available inside script functions.
* **Spells & Capabilities:** Returns a Promise that resolves after Lyap finishes flushing pending reactive state updates to the DOM.

---

## Implementation Rules & Engine Constraints

1. **State Key Collision Guard:**
   If multiple `<script type="lyap">` blocks within the same container declare identical state property keys, the runtime must throw a console warning (`[Lyap Guard] State key collision: "key" already declared in container scope`).

2. **Scoped Variable Proxy Resolution:**
   Top-level identifiers inside `<script type="lyap">` and attribute expressions automatically resolve against the container's reactive Proxy without requiring `this.` or `$scope.`.

3. **`derived({})` Memoization Rule:**
   Derived values are lazily evaluated and memoized using reactive computed signals. They only re-run when their specific reactive state dependencies change.

4. **IME Composition Guard:**
   `ly-bind` must attach `compositionstart` and `compositionend` listeners to text inputs to freeze state mutations during active composition.

---

## Directives Summary Table

| Directive | Purpose | Example |
| :--- | :--- | :--- |
| `ly-cloak` | Hides container until Lyap initializes | `<div ly-cloak>` |
| `ly-text` | Sets text content safely (Anti-XSS) | `<span ly-text="user.name">` |
| `ly-on:*` | Listens to DOM events (`.outside`, `.self`, `.prevent`, `:` prefix for inline) | `ly-on:click.outside=":open = false"` |
| `ly-bind` | Two-way input binding with IME protection & modifiers | `<input ly-bind.trim="username">` |
| `ly-class` | Dynamic class list toggle (`:cond class1 class2`) | `ly-class=":isActive active :isDisabled disabled"` |
| `ly-attr:*` | Binds dynamic element attributes | `<button ly-attr:disabled="!isValid">` |
| `ly-show` | Toggles display visibility via CSS | `<p ly-show="isOpen">` |
| `ly-if` / `ly-else` | Conditional DOM insertion/omission | `<template ly-if="isLoggedIn">` |
| `ly-for` | Iterates array items with key tracking | `<template ly-for="item in items">` |