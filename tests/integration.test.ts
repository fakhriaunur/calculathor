/**
 * Integration Tests for Calculathor
 *
 * End-to-end pipeline tests: tokenizer -> parser -> evaluator
 * Tests the complete expression evaluation flow with various scenarios.
 */

import { describe, it, expect } from 'bun:test';
import { tokenize, Token } from '../src/parser/tokenizer';
import { parse, ASTNode, OperatorRegistry } from '../src/parser/pratt';
import { evaluate, createDefaultContext, EvaluateContext } from '../src/evaluator';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Calculate an expression through the complete pipeline.
 * tokenizer -> parser -> evaluator
 */
function calculate(expression: string): number {
  const tokens = tokenize(expression);
  const ast = parse(tokens);
  const context = createDefaultContext();
  return evaluate(ast, context);
}

/**
 * Calculate with timing information for performance validation
 */
function calculateWithTiming(expression: string): { result: number; duration: number } {
  const start = performance.now();
  const result = calculate(expression);
  const duration = performance.now() - start;
  return { result, duration };
}

// ============================================================================
// Integration Test Suite
// ============================================================================

describe('Integration', () => {
  describe('Basic Arithmetic', () => {
    it('evaluates 2 + 3 * 4 = 14', () => {
      const result = calculate('2 + 3 * 4');
      expect(result).toBe(14);
    });

    it('evaluates simple addition', () => {
      expect(calculate('1 + 1')).toBe(2);
      expect(calculate('10 + 20')).toBe(30);
      expect(calculate('0 + 0')).toBe(0);
    });

    it('evaluates simple subtraction', () => {
      expect(calculate('5 - 3')).toBe(2);
      expect(calculate('10 - 20')).toBe(-10);
      expect(calculate('0 - 5')).toBe(-5);
    });

    it('evaluates simple multiplication', () => {
      expect(calculate('3 * 4')).toBe(12);
      expect(calculate('5 * 0')).toBe(0);
      expect(calculate('-2 * 3')).toBe(-6);
    });

    it('evaluates simple division', () => {
      expect(calculate('10 / 2')).toBe(5);
      expect(calculate('7 / 2')).toBe(3.5);
      expect(calculate('0 / 5')).toBe(0);
    });

    it('throws on division by zero', () => {
      expect(() => calculate('1 / 0')).toThrow('Division by zero');
      expect(() => calculate('10 / (5 - 5)')).toThrow('Division by zero');
    });
  });

  describe('Operator Precedence', () => {
    it('respects multiplication over addition', () => {
      expect(calculate('2 + 3 * 4')).toBe(14);
      expect(calculate('2 * 3 + 4')).toBe(10);
    });

    it('respects division over subtraction', () => {
      expect(calculate('10 - 6 / 2')).toBe(7);
      expect(calculate('10 / 2 - 3')).toBe(2);
    });

    it('evaluates left to right for same precedence', () => {
      expect(calculate('10 - 5 - 2')).toBe(3);
      expect(calculate('20 / 4 / 2')).toBe(2.5);
    });

    it('respects right-associativity of exponentiation: 2^3^2 = 512', () => {
      const result = calculate('2^3^2');
      expect(result).toBe(512);
    });

    it('evaluates chained exponentiation correctly', () => {
      expect(calculate('2^2^2')).toBe(16);  // 2^(2^2) = 2^4 = 16
      expect(calculate('3^2^2')).toBe(81);  // 3^(2^2) = 3^4 = 81
    });

    it('evaluates mixed precedence correctly', () => {
      expect(calculate('1 + 2 * 3 + 4')).toBe(11);
      expect(calculate('10 / 2 * 5')).toBe(25);
      expect(calculate('2^3 + 3^2')).toBe(17);
    });
  });

  describe('Parentheses', () => {
    it('evaluates parenthesized expressions', () => {
      expect(calculate('(2 + 3) * 4')).toBe(20);
      expect(calculate('2 * (3 + 4)')).toBe(14);
    });

    it('handles nested parentheses', () => {
      expect(calculate('((2 + 3) * 4)')).toBe(20);
      expect(calculate('(1 + (2 + 3))')).toBe(6);
      expect(calculate('((1 + 2) * (3 + 4))')).toBe(21);
    });

    it('overrides precedence with parentheses', () => {
      expect(calculate('2 * 3 + 4')).toBe(10);
      expect(calculate('2 * (3 + 4)')).toBe(14);
    });

    it('handles complex nested expressions', () => {
      expect(calculate('((2 + 3) * (4 - 1)) / 3')).toBe(5);
    });
  });

  describe('Trigonometry', () => {
    it('handles trigonometry: sin(pi/2) = 1', () => {
      const result = calculate('sin(pi/2)');
      expect(result).toBeCloseTo(1, 10);
    });

    it('evaluates sin(0) = 0', () => {
      expect(calculate('sin(0)')).toBeCloseTo(0, 10);
    });

    it('evaluates cos(0) = 1', () => {
      expect(calculate('cos(0)')).toBeCloseTo(1, 10);
    });

    it('evaluates cos(pi) = -1', () => {
      expect(calculate('cos(pi)')).toBeCloseTo(-1, 10);
    });

    it('evaluates tan(0) = 0', () => {
      expect(calculate('tan(0)')).toBeCloseTo(0, 10);
    });

    it('evaluates trigonometric identities', () => {
      // sin^2(x) + cos^2(x) = 1
      const x = 0.5;
      const result = calculate(`sin(${x})^2 + cos(${x})^2`);
      expect(result).toBeCloseTo(1, 10);
    });
  });

  describe('Mathematical Functions', () => {
    it('evaluates sqrt', () => {
      expect(calculate('sqrt(16)')).toBe(4);
      expect(calculate('sqrt(2)')).toBeCloseTo(1.41421356, 5);
      expect(calculate('sqrt(0)')).toBe(0);
    });

    it('evaluates base-10 logarithm (log)', () => {
      // log in the evaluator is base-10 (Math.log10)
      expect(calculate('log(100)')).toBe(2);
      expect(calculate('log(1000)')).toBe(3);
      expect(calculate('log(1)')).toBe(0);
    });

    it('evaluates natural logarithm (ln)', () => {
      // ln is natural log (Math.log)
      expect(calculate('ln(e)')).toBeCloseTo(1, 10);
      expect(calculate('ln(1)')).toBeCloseTo(0, 10);
    });

    it('evaluates log10 alias', () => {
      expect(calculate('log10(100)')).toBe(2);
      expect(calculate('log10(1000)')).toBe(3);
    });

    it('evaluates exp', () => {
      expect(calculate('exp(0)')).toBe(1);
      expect(calculate('exp(1)')).toBeCloseTo(Math.E, 10);
    });

    it('evaluates abs', () => {
      expect(calculate('abs(-5)')).toBe(5);
      expect(calculate('abs(5)')).toBe(5);
      expect(calculate('abs(0)')).toBe(0);
    });

    it('evaluates rounding functions', () => {
      expect(calculate('floor(3.7)')).toBe(3);
      expect(calculate('ceil(3.2)')).toBe(4);
      expect(calculate('round(3.5)')).toBe(4);
      expect(calculate('round(3.4)')).toBe(3);
    });

    it('evaluates min and max', () => {
      expect(calculate('min(3, 7)')).toBe(3);
      expect(calculate('max(3, 7)')).toBe(7);
    });

    it('evaluates pow', () => {
      expect(calculate('pow(2, 3)')).toBe(8);
      expect(calculate('pow(3, 2)')).toBe(9);
    });
  });

  describe('Constants', () => {
    it('evaluates pi constant', () => {
      expect(calculate('pi')).toBeCloseTo(Math.PI, 10);
    });

    it('evaluates e constant', () => {
      expect(calculate('e')).toBeCloseTo(Math.E, 10);
    });

    it('uses constants in expressions', () => {
      expect(calculate('2 * pi')).toBeCloseTo(2 * Math.PI, 10);
      expect(calculate('pi + e')).toBeCloseTo(Math.PI + Math.E, 10);
    });
  });

  describe('Unary Operators', () => {
    it('evaluates unary minus', () => {
      expect(calculate('-5')).toBe(-5);
      expect(calculate('--5')).toBe(5);
      expect(calculate('---5')).toBe(-5);
    });

    it('evaluates unary plus', () => {
      expect(calculate('+5')).toBe(5);
      expect(calculate('++5')).toBe(5);
    });

    it('combines unary with binary operators', () => {
      expect(calculate('5 + -3')).toBe(2);
      expect(calculate('-5 + 3')).toBe(-2);
      expect(calculate('-5 * -2')).toBe(10);
    });

    it('handles unary with parentheses', () => {
      expect(calculate('-(3 + 2)')).toBe(-5);
      expect(calculate('-(-5)')).toBe(5);
    });
  });

  describe('Complex Expressions', () => {
    it('evaluates compound expressions', () => {
      const result = calculate('sin(pi/2) + sqrt(16)');
      expect(result).toBeCloseTo(5, 10);
    });

    it('evaluates quadratic formula components', () => {
      // For x^2 - 5x + 6 = 0, roots are at x = 2 and x = 3
      // Discriminant: b^2 - 4ac where a=1, b=-5, c=6
      // = 25 - 24 = 1
      expect(calculate('(-5)^2 - 4 * 1 * 6')).toBe(1);
    });

    it('evaluates scientific expressions', () => {
      // E = mc^2 with m=1, c=299792458
      const c = 299792458;
      expect(calculate(`${c}^2`)).toBeCloseTo(c * c, 0);
    });

    it('evaluates nested function calls', () => {
      expect(calculate('sqrt(sqrt(16))')).toBe(2);
    });

    it('evaluates multi-argument functions', () => {
      expect(calculate('max(1, 2)')).toBe(2);
      expect(calculate('min(1, 2)')).toBe(1);
      expect(calculate('pow(2, 10)')).toBe(1024);
    });
  });

  describe('Decimal and Scientific Notation', () => {
    it('evaluates decimal numbers', () => {
      expect(calculate('3.14159')).toBeCloseTo(3.14159, 5);
      expect(calculate('0.5 + 0.5')).toBe(1);
    });

    it('evaluates numbers starting with dot', () => {
      expect(calculate('.5 + .5')).toBe(1);
      expect(calculate('.25 * 4')).toBe(1);
    });

    it('evaluates scientific notation', () => {
      expect(calculate('1e3')).toBe(1000);
      expect(calculate('1e-3')).toBe(0.001);
      expect(calculate('2.5e2')).toBe(250);
    });

    it('handles very large numbers', () => {
      expect(calculate('1e10 * 1e10')).toBe(1e20);
    });

    it('handles very small numbers', () => {
      const result = calculate('1e-10 * 1e-10');
      expect(result).toBeCloseTo(1e-20, 20);
    });
  });

  describe('Whitespace Handling', () => {
    it('handles no whitespace', () => {
      expect(calculate('2+3')).toBe(5);
      expect(calculate('sin(pi/2)')).toBeCloseTo(1, 10);
    });

    it('handles extra whitespace', () => {
      expect(calculate('  2  +  3  ')).toBe(5);
      expect(calculate('  sin(  pi / 2  )  ')).toBeCloseTo(1, 10);
    });

    it('handles tabs and newlines', () => {
      expect(calculate('2\t+\t3')).toBe(5);
      expect(calculate('2\n+\n3')).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty expression gracefully', () => {
      expect(() => calculate('')).toThrow();
    });

    it('handles single number', () => {
      expect(calculate('42')).toBe(42);
      expect(calculate('0')).toBe(0);
    });

    it('handles single constant', () => {
      expect(calculate('pi')).toBeCloseTo(Math.PI, 10);
    });

    it('handles very long expressions', () => {
      // Expression: 1 + 1 + 1 + ... (100 times)
      const expr = Array(100).fill('1').join(' + ');
      expect(calculate(expr)).toBe(100);
    });

    it('handles deeply nested parentheses', () => {
      let expr = '5';
      for (let i = 0; i < 50; i++) {
        expr = `(${expr})`;
      }
      expect(calculate(expr)).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('throws on unknown identifiers', () => {
      expect(() => calculate('unknown_var')).toThrow(/Unknown identifier/);
    });

    it('throws on unknown functions', () => {
      expect(() => calculate('unknown_func(1)')).toThrow(/Unknown function/);
    });

    it('throws on invalid characters', () => {
      expect(() => calculate('2 @ 3')).toThrow();
    });
  });
});

// ============================================================================
// Performance Validation Tests
// ============================================================================

describe('Performance Targets', () => {
  const TARGET_TOKENIZE_MS = 0.1;
  const TARGET_PARSE_MS = 0.2;
  const TARGET_EVALUATE_MS = 0.5;
  const TARGET_TOTAL_MS = 1.0;

  it(`tokenizes simple expression in <${TARGET_TOKENIZE_MS}ms`, () => {
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      tokenize('2 + 3 * 4');
    }
    const duration = performance.now() - start;
    const avgDuration = duration / iterations;
    expect(avgDuration).toBeLessThan(TARGET_TOKENIZE_MS);
  });

  it(`parses tokens in <${TARGET_PARSE_MS}ms`, () => {
    const tokens = tokenize('2 + 3 * 4');
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      parse(tokens);
    }
    const duration = performance.now() - start;
    const avgDuration = duration / iterations;
    expect(avgDuration).toBeLessThan(TARGET_PARSE_MS);
  });

  it(`evaluates AST in <${TARGET_EVALUATE_MS}ms`, () => {
    const tokens = tokenize('2 + 3 * 4');
    const ast = parse(tokens);
    const context = createDefaultContext();
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      evaluate(ast, context);
    }
    const duration = performance.now() - start;
    const avgDuration = duration / iterations;
    expect(avgDuration).toBeLessThan(TARGET_EVALUATE_MS);
  });

  it(`complete pipeline in <${TARGET_TOTAL_MS}ms`, () => {
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      calculate('sin(pi/2) + sqrt(16)');
    }
    const duration = performance.now() - start;
    const avgDuration = duration / iterations;
    expect(avgDuration).toBeLessThan(TARGET_TOTAL_MS);
  });
});

