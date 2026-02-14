/**
 * Tokenizer tests for Calculathor expression parser
 * Following TDD approach - tests define the requirements
 */

import { describe, it, expect } from 'bun:test';
import { tokenize, Token, TokenType } from '../src/parser/tokenizer';

function tokenSummary(tokens: Token[]): Array<{ type: string; value: string }> {
  return tokens.map(t => ({ type: t.type, value: t.value }));
}

describe('Tokenizer', () => {
  describe('basic tokens', () => {
    it('tokenizes a single number', () => {
      const tokens = tokenize('42');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'NUMBER', value: '42' },
        { type: 'EOF', value: '' }
      ]);
    });

    it('tokenizes a simple expression', () => {
      const tokens = tokenize('2 + 3');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'NUMBER', value: '2' },
        { type: 'OPERATOR', value: '+' },
        { type: 'NUMBER', value: '3' },
        { type: 'EOF', value: '' }
      ]);
    });

    it('tokenizes multiple operators', () => {
      const tokens = tokenize('2 + 3 * 4 - 5 / 2');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'NUMBER', value: '2' },
        { type: 'OPERATOR', value: '+' },
        { type: 'NUMBER', value: '3' },
        { type: 'OPERATOR', value: '*' },
        { type: 'NUMBER', value: '4' },
        { type: 'OPERATOR', value: '-' },
        { type: 'NUMBER', value: '5' },
        { type: 'OPERATOR', value: '/' },
        { type: 'NUMBER', value: '2' },
        { type: 'EOF', value: '' }
      ]);
    });
  });

  describe('numbers', () => {
    it('tokenizes integers', () => {
      const tokens = tokenize('123');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('123');
    });

    it('tokenizes decimals', () => {
      const tokens = tokenize('3.14159');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('3.14159');
    });

    it('tokenizes scientific notation', () => {
      const tokens = tokenize('1e10');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('1e10');
    });

    it('tokenizes scientific notation with negative exponent', () => {
      const tokens = tokenize('2.5e-3');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('2.5e-3');
    });

    it('tokenizes scientific notation with positive exponent', () => {
      const tokens = tokenize('1.5e+5');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('1.5e+5');
    });

    it('tokenizes decimal with scientific notation', () => {
      const tokens = tokenize('6.022e23');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('6.022e23');
    });

    it('handles number starting with dot', () => {
      const tokens = tokenize('.5');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('0.5');
    });

    it('handles number with dot but no fraction', () => {
      const tokens = tokenize('5.');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('5');
    });
  });

  describe('operators', () => {
    it('tokenizes all single-character operators', () => {
      const ops = ['+', '-', '*', '/', '^', '%', '<', '>'];
      for (const op of ops) {
        const tokens = tokenize(op);
        expect(tokens[0].type).toBe('OPERATOR');
        expect(tokens[0].value).toBe(op);
      }
    });

    it('tokenizes two-character comparison operators', () => {
      const ops = ['==', '!=', '<=', '>='];
      for (const op of ops) {
        const tokens = tokenize(op);
        expect(tokens[0].type).toBe('OPERATOR');
        expect(tokens[0].value).toBe(op);
      }
    });

    it('uses ^ for exponentiation (not **)', () => {
      const tokens = tokenize('2^3');
      expect(tokens[1].type).toBe('OPERATOR');
      expect(tokens[1].value).toBe('^');
    });

    it('tokenizes ** as two separate * operators', () => {
      const tokens = tokenize('**');
      expect(tokens[0].type).toBe('OPERATOR');
      expect(tokens[0].value).toBe('*');
      expect(tokens[1].type).toBe('OPERATOR');
      expect(tokens[1].value).toBe('*');
    });
  });

  describe('identifiers', () => {
    it('tokenizes simple identifiers', () => {
      const tokens = tokenize('x');
      expect(tokens[0].type).toBe('IDENTIFIER');
      expect(tokens[0].value).toBe('x');
    });

    it('tokenizes function names', () => {
      const tokens = tokenize('sin cos log');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'IDENTIFIER', value: 'sin' },
        { type: 'IDENTIFIER', value: 'cos' },
        { type: 'IDENTIFIER', value: 'log' },
        { type: 'EOF', value: '' }
      ]);
    });

    it('tokenizes identifiers with underscores', () => {
      const tokens = tokenize('my_var _temp');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'IDENTIFIER', value: 'my_var' },
        { type: 'IDENTIFIER', value: '_temp' },
        { type: 'EOF', value: '' }
      ]);
    });

    it('tokenizes identifiers with numbers', () => {
      const tokens = tokenize('x1 y2z');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'IDENTIFIER', value: 'x1' },
        { type: 'IDENTIFIER', value: 'y2z' },
        { type: 'EOF', value: '' }
      ]);
    });
  });

  describe('punctuation', () => {
    it('tokenizes parentheses', () => {
      const tokens = tokenize('()');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'LPAREN', value: '(' },
        { type: 'RPAREN', value: ')' },
        { type: 'EOF', value: '' }
      ]);
    });

    it('tokenizes comma', () => {
      const tokens = tokenize(',');
      expect(tokens[0].type).toBe('COMMA');
      expect(tokens[0].value).toBe(',');
    });
  });

  describe('complex expressions', () => {
    it('tokenizes function call', () => {
      const tokens = tokenize('sin(pi/2)');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'IDENTIFIER', value: 'sin' },
        { type: 'LPAREN', value: '(' },
        { type: 'IDENTIFIER', value: 'pi' },
        { type: 'OPERATOR', value: '/' },
        { type: 'NUMBER', value: '2' },
        { type: 'RPAREN', value: ')' },
        { type: 'EOF', value: '' }
      ]);
    });

    it('tokenizes multi-argument function', () => {
      const tokens = tokenize('atan2(1, 2)');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'IDENTIFIER', value: 'atan2' },
        { type: 'LPAREN', value: '(' },
        { type: 'NUMBER', value: '1' },
        { type: 'COMMA', value: ',' },
        { type: 'NUMBER', value: '2' },
        { type: 'RPAREN', value: ')' },
        { type: 'EOF', value: '' }
      ]);
    });

    it('tokenizes chained operations', () => {
      const tokens = tokenize('2 + 3 * 4');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'NUMBER', value: '2' },
        { type: 'OPERATOR', value: '+' },
        { type: 'NUMBER', value: '3' },
        { type: 'OPERATOR', value: '*' },
        { type: 'NUMBER', value: '4' },
        { type: 'EOF', value: '' }
      ]);
    });

    it('tokenizes exponentiation', () => {
      const tokens = tokenize('2^3^2');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'NUMBER', value: '2' },
        { type: 'OPERATOR', value: '^' },
        { type: 'NUMBER', value: '3' },
        { type: 'OPERATOR', value: '^' },
        { type: 'NUMBER', value: '2' },
        { type: 'EOF', value: '' }
      ]);
    });

    it('tokenizes comparison expression', () => {
      const tokens = tokenize('x <= 10');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'IDENTIFIER', value: 'x' },
        { type: 'OPERATOR', value: '<=' },
        { type: 'NUMBER', value: '10' },
        { type: 'EOF', value: '' }
      ]);
    });
  });

  describe('whitespace handling', () => {
    it('skips spaces', () => {
      const tokens = tokenize('1   +   2');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'NUMBER', value: '1' },
        { type: 'OPERATOR', value: '+' },
        { type: 'NUMBER', value: '2' },
        { type: 'EOF', value: '' }
      ]);
    });

    it('skips tabs', () => {
      const tokens = tokenize('1\t+\t2');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'NUMBER', value: '1' },
        { type: 'OPERATOR', value: '+' },
        { type: 'NUMBER', value: '2' },
        { type: 'EOF', value: '' }
      ]);
    });

    it('skips mixed whitespace', () => {
      const tokens = tokenize('1 \t \n + \r\n 2');
      expect(tokenSummary(tokens)).toEqual([
        { type: 'NUMBER', value: '1' },
        { type: 'OPERATOR', value: '+' },
        { type: 'NUMBER', value: '2' },
        { type: 'EOF', value: '' }
      ]);
    });
  });

  describe('position tracking', () => {
    it('tracks line and column', () => {
      const tokens = tokenize('2 + 3');

      expect(tokens[0]).toMatchObject({ type: 'NUMBER', line: 1, column: 1 });
      expect(tokens[1]).toMatchObject({ type: 'OPERATOR', line: 1, column: 3 });
      expect(tokens[2]).toMatchObject({ type: 'NUMBER', line: 1, column: 5 });
    });

    it('tracks positions across multiple lines', () => {
      const tokens = tokenize('2\n+\n3');

      expect(tokens[0]).toMatchObject({ type: 'NUMBER', line: 1, column: 1 });
      expect(tokens[1]).toMatchObject({ type: 'OPERATOR', line: 2, column: 1 });
      expect(tokens[2]).toMatchObject({ type: 'NUMBER', line: 3, column: 1 });
    });

    it('tracks absolute position', () => {
      const tokens = tokenize('2 + 3');

      expect(tokens[0].position).toBe(0);
      expect(tokens[1].position).toBe(2);
      expect(tokens[2].position).toBe(4);
    });

    it('tracks column correctly after multi-char tokens', () => {
      const tokens = tokenize('1 <= 2');

      expect(tokens[0]).toMatchObject({ type: 'NUMBER', line: 1, column: 1 });
      expect(tokens[1]).toMatchObject({ type: 'OPERATOR', line: 1, column: 3 });
      expect(tokens[2]).toMatchObject({ type: 'NUMBER', line: 1, column: 6 });
    });
  });

  describe('error handling', () => {
    it('throws on unexpected character', () => {
      expect(() => tokenize('2 @ 3')).toThrow(/Unexpected character/);
    });

    it('throws on invalid character at start', () => {
      expect(() => tokenize('$')).toThrow(/Unexpected character/);
    });

    it('includes position in error message', () => {
      expect(() => tokenize('2 + $')).toThrow(/line 1, column 5/);
    });

    it('includes line number in error message for multi-line', () => {
      expect(() => tokenize('2\n+\n$')).toThrow(/line 3/);
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const tokens = tokenize('');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('EOF');
    });

    it('handles whitespace-only string', () => {
      const tokens = tokenize('   \n\t  ');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('EOF');
    });

    it('handles very long number', () => {
      const tokens = tokenize('12345678901234567890');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('12345678901234567890');
    });

    it('handles identifier starting with underscore', () => {
      const tokens = tokenize('_private');
      expect(tokens[0].type).toBe('IDENTIFIER');
      expect(tokens[0].value).toBe('_private');
    });
  });
});
