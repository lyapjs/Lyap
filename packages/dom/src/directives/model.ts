import { createOwnedEffect } from '../scope.js';
import { getExpressionReference } from '../evaluator.js';
import type { DirectiveContext } from '../types.js';

export function modelDirective(context: DirectiveContext) {
  const { runtime, scope, element, attributeName, value: expr, locals } = context;

  const parts = attributeName.split('.');
  parts.shift(); // remove 'ly-model'
  const modifiers = new Set(parts);

  for (const mod of modifiers) {
    if (!['trim', 'number', 'lazy'].includes(mod)) throw new Error(`Unknown ly-model modifier: ${mod}`);
  }
  if (parts.length !== modifiers.size) {
    throw new Error('Duplicate ly-model modifiers are not allowed');
  }

  const tagName = element.tagName.toLowerCase();
  const inputType = (element as HTMLInputElement).type?.toLowerCase();

  if (tagName === 'input' && inputType === 'file') {
    throw new Error('File inputs cannot use ly-model');
  }

  const ref = getExpressionReference(expr, runtime.createEvaluationContext(element, undefined, locals));

  let isComposing = false;
  element.addEventListener('compositionstart', () => {
    isComposing = true;
  });
  element.addEventListener('compositionend', () => {
    isComposing = false;
    onUserChange();
  });

  const onUserChange = () => {
    if (isComposing) return;

    if (tagName === 'input' && inputType === 'checkbox') {
      const input = element as HTMLInputElement;
      const currentVal = ref.get();

      if (Array.isArray(currentVal)) {
        const val = input.value;
        const index = currentVal.indexOf(val);
        if (input.checked && index === -1) currentVal.push(val);
        else if (!input.checked && index !== -1) currentVal.splice(index, 1);
      } else {
        ref.set(input.checked);
      }
    } else if (tagName === 'input' && inputType === 'radio') {
      const input = element as HTMLInputElement;
      if (input.checked) {
        let val: any = input.value;
        if (modifiers.has('trim')) val = val.trim();
        if (modifiers.has('number')) {
          const n = Number(val);
          if (val !== '' && Number.isFinite(n)) val = n;
        }
        ref.set(val);
      }
    } else if (tagName === 'select' && (element as HTMLSelectElement).multiple) {
      const select = element as HTMLSelectElement;
      const selected = Array.from(select.selectedOptions).map((o) => o.value);
      ref.set(selected);
    } else {
      let val: any = (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
      if (modifiers.has('trim')) val = val.trim();
      if (modifiers.has('number')) {
        const n = Number(val);
        if (val !== '' && Number.isFinite(n)) val = n;
      }
      ref.set(val);
    }
  };

  const eventName = modifiers.has('lazy') ? 'change' : 'input';
  element.addEventListener(eventName, onUserChange);
  if (eventName === 'input') element.addEventListener('change', onUserChange);

  scope.cleanup(() => {
    element.removeEventListener(eventName, onUserChange);
    if (eventName === 'input') element.removeEventListener('change', onUserChange);
  });

  createOwnedEffect(scope, () => {
    const val = ref.get();
    if (tagName === 'input' && inputType === 'checkbox') {
      const input = element as HTMLInputElement;
      if (Array.isArray(val)) input.checked = val.includes(input.value);
      else input.checked = Boolean(val);
    } else if (tagName === 'input' && inputType === 'radio') {
      const input = element as HTMLInputElement;
      input.checked = String(val) === input.value;
    } else if (tagName === 'select' && (element as HTMLSelectElement).multiple) {
      const select = element as HTMLSelectElement;
      const arr = Array.isArray(val) ? val : [];
      for (const opt of Array.from(select.options)) {
        opt.selected = arr.includes(opt.value);
      }
    } else {
      if (!isComposing) {
        (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value = val == null ? '' : String(val);
      }
    }
  });
}