// ============================================================================
// Property-Based Tests (Manual Implementation)
// ============================================================================

describe('Property-Based Tests', () => {
  const ITERATIONS = 100;

  // Helper to generate random number in range
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;
  const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

  describe('Arithmetic Properties', () => {
    it('commutativity of addition: a + b = b + a', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const a = randInt(-100, 100);
        const b = randInt(-100, 100);
        const left = calculate(`${a} + ${b}`);
        const right = calculate(`${b} + ${a}`);
        expect(left).toBe(right);
      }
    });

    it('associativity of addition: (a + b) + c = a + (b + c)', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const a = randInt(-50, 50);
        const b = randInt(-50, 50);
        const c = randInt(-50, 50);
        const left = calculate(`(${a} + ${b}) + ${c}`);
        const right = calculate(`${a} + (${b} + ${c})`);
        expect(left).toBe(right);
      }
    });

    it('commutativity of multiplication: a * b = b * a', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const a = randInt(-20, 20);
        const b = randInt(-20, 20);
        const left = calculate(`${a} * ${b}`);
        const right = calculate(`${b} * ${a}`);
        expect(left).toBe(right);
      }
    });

    it('associativity of multiplication: (a * b) * c = a * (b * c)', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const a = randInt(-10, 10);
        const b = randInt(-10, 10);
        const c = randInt(-10, 10);
        const left = calculate(`(${a} * ${b}) * ${c}`);
        const right = calculate(`${a} * (${b} * ${c})`);
        expect(left).toBe(right);
      }
    });

    it('distributivity: a * (b + c) = a * b + a * c', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const a = randInt(-10, 10);
        const b = randInt(-10, 10);
        const c = randInt(-10, 10);
        const left = calculate(`${a} * (${b} + ${c})`);
        const right = calculate(`${a} * ${b} + ${a} * ${c}`);
        // Use toBeCloseTo for floating point comparison
        expect(left).toBeCloseTo(right, 10);
      }
    });

    it('identity of addition: a + 0 = a', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const a = randInt(-100, 100);
        expect(calculate(`${a} + 0`)).toBe(a);
      }
    });

    it('identity of multiplication: a * 1 = a', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const a = randInt(-100, 100);
        expect(calculate(`${a} * 1`)).toBe(a);
      }
    });

    it('multiplication by zero: a * 0 = 0', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const a = randInt(-100, 100);
        const result = calculate(`${a} * 0`);
        // Handle -0 vs 0
        expect(result === 0 || result === -0).toBe(true);
      }
    });
  });

  describe('Function Properties', () => {
    it('sqrt(x)^2 = x for x >= 0', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const x = randInt(0, 1000);
        expect(calculate(`sqrt(${x})^2`)).toBeCloseTo(x, 10);
      }
    });

    it('exp(ln(x)) = x for x > 0', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const x = rand(0.001, 100);
        expect(calculate(`exp(ln(${x}))`)).toBeCloseTo(x, 10);
      }
    });

    it('abs(x) >= 0', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const x = rand(-1000, 1000);
        expect(calculate(`abs(${x})`)).toBeGreaterThanOrEqual(0);
      }
    });

    it('abs(x) = abs(-x)', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const x = randInt(-500, 500);
        expect(calculate(`abs(${x})`)).toBe(calculate(`abs(-${x})`));
      }
    });
  });

  describe('Exponentiation Properties', () => {
    it('x^0 = 1 for x != 0', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const x = randInt(-20, 20);
        if (x === 0) continue;
        expect(calculate(`${x}^0`)).toBe(1);
      }
    });

    it('x^1 = x', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const x = randInt(-20, 20);
        expect(calculate(`${x}^1`)).toBe(x);
      }
    });

    it('1^x = 1', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const x = randInt(-10, 10);
        expect(calculate(`1^${x}`)).toBe(1);
      }
    });

    it('x^y * x^z = x^(y+z)', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const x = randInt(2, 5);
        const y = randInt(0, 5);
        const z = randInt(0, 5);
        const left = calculate(`${x}^${y} * ${x}^${z}`);
        const right = calculate(`${x}^(${y}+${z})`);
        expect(left).toBe(right);
      }
    });
  });
});

