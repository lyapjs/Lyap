import { IS_LYAP_ACTION } from './scope.js';
import type { EvaluationContext, Reference, ParsedForExpression } from './types.js';

export type { EvaluationContext, Reference, ParsedForExpression } from './types.js';

const forbidden = new Set([
  'window',
  'document',
  'globalThis',
  'location',
  'cookie',
  'localStorage',
  'sessionStorage',
  'constructor',
  'prototype',
  '__proto__'
]);

type Token = { type: 'value' | 'identifier' | 'operator' | 'punctuation' | 'eof'; value: any };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index]!;
    if (/\s/.test(char)) {
      index++;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      let value = '';
      index++;
      while (index < input.length && input[index] !== quote) {
        if (input[index] === '\\' && index + 1 < input.length) index++;
        value += input[index++]!;
      }
      if (input[index] !== quote) throw new Error('Unterminated string literal');
      index++;
      tokens.push({ type: 'value', value });
      continue;
    }

    if (/\d/.test(char) || (char === '.' && /\d/.test(input[index + 1] ?? ''))) {
      let value = '';
      while (index < input.length && /[\d.]/.test(input[index]!)) value += input[index++]!;
      tokens.push({ type: 'value', value: Number(value) });
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      let value = '';
      while (index < input.length && /[A-Za-z0-9_$]/.test(input[index]!)) value += input[index++]!;
      tokens.push({ type: 'identifier', value });
      continue;
    }

    const three = input.slice(index, index + 3);
    const two = input.slice(index, index + 2);
    if (['===', '!=='].includes(three)) {
      tokens.push({ type: 'operator', value: three });
      index += 3;
      continue;
    }
    if (['==', '!=', '<=', '>=', '&&', '||', '??', '++', '--', '+=', '-='].includes(two)) {
      tokens.push({ type: 'operator', value: two });
      index += 2;
      continue;
    }
    if ('+-*/%!<>=?:,.()[]'.includes(char)) {
      tokens.push({ type: '+-*/%!<>=?'.includes(char) ? 'operator' : 'punctuation', value: char });
      index++;
      continue;
    }

    throw new Error(`Unexpected character: ${char}`);
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

function unwrap(value: any): any {
  return value && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value;
}

export function isAssignableReference(ref: any): ref is Reference {
  return ref && typeof ref === 'object' && typeof ref.get === 'function' && typeof ref.set === 'function' && ref.isAssignable !== false;
}

export function getExpressionReference(expression: string, context: EvaluationContext): Reference {
  const source = expression.trim().replace(/^:/, '').trim();
  if (!source) throw new Error('Expression is empty');
  const tokens = tokenize(source);
  let position = 0;

  const peek = () => tokens[position]!;
  const consume = () => tokens[position++]!;

  function parseMemberAccess(): any {
    const primary = parsePrimaryToken();
    let curr = primary;
    while (peek().value === '.' || peek().value === '[') {
      let property: string | number;
      if (consume().value === '.') {
        const token = consume();
        if (token.type !== 'identifier') throw new Error('Expected property name');
        property = token.value;
      } else {
        property = evaluateParsedExpression();
        if (consume().value !== ']') throw new Error('Expected ]');
      }
      if (forbidden.has(String(property))) throw new Error(`Forbidden property: ${String(property)}`);
      const parent = curr;
      curr = {
        get: () => unwrap(parent)?.[property],
        set: (next: any) => {
          const target = unwrap(parent);
          if (target == null) throw new Error(`Cannot set property ${String(property)} on nullish value`);
          target[property] = next;
        },
        isAssignable: true
      } satisfies Reference;
    }
    return curr;
  }

  function parsePrimaryToken(): any {
    const token = consume();
    if (token.type === 'identifier') {
      if (forbidden.has(token.value)) throw new Error(`Forbidden identifier: ${token.value}`);
      if (context.locals && token.value in context.locals) {
        return {
          get: () => context.locals![token.value],
          set: (v: any) => { context.locals![token.value] = v; },
          isAssignable: true
        } satisfies Reference;
      }
      const scope = context.resolveScope(token.value);
      if (scope !== undefined) {
        return {
          get: () => scope,
          set: () => { throw new Error('Scope handles are not assignable'); },
          isAssignable: false
        } satisfies Reference;
      }
    }
    throw new Error('Expression must be a property reference path');
  }

  function evaluateParsedExpression(): any {
    return evaluateExpression(expression, context);
  }

  const res = parseMemberAccess();
  if (!isAssignableReference(res)) throw new Error('Target expression is not assignable');
  return res;
}

