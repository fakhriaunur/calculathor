import { describe, it, expect, beforeEach } from 'bun:test';
import { evaluate, EvaluationError } from '../../../src/core/pure/evaluator';
import { tokenize } from '../../../src/core/pure/tokenizer';
import { PrattParser } from '../../../src/core/pure/pratt-parser';
import { RegistryService } from '../../../src/core/services/registry-service';

describe('Evaluator', () => {
  let registry: RegistryService;
  let parser: PrattParser;

  beforeEach(() => {
    registry = RegistryService.createStandard();
    parser = new PrattParser(registry);
  });

  function evalExpr(input: string, variables?: Map<string, number>): number {
    const tokens = tokenize(input);
    const { ast } = parser.parse(tokens);
    return evaluate(ast, { registry, variables });
  }

  describe('literals', () => {
    it('evaluates number literal', () => {
      expect(evalExpr('42')).toBe(42);
    });

    it('evaluates decimal literal', () => {
      expect(evalExpr('3.14159')).toBe(3.14159);
    });

    it('evaluates negative number', () => {
      expect(evalExpr('-5')).toBe(-5);
    });

    it('evaluates positive number with unary plus', () => {
      expect(evalExpr('+5')).toBe(5);
    });
  });

  describe('constants', () => {
    it('evaluates pi', () => {
      expect(evalExpr('pi')).toBe(Math.PI);
    });

    it('evaluates e', () => {
      expect(evalExpr('e')).toBe(Math.E);
    });

    it('evaluates phi', () => {
      const phi = (1 + Math.sqrt(5)) / 2;
      expect(evalExpr('phi')).toBe(phi);
    });
  });

  describe('variables', () => {
    it('evaluates variable', () => {
      const vars = new Map([['x', 10]]);
      expect(evalExpr('x', vars)).toBe(10);
    });

    it('variable shadows constant', () => {
      const vars = new Map([['pi', 3]]);
      expect(evalExpr('pi', vars)).toBe(3);
    });

    it('throws on undefined variable', () => {
      expect(() => evalExpr('undefined_var')).toThrow(EvaluationError);
    });
  });

  describe('arithmetic', () => {
    it('evaluates addition', () => {
      expect(evalExpr('2 + 3')).toBe(5);
    });

    it('evaluates subtraction', () => {
      expect(evalExpr('5 - 3')).toBe(2);
    });

    it('evaluates multiplication', () => {
      expect(evalExpr('4 * 5')).toBe(20);
    });

    it('evaluates division', () => {
      expect(evalExpr('10 / 2')).toBe(5);
    });

    it('evaluates modulo', () => {
      expect(evalExpr('10 % 3')).toBe(1);
    });

    it('evaluates exponentiation', () => {
      expect(evalExpr('2 ^ 3')).toBe(8);
    });

    it('evaluates right-associative exponentiation', () => {
      expect(evalExpr('2 ^ 3 ^ 2')).toBe(512); // 2 ^ (3 ^ 2) = 2 ^ 9 = 512
    });
  });

  describe('operator precedence', () => {
    it('multiplication before addition', () => {
      expect(evalExpr('2 + 3 * 4')).toBe(14);
    });

    it('parentheses override precedence', () => {
      expect(evalExpr('(2 + 3) * 4')).toBe(20);
    });

    it('complex expression', () => {
      expect(evalExpr('2 * 3 + 4 * 5')).toBe(26); // 6 + 20
    });
  });

  describe('comparison', () => {
    it('evaluates equality (true)', () => {
      expect(evalExpr('1 == 1')).toBe(1);
    });

    it('evaluates equality (false)', () => {
      expect(evalExpr('1 == 2')).toBe(0);
    });

    it('evaluates inequality', () => {
      expect(evalExpr('1 != 2')).toBe(1);
    });

    it('evaluates less than', () => {
      expect(evalExpr('1 < 2')).toBe(1);
    });

    it('evaluates greater than', () => {
      expect(evalExpr('2 > 1')).toBe(1);
    });

    it('evaluates less or equal', () => {
      expect(evalExpr('1 <= 1')).toBe(1);
    });

    it('evaluates greater or equal', () => {
      expect(evalExpr('1 >= 1')).toBe(1);
    });
  });

  describe('functions', () => {
    it('evaluates sin', () => {
      expect(evalExpr('sin(0)')).toBe(0);
      expect(evalExpr('sin(pi/2)')).toBeCloseTo(1, 10);
    });

    it('evaluates cos', () => {
      expect(evalExpr('cos(0)')).toBe(1);
      expect(evalExpr('cos(pi)')).toBeCloseTo(-1, 10);
    });

    it('evaluates sqrt', () => {
      expect(evalExpr('sqrt(16)')).toBe(4);
    });

    it('evaluates abs', () => {
      expect(evalExpr('abs(-5)')).toBe(5);
    });

    it('evaluates min', () => {
      expect(evalExpr('min(1, 2, 3)')).toBe(1);
    });

    it('evaluates max', () => {
      expect(evalExpr('max(1, 2, 3)')).toBe(3);
    });

    it('evaluates nested functions', () => {
      expect(evalExpr('sqrt(sin(0) + 16)')).toBe(4);
    });

    it('throws on unknown function', () => {
      expect(() => evalExpr('unknown(1)')).toThrow(EvaluationError);
    });

    it('throws on wrong arity', () => {
      expect(() => evalExpr('sin(1, 2)')).toThrow(EvaluationError);
    });
  });

  describe('complex expressions', () => {
    it('evaluates quadratic formula component', () => {
      // b^2 - 4ac for a=1, b=5, c=6
      // 25 - 24 = 1
      const vars = new Map([
        ['a', 1],
        ['b', 5],
        ['c', 6]
      ]);
      expect(evalExpr('b^2 - 4*a*c', vars)).toBe(1);
    });

    it('evaluates trigonometric identity', () => {
      // sin^2(x) + cos^2(x) = 1
      expect(evalExpr('sin(1)^2 + cos(1)^2')).toBeCloseTo(1, 10);
    });

    it('evaluates compound expression', () => {
      expect(evalExpr('2 * (3 + 4) - 5 / 2')).toBe(11.5);
    });
  });

  describe('error handling', () => {
    it('throws on division by zero', () => {
      expect(() => evalExpr('1 / 0')).toThrow(EvaluationError);
    });

    it('throws on modulo by zero', () => {
      expect(() => evalExpr('1 % 0')).toThrow(EvaluationError);
    });

    it('error message includes operation', () => {
      try {
        evalExpr('1 / 0');
      } catch (e: any) {
        expect(e.message).toContain('Division by zero');
      }
    });
  });
});
