export function handleCloak(element: Element): void {
  if (element.hasAttribute('ly-cloak')) {
    element.removeAttribute('ly-cloak');
  }
}
