# Lyap.js Interactive Showcase & Example Website

An interactive example application built with **Lyap.js Prototype 3** using the standalone minified CDN bundle (`lyap.min.js`).

---

## CDN Usage

To use Lyap.js via CDN in any HTML page, simply include the script tag:

```html
<!-- Include Lyap.js CDN bundle -->
<script src="https://cdn.jsdelivr.net/npm/@lyap/dom/dist/lyap.min.js"></script>

<!-- Declare DOM with Directives -->
<div id="counter-app">
  <button ly-on:click="app.count++">Count: <span ly-text="app.count"></span></button>
</div>

<!-- Define Reactive Scope -->
<script>
  const app = Lyap.scope('app', document.getElementById('counter-app'));
  app.state({ count: 0 });
</script>
```

---

## Building the CDN Bundle

To build the minified bundle from source:

```bash
# In packages/dom
npm run build:min
```

This outputs `packages/dom/dist/lyap.min.js` (~27KB uncompressed, ~8KB gzipped), which is a self-contained IIFE bundle including the reactive store and CSP-safe evaluator.

---

## Running the Example Locally

To view the example website locally in any browser:

### Option 1: Using npx serve / http-server
From the repository root:
```bash
npx serve .
# Open http://localhost:3000/docs/example/
```

### Option 2: Using Python's built-in HTTP server
```bash
python3 -m http.server 8000
# Open http://localhost:8000/docs/example/
```

---

## File Structure

* [`index.html`](./index.html): HTML markup containing Lyap directives (`ly-text`, `ly-show`, `ly-bind`, `ly-model`, `ly-on`, `ly-ref`, `ly-if`, `ly-else`, `ly-for`, `ly-key`).
* [`lyap.min.js`](./lyap.min.js): Standalone minified CDN distribution bundle.
* [`app.js`](./app.js): Application scopes, state definitions, derived calculations, and action handlers.
* [`style.css`](./style.css): Modern dark-themed styling and responsive layouts.
