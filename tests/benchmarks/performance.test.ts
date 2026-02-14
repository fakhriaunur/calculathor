/**
 * Performance Benchmarks for Calculathor
 *
 * Comprehensive benchmarks for tokenizer, parser, and evaluator.
 * Uses Bun's built-in test runner with manual timing for benchmarks.
 *
 * Targets:
 * - Tokenize: <0.1ms
 * - Parse: <0.2ms
 * - Evaluate: <0.5ms
 * - Total: <1ms per expression
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { tokenize, Token } from '../../src/parser/tokenizer';
import { parse, ASTNode, OperatorRegistry } from '../../src/parser/pratt';
import { evaluate, createDefaultContext, EvaluateContext } from '../../src/evaluator';

// ============================================================================
// Benchmark Context
// ============================================================================

let cachedTokens: Token[];
let cachedAST: ASTNode;
let cachedContext: EvaluateContext;
let complexExpression: string;
let complexTokens: Token[];
let complexAST: ASTNode;

beforeAll(() => {
  // Pre-compute common values for isolated benchmarks
  cachedContext = createDefaultContext();
  complexExpression = 'sin(pi/2) + sqrt(16) * ln(e) - abs(-5)';
  complexTokens = tokenize(complexExpression);
  complexAST = parse(complexTokens);
});

// ============================================================================
// Benchmark Helper
// ============================================================================

/**
 * Run a benchmark and return average duration in ms
 */