// ============================================================================
// Pipeline Component Tests (4 Tracers)
// ============================================================================

describe('Pipeline Component Tests', () => {
  it('validates tokenizer output format', () => {
    const tokens = tokenize('2 + 3 * x');

    // Every token should have required fields
    for (const token of tokens) {
      expect(token).toHaveProperty('type');
      expect(token).toHaveProperty('value');
      expect(token).toHaveProperty('position');
      expect(token).toHaveProperty('line');
      expect(token).toHaveProperty('column');
    }

    // Last token should be EOF
    expect(tokens[tokens.length - 1].type).toBe('EOF');
  });

  it('validates parser output format', () => {
    const tokens = tokenize('2 + 3');
    const ast = parse(tokens);

    // AST should have type property
    expect(ast).toHaveProperty('type');
    expect(ast.type).toBe('binary');
  });

  it('validates all node types in complex expression', () => {
    const tokens = tokenize('sin(pi) + -3 * sqrt(16)');
    const ast = parse(tokens);

    // Should be a binary + at root
    expect(ast.type).toBe('binary');
    if (ast.type === 'binary') {
      // Left should be function call
      expect(ast.left.type).toBe('call');
      // Right should be binary *
      expect(ast.right.type).toBe('binary');
    }
  });

  it('validates evaluator handles all node types', () => {
    // Literal
    expect(calculate('42')).toBe(42);

    // Identifier (constant)
    expect(calculate('pi')).toBeCloseTo(Math.PI, 10);

    // Unary
    expect(calculate('-5')).toBe(-5);
    expect(calculate('+5')).toBe(5);

    // Binary
    expect(calculate('2 + 3')).toBe(5);

    // Call
    expect(calculate('sin(0)')).toBe(0);
  });
});