export function evaluateExpression(expression: string, context: EvaluationContext): any {
  const source = expression.trim().replace(/^:/, '').trim();
  if (!source) return undefined;
  const tokens = tokenize(source);
  let position = 0;

  const peek = () => tokens[position]!;
  const consume = () => tokens[position++]!;

  function parseExpression(): any {
    return parseAssignment();
  }

  function parseAssignment(): any {
    const left = parseTernary();
    const token = peek();
    if (token.type === 'operator' && ['=', '+=', '-='].includes(token.value)) {
      consume();
      const right = unwrap(parseAssignment());
      if (!isAssignableReference(left)) throw new Error('Expression is not assignable');
      const current = unwrap(left);
      left.set(token.value === '=' ? right : token.value === '+=' ? current + right : current - right);
      return right;
    }
    return left;
  }

  function parseTernary(): any {
    const condition = parseLogicalOr();
    if (peek().value !== '?') return condition;
    consume();
    const consequent = parseExpression();
    if (consume().value !== ':') throw new Error('Expected : in ternary expression');
    const alternate = parseExpression();
    return unwrap(condition) ? consequent : alternate;
  }

  function parseLogicalOr(): any {
    let left = parseLogicalAnd();
    while (peek().value === '||' || peek().value === '??') {
      const operator = consume().value;
      const right = parseLogicalAnd();
      const current = unwrap(left);
      left = operator === '||' ? current || unwrap(right) : current ?? unwrap(right);
    }
    return left;
  }

  function parseLogicalAnd(): any {
    let left = parseEquality();
    while (peek().value === '&&') {
      consume();
      left = unwrap(left) && unwrap(parseEquality());
    }
    return left;
  }

  function parseEquality(): any {
    let left = parseRelational();
    while (['==', '===', '!=', '!=='].includes(peek().value)) {
      const operator = consume().value;
      const right = unwrap(parseRelational());
      const current = unwrap(left);
      left = operator === '==' ? current == right : operator === '===' ? current === right : operator === '!=' ? current != right : current !== right;
    }
    return left;
  }

  function parseRelational(): any {
    let left = parseAdditive();
    while (['<', '>', '<=', '>='].includes(peek().value)) {
      const operator = consume().value;
      const right = unwrap(parseAdditive());
      const current = unwrap(left);
      left = operator === '<' ? current < right : operator === '>' ? current > right : operator === '<=' ? current <= right : current >= right;
    }
    return left;
  }

  function parseAdditive(): any {
    let left = parseMultiplicative();
    while (peek().value === '+' || peek().value === '-') {
      const operator = consume().value;
      const right = unwrap(parseMultiplicative());
      left = operator === '+' ? unwrap(left) + right : unwrap(left) - right;
    }
    return left;
  }

  function parseMultiplicative(): any {
    let left = parseUnary();
    while (['*', '/', '%'].includes(peek().value)) {
      const operator = consume().value;
      const right = unwrap(parseUnary());
      const current = unwrap(left);
      left = operator === '*' ? current * right : operator === '/' ? current / right : current % right;
    }
    return left;
  }

  function parseUnary(): any {
    if (['!', '+', '-'].includes(peek().value)) {
      const operator = consume().value;
      const value = unwrap(parseUnary());
      return operator === '!' ? !value : operator === '+' ? +value : -value;
    }
    return parsePostfix();
  }

  function parsePostfix(): any {
    const reference = parseMember();
    if (peek().value === '++' || peek().value === '--') {
      const operator = consume().value;
      if (!isAssignableReference(reference)) throw new Error('Expression is not assignable');
      const current = unwrap(reference);
      reference.set(operator === '++' ? current + 1 : current - 1);
      return current;
    }
    return reference;
  }

  function parseMember(): any {
    let value = parsePrimary();
    while (peek().value === '.' || peek().value === '[') {
      let property: string | number;
      if (consume().value === '.') {
        const token = consume();
        if (token.type !== 'identifier') throw new Error('Expected property name');
        property = token.value;
      } else {
        property = unwrap(parseExpression());
        if (consume().value !== ']') throw new Error('Expected ]');
      }
      if (forbidden.has(String(property))) throw new Error(`Forbidden property: ${String(property)}`);
      const parent = value;
      value = {
        get: () => unwrap(parent)?.[property],
        set: (next: any) => {
          const target = unwrap(parent);
          if (target == null) throw new Error(`Cannot set property ${String(property)} on nullish value`);
          target[property] = next;
        },
        isAssignable: true
      } satisfies Reference;
      if (peek().value === '(') value = callReference(value);
    }
    return value;
  }

  function callReference(reference: any): any {
    consume();
    const args: any[] = [];
    if (peek().value !== ')') {
      while (true) {
        args.push(unwrap(parseExpression()));
        if (peek().value !== ',') break;
        consume();
      }
    }
    if (consume().value !== ')') throw new Error('Expected )');
    const target = unwrap(reference);
    const isAction = typeof target === 'function' && (Boolean((target as any)[IS_LYAP_ACTION]) || Boolean(reference?.isAction));
    if (!isAction) throw new Error('Only registered actions may be called');
    return target(...args);
  }

  function parsePrimary(): any {
    const token = consume();
    if (token.type === 'value') return token.value;
    if (token.type === 'identifier') {
      if (forbidden.has(token.value)) throw new Error(`Forbidden identifier: ${token.value}`);
      if (token.value === 'true') return true;
      if (token.value === 'false') return false;
      if (token.value === 'null') return null;
      if (token.value === 'undefined') return undefined;

      if (context.locals && token.value in context.locals) {
        return {
          get: () => context.locals![token.value],
          set: (v: any) => { context.locals![token.value] = v; },
          isAssignable: true
        } satisfies Reference;
      }

      if (token.value === '$event') return context.event;
      if (token.value === '$el') return context.element;
      if (token.value === '$refs') return context.refs ?? {};
      if (token.value === '$form') return context.element?.closest('form') ?? undefined;
      if (token.value === '$nextTick') return context.nextTick;

      const scope = context.resolveScope(token.value);
      if (scope === undefined) throw new Error(`Unknown variable or scope: ${token.value}`);
      return {
        get: () => scope,
        set: () => { throw new Error('Scope handles are not assignable'); },
        isAssignable: false
      } satisfies Reference;
    }
    if (token.value === '(') {
      const value = parseExpression();
      if (consume().value !== ')') throw new Error('Expected )');
      return value;
    }
    throw new Error(`Unexpected token: ${String(token.value)}`);
  }

  const result = parseExpression();
  if (peek().type !== 'eof') throw new Error(`Unexpected token: ${String(peek().value)}`);
  return unwrap(result);
}

export function parseForExpression(expression: string): ParsedForExpression {
  const trimmed = expression.trim();
  const match = trimmed.match(/^(?:\(([^)]+)\)|([A-Za-z_$][A-Za-z0-9_$]*))\s+in\s+(.+)$/);
  if (!match) throw new Error(`Invalid ly-for expression: ${expression}`);

  let itemVar = '';
  let var2: string | undefined;
  let var3: string | undefined;
  const collectionExpr = match[3]!.trim();

  if (match[2]) {
    itemVar = match[2].trim();
  } else if (match[1]) {
    const parts = match[1].split(',').map((s) => s.trim());
    if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p))) {
      throw new Error(`Invalid loop variables in ly-for: ${expression}`);
    }
    itemVar = parts[0]!;
    var2 = parts[1];
    var3 = parts[2];
  }

  return { itemVar, var2, var3, collectionExpr };
}

