import { describe, it, expect } from 'bun:test';
import {
  evaluate,
  createDefaultContext,
  EvalError,
  type EvalContext,
  type ASTNode,
  type SourcePosition,
} from '../src/evaluator';

// Helper to create position
const pos = (offset = 0): SourcePosition => ({ offset, line: 1, column: offset + 1 });

// Helper to create literal node
const lit = (value: number, offset = 0): ASTNode => ({
  type: 'literal',
  value,
  position: pos(offset),
});

// Helper to create identifier node
const ident = (name: string, offset = 0): ASTNode => ({
  type: 'identifier',
  name,
  position: pos(offset),
});

// Helper to create unary node
const unary = (operator: string, operand: ASTNode, offset = 0): ASTNode => ({
  type: 'unary',
  operator,
  operand,
  position: pos(offset),
});

// Helper to create binary node
const binary = (operator: string, left: ASTNode, right: ASTNode, offset = 0): ASTNode => ({
  type: 'binary',
  operator,
  left,
  right,
  position: pos(offset),
});

// Helper to create call node
const call = (callee: string, args: ASTNode[], offset = 0): ASTNode => ({
  type: 'call',
  callee,
  arguments: args,
  position: pos(offset),
});

describe('Expression Evaluator', () => {
  describe('Literals', () => {
    it('evaluates positive numbers', () => {
      const context = createDefaultContext();
      const ast = lit(42);
      expect(evaluate(ast, context)).toBe(42);
    });

    it('evaluates negative numbers', () => {
      const context = createDefaultContext();
      const ast = lit(-3.14);
      expect(evaluate(ast, context)).toBe(-3.14);
    });

    it('evaluates zero', () => {
      const context = createDefaultContext();
      const ast = lit(0);
      expect(evaluate(ast, context)).toBe(0);
    });

    it('evaluates large numbers', () => {
      const context = createDefaultContext();
      const ast = lit(1e10);
      expect(evaluate(ast, context)).toBe(1e10);
    });
  });

  describe('Unary Operations', () => {
    it('evaluates unary plus', () => {
      const context = createDefaultContext();
      const ast = unary('+', lit(5));
      expect(evaluate(ast, context)).toBe(5);
    });

    it('evaluates unary minus', () => {
      const context = createDefaultContext();
      const ast = unary('-', lit(5));
      expect(evaluate(ast, context)).toBe(-5);
    });

    it('evaluates double negation', () => {
      const context = createDefaultContext();
      const ast = unary('-', unary('-', lit(5)));
      expect(evaluate(ast, context)).toBe(5);
    });
  });

  describe('Binary Operations', () => {
    it('evaluates addition', () => {
      const context = createDefaultContext();
      const ast = binary('+', lit(2), lit(3));
      expect(evaluate(ast, context)).toBe(5);
    });

    it('evaluates subtraction', () => {
      const context = createDefaultContext();
      const ast = binary('-', lit(5), lit(3));
      expect(evaluate(ast, context)).toBe(2);
    });

    it('evaluates multiplication', () => {
      const context = createDefaultContext();
      const ast = binary('*', lit(4), lit(5));
      expect(evaluate(ast, context)).toBe(20);
    });

    it('evaluates division', () => {
      const context = createDefaultContext();
      const ast = binary('/', lit(10), lit(2));
      expect(evaluate(ast, context)).toBe(5);
    });

    it('evaluates modulo', () => {
      const context = createDefaultContext();
      const ast = binary('%', lit(10), lit(3));
      expect(evaluate(ast, context)).toBe(1);
    });

    it('evaluates exponentiation with ^', () => {
      const context = createDefaultContext();
      const ast = binary('^', lit(2), lit(3));
      expect(evaluate(ast, context)).toBe(8);
    });

    it('evaluates exponentiation with **', () => {
      const context = createDefaultContext();
      const ast = binary('**', lit(2), lit(3));
      expect(evaluate(ast, context)).toBe(8);
    });

    it('throws on division by zero', () => {
      const context = createDefaultContext();
      const ast = binary('/', lit(10), lit(0));
      expect(() => evaluate(ast, context)).toThrow(EvalError);
    });

    it('throws on modulo by zero', () => {
      const context = createDefaultContext();
      const ast = binary('%', lit(10), lit(0));
      expect(() => evaluate(ast, context)).toThrow(EvalError);
    });
  });

  describe('Comparison Operations', () => {
    it('evaluates equality (true)', () => {
      const context = createDefaultContext();
      const ast = binary('==', lit(5), lit(5));
      expect(evaluate(ast, context)).toBe(1);
    });

    it('evaluates equality (false)', () => {
      const context = createDefaultContext();
      const ast = binary('==', lit(5), lit(3));
      expect(evaluate(ast, context)).toBe(0);
    });

    it('evaluates inequality', () => {
      const context = createDefaultContext();
      const ast = binary('!=', lit(5), lit(3));
      expect(evaluate(ast, context)).toBe(1);
    });

    it('evaluates less than', () => {
      const context = createDefaultContext();
      const ast = binary('<', lit(3), lit(5));
      expect(evaluate(ast, context)).toBe(1);
    });

    it('evaluates greater than', () => {
      const context = createDefaultContext();
      const ast = binary('>', lit(5), lit(3));
      expect(evaluate(ast, context)).toBe(1);
    });

    it('evaluates less than or equal', () => {
      const context = createDefaultContext();
      const ast = binary('<=', lit(5), lit(5));
      expect(evaluate(ast, context)).toBe(1);
    });

    it('evaluates greater than or equal', () => {
      const context = createDefaultContext();
      const ast = binary('>=', lit(5), lit(5));
      expect(evaluate(ast, context)).toBe(1);
    });
  });

  describe('Complex Expressions', () => {
    it('evaluates 2 + 3 * 4 (order of operations)', () => {
      const context = createDefaultContext();
      // Build AST: 2 + (3 * 4) = 14
      const ast = binary('+', lit(2), binary('*', lit(3), lit(4)));
      expect(evaluate(ast, context)).toBe(14);
    });

    it('evaluates (2 + 3) * 4', () => {
      const context = createDefaultContext();
      // Build AST: (2 + 3) * 4 = 20
      const ast = binary('*', binary('+', lit(2), lit(3)), lit(4));
      expect(evaluate(ast, context)).toBe(20);
    });

    it('evaluates nested expressions', () => {
      const context = createDefaultContext();
      // (10 - 3) * (4 + 2) / 2 = 21
      const ast = binary(
        '/',
        binary(
          '*',
          binary('-', lit(10), lit(3)),
          binary('+', lit(4), lit(2))
        ),
        lit(2)
      );
      expect(evaluate(ast, context)).toBe(21);
    });
  });

  describe('Built-in Constants', () => {
    it('evaluates pi', () => {
      const context = createDefaultContext();
      const ast = ident('pi');
      expect(evaluate(ast, context)).toBe(Math.PI);
    });

    it('evaluates e', () => {
      const context = createDefaultContext();
      const ast = ident('e');
      expect(evaluate(ast, context)).toBe(Math.E);
    });

    it('throws on unknown identifier', () => {
      const context = createDefaultContext();
      const ast = ident('unknown');
      expect(() => evaluate(ast, context)).toThrow(EvalError);
    });
  });

  describe('Built-in Functions - Trigonometric', () => {
    it('evaluates sin', () => {
      const context = createDefaultContext();
      const ast = call('sin', [lit(0)]);
      expect(evaluate(ast, context)).toBeCloseTo(0);
    });

    it('evaluates cos', () => {
      const context = createDefaultContext();
      const ast = call('cos', [lit(0)]);
      expect(evaluate(ast, context)).toBeCloseTo(1);
    });

    it('evaluates tan', () => {
      const context = createDefaultContext();
      const ast = call('tan', [lit(0)]);
      expect(evaluate(ast, context)).toBeCloseTo(0);
    });
  });

  describe('Built-in Functions - Logarithmic', () => {
    it('evaluates log (base 10)', () => {
      const context = createDefaultContext();
      const ast = call('log', [lit(100)]);
      expect(evaluate(ast, context)).toBeCloseTo(2);
    });

    it('evaluates log10', () => {
      const context = createDefaultContext();
      const ast = call('log10', [lit(1000)]);
      expect(evaluate(ast, context)).toBeCloseTo(3);
    });

    it('evaluates ln (natural log)', () => {
      const context = createDefaultContext();
      const ast = call('ln', [lit(Math.E)]);
      expect(evaluate(ast, context)).toBeCloseTo(1);
    });
  });

  describe('Built-in Functions - Exponential and Power', () => {
    it('evaluates exp', () => {
      const context = createDefaultContext();
      const ast = call('exp', [lit(1)]);
      expect(evaluate(ast, context)).toBeCloseTo(Math.E);
    });

    it('evaluates sqrt', () => {
      const context = createDefaultContext();
      const ast = call('sqrt', [lit(16)]);
      expect(evaluate(ast, context)).toBe(4);
    });

    it('evaluates pow', () => {
      const context = createDefaultContext();
      const ast = call('pow', [lit(2), lit(3)]);
      expect(evaluate(ast, context)).toBe(8);
    });
  });

  describe('Built-in Functions - Absolute and Rounding', () => {
    it('evaluates abs (positive)', () => {
      const context = createDefaultContext();
      const ast = call('abs', [lit(5)]);
      expect(evaluate(ast, context)).toBe(5);
    });

    it('evaluates abs (negative)', () => {
      const context = createDefaultContext();
      const ast = call('abs', [lit(-5)]);
      expect(evaluate(ast, context)).toBe(5);
    });

    it('evaluates floor', () => {
      const context = createDefaultContext();
      const ast = call('floor', [lit(3.7)]);
      expect(evaluate(ast, context)).toBe(3);
    });

    it('evaluates ceil', () => {
      const context = createDefaultContext();
      const ast = call('ceil', [lit(3.2)]);
      expect(evaluate(ast, context)).toBe(4);
    });

    it('evaluates round', () => {
      const context = createDefaultContext();
      const ast = call('round', [lit(3.5)]);
      expect(evaluate(ast, context)).toBe(4);
    });
  });

  describe('Built-in Functions - Min/Max', () => {
    it('evaluates min with two arguments', () => {
      const context = createDefaultContext();
      const ast = call('min', [lit(5), lit(3)]);
      expect(evaluate(ast, context)).toBe(3);
    });

    it('evaluates min with multiple arguments', () => {
      const context = createDefaultContext();
      const ast = call('min', [lit(5), lit(3), lit(8), lit(1)]);
      expect(evaluate(ast, context)).toBe(1);
    });

    it('evaluates max with two arguments', () => {
      const context = createDefaultContext();
      const ast = call('max', [lit(5), lit(3)]);
      expect(evaluate(ast, context)).toBe(5);
    });

    it('evaluates max with multiple arguments', () => {
      const context = createDefaultContext();
      const ast = call('max', [lit(5), lit(3), lit(8), lit(1)]);
      expect(evaluate(ast, context)).toBe(8);
    });

    it('throws on min with no arguments', () => {
      const context = createDefaultContext();
      const ast = call('min', []);
      expect(() => evaluate(ast, context)).toThrow(EvalError);
    });

    it('throws on max with no arguments', () => {
      const context = createDefaultContext();
      const ast = call('max', []);
      expect(() => evaluate(ast, context)).toThrow(EvalError);
    });
  });

  describe('Function Call Errors', () => {
    it('throws on unknown function', () => {
      const context = createDefaultContext();
      const ast = call('unknown', [lit(5)]);
      expect(() => evaluate(ast, context)).toThrow(EvalError);
    });

    it('throws on wrong arity', () => {
      const context = createDefaultContext();
      const ast = call('sin', [lit(1), lit(2)]);
      expect(() => evaluate(ast, context)).toThrow(EvalError);
    });

    it('throws on too few arguments', () => {
      const context = createDefaultContext();
      const ast = call('sin', []);
      expect(() => evaluate(ast, context)).toThrow(EvalError);
    });
  });

  describe('Nested Function Calls', () => {
    it('evaluates nested functions', () => {
      const context = createDefaultContext();
      // sqrt(16) + sin(pi/2) = 4 + 1 = 5
      const ast = binary(
        '+',
        call('sqrt', [lit(16)]),
        call('sin', [binary('/', ident('pi'), lit(2))])
      );
      expect(evaluate(ast, context)).toBeCloseTo(5);
    });

    it('evaluates complex nested expression', () => {
      const context = createDefaultContext();
      // max(2, pow(2, 3)) = max(2, 8) = 8
      const ast = call('max', [lit(2), call('pow', [lit(2), lit(3)])]);
      expect(evaluate(ast, context)).toBe(8);
    });
  });

  describe('Custom Context', () => {
    it('uses custom constants', () => {
      const context: EvalContext = {
        functions: createDefaultContext().functions,
        constants: new Map([['custom', 42]]),
      };
      const ast = ident('custom');
      expect(evaluate(ast, context)).toBe(42);
    });

    it('uses custom functions', () => {
      const context: EvalContext = {
        functions: new Map([
          ['double', { name: 'double', arity: 1, fn: (x: number) => x * 2 }],
        ]),
        constants: new Map(),
      };
      const ast = call('double', [lit(5)]);
      expect(evaluate(ast, context)).toBe(10);
    });

    it('combines built-in and custom functions', () => {
      const defaultCtx = createDefaultContext();
      const context: EvalContext = {
        functions: new Map([
          ...defaultCtx.functions,
          ['triple', { name: 'triple', arity: 1, fn: (x: number) => x * 3 }],
        ]),
        constants: defaultCtx.constants,
      };
      const ast = call('triple', [call('sin', [lit(0)])]);
      expect(evaluate(ast, context)).toBeCloseTo(0);
    });
  });

  describe('EvalError', () => {
    it('includes position information', () => {
      const context = createDefaultContext();
      const ast = ident('unknown', 15);
      try {
        evaluate(ast, context);
        expect(false).toBe(true); // Should not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(EvalError);
        expect((e as EvalError).position).toBe(15);
      }
    });

    it('has correct error name', () => {
      const context = createDefaultContext();
      const ast = ident('unknown');
      try {
        evaluate(ast, context);
      } catch (e) {
        expect((e as Error).name).toBe('EvalError');
      }
    });
  });
});
