import { describe, it, expect } from 'bun:test';
import { tokenize, formatTokens } from '../../../src/core/pure/tokenizer';

describe('Tokenizer', () => {
  describe('basic tokens', () => {
    it('tokenizes numbers', () => {
      const tokens = tokenize('42');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('42');
      expect(tokens[1].type).toBe('EOF');
    });

    it('tokenizes decimal numbers', () => {
      const tokens = tokenize('3.14159');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('3.14159');
    });

    it('tokenizes identifiers', () => {
      const tokens = tokenize('sin');
      expect(tokens[0].type).toBe('IDENTIFIER');
      expect(tokens[0].value).toBe('sin');
    });

    it('tokenizes operators', () => {
      const tokens = tokenize('+ - * /');
      expect(tokens.map(t => t.type)).toEqual(['OPERATOR', 'OPERATOR', 'OPERATOR', 'OPERATOR', 'EOF']);
    });
  });

  describe('complex expressions', () => {
    it('tokenizes simple expression', () => {
      const tokens = tokenize('2 + 3');
      expect(tokens.map(t => `${t.type}(${t.value})`)).toEqual([
        'NUMBER(2)', 'OPERATOR(+)', 'NUMBER(3)', 'EOF()'
      ]);
    });

    it('tokenizes expression with parentheses', () => {
      const tokens = tokenize('(2 + 3) * 4');
      expect(tokens.map(t => t.type)).toEqual([
        'LPAREN', 'NUMBER', 'OPERATOR', 'NUMBER', 'RPAREN', 'OPERATOR', 'NUMBER', 'EOF'
      ]);
    });

    it('tokenizes function call', () => {
      const tokens = tokenize('sin(pi)');
      expect(tokens.map(t => `${t.type}(${t.value})`)).toEqual([
        'IDENTIFIER(sin)', 'LPAREN(()', 'IDENTIFIER(pi)', 'RPAREN())', 'EOF()'
      ]);
    });

    it('tokenizes function with multiple args', () => {
      const tokens = tokenize('max(1, 2)');
      expect(tokens.map(t => t.type)).toEqual([
        'IDENTIFIER', 'LPAREN', 'NUMBER', 'COMMA', 'NUMBER', 'RPAREN', 'EOF'
      ]);
    });
  });

  describe('double-character operators', () => {
    it('tokenizes comparison operators', () => {
      const tokens = tokenize('1 == 2');
      expect(tokens[1].type).toBe('OPERATOR');
      expect(tokens[1].value).toBe('==');
    });

    it('tokenizes not-equal', () => {
      const tokens = tokenize('1 != 2');
      expect(tokens[1].value).toBe('!=');
    });

    it('tokenizes less-equal', () => {
      const tokens = tokenize('1 <= 2');
      expect(tokens[1].value).toBe('<=');
    });

    it('tokenizes greater-equal', () => {
      const tokens = tokenize('1 >= 2');
      expect(tokens[1].value).toBe('>=');
    });
  });

  describe('whitespace handling', () => {
    it('ignores spaces', () => {
      const tokens = tokenize('  42  ');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('42');
    });

    it('ignores tabs', () => {
      const tokens = tokenize('\t42\t');
      expect(tokens[0].type).toBe('NUMBER');
    });

    it('ignores newlines', () => {
      const tokens = tokenize('\n42\n');
      expect(tokens[0].type).toBe('NUMBER');
    });
  });

  describe('position tracking', () => {
    it('tracks offset', () => {
      const tokens = tokenize('2 + 3');
      expect(tokens[0].position.offset).toBe(0);
      expect(tokens[1].position.offset).toBe(2);
      expect(tokens[2].position.offset).toBe(4);
    });

    it('tracks line and column', () => {
      const tokens = tokenize('2\n+ 3');
      expect(tokens[0].position.line).toBe(1);
      expect(tokens[0].position.column).toBe(1);
      expect(tokens[1].position.line).toBe(2);
      expect(tokens[1].position.column).toBe(1);
    });
  });

  describe('scientific notation', () => {
    it('tokenizes scientific notation', () => {
      const tokens = tokenize('1e10');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('1e10');
    });

    it('tokenizes scientific notation with negative exponent', () => {
      const tokens = tokenize('1e-5');
      expect(tokens[0].value).toBe('1e-5');
    });

    it('tokenizes scientific notation with positive exponent', () => {
      const tokens = tokenize('1e+5');
      expect(tokens[0].value).toBe('1e+5');
    });
  });

  describe('error handling', () => {
    it('throws on invalid character', () => {
      expect(() => tokenize('2 @ 3')).toThrow();
    });

    it('throws with position info', () => {
      try {
        tokenize('2 @ 3');
      } catch (e: any) {
        expect(e.message).toContain('line 1');
        expect(e.message).toContain('column 3');
      }
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      const tokens = tokenize('');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('EOF');
    });

    it('handles only whitespace', () => {
      const tokens = tokenize('   ');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('EOF');
    });
  });

  describe('formatTokens', () => {
    it('formats tokens for debugging', () => {
      const tokens = tokenize('2 + 3');
      expect(formatTokens(tokens)).toBe('NUMBER(2) OPERATOR(+) NUMBER(3) EOF()');
    });
  });
});
