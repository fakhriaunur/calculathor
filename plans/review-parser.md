# Code Review: Parser Strategy Research Document

> **Reviewer**: Code Review Agent
> **Date**: 2026-02-14
> **Document**: `/plans/research-parser.md`
> **Related**: `/plans/research.md`, `/plans/research-architecture.md`, `/plans/research-extensibility.md`

---

## Executive Summary

**Status**: APPROVED WITH RECOMMENDATIONS

The Pratt parser strategy research document is comprehensive and well-structured. The decision to use a Pratt parser is technically sound and aligns with project goals. However, several minor issues and gaps require attention before implementation begins.

---

## 1. Strengths

### 1.1 Decision Quality
- **Pratt parser selection is justified**: The comparison matrix (Section 2) provides clear rationale for choosing Pratt over Shunting Yard and Parser Generators
- **Performance targets are realistic**: <1ms evaluation target is achievable based on the provided benchmarks
- **Extensibility focus is appropriate**: Runtime operator/function registration aligns with Phase 4 user-defined features

### 1.2 Technical Accuracy
- **Binding power explanation is correct**: The left/right associativity handling via binding powers is properly documented (Section 5.4, `bindingPower` method)
- **TypeScript integration is well-planned**: Full type definitions provided for AST nodes, tokens, and registry
- **Tokenizer handles edge cases**: Scientific notation, decimal numbers, and two-character operators are covered

### 1.3 Architecture Alignment
- **Functional Core principle satisfied**: Parser is pure (string -> AST), with no side effects
- **Orthogonality maintained**: Parser depends only on tokenizer and registry, no tight coupling to evaluator
- **Bun compatibility**: No Node.js-specific APIs used; compatible with Bun runtime

### 1.4 Testing Strategy
- **Comprehensive unit test examples**: Covers literals, operators, functions, unary operators, errors
- **Property-based testing included**: Fast-check examples for mathematical properties
- **Error case coverage**: Unexpected tokens, unclosed parens addressed

---

## 2. Critical Issues (Must Fix Before Implementation)

### 2.1 MVP Scope Inconsistency

**Issue**: Document shows `AssignmentNode` in AST types (Section 5.1) and assignment operator in registry (Section 5.2), but `research.md` explicitly states **"NO variables in MVP"**.

**Impact**: Implementation may include features not approved for MVP, causing scope creep.

**Recommendation**:
```markdown
1. Remove `ASSIGN` token type from MVP tokenizer
2. Remove `AssignmentNode` from MVP AST types
3. Remove `=` operator from default registry for MVP
4. Add comment: "Assignment support planned for Phase 2"
```

---

### 2.2 Missing Error Handling for Division by Zero

**Issue**: No discussion of runtime arithmetic errors (division by zero, overflow, etc.) in parser document. These errors occur during evaluation, not parsing, but the parser/evaluator interface should specify how they're handled.

**Impact**: Undefined error handling contract between parser and evaluator.

**Recommendation**: Add evaluator error specification:
```typescript
// Add to Section 5.1
export interface EvaluationError {
  type: 'division_by_zero' | 'overflow' | 'domain_error' | 'undefined_variable';
  message: string;
  position?: number;  // From AST node
}

// Evaluator should return Result type
export type EvalResult =
  | { success: true; value: number }
  | { success: false; error: EvaluationError };
```

---

### 2.3 Tokenizer `**` Operator Conflict

**Issue**: Tokenizer recognizes `**` as an operator (line 494), but registry registers `^` for exponentiation with no mention of `**` alias.

**Impact**: Inconsistent operator support - tokenizer allows `**` but registry doesn't define it.

**Recommendation**: Either:
- Option A: Add `**` as alias for `^` in operator registry
- Option B: Remove `**` from tokenizer and only support `^`