function runBenchmark(name: string, fn: () => void, iterations: number = 1000): number {
  // Warmup
  for (let i = 0; i < 100; i++) {
    fn();
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const duration = performance.now() - start;
  return duration / iterations;
}

// ============================================================================
// Tokenizer Benchmarks
// ============================================================================

describe('Tokenizer Performance', () => {
  it('tokenizes single number quickly', () => {
    const avgMs = runBenchmark('single number', () => {
      tokenize('42');
    });
    expect(avgMs).toBeLessThan(0.1);
  });

  it('tokenizes simple expression quickly', () => {
    const avgMs = runBenchmark('simple expression', () => {
      tokenize('2 + 3 * 4');
    });
    expect(avgMs).toBeLessThan(0.1);
  });

  it('tokenizes function call quickly', () => {
    const avgMs = runBenchmark('function call', () => {
      tokenize('sin(pi / 2)');
    });
    expect(avgMs).toBeLessThan(0.1);
  });

  it('tokenizes complex expression quickly', () => {
    const avgMs = runBenchmark('complex expression', () => {
      tokenize(complexExpression);
    });
    expect(avgMs).toBeLessThan(0.1);
  });

  it('tokenizes long expression (100 tokens) quickly', () => {
    const longExpr = Array(50).fill('1 + ').join('') + '1';
    const avgMs = runBenchmark('long expression', () => {
      tokenize(longExpr);
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  it('tokenizes scientific notation quickly', () => {
    const avgMs = runBenchmark('scientific notation', () => {
      tokenize('1.5e10 + 2.3e-5');
    });
    expect(avgMs).toBeLessThan(0.1);
  });
});

// ============================================================================
// Parser Benchmarks
// ============================================================================

describe('Parser Performance', () => {
  it('parses simple tokens quickly', () => {
    const tokens = tokenize('2 + 3');
    const avgMs = runBenchmark('simple tokens', () => {
      parse(tokens);
    });
    expect(avgMs).toBeLessThan(0.2);
  });

  it('parses arithmetic expression quickly', () => {
    const tokens = tokenize('2 + 3 * 4 - 5 / 2');
    const avgMs = runBenchmark('arithmetic', () => {
      parse(tokens);
    });
    expect(avgMs).toBeLessThan(0.2);
  });

  it('parses parentheses quickly', () => {
    const tokens = tokenize('(2 + 3) * (4 - 1)');
    const avgMs = runBenchmark('parentheses', () => {
      parse(tokens);
    });
    expect(avgMs).toBeLessThan(0.2);
  });

  it('parses function call quickly', () => {
    const tokens = tokenize('sin(pi / 2)');
    const avgMs = runBenchmark('function call', () => {
      parse(tokens);
    });
    expect(avgMs).toBeLessThan(0.2);
  });

  it('parses nested functions quickly', () => {
    const tokens = tokenize('sqrt(sqrt(sqrt(256)))');
    const avgMs = runBenchmark('nested functions', () => {
      parse(tokens);
    });
    expect(avgMs).toBeLessThan(0.2);
  });

  it('parses exponentiation chain quickly', () => {
    const tokens = tokenize('2^3^2^1');
    const avgMs = runBenchmark('exponentiation', () => {
      parse(tokens);
    });
    expect(avgMs).toBeLessThan(0.2);
  });

  it('parses complex expression quickly', () => {
    const avgMs = runBenchmark('complex parse', () => {
      parse(tokenize(complexExpression));
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  it('parses pre-tokenized simple quickly', () => {
    cachedTokens ??= tokenize('2 + 3');
    const avgMs = runBenchmark('pre-tokenized simple', () => {
      parse(cachedTokens);
    });
    expect(avgMs).toBeLessThan(0.2);
  });

  it('parses pre-tokenized complex quickly', () => {
    const avgMs = runBenchmark('pre-tokenized complex', () => {
      parse(complexTokens);
    });
    expect(avgMs).toBeLessThan(0.2);
  });
});

// ============================================================================
// Evaluator Benchmarks
// ============================================================================

describe('Evaluator Performance', () => {
  it('evaluates literal quickly', () => {
    const tokens = tokenize('42');
    const ast = parse(tokens);
    const avgMs = runBenchmark('literal', () => {
      evaluate(ast, cachedContext);
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  it('evaluates simple binary quickly', () => {
    const tokens = tokenize('2 + 3');
    const ast = parse(tokens);
    const avgMs = runBenchmark('simple binary', () => {
      evaluate(ast, cachedContext);
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  it('evaluates arithmetic chain quickly', () => {
    const tokens = tokenize('1 + 2 + 3 + 4 + 5');
    const ast = parse(tokens);
    const avgMs = runBenchmark('arithmetic chain', () => {
      evaluate(ast, cachedContext);
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  it('evaluates with constants quickly', () => {
    const tokens = tokenize('pi + e');
    const ast = parse(tokens);
    const avgMs = runBenchmark('constants', () => {
      evaluate(ast, cachedContext);
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  it('evaluates trigonometric quickly', () => {
    const tokens = tokenize('sin(pi/2) + cos(0)');
    const ast = parse(tokens);
    const avgMs = runBenchmark('trigonometric', () => {
      evaluate(ast, cachedContext);
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  it('evaluates multi-arg function quickly', () => {
    const tokens = tokenize('max(1, 2)');
    const ast = parse(tokens);
    const avgMs = runBenchmark('multi-arg', () => {
      evaluate(ast, cachedContext);
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  it('evaluates nested functions quickly', () => {
    const tokens = tokenize('sqrt(sqrt(16))');
    const ast = parse(tokens);
    const avgMs = runBenchmark('nested eval', () => {
      evaluate(ast, cachedContext);
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  it('evaluates pre-parsed simple quickly', () => {
    cachedAST ??= parse(tokenize('2 + 3'));
    const avgMs = runBenchmark('pre-parsed simple', () => {
      evaluate(cachedAST, cachedContext);
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  it('evaluates pre-parsed complex quickly', () => {
    const avgMs = runBenchmark('pre-parsed complex', () => {
      evaluate(complexAST, cachedContext);
    });
    expect(avgMs).toBeLessThan(0.5);
  });
});

// ============================================================================
// Full Pipeline Benchmarks
// ============================================================================

describe('Full Pipeline Performance', () => {
  it('pipeline: simple expression meets target', () => {
    const avgMs = runBenchmark('pipeline simple', () => {
      const tokens = tokenize('2 + 3 * 4');
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    });
    expect(avgMs).toBeLessThan(1.0);
  });

  it('pipeline: with function meets target', () => {
    const avgMs = runBenchmark('pipeline function', () => {
      const tokens = tokenize('sin(pi/2)');
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    });
    expect(avgMs).toBeLessThan(1.0);
  });

  it('pipeline: complex math meets target', () => {
    const avgMs = runBenchmark('pipeline complex', () => {
      const tokens = tokenize('sqrt(16) + log(e) * abs(-5)');
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    });
    expect(avgMs).toBeLessThan(1.0);
  });

  it('pipeline: full expression meets target', () => {
    const avgMs = runBenchmark('pipeline full', () => {
      const tokens = tokenize('sin(pi/2) + sqrt(16)');
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    });
    expect(avgMs).toBeLessThan(1.0);
  });

  it('pipeline: scientific notation meets target', () => {
    const avgMs = runBenchmark('pipeline scientific', () => {
      const tokens = tokenize('1.5e10 * 2.5e-5');
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    });
    expect(avgMs).toBeLessThan(1.0);
  });

  it('pipeline: deeply nested meets target', () => {
    const avgMs = runBenchmark('pipeline nested', () => {
      const tokens = tokenize('sqrt(sqrt(sqrt(sqrt(65536))))');
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    });
    expect(avgMs).toBeLessThan(1.0);
  });

  it('pipeline: chained exponentiation meets target', () => {
    const avgMs = runBenchmark('pipeline exponentiation', () => {
      const tokens = tokenize('2^3^2');
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    });
    expect(avgMs).toBeLessThan(1.0);
  });
});

// ============================================================================
// Stress Tests
// ============================================================================

describe('Stress Tests', () => {
  it('handles very long addition chain', () => {
    const expr = Array(100).fill('1').join(' + ');
    const avgMs = runBenchmark('stress long addition', () => {
      const tokens = tokenize(expr);
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    }, 100);
    expect(avgMs).toBeLessThan(5.0);
  });

  it('handles deeply nested parentheses', () => {
    let expr = '5';
    for (let i = 0; i < 50; i++) {
      expr = `(${expr})`;
    }
    const avgMs = runBenchmark('stress nested parens', () => {
      const tokens = tokenize(expr);
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    }, 100);
    expect(avgMs).toBeLessThan(5.0);
  });

  it('handles many function calls', () => {
    const expr = Array(20).fill('sin(0)').join(' + ');
    const avgMs = runBenchmark('stress many functions', () => {
      const tokens = tokenize(expr);
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    }, 100);
    expect(avgMs).toBeLessThan(5.0);
  });

  it('handles complex mixed expression', () => {
    const expr = '((sin(pi/2) + cos(0)) * (sqrt(16) - log(e))) / abs(-5)';
    const avgMs = runBenchmark('stress complex mixed', () => {
      const tokens = tokenize(expr);
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    });
    expect(avgMs).toBeLessThan(1.0);
  });
});

// ============================================================================
// Target Validation Benchmarks
// ============================================================================

describe('Target Validation', () => {
  it('target: tokenize <0.1ms', () => {
    const avgMs = runBenchmark('target tokenize', () => {
      tokenize('2 + 3 * 4');
    }, 10000);
    console.log(`  Tokenize avg: ${avgMs.toFixed(4)}ms`);
    expect(avgMs).toBeLessThan(0.1);
  });

  it('target: parse <0.2ms', () => {
    const avgMs = runBenchmark('target parse', () => {
      parse(tokenize('2 + 3 * 4'));
    }, 10000);
    console.log(`  Parse avg: ${avgMs.toFixed(4)}ms`);
    expect(avgMs).toBeLessThan(0.2);
  });

  it('target: evaluate <0.5ms', () => {
    const ast = parse(tokenize('sin(pi/2)'));
    const avgMs = runBenchmark('target evaluate', () => {
      evaluate(ast, cachedContext);
    }, 10000);
    console.log(`  Evaluate avg: ${avgMs.toFixed(4)}ms`);
    expect(avgMs).toBeLessThan(0.5);
  });

  it('target: full pipeline <1ms', () => {
    const avgMs = runBenchmark('target pipeline', () => {
      const tokens = tokenize('sin(pi/2) + sqrt(16)');
      const ast = parse(tokens);
      evaluate(ast, createDefaultContext());
    }, 10000);
    console.log(`  Pipeline avg: ${avgMs.toFixed(4)}ms`);
    expect(avgMs).toBeLessThan(1.0);
  });
});

// ============================================================================
// Memory Benchmarks
// ============================================================================

describe('Memory Efficiency', () => {
  it('handles repeated tokenization efficiently', () => {
    const avgMs = runBenchmark('memory tokenization', () => {
      for (let i = 0; i < 100; i++) {
        tokenize('2 + 3 * sin(pi / 2)');
      }
    }, 100);
    expect(avgMs).toBeLessThan(10);
  });

  it('handles repeated parsing efficiently', () => {
    const tokens = tokenize('2 + 3 * sin(pi / 2)');
    const avgMs = runBenchmark('memory parsing', () => {
      for (let i = 0; i < 100; i++) {
        parse(tokens);
      }
    }, 100);
    expect(avgMs).toBeLessThan(10);
  });

  it('handles repeated evaluation efficiently', () => {
    const ast = parse(tokenize('2 + 3 * sin(pi / 2)'));
    const avgMs = runBenchmark('memory evaluation', () => {
      for (let i = 0; i < 100; i++) {
        evaluate(ast, cachedContext);
      }
    }, 100);
    expect(avgMs).toBeLessThan(10);
  });
});

// ============================================================================
// Comparative Benchmarks
// ============================================================================

describe('Comparative Benchmarks', () => {
  it('compares simple vs complex tokenization', () => {
    const simpleMs = runBenchmark('simple tokenize', () => {
      tokenize('2');
    }, 1000);
    const complexMs = runBenchmark('complex tokenize', () => {
      tokenize('sin(pi/2) + sqrt(16) * log(e)');
    }, 1000);

    console.log(`  Simple: ${simpleMs.toFixed(4)}ms, Complex: ${complexMs.toFixed(4)}ms`);
    expect(complexMs / simpleMs).toBeGreaterThan(1); // Complex should take longer
  });

  it('compares simple vs complex parsing', () => {
    const simpleMs = runBenchmark('simple parse', () => {
      parse(tokenize('2 + 3'));
    }, 1000);
    const complexMs = runBenchmark('complex parse', () => {
      parse(tokenize('sin(pi/2) + sqrt(16)'));
    }, 1000);

    console.log(`  Simple: ${simpleMs.toFixed(4)}ms, Complex: ${complexMs.toFixed(4)}ms`);
    expect(complexMs / simpleMs).toBeGreaterThan(1);
  });

  it('compares simple vs complex evaluation', () => {
    const simpleMs = runBenchmark('simple eval', () => {
      evaluate(parse(tokenize('2 + 3')), cachedContext);
    }, 1000);
    const complexMs = runBenchmark('complex eval', () => {
      evaluate(parse(tokenize('sin(pi/2) + sqrt(16)')), cachedContext);
    }, 1000);

    console.log(`  Simple: ${simpleMs.toFixed(4)}ms, Complex: ${complexMs.toFixed(4)}ms`);
    expect(complexMs / simpleMs).toBeGreaterThan(1);
  });
});

// ============================================================================
// Tracer-Specific Benchmarks (4 Tracers)
// ============================================================================

describe('Tracer-Specific Benchmarks', () => {
  // Tracer 1: Tokenizer output validation
  it('tracer: tokenizer output size', () => {
    const avgMs = runBenchmark('tracer tokenizer', () => {
      const tokens = tokenize('sin(pi/2) + sqrt(16) * log(e) - abs(-5)');
      // Validate token count
      if (tokens.length < 10) throw new Error('Unexpected token count');
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  // Tracer 2: Parser AST structure validation
  it('tracer: parser AST depth', () => {
    const avgMs = runBenchmark('tracer parser', () => {
      const tokens = tokenize('((1 + 2) * (3 + 4)) ^ 2');
      const ast = parse(tokens);
      // AST should have proper structure
      if (ast.type !== 'binary') throw new Error('Expected binary root');
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  // Tracer 3: Evaluator result validation
  it('tracer: evaluator accuracy', () => {
    const avgMs = runBenchmark('tracer evaluator', () => {
      const tokens = tokenize('sin(pi/2)');
      const ast = parse(tokens);
      const result = evaluate(ast, cachedContext);
      if (Math.abs(result - 1) > 1e-10) throw new Error('Precision error');
    });
    expect(avgMs).toBeLessThan(0.5);
  });

  // Tracer 4: End-to-end pipeline validation
  it('tracer: full pipeline', () => {
    const avgMs = runBenchmark('tracer pipeline', () => {
      const tokens = tokenize('sqrt(16) + ln(e)');
      const ast = parse(tokens);
      const result = evaluate(ast, createDefaultContext());
      // sqrt(16) = 4, ln(e) = 1, so result = 5
      if (Math.abs(result - 5) > 1e-10) throw new Error('Pipeline error');
    });
    expect(avgMs).toBeLessThan(1.0);
  });
});
