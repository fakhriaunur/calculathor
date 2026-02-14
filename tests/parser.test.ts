/**
 * Pratt Parser Tests
 *
 * Comprehensive test suite for the Pratt parser implementation.
 */

import { describe, it, expect } from 'bun:test';
import {
  parse,
  OperatorRegistry,
  ParseError,
  type ASTNode,
  type LiteralNode,
  type IdentifierNode,
  type UnaryNode,
  type BinaryNode,
  type CallNode,
} from '../src/parser/pratt';
import type { Token } from '../src/parser/tokenizer';

// ============================================================================
// Test Helpers
// ============================================================================

function makeToken(
  type: Token['type'],
  value: string,
  offset = 0,
  line = 1,
  column = 1
): Token {
  return { type, value, position: { offset, line, column } };
}

const pos = (offset = 0, line = 1, column = 1) => ({ offset, line, column });

function lit(value: number, offset = 0): LiteralNode {
  return { type: 'literal', value, position: pos(offset) };
}

function ident(name: string, offset = 0): IdentifierNode {
  return { type: 'identifier', name, position: pos(offset) };
}

function unary(op: string, operand: ASTNode, offset = 0): UnaryNode {
  return { type: 'unary', operator: op, operand, position: pos(offset) };
}

function binary(op: string, left: ASTNode, right: ASTNode, offset = 0): BinaryNode {
  return { type: 'binary', operator: op, left, right, position: pos(offset) };
}

function callNode(callee: string, args: ASTNode[], offset = 0): CallNode {
  return { type: 'call', callee, arguments: args, position: pos(offset) };
}

// ============================================================================
// Literal Tests
// ============================================================================

describe('Literals', () => {
  it('should parse integer literals', () => {
    const tokens: Token[] = [makeToken('NUMBER', '42'), makeToken('EOF', '')];
    const ast = parse(tokens);
    expect(ast).toEqual(lit(42));
  });

  it('should parse decimal literals', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '3.14159'),
      makeToken('EOF', ''),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(lit(3.14159));
  });

  it('should parse negative decimal literals', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '-2.5'),
      makeToken('EOF', ''),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(lit(-2.5));
  });

  it('should parse scientific notation', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '1e10'),
      makeToken('EOF', ''),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(lit(1e10));
  });
});

// ============================================================================
// Identifier Tests
// ============================================================================

describe('Identifiers', () => {
  it('should parse single-letter identifiers', () => {
    const tokens: Token[] = [makeToken('IDENTIFIER', 'x'), makeToken('EOF', '')];
    const ast = parse(tokens);
    expect(ast).toEqual(ident('x'));
  });

  it('should parse multi-letter identifiers', () => {
    const tokens: Token[] = [
      makeToken('IDENTIFIER', 'pi'),
      makeToken('EOF', ''),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(ident('pi'));
  });

  it('should parse identifiers with numbers', () => {
    const tokens: Token[] = [
      makeToken('IDENTIFIER', 'var1'),
      makeToken('EOF', ''),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(ident('var1'));
  });
});

// ============================================================================
// Unary Operator Tests
// ============================================================================

describe('Unary Operators', () => {
  it('should parse unary minus', () => {
    const tokens: Token[] = [
      makeToken('OPERATOR', '-', 0),
      makeToken('NUMBER', '5', 1),
      makeToken('EOF', '', 2),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(unary('-', lit(5, 1), 0));
  });

  it('should parse unary plus', () => {
    const tokens: Token[] = [
      makeToken('OPERATOR', '+', 0),
      makeToken('NUMBER', '5', 1),
      makeToken('EOF', '', 2),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(unary('+', lit(5, 1), 0));
  });

  it('should parse double unary minus', () => {
    const tokens: Token[] = [
      makeToken('OPERATOR', '-', 0),
      makeToken('OPERATOR', '-', 1),
      makeToken('NUMBER', '5', 2),
      makeToken('EOF', '', 3),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(unary('-', unary('-', lit(5, 2), 1), 0));
  });

  it('should parse unary minus with parentheses', () => {
    const tokens: Token[] = [
      makeToken('OPERATOR', '-', 0),
      makeToken('LPAREN', '(', 1),
      makeToken('NUMBER', '5', 2),
      makeToken('RPAREN', ')', 3),
      makeToken('EOF', '', 4),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(unary('-', lit(5, 2), 0));
  });
});

// ============================================================================
// Binary Operator Tests
// ============================================================================

describe('Binary Operators', () => {
  it('should parse addition', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '2', 0),
      makeToken('OPERATOR', '+', 1),
      makeToken('NUMBER', '3', 2),
      makeToken('EOF', '', 3),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(binary('+', lit(2, 0), lit(3, 2), 0));
  });

  it('should parse subtraction', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '5', 0),
      makeToken('OPERATOR', '-', 1),
      makeToken('NUMBER', '3', 2),
      makeToken('EOF', '', 3),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(binary('-', lit(5, 0), lit(3, 2), 0));
  });

  it('should parse multiplication', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '4', 0),
      makeToken('OPERATOR', '*', 1),
      makeToken('NUMBER', '5', 2),
      makeToken('EOF', '', 3),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(binary('*', lit(4, 0), lit(5, 2), 0));
  });

  it('should parse division', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '10', 0),
      makeToken('OPERATOR', '/', 2),
      makeToken('NUMBER', '2', 3),
      makeToken('EOF', '', 4),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(binary('/', lit(10, 0), lit(2, 3), 0));
  });

  it('should parse exponentiation', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '2', 0),
      makeToken('OPERATOR', '^', 1),
      makeToken('NUMBER', '3', 2),
      makeToken('EOF', '', 3),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(binary('^', lit(2, 0), lit(3, 2), 0));
  });
});