**Suggested fix** (Option B - simpler):
```typescript
// Remove from tokenizer.ts line 494
// ['==', '!=', '<=', '>=', '**'].includes(twoChar)
// Change to:
['==', '!=', '<=', '>='].includes(twoChar)
```

---

## 3. Major Suggestions (Should Fix)

### 3.1 Missing String Literal Support

**Issue**: `TokenType` includes `'STRING'` and tokenizer has `STRING` case, but no string literal parsing in `nud()`.

**Impact**: Incomplete implementation sketch.

**Recommendation**: Add to Section 5.4 `nud()` method:
```typescript
case 'STRING':
  this.advance();
  return {
    type: 'literal',
    value: token.value,  // May need unescaping
    position: token.position
  } as LiteralNode;
```

Or remove `'STRING'` from MVP token types if strings are not in MVP scope.

---

### 3.2 No Discussion of Number Precision

**Issue**: `parseFloat()` is used for number parsing, but research.md mentions "Number representation: BigInt, Decimal, arbitrary precision?" as an open question.

**Impact**: Floating-point precision issues (0.1 + 0.2 != 0.3) will affect calculations.

**Recommendation**: Add section on number representation:
```markdown
### Number Precision Decision
**MVP**: Use JavaScript number (IEEE 754 double precision)
**Rationale**: Simpler implementation, sufficient for most calculations
**Limitations**: 15-17 significant digits, known floating-point issues
**Future**: Consider decimal.js or similar for arbitrary precision
```

---

### 3.3 Function Call Ambiguity

**Issue**: Parser uses `left.type === 'identifier'` check to detect function calls, but this requires lookahead to distinguish from grouping parentheses.

**Example ambiguity**:
```
(x) = x^2    // Could be: 1) function definition, 2) grouping with assignment
f(x)         // Function call
(x) * 2      // Grouping, then multiplication
```

