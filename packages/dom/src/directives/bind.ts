import { effect } from '@lyapjs/reactive';
import { evaluateExpression } from '../evaluator.js';
import { ScopeContext } from '../scope.js';

export function handleBind(element: Element, rawPropName: string, scopeCtx: ScopeContext): void {
  const inputEl = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  const parts = rawPropName.split('.');
  const propName = parts[0];
  const modifiers = new Set(parts.slice(1));

  let debounceMs = 0;
  for (const mod of modifiers) {
    const match = mod.match(/^debounce\((\d+)\)$/);
    if (match) {
      debounceMs = parseInt(match[1], 10);
    }
  }

  let isComposing = false;
  const onComposeStart = () => {
    isComposing = true;
  };
  const onComposeEnd = () => {
    isComposing = false;
    updateStateFromInput();
  };

  let debounceTimer: any = null;

  const updateStateFromInput = () => {
    if (isComposing) return;

    let value: any;

    if (inputEl.type === 'checkbox') {
      const isChecked = (inputEl as HTMLInputElement).checked;
      const currentArr = scopeCtx.state[propName];

      if (Array.isArray(currentArr)) {
        const val = inputEl.value;
        if (isChecked) {
          if (!currentArr.includes(val)) currentArr.push(val);
        } else {
          const idx = currentArr.indexOf(val);
          if (idx !== -1) currentArr.splice(idx, 1);
        }
        return;
      } else {
        value = isChecked;
      }
    } else if (inputEl.type === 'radio') {
      if (!(inputEl as HTMLInputElement).checked) return;
      value = inputEl.value;
    } else {
      value = inputEl.value;
    }

    if (modifiers.has('trim') && typeof value === 'string') {
      value = value.trim();
    }

    if (modifiers.has('number')) {
      const num = parseFloat(value);
      if (!isNaN(num)) value = num;
    }

    if (debounceMs > 0) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        scopeCtx.state[propName] = value;
      }, debounceMs);
    } else {
      scopeCtx.state[propName] = value;
    }
  };

  inputEl.addEventListener('compositionstart', onComposeStart);
  inputEl.addEventListener('compositionend', onComposeEnd);
  inputEl.addEventListener('input', updateStateFromInput);
  inputEl.addEventListener('change', updateStateFromInput);

  const e = effect(() => {
    const val = evaluateExpression(propName, {
      scope: scopeCtx.state,
      element,
      refs: scopeCtx.refs
    });

    if (isComposing) return;

    if (inputEl.type === 'checkbox') {
      if (Array.isArray(val)) {
        (inputEl as HTMLInputElement).checked = val.includes(inputEl.value);
      } else {
        (inputEl as HTMLInputElement).checked = Boolean(val);
      }
    } else if (inputEl.type === 'radio') {
      (inputEl as HTMLInputElement).checked = (inputEl.value === String(val));
    } else {
      if (document.activeElement !== inputEl) {
        inputEl.value = val !== undefined && val !== null ? String(val) : '';
      }
    }
  });

  scopeCtx.destroyHooks.push(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    inputEl.removeEventListener('compositionstart', onComposeStart);
    inputEl.removeEventListener('compositionend', onComposeEnd);
    inputEl.removeEventListener('input', updateStateFromInput);
    inputEl.removeEventListener('change', updateStateFromInput);
    e.dispose();
  });

  e.runEffect();
}
