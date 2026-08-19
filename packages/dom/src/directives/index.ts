import { textDirective } from './text.js';
import { showDirective } from './show.js';
import { bindDirective } from './bind.js';
import { modelDirective } from './model.js';
import { onDirective } from './on.js';
import { refDirective } from './ref.js';
import { handleIfChain } from './if.js';
import { handleForLoop } from './for.js';
import type { DirectiveContext, DirectiveHandler } from '../types.js';

export { textDirective } from './text.js';
export { showDirective } from './show.js';
export { bindDirective } from './bind.js';
export { modelDirective } from './model.js';
export { onDirective } from './on.js';
export { refDirective } from './ref.js';
export { handleIfChain, getNextContiguousElementSibling, getPreviousContiguousSibling, type IfBranch } from './if.js';
export { handleForLoop, type LoopBlock } from './for.js';

const directiveRegistry = new Map<string, DirectiveHandler>();

export function registerDirective(name: string, handler: DirectiveHandler) {
  if (directiveRegistry.has(name)) {
    throw new Error(`Directive ${name} is already registered`);
  }
  directiveRegistry.set(name, handler);
}

export function getDirective(name: string): DirectiveHandler | undefined {
  return directiveRegistry.get(name);
}

export function executeDirective(name: string, context: DirectiveContext) {
  const handler = directiveRegistry.get(name);
  if (!handler) throw new Error(`Unknown directive: ${name}`);
  return handler(context);
}

registerDirective('text', textDirective);
registerDirective('show', showDirective);
registerDirective('bind', bindDirective);
registerDirective('model', modelDirective);
registerDirective('on', onDirective);
registerDirective('ref', refDirective);
