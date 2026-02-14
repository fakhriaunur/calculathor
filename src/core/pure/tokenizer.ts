/**
 * Core Domain Tokenizer
 * Pure function for lexical analysis of mathematical expressions
 */

export type TokenType =
  | 'NUMBER'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

export interface SourcePosition {
  offset: number;
  line: number;
  column: number;
}

export interface Token {
  type: TokenType;
  value: string;
  position: SourcePosition;
}

// Double-character operators
const DOUBLE_CHAR_OPS = new Set(['==', '!=', '<=', '>=']);
// Single-character operators
const SINGLE_CHAR_OPS = new Set(['+', '-', '*', '/', '%', '^', '<', '>']);
// Valid identifier start characters
const IDENT_START = /[a-zA-Z_]/;
// Valid identifier characters
const IDENT_CHAR = /[a-zA-Z0-9_]/;
// Digit characters
const DIGIT = /[0-9]/;

/**
 * Tokenize an expression string into tokens
 * Pure function - no side effects
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;
  let line = 1;
  let column = 1;

  function currentPos(): SourcePosition {
    return { offset, line, column };
  }

  function advance(): string {
    const char = input[offset];
    offset++;
    if (char === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
    return char;
  }

  function peek(n = 0): string | undefined {
    return input[offset + n] ?? undefined;
  }

  while (offset < input.length) {
    const char = peek();

    if (char === undefined) {
      break;
    }

    // Skip whitespace
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      advance();
      continue;
    }

    const pos = currentPos();

    // Numbers
    if (DIGIT.test(char) || (char === '.' && DIGIT.test(peek(1) ?? ''))) {
      let value = '';
      let hasDot = false;

      while (offset < input.length) {
        const c = peek();
        if (c === undefined) break;

        if (DIGIT.test(c)) {
          value += advance();
        } else if (c === '.' && !hasDot) {
          hasDot = true;
          value += advance();
        } else if ((c === 'e' || c === 'E') && (peek(1) === '-' || peek(1) === '+' || DIGIT.test(peek(1) ?? ''))) {
          value += advance(); // e
          if (peek() === '-' || peek() === '+') {
            value += advance(); // sign
          }
          while (offset < input.length && DIGIT.test(peek() ?? '')) {
            value += advance();
          }
        } else {
          break;
        }
      }

      tokens.push({ type: 'NUMBER', value, position: pos });
      continue;
    }

    // Identifiers
    if (IDENT_START.test(char)) {
      let value = '';
      while (offset < input.length) {
        const c = peek();
        if (c === undefined || !IDENT_CHAR.test(c)) {
          break;
        }
        value += advance();
      }

      tokens.push({ type: 'IDENTIFIER', value, position: pos });
      continue;
    }

    // Double-character operators
    const twoChars = char + (peek(1) ?? '');
    if (DOUBLE_CHAR_OPS.has(twoChars)) {
      advance();
      advance();
      tokens.push({ type: 'OPERATOR', value: twoChars, position: pos });
      continue;
    }

    // Single-character operators
    if (SINGLE_CHAR_OPS.has(char)) {
      advance();
      tokens.push({ type: 'OPERATOR', value: char, position: pos });
      continue;
    }

    // Parentheses and comma
    if (char === '(') {
      advance();
      tokens.push({ type: 'LPAREN', value: char, position: pos });
      continue;
    }

    if (char === ')') {
      advance();
      tokens.push({ type: 'RPAREN', value: char, position: pos });
      continue;
    }

    if (char === ',') {
      advance();
      tokens.push({ type: 'COMMA', value: char, position: pos });
      continue;
    }

    // Unknown character
    throw new Error(
      `Unexpected character '${char}' at line ${pos.line}, column ${pos.column}`
    );
  }

  // Add EOF token
  tokens.push({
    type: 'EOF',
    value: '',
    position: currentPos(),
  });

  return tokens;
}

/**
 * Tokenize with error recovery - returns Result type
 */
import { Result, ok, err } from '../../shared/utils/result';

export function tokenizeSafe(input: string): Result<Token[], Error> {
  try {
    return ok(tokenize(input));
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Format tokens for debugging
 */
export function formatTokens(tokens: Token[]): string {
  return tokens
    .map((t) => `${t.type}(${t.value})`)
    .join(' ');
}
