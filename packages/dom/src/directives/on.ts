import { executeStatement } from '../evaluator.js';
import { ScopeContext, createFormAssistant } from '../scope.js';

export function handleOn(element: Element, rawEventName: string, expression: string, scopeCtx: ScopeContext): void {
  const parts = rawEventName.split('.');
  const eventName = parts[0];
  const modifiers = new Set(parts.slice(1));

  const listener = (event: Event) => {
    // Modifier: .self
    if (modifiers.has('self') && event.target !== element) {
      return;
    }

    // Modifier: .prevent
    if (modifiers.has('prevent')) {
      event.preventDefault();
    }

    // Modifier: .stop
    if (modifiers.has('stop')) {
      event.stopPropagation();
    }

    // Keyboard Modifiers
    if (event instanceof KeyboardEvent) {
      if (modifiers.has('enter') && event.key !== 'Enter') return;
      if (modifiers.has('escape') && event.key !== 'Escape') return;
    }

    // Form assistant context if inside a form
    const formElement = element.closest('form') || (element.tagName === 'FORM' ? element : null);
    const formAssistant = formElement ? createFormAssistant(formElement, scopeCtx) : undefined;

    const evalContext = {
      scope: scopeCtx.state,
      event,
      element,
      refs: scopeCtx.refs,
      form: formAssistant
    };

    if (expression.startsWith(':')) {
      // Inline micro-expression
      executeStatement(expression, evalContext);
    } else {
      // Reusable function call
      const fn = scopeCtx.state[expression];
      if (typeof fn === 'function') {
        fn.call(scopeCtx.state, event, evalContext);
      } else {
        // Fallback execute expression
        executeStatement(expression, evalContext);
      }
    }
  };

  // Target selection based on modifiers
  if (modifiers.has('window')) {
    window.addEventListener(eventName, listener, { once: modifiers.has('once') });
  } else if (modifiers.has('outside')) {
    const outsideListener = (event: Event) => {
      if (!element.contains(event.target as Node)) {
        listener(event);
      }
    };
    document.addEventListener(eventName, outsideListener, { once: modifiers.has('once') });
    scopeCtx.destroyHooks.push(() => {
      document.removeEventListener(eventName, outsideListener);
    });
  } else {
    element.addEventListener(eventName, listener, { once: modifiers.has('once') });
  }
}
