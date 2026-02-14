import { describe, it, expect, beforeEach } from 'bun:test';
import {
  PrattParser,
  ParseError,
  formatAST,
  type ASTNode
} from '../../../src/core/pure/pratt-parser';
import { tokenize } from '../../../src/core/pure/tokenizer';
import { RegistryService } from '../../../src/core/services/registry-service';

describe('PrattParser', () => {
  let parser: PrattParser;
  let registry: RegistryService;

  beforeEach(() => {
    registry = RegistryService.createStandard();
    parser = new PrattParser(registry);
  });

  function parse(input: string): ASTNode {
    const tokens = tokenize(input);
    return parser.parse(tokens).ast;
  }

  describe('basic parsing', () => {
    it('parses literal number', () => {
      const ast = parse('42');
      expect(ast.type).toBe('literal');
      expect((ast as any).value).toBe(42);
    });

    it('parses identifier', () => {
      const ast = parse('x');
      expect(ast.type).toBe('identifier');
      expect((ast as any).name).toBe('x');
    });

    it('parses decimal number', () => {
      const ast = parse('3.14159');
      expect((ast as any).value).toBe(3.14159);
    });
  });

  describe('binary operations', () => {
    it('parses simple addition', () => {
      const ast = parse('2 + 3') as any;
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('+');
      expect(ast.left.value).toBe(2);
      expect(ast.right.value).toBe(3);
    });

    it('parses operator precedence', () => {
      const ast = parse('2 + 3 * 4') as any;
      // Should parse as 2 + (3 * 4), not (2 + 3) * 4
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('+');
      expect(ast.left.value).toBe(2);
      expect(ast.right.type).toBe('binary');
      expect(ast.right.operator).toBe('*');
    });

    it('parses left associativity', () => {
      const ast = parse('10 - 5 - 2') as any;
      // Should parse as (10 - 5) - 2
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('-');
      expect(ast.left.type).toBe('binary');
      expect(ast.right.value).toBe(2);
    });

    it('parses right associativity for exponentiation', () => {
      const ast = parse('2 ^ 3 ^ 2') as any;
      // Should parse as 2 ^ (3 ^ 2)
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('^');
      expect(ast.left.value).toBe(2);
      expect(ast.right.type).toBe('binary');
      expect(ast.right.left.value).toBe(3);
      expect(ast.right.right.value).toBe(2);
    });
  });

  describe('unary operations', () => {
    it('parses unary minus', () => {
      const ast = parse('-5') as any;
      expect(ast.type).toBe('unary');
      expect(ast.operator).toBe('-');
      expect(ast.operand.value).toBe(5);
    });

    it('parses unary plus', () => {
      const ast = parse('+5') as any;
      expect(ast.type).toBe('unary');
      expect(ast.operator).toBe('+');
      expect(ast.operand.value).toBe(5);
    });

    it('parses double negation', () => {
      const ast = parse('--5') as any;
      expect(ast.type).toBe('unary');
      expect(ast.operator).toBe('-');
      expect(ast.operand.type).toBe('unary');
      expect(ast.operand.operator).toBe('-');
    });

    it('unary has higher precedence than binary', () => {
      const ast = parse('-3 ^ 2') as any;
      // Should parse as (-3) ^ 2
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('^');
      expect(ast.left.type).toBe('unary');
    });
  });

  describe('parentheses', () => {
    it('parses grouped expression', () => {
      const ast = parse('(2 + 3) * 4') as any;
      // Should parse as (2 + 3) * 4
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('*');
      expect(ast.left.type).toBe('binary');
      expect(ast.left.operator).toBe('+');
      expect(ast.right.value).toBe(4);
    });

    it('parses nested parentheses', () => {
      const ast = parse('((1 + 2))') as any;
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('+');
    });
  });

  describe('function calls', () => {
    it('parses function call with no args', () => {
      const ast = parse('random()') as any;
      expect(ast.type).toBe('call');
      expect(ast.callee).toBe('random');
      expect(ast.arguments).toHaveLength(0);
    });

    it('parses function call with one arg', () => {
      const ast = parse('sin(0)') as any;
      expect(ast.type).toBe('call');
      expect(ast.callee).toBe('sin');
      expect(ast.arguments).toHaveLength(1);
      expect(ast.arguments[0].value).toBe(0);
    });

    it('parses function call with multiple args', () => {
      const ast = parse('max(1, 2, 3)') as any;
      expect(ast.type).toBe('call');
      expect(ast.callee).toBe('max');
      expect(ast.arguments).toHaveLength(3);
    });

    it('parses nested function calls', () => {
      const ast = parse('sin(cos(0))') as any;
      expect(ast.type).toBe('call');
      expect(ast.callee).toBe('sin');
      expect(ast.arguments[0].type).toBe('call');
      expect(ast.arguments[0].callee).toBe('cos');
    });

    it('parses function call in expression', () => {
      const ast = parse('2 * sin(pi)') as any;
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('*');
      expect(ast.left.value).toBe(2);
      expect(ast.right.type).toBe('call');
    });
  });

  describe('complex expressions', () => {
    it('parses complex arithmetic', () => {
      const ast = parse('2 * (3 + 4) - 5 / 2') as any;
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('-');
    });

    it('parses scientific notation', () => {
      const ast = parse('1e10 + 2e-5');
      expect(ast.type).toBe('binary');
    });
  });

  describe('comparison operators', () => {
    it('parses equality', () => {
      const ast = parse('1 == 1') as any;
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('==');
    });

    it('parses inequality', () => {
      const ast = parse('1 != 2') as any;
      expect(ast.operator).toBe('!=');
    });

    it('parses less than', () => {
      const ast = parse('1 < 2') as any;
      expect(ast.operator).toBe('<');
    });

    it('parses comparison chain', () => {
      const ast = parse('1 < 2 <= 3') as any;
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('<=');
    });
  });

  describe('error handling', () => {
    it('throws on unexpected token', () => {
      expect(() => parse('2 +')).toThrow(ParseError);
    });

    it('throws on unclosed paren', () => {
      expect(() => parse('(2 + 3')).toThrow(ParseError);
    });

    it('throws on unexpected closing paren', () => {
      expect(() => parse('2 + 3)')).toThrow(ParseError);
    });

    it('throws on unknown operator', () => {
      // This won't happen with standard tokenizer, but test anyway
      const tokens = [
        { type: 'NUMBER' as const, value: '1', position: { offset: 0, line: 1, column: 1 } },
        { type: 'OPERATOR' as const, value: '@', position: { offset: 2, line: 1, column: 3 } },
        { type: 'NUMBER' as const, value: '2', position: { offset: 4, line: 1, column: 5 } },
        { type: 'EOF' as const, value: '', position: { offset: 5, line: 1, column: 6 } },
      ];
      expect(() => parser.parse(tokens)).toThrow(ParseError);
    });

    it('includes position in error', () => {
      try {
        parse('(2 +');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ParseError);
        expect(e.position).toBeDefined();
      }
    });
  });

  describe('formatAST', () => {
    it('formats literal', () => {
      const ast = parse('42');
      expect(formatAST(ast)).toBe('Literal(42)');
    });

    it('formats binary', () => {
      const ast = parse('1 + 2');
      const formatted = formatAST(ast);
      expect(formatted).toContain('Binary(+)');
      expect(formatted).toContain('Literal(1)');
      expect(formatted).toContain('Literal(2)');
    });

    it('formats with indentation', () => {
      const ast = parse('1 + 2');
      const formatted = formatAST(ast);
      const lines = formatted.split('\n');
      expect(lines[0]).toBe('Binary(+)');
      expect(lines[1]).toContain('Literal(1)');
    });
  });
});
