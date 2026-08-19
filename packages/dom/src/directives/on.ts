import type { DirectiveContext } from '../types.js';

export function onDirective(context: DirectiveContext) {
  const { runtime, scope, element, attributeName, value: expr, locals } = context;

  const eventParts = attributeName.slice('ly-on:'.length).split('.');
  const eventName = eventParts.shift()!;
  const modifiers = eventParts;

  for (const mod of modifiers) {
    if (!['prevent', 'stop', 'self', 'once', 'capture', 'passive'].includes(mod)) {
      throw new Error(`Unknown ly-on modifier: ${mod}`);
    }
  }

  if (modifiers.includes('passive') && modifiers.includes('prevent')) {
    throw new Error('Incompatible modifiers: passive and prevent cannot be combined');
  }

  const listener = (event: Event) => {
    if (modifiers.includes('self') && event.target !== element) return;
    if (modifiers.includes('prevent')) event.preventDefault();
    if (modifiers.includes('stop')) event.stopPropagation();

    try {
      const result = runtime.evaluate(expr, element, event, locals);
      if (result && typeof result === 'object' && typeof result.then === 'function') {
        result.catch((error: unknown) => runtime.reportError(error, element));
      }
    } catch (error) {
      runtime.reportError(error, element);
    }
  };

  const options: AddEventListenerOptions = {
    once: modifiers.includes('once'),
    capture: modifiers.includes('capture'),
    passive: modifiers.includes('passive')
  };

  element.addEventListener(eventName, listener, options);
  scope.cleanup(() => element.removeEventListener(eventName, listener, { capture: modifiers.includes('capture') }));
}