// ============================================================================
// Precedence Tests
// ============================================================================

describe('Operator Precedence', () => {
  it('should respect * over + precedence', () => {
    // 2 + 3 * 4 -> 2 + (3 * 4)
    const tokens: Token[] = [
      makeToken('NUMBER', '2', 0),
      makeToken('OPERATOR', '+', 2),
      makeToken('NUMBER', '3', 4),
      makeToken('OPERATOR', '*', 6),
      makeToken('NUMBER', '4', 8),
      makeToken('EOF', '', 9),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(
      binary('+', lit(2, 0), binary('*', lit(3, 4), lit(4, 8), 4), 0)
    );
  });

  it('should respect / over - precedence', () => {
    // 10 - 6 / 2 -> 10 - (6 / 2)
    const tokens: Token[] = [
      makeToken('NUMBER', '10', 0),
      makeToken('OPERATOR', '-', 3),
      makeToken('NUMBER', '6', 5),
      makeToken('OPERATOR', '/', 7),
      makeToken('NUMBER', '2', 9),
      makeToken('EOF', '', 10),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(
      binary('-', lit(10, 0), binary('/', lit(6, 5), lit(2, 9), 5), 0)
    );
  });

  it('should respect ^ over * precedence', () => {
    // 2 * 3 ^ 2 -> 2 * (3 ^ 2)
    const tokens: Token[] = [
      makeToken('NUMBER', '2', 0),
      makeToken('OPERATOR', '*', 2),
      makeToken('NUMBER', '3', 4),
      makeToken('OPERATOR', '^', 6),
      makeToken('NUMBER', '2', 8),
      makeToken('EOF', '', 9),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(
      binary('*', lit(2, 0), binary('^', lit(3, 4), lit(2, 8), 4), 0)
    );
  });

  it('should respect unary over binary precedence', () => {
    // -3 ^ 2 -> (-3) ^ 2
    const tokens: Token[] = [
      makeToken('OPERATOR', '-', 0),
      makeToken('NUMBER', '3', 1),
      makeToken('OPERATOR', '^', 2),
      makeToken('NUMBER', '2', 3),
      makeToken('EOF', '', 4),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(
      binary('^', unary('-', lit(3, 1), 0), lit(2, 3), 0)
    );
  });
});

// ============================================================================
// Associativity Tests
// ============================================================================

describe('Operator Associativity', () => {
  it('should parse left-associative operators left-to-right', () => {
    // 10 - 5 - 2 -> (10 - 5) - 2
    const tokens: Token[] = [
      makeToken('NUMBER', '10', 0),
      makeToken('OPERATOR', '-', 3),
      makeToken('NUMBER', '5', 5),
      makeToken('OPERATOR', '-', 7),
      makeToken('NUMBER', '2', 9),
      makeToken('EOF', '', 10),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(
      binary('-', binary('-', lit(10, 0), lit(5, 5), 0), lit(2, 9), 0)
    );
  });

  it('should parse left-associative + left-to-right', () => {
    // 1 + 2 + 3 -> (1 + 2) + 3
    const tokens: Token[] = [
      makeToken('NUMBER', '1', 0),
      makeToken('OPERATOR', '+', 2),
      makeToken('NUMBER', '2', 4),
      makeToken('OPERATOR', '+', 6),
      makeToken('NUMBER', '3', 8),
      makeToken('EOF', '', 9),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(
      binary('+', binary('+', lit(1, 0), lit(2, 4), 0), lit(3, 8), 0)
    );
  });

  it('should parse right-associative ^ right-to-left', () => {
    // 2 ^ 3 ^ 2 -> 2 ^ (3 ^ 2) = 512
    const tokens: Token[] = [
      makeToken('NUMBER', '2', 0),
      makeToken('OPERATOR', '^', 1),
      makeToken('NUMBER', '3', 2),
      makeToken('OPERATOR', '^', 3),
      makeToken('NUMBER', '2', 4),
      makeToken('EOF', '', 5),
    ];
    const ast = parse(tokens);
    // Should be: 2 ^ (3 ^ 2)
    expect(ast).toEqual(
      binary('^', lit(2, 0), binary('^', lit(3, 2), lit(2, 4), 2), 0)
    );
  });

  it('should handle complex right-associative chain', () => {
    // 2 ^ 3 ^ 2 ^ 1 -> 2 ^ (3 ^ (2 ^ 1))
    const tokens: Token[] = [
      makeToken('NUMBER', '2', 0),
      makeToken('OPERATOR', '^', 1),
      makeToken('NUMBER', '3', 2),
      makeToken('OPERATOR', '^', 3),
      makeToken('NUMBER', '2', 4),
      makeToken('OPERATOR', '^', 5),
      makeToken('NUMBER', '1', 6),
      makeToken('EOF', '', 7),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(
      binary('^', lit(2, 0), binary('^', lit(3, 2), binary('^', lit(2, 4), lit(1, 6), 4), 2), 0)
    );
  });
});

// ============================================================================
// Parentheses Tests
// ============================================================================

describe('Parentheses', () => {
  it('should parse parentheses grouping', () => {
    // (2 + 3) * 4
    const tokens: Token[] = [
      makeToken('LPAREN', '(', 0),
      makeToken('NUMBER', '2', 1),
      makeToken('OPERATOR', '+', 3),
      makeToken('NUMBER', '3', 5),
      makeToken('RPAREN', ')', 6),
      makeToken('OPERATOR', '*', 8),
      makeToken('NUMBER', '4', 10),
      makeToken('EOF', '', 11),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(
      binary('*', binary('+', lit(2, 1), lit(3, 5), 1), lit(4, 10), 1)
    );
  });

  it('should parse nested parentheses', () => {
    // ((1 + 2))
    const tokens: Token[] = [
      makeToken('LPAREN', '(', 0),
      makeToken('LPAREN', '(', 1),
      makeToken('NUMBER', '1', 2),
      makeToken('OPERATOR', '+', 4),
      makeToken('NUMBER', '2', 6),
      makeToken('RPAREN', ')', 7),
      makeToken('RPAREN', ')', 8),
      makeToken('EOF', '', 9),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(binary('+', lit(1, 2), lit(2, 6), 2));
  });
});

// ============================================================================
// Function Call Tests
// ============================================================================

describe('Function Calls', () => {
  it('should parse function call with no arguments', () => {
    const tokens: Token[] = [
      makeToken('IDENTIFIER', 'pi', 0),
      makeToken('LPAREN', '(', 2),
      makeToken('RPAREN', ')', 3),
      makeToken('EOF', '', 4),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(callNode('pi', [], 0));
  });

  it('should parse function call with single argument', () => {
    // sin(x)
    const tokens: Token[] = [
      makeToken('IDENTIFIER', 'sin', 0),
      makeToken('LPAREN', '(', 3),
      makeToken('IDENTIFIER', 'x', 4),
      makeToken('RPAREN', ')', 5),
      makeToken('EOF', '', 6),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(callNode('sin', [ident('x', 4)], 0));
  });

  it('should parse function call with expression argument', () => {
    // sin(2 + 3)
    const tokens: Token[] = [
      makeToken('IDENTIFIER', 'sin', 0),
      makeToken('LPAREN', '(', 3),
      makeToken('NUMBER', '2', 4),
      makeToken('OPERATOR', '+', 6),
      makeToken('NUMBER', '3', 8),
      makeToken('RPAREN', ')', 9),
      makeToken('EOF', '', 10),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(
      callNode('sin', [binary('+', lit(2, 4), lit(3, 8), 4)], 0)
    );
  });

  it('should parse function call with multiple arguments', () => {
    // atan2(1, 2)
    const tokens: Token[] = [
      makeToken('IDENTIFIER', 'atan2', 0),
      makeToken('LPAREN', '(', 5),
      makeToken('NUMBER', '1', 6),
      makeToken('COMMA', ',', 7),
      makeToken('NUMBER', '2', 9),
      makeToken('RPAREN', ')', 10),
      makeToken('EOF', '', 11),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(callNode('atan2', [lit(1, 6), lit(2, 9)], 0));
  });

  it('should parse nested function calls', () => {
    // sin(cos(0))
    const tokens: Token[] = [
      makeToken('IDENTIFIER', 'sin', 0),
      makeToken('LPAREN', '(', 3),
      makeToken('IDENTIFIER', 'cos', 4),
      makeToken('LPAREN', '(', 7),
      makeToken('NUMBER', '0', 8),
      makeToken('RPAREN', ')', 9),
      makeToken('RPAREN', ')', 10),
      makeToken('EOF', '', 11),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(callNode('sin', [callNode('cos', [lit(0, 8)], 4)], 0));
  });

  it('should parse function call in expression', () => {
    // 2 * sin(pi)
    const tokens: Token[] = [
      makeToken('NUMBER', '2', 0),
      makeToken('OPERATOR', '*', 2),
      makeToken('IDENTIFIER', 'sin', 4),
      makeToken('LPAREN', '(', 7),
      makeToken('IDENTIFIER', 'pi', 8),
      makeToken('RPAREN', ')', 10),
      makeToken('EOF', '', 11),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(
      binary('*', lit(2, 0), callNode('sin', [ident('pi', 8)], 4), 0)
    );
  });
});

// ============================================================================
// Complex Expression Tests
// ============================================================================

describe('Complex Expressions', () => {
  it('should parse combination of operators and functions', () => {
    // -3 + sin(0) * 2
    const tokens: Token[] = [
      makeToken('OPERATOR', '-', 0),
      makeToken('NUMBER', '3', 1),
      makeToken('OPERATOR', '+', 2),
      makeToken('IDENTIFIER', 'sin', 4),
      makeToken('LPAREN', '(', 7),
      makeToken('NUMBER', '0', 8),
      makeToken('RPAREN', ')', 9),
      makeToken('OPERATOR', '*', 11),
      makeToken('NUMBER', '2', 13),
      makeToken('EOF', '', 14),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(
      binary(
        '+',
        unary('-', lit(3, 1), 0),
        binary('*', callNode('sin', [lit(0, 8)], 4), lit(2, 13), 4),
        0
      )
    );
  });

  it('should parse deeply nested expression', () => {
    // (1 + 2) * (3 + 4) / (5 - 6)
    const tokens: Token[] = [
      makeToken('LPAREN', '(', 0),
      makeToken('NUMBER', '1', 1),
      makeToken('OPERATOR', '+', 3),
      makeToken('NUMBER', '2', 5),
      makeToken('RPAREN', ')', 6),
      makeToken('OPERATOR', '*', 8),
      makeToken('LPAREN', '(', 10),
      makeToken('NUMBER', '3', 11),
      makeToken('OPERATOR', '+', 13),
      makeToken('NUMBER', '4', 15),
      makeToken('RPAREN', ')', 16),
      makeToken('OPERATOR', '/', 18),
      makeToken('LPAREN', '(', 20),
      makeToken('NUMBER', '5', 21),
      makeToken('OPERATOR', '-', 23),
      makeToken('NUMBER', '6', 25),
      makeToken('RPAREN', ')', 26),
      makeToken('EOF', '', 27),
    ];
    const ast = parse(tokens);
    expect(ast.type).toBe('binary');
    expect((ast as BinaryNode).operator).toBe('/');
  });
});

// ============================================================================
// Error Tests
// ============================================================================

describe('Parse Errors', () => {
  it('should throw on unexpected token', () => {
    const tokens: Token[] = [
      makeToken('OPERATOR', '*', 0),
      makeToken('NUMBER', '5', 1),
      makeToken('EOF', '', 2),
    ];
    expect(() => parse(tokens)).toThrow(ParseError);
  });

  it('should throw on missing closing parenthesis', () => {
    const tokens: Token[] = [
      makeToken('LPAREN', '(', 0),
      makeToken('NUMBER', '5', 1),
      makeToken('EOF', '', 2),
    ];
    expect(() => parse(tokens)).toThrow(ParseError);
  });

  it('should throw on empty input', () => {
    const tokens: Token[] = [makeToken('EOF', '', 0)];
    expect(() => parse(tokens)).toThrow(ParseError);
  });

  it('should throw on trailing operator', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '5', 0),
      makeToken('OPERATOR', '+', 1),
      makeToken('EOF', '', 2),
    ];
    expect(() => parse(tokens)).toThrow(ParseError);
  });

  it('should throw on missing comma in function args', () => {
    const tokens: Token[] = [
      makeToken('IDENTIFIER', 'f', 0),
      makeToken('LPAREN', '(', 1),
      makeToken('NUMBER', '1', 2),
      makeToken('NUMBER', '2', 3),
      makeToken('RPAREN', ')', 4),
      makeToken('EOF', '', 5),
    ];
    expect(() => parse(tokens)).toThrow(ParseError);
  });

  it('should throw on unexpected token after expression', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '5', 0),
      makeToken('NUMBER', '3', 1),
      makeToken('EOF', '', 2),
    ];
    expect(() => parse(tokens)).toThrow(ParseError);
  });
});

// ============================================================================
// OperatorRegistry Tests
// ============================================================================

describe('OperatorRegistry', () => {
  it('should register custom operator', () => {
    const registry = new OperatorRegistry();
    registry.registerOperator('@', 25, 'left', 2);
    expect(registry.hasOperator('@')).toBe(true);
  });

  it('should return undefined for unknown operator', () => {
    const registry = new OperatorRegistry();
    expect(registry.getOperator('unknown')).toBeUndefined();
  });

  it('should create default registry with standard operators', () => {
    const registry = OperatorRegistry.createDefault();
    expect(registry.hasOperator('+')).toBe(true);
    expect(registry.hasOperator('-')).toBe(true);
    expect(registry.hasOperator('*')).toBe(true);
    expect(registry.hasOperator('/')).toBe(true);
    expect(registry.hasOperator('^')).toBe(true);
    expect(registry.hasOperator('u+')).toBe(true);
    expect(registry.hasOperator('u-')).toBe(true);
  });

  it('should use custom registry for parsing', () => {
    const registry = new OperatorRegistry();
    registry.registerOperator('+', 10, 'left', 2);
    registry.registerOperator('u-', 40, 'right', 1);

    const tokens: Token[] = [
      makeToken('OPERATOR', '-', 0),
      makeToken('NUMBER', '5', 1),
      makeToken('OPERATOR', '+', 2),
      makeToken('NUMBER', '3', 3),
      makeToken('EOF', '', 4),
    ];

    const ast = parse(tokens, registry);
    expect(ast.type).toBe('binary');
    expect((ast as BinaryNode).operator).toBe('+');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle zero', () => {
    const tokens: Token[] = [makeToken('NUMBER', '0'), makeToken('EOF', '')];
    const ast = parse(tokens);
    expect(ast).toEqual(lit(0));
  });

  it('should handle very large numbers', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '999999999999'),
      makeToken('EOF', ''),
    ];
    const ast = parse(tokens);
    expect((ast as LiteralNode).value).toBe(999999999999);
  });

  it('should handle very small decimal numbers', () => {
    const tokens: Token[] = [
      makeToken('NUMBER', '0.000000001'),
      makeToken('EOF', ''),
    ];
    const ast = parse(tokens);
    expect((ast as LiteralNode).value).toBe(0.000000001);
  });

  it('should handle identifier named like operator', () => {
    const tokens: Token[] = [
      makeToken('IDENTIFIER', 'max'),
      makeToken('EOF', ''),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(ident('max'));
  });

  it('should parse multiple unary operators with different types', () => {
    // +-5 -> +(-5)
    const tokens: Token[] = [
      makeToken('OPERATOR', '+', 0),
      makeToken('OPERATOR', '-', 1),
      makeToken('NUMBER', '5', 2),
      makeToken('EOF', '', 3),
    ];
    const ast = parse(tokens);
    expect(ast).toEqual(unary('+', unary('-', lit(5))));
  });
});
