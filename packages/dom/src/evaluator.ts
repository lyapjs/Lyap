/**
 * Safe, sandboxed AST micro-evaluator for LyapJs expressions.
 * 100% CSP compliant — zero use of eval() or new Function().
 */

export interface EvaluationContext {
  scope: Record<string, any>;
  event?: Event;
  element?: Element;
  form?: Record<string, any>;
  refs?: Record<string, Element>;
  nextTick?: () => Promise<void>;
}

const BANNED_IDENTIFIERS = new Set([
  'window',
  'document',
  'globalThis',
  'fetch',
  'XMLHttpRequest',
  'cookie',
  'localStorage',
  'sessionStorage',
  'location'
]);

export interface Token {
  type: 'IDENT' | 'NUMBER' | 'STRING' | 'BOOLEAN' | 'NULL' | 'UNDEFINED' | 'PUNCT' | 'OP' | 'EOF';
  value: string;
}

export function tokenize(input: string): Token[] {
  let str = input.trim();
  // Strip leading colon if present
  if (str.startsWith(':')) {
    str = str.slice(1).trim();
  }

  const tokens: Token[] = [];
  let i = 0;

  while (i < str.length) {
    const ch = str[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // String literals ('...' or "..." or `...`)
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      let val = '';
      i++;
      while (i < str.length && str[i] !== quote) {
        if (str[i] === '\\' && i + 1 < str.length) {
          i++;
          val += str[i];
        } else {
          val += str[i];
        }
        i++;
      }
      i++; // Skip closing quote
      tokens.push({ type: 'STRING', value: val });
      continue;
    }

    // Numbers
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(str[i + 1] || ''))) {
      let numStr = '';
      while (i < str.length && (/\d/.test(str[i]) || str[i] === '.')) {
        numStr += str[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = '';
      while (i < str.length && /[a-zA-Z0-9_$]/.test(str[i])) {
        ident += str[i];
        i++;
      }

      if (ident === 'true' || ident === 'false') {
        tokens.push({ type: 'BOOLEAN', value: ident });
      } else if (ident === 'null') {
        tokens.push({ type: 'NULL', value: 'null' });
      } else if (ident === 'undefined') {
        tokens.push({ type: 'UNDEFINED', value: 'undefined' });
      } else {
        tokens.push({ type: 'IDENT', value: ident });
      }
      continue;
    }

    // Multi-character operators
    const two = str.slice(i, i + 3);
    const twoShort = str.slice(i, i + 2);

    if (['===', '!=='].includes(two)) {
      tokens.push({ type: 'OP', value: two });
      i += 3;
      continue;
    }

    if (['==', '!=', '<=', '>=', '&&', '||', '??', '++', '--', '+=', '-='].includes(twoShort)) {
      tokens.push({ type: 'OP', value: twoShort });
      i += 2;
      continue;
    }

    // Single-character punctuation & operators
    if ('+-*/%!<>=?:,.(){}[]'.includes(ch)) {
      if ('+-*/%!<>=?'.includes(ch)) {
        tokens.push({ type: 'OP', value: ch });
      } else {
        tokens.push({ type: 'PUNCT', value: ch });
      }
      i++;
      continue;
    }

    i++; // Fallback skip invalid char
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

export function evaluateExpression(expression: string, context: EvaluationContext): any {
  const trimmed = expression.trim();
  if (!trimmed) return undefined;

  const tokens = tokenize(trimmed);
  let pos = 0;

  function peek(): Token {
    return tokens[pos] || { type: 'EOF', value: '' };
  }

  function consume(): Token {
    const tok = peek();
    pos++;
    return tok;
  }

  function unwrap(val: any): any {
    if (val && typeof val === 'object' && 'get' in val && typeof val.get === 'function') {
      return val.get();
    }
    return val;
  }

  function parseExpression(): any {
    return parseAssignment();
  }

  function parseAssignment(): any {
    const left = parseTernary();

    if (peek().type === 'OP' && ['=', '+=', '-='].includes(peek().value)) {
      const op = consume().value;
      const right = unwrap(parseAssignment());

      if (left && typeof left === 'object' && 'set' in left && typeof left.set === 'function') {
        let newVal = right;
        if (op === '+=') newVal = unwrap(left) + right;
        if (op === '-=') newVal = unwrap(left) - right;
        left.set(newVal);
        return newVal;
      }
    }

    return left;
  }

  function parseTernary(): any {
    let cond = parseLogicalOr();

    if (peek().type === 'OP' && peek().value === '?') {
      consume(); // consume ?
      const consequent = parseExpression();
      if (peek().type === 'PUNCT' && peek().value === ':') {
        consume(); // consume :
      }
      const alternate = parseExpression();
      return unwrap(cond) ? consequent : alternate;
    }

    return cond;
  }

  function parseLogicalOr(): any {
    let left = parseLogicalAnd();
    while (peek().type === 'OP' && peek().value === '||') {
      consume();
      const right = parseLogicalAnd();
      const lVal = unwrap(left);
      const rVal = unwrap(right);
      left = lVal || rVal;
    }
    return left;
  }

  function parseLogicalAnd(): any {
    let left = parseEquality();
    while (peek().type === 'OP' && peek().value === '&&') {
      consume();
      const right = parseEquality();
      const lVal = unwrap(left);
      const rVal = unwrap(right);
      left = lVal && rVal;
    }
    return left;
  }

  function parseEquality(): any {
    let left = parseRelational();
    while (peek().type === 'OP' && ['==', '===', '!=', '!=='].includes(peek().value)) {
      const op = consume().value;
      const right = parseRelational();
      const lVal = unwrap(left);
      const rVal = unwrap(right);
      if (op === '==') left = lVal == rVal;
      if (op === '===') left = lVal === rVal;
      if (op === '!=') left = lVal != rVal;
      if (op === '!==') left = lVal !== rVal;
    }
    return left;
  }

  function parseRelational(): any {
    let left = parseAdditive();
    while (peek().type === 'OP' && ['<', '>', '<=', '>='].includes(peek().value)) {
      const op = consume().value;
      const right = parseAdditive();
      const lVal = unwrap(left);
      const rVal = unwrap(right);
      if (op === '<') left = lVal < rVal;
      if (op === '>') left = lVal > rVal;
      if (op === '<=') left = lVal <= rVal;
      if (op === '>=') left = lVal >= rVal;
    }
    return left;
  }

  function parseAdditive(): any {
    let left = parseMultiplicative();
    while (peek().type === 'OP' && ['+', '-'].includes(peek().value)) {
      const op = consume().value;
      const right = parseMultiplicative();
      const lVal = unwrap(left);
      const rVal = unwrap(right);
      if (op === '+') left = lVal + rVal;
      if (op === '-') left = lVal - rVal;
    }
    return left;
  }

  function parseMultiplicative(): any {
    let left = parseUnary();
    while (peek().type === 'OP' && ['*', '/', '%'].includes(peek().value)) {
      const op = consume().value;
      const right = parseUnary();
      const lVal = unwrap(left);
      const rVal = unwrap(right);
      if (op === '*') left = lVal * rVal;
      if (op === '/') left = lVal / rVal;
      if (op === '%') left = lVal % rVal;
    }
    return left;
  }

  function parseUnary(): any {
    if (peek().type === 'OP' && ['!', '-', '+'].includes(peek().value)) {
      const op = consume().value;
      const operand = unwrap(parseUnary());
      if (op === '!') return !operand;
      if (op === '-') return -operand;
      if (op === '+') return +operand;
    }

    return parsePostfix();
  }

  function parsePostfix(): any {
    const left = parseMember();

    if (peek().type === 'OP' && ['++', '--'].includes(peek().value)) {
      const op = consume().value;
      if (left && typeof left === 'object' && 'get' in left && 'set' in left) {
        const cur = left.get();
        const next = op === '++' ? cur + 1 : cur - 1;
        left.set(next);
        return cur;
      }
    }

    return left;
  }

  function parseMember(): any {
    let objRef = parsePrimary();

    while (true) {
      if (peek().type === 'PUNCT' && peek().value === '.') {
        consume(); // consume .
        const propToken = consume();
        if (propToken.type !== 'IDENT') throw new Error('Expected identifier after .');

        const propName = propToken.value;
        if (['__proto__', 'constructor', 'prototype'].includes(propName)) {
          throw new Error(`Forbidden property access: ${propName}`);
        }

        const parentRef = objRef;

        // Function call (e.g. obj.method())
        if (peek().type === 'PUNCT' && peek().value === '(') {
          consume(); // consume (
          const args: any[] = [];
          if (peek().type !== 'PUNCT' || peek().value !== ')') {
            while (true) {
              const arg = unwrap(parseExpression());
              args.push(arg);
              if (peek().type === 'PUNCT' && peek().value === ',') {
                consume();
              } else {
                break;
              }
            }
          }
          if (peek().type === 'PUNCT' && peek().value === ')') consume();

          const currentObj = unwrap(parentRef);
          const method = currentObj?.[propName];
          if (typeof method === 'function') {
            objRef = method.apply(currentObj, args);
          } else {
            objRef = undefined;
          }
        } else {
          objRef = {
            get: () => unwrap(parentRef)?.[propName],
            set: (v: any) => {
              const targetObj = unwrap(parentRef);
              if (targetObj) targetObj[propName] = v;
            }
          };
        }
      } else if (peek().type === 'PUNCT' && peek().value === '[') {
        consume(); // consume [
        const keyExpr = unwrap(parseExpression());
        if (peek().type === 'PUNCT' && peek().value === ']') consume();

        if (['__proto__', 'constructor', 'prototype'].includes(String(keyExpr))) {
          throw new Error(`Forbidden key access: ${keyExpr}`);
        }

        const parentRef = objRef;
        objRef = {
          get: () => unwrap(parentRef)?.[keyExpr],
          set: (v: any) => {
            const targetObj = unwrap(parentRef);
            if (targetObj) targetObj[keyExpr] = v;
          }
        };
      } else {
        break;
      }
    }

    return objRef;
  }

  function parsePrimary(): any {
    const tok = peek();

    if (tok.type === 'NUMBER') {
      consume();
      return Number(tok.value);
    }
    if (tok.type === 'STRING') {
      consume();
      return tok.value;
    }
    if (tok.type === 'BOOLEAN') {
      consume();
      return tok.value === 'true';
    }
    if (tok.type === 'NULL') {
      consume();
      return null;
    }
    if (tok.type === 'UNDEFINED') {
      consume();
      return undefined;
    }

    if (tok.type === 'IDENT') {
      consume();
      const name = tok.value;

      if (BANNED_IDENTIFIERS.has(name)) {
        throw new Error(`Forbidden identifier in Lyap expression: ${name}`);
      }

      // Check Magic Variables
      if (name === '$event') return context.event;
      if (name === '$el') return context.element;
      if (name === '$scope') return context.scope;
      if (name === '$form') return context.form;
      if (name === '$refs') return context.refs;
      if (name === '$nextTick') return context.nextTick;

      // Function call e.g. increment() or save()
      if (peek().type === 'PUNCT' && peek().value === '(') {
        consume(); // consume (
        const args: any[] = [];
        if (peek().type !== 'PUNCT' || peek().value !== ')') {
          while (true) {
            const arg = unwrap(parseExpression());
            args.push(arg);
            if (peek().type === 'PUNCT' && peek().value === ',') {
              consume();
            } else {
              break;
            }
          }
        }
        if (peek().type === 'PUNCT' && peek().value === ')') consume();

        const fn = context.scope?.[name];
        if (typeof fn === 'function') {
          return fn.apply(context.scope, args);
        }
        return undefined;
      }

      return {
        get: () => context.scope?.[name],
        set: (v: any) => {
          if (context.scope) context.scope[name] = v;
        }
      };
    }

    // Grouping ( expr )
    if (tok.type === 'PUNCT' && tok.value === '(') {
      consume();
      const expr = parseExpression();
      if (peek().type === 'PUNCT' && peek().value === ')') consume();
      return expr;
    }

    // Object Literal { a: 1, b: 2 }
    if (tok.type === 'PUNCT' && tok.value === '{') {
      consume();
      const obj: Record<string, any> = {};
      if (peek().type !== 'PUNCT' || peek().value !== '}') {
        while (true) {
          const keyTok = consume();
          const key = keyTok.value;
          if (peek().type === 'PUNCT' && peek().value === ':') consume();
          const valExpr = unwrap(parseExpression());
          obj[key] = valExpr;
          if (peek().type === 'PUNCT' && peek().value === ',') {
            consume();
          } else {
            break;
          }
        }
      }
      if (peek().type === 'PUNCT' && peek().value === '}') consume();
      return obj;
    }

    // Array Literal [1, 2, 3]
    if (tok.type === 'PUNCT' && tok.value === '[') {
      consume();
      const arr: any[] = [];
      if (peek().type !== 'PUNCT' || peek().value !== ']') {
        while (true) {
          const valExpr = unwrap(parseExpression());
          arr.push(valExpr);
          if (peek().type === 'PUNCT' && peek().value === ',') {
            consume();
          } else {
            break;
          }
        }
      }
      if (peek().type === 'PUNCT' && peek().value === ']') consume();
      return arr;
    }

    return undefined;
  }

  const result = parseExpression();
  return unwrap(result);
}

export function executeStatement(expression: string, context: EvaluationContext): any {
  return evaluateExpression(expression, context);
}
