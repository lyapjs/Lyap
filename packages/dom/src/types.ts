import type { ScopeHandle, ScopeProxy } from './scope.js';
import type { Runtime } from './runtime.js';

export type { ScopeProxy } from './scope.js';

export type Cleanup = () => void;
export type ScopeCallback = (scope: ScopeProxy) => void | Promise<void>;

export type Root = Document | Element;
export type MountOptions = {
  onError?: ((error: unknown) => void) | undefined;
};

export type EvaluationContext = {
  resolveScope: (name: string) => any;
  element?: Element | undefined;
  event?: Event | undefined;
  refs?: Record<string, Element> | undefined;
  locals?: Record<string, any> | undefined;
  nextTick?: ((cb: () => void) => void) | undefined;
};

export type Reference = {
  get: () => any;
  set: (value: any) => void;
  isAssignable?: boolean | undefined;
  isAction?: boolean | undefined;
};

export type ParsedForExpression = {
  itemVar: string;
  var2?: string | undefined;
  var3?: string | undefined;
  collectionExpr: string;
};

export type DirectiveContext = {
  runtime: Runtime;
  scope: ScopeHandle;
  element: Element;
  attributeName: string;
  value: string;
  locals?: Record<string, any> | undefined;
};

export type DirectiveHandler = (context: DirectiveContext) => Cleanup | void;