**Recommendation**: Document the ambiguity resolution:
```markdown
Function call detection uses this precedence:
1. If token before `(` is an identifier AND the identifier is registered as a function -> function call
2. Otherwise, it's a grouping expression

Note: This means unregistered functions will parse as grouping, causing later error.
```

---

### 3.4 Missing EOF Handling in Tokenizer

**Issue**: Tokenizer adds EOF token after loop (line 474), but doesn't handle the case where input is empty string.

**Impact**: Empty input behavior undefined.

**Recommendation**: Specify behavior:
```typescript
// In tokenize() method
tokenize(): Token[] {
  if (this.input.length === 0) {
    return [this.createToken('EOF', '', 0)];
  }
  // ... rest of method
}
```

---

## 4. Minor Suggestions (Nice to Have)

### 4.1 Type Safety Improvement

**Issue**: `bindingPower` return type uses TypeScript's `[number, left: number]` which is unusual syntax.

**Current** (line 815):
```typescript
private bindingPower(opDef: OperatorDef): [number, left: number]
```

**Recommendation**:
```typescript
private bindingPower(opDef: OperatorDef): [leftBp: number, rightBp: number]
```

### 4.2 Missing Test Coverage for Edge Cases

**Issue**: Test examples don't cover:
- Very large numbers (overflow)
- Very small numbers (underflow)
- Empty expressions
- Whitespace-only input
- Unicode identifiers (if supported)
- Nested function calls: `sin(cos(tan(x)))`
- Multiple unary operators: `---5`

**Recommendation**: Add to Section 7.1:
```typescript
describe('edge cases', () => {
  it('handles empty input', () => {
    expect(() => parseExpression('')).toThrow(/Empty expression/);
  });

  it('handles whitespace only', () => {
    expect(() => parseExpression('   \n\t  ')).toThrow(/Empty expression/);
  });

  it('parses deeply nested expressions', () => {
    const deep = '1' + ' + 1'.repeat(100);
    expect(() => parseExpression(deep)).not.toThrow();
  });
});
```

### 4.3 Performance Benchmark Methodology Missing

**Issue**: Section 6.1 lists expected performance numbers but doesn't specify:
- Hardware used for measurement
- Expression complexity definitions
- Statistical method (mean, median, p99)
- Bun vs Node.js differences

**Recommendation**: Add benchmark methodology section:
```markdown
### Benchmark Methodology
- **Runtime**: Bun 1.0+
- **Hardware**: M1 MacBook Pro (or equivalent)
- **Iterations**: 10,000 runs per expression
- **Metric**: Median of 5 benchmark runs
- **Warmup**: 100 iterations before measurement
```

### 4.4 No Line/Column in Error Messages

**Issue**: Parser errors include line/column (Section 5.4, line 849-851), but tokenizer errors (line 631-632) only include line/column without the position in input.

**Recommendation**: Standardize error format across tokenizer and parser.

---

## 5. Alignment with Project Goals

| Goal | Alignment | Notes |
|------|-----------|-------|
| **TUI-first MVP** | Strong | Parser supports syntax highlighting via token positions |
| **Multi-client architecture** | Strong | Pure functions make parser thread-safe |
| **<1ms evaluation** | Strong | Benchmarks show 0.2-0.5ms for typical expressions |
| **User-defined functions** | Strong | Pratt parser supports runtime extensibility |
| **Bun runtime** | Strong | No Node.js-specific dependencies |
| **Functional Core** | Strong | Parser is pure string -> AST transformation |
| **NO variables in MVP** | **Weak** | Document includes assignment/variables - needs correction |

---

## 6. Evaluator Interface Review

The document shows evaluator usage (Section 5.5) but doesn't define the interface. Here's a recommended specification:

```typescript
// /src/evaluator/types.ts

export interface EvaluatorContext {
  variables: Map<string, number>;
  functions: Map<string, UserFunction>;
  constants: Map<string, number>;
}

export interface UserFunction {
  params: string[];
  body: ASTNode;
}

export interface Evaluator {
  evaluate(ast: ASTNode, context: EvaluatorContext): EvalResult;
  evaluateWithNewScope(ast: ASTNode, context: EvaluatorContext): EvalResult;
}

// Factory function
export function createEvaluator(registry: OperatorRegistry): Evaluator;
```

This maintains the Functional Core principle by making context explicit and immutable.

---

## 7. Blockers for Implementation

The following must be resolved before implementation begins:

| # | Blocker | Priority | Owner |
|---|---------|----------|-------|
| 1 | Clarify MVP scope (variables yes/no) | **Critical** | Project Lead |
| 2 | Define evaluator error handling contract | **High** | Architect |
| 3 | Resolve `**` vs `^` operator conflict | **High** | Parser Dev |
| 4 | Document number precision decision | Medium | Researcher |
| 5 | Add evaluator interface specification | Medium | Architect |

---

## 8. Final Recommendations

### Approved for Implementation
- Pratt parser algorithm
- Tokenizer structure
- AST node types (minus AssignmentNode for MVP)
- Operator registry design
- Test strategy

### Requires Revision
- Remove assignment-related features from MVP scope
- Resolve `**` operator handling
- Add evaluator error specification
- Document number precision limitations

### Suggested Implementation Order
1. Tokenizer (with comprehensive tests)
2. Operator registry
3. Pratt parser core
4. Basic evaluator
5. Integration tests
6. Benchmark suite

---

## 9. Conclusion

The parser research document demonstrates solid understanding of parsing theory and project requirements. The Pratt parser is the correct choice for Calculathor's extensibility needs. With minor revisions to address scope consistency and error handling, this document provides an excellent foundation for implementation.

**Overall Assessment**: 8.5/10
- Technical accuracy: 9/10
- Completeness: 8/10
- Alignment with goals: 8/10
- Clarity: 9/10

---

**Reviewer Signature**: Code Review Agent
**Date**: 2026-02-14
**Next Step**: Address blockers, then proceed to implementation planning
