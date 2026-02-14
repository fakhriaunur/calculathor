/**
 * Pratt Parser (Top-Down Operator Precedence)
 *
 * Pure functional parser for mathematical expressions.
 * Follows Functional Core principle - no side effects.
 */

import { Token, TokenType } from './tokenizer';

// ============================================================================
// AST Node Types
// ============================================================================

export type ASTNode =
  | LiteralNode
  | IdentifierNode
  | UnaryNode
  | BinaryNode
  | CallNode;

export interface SourcePosition {
  offset: number;
  line: number;
  column: number;
}

export interface LiteralNode {
  type: 'literal';
  value: number;
  position: SourcePosition;
}

export interface IdentifierNode {
  type: 'identifier';
  name: string;
  position: SourcePosition;
}

export interface UnaryNode {
  type: 'unary';
  operator: string;
  operand: ASTNode;
  position: SourcePosition;
}

export interface BinaryNode {
  type: 'binary';
  operator: string;
  left: ASTNode;
  right: ASTNode;
  position: SourcePosition;
}

export interface CallNode {
  type: 'call';
  callee: string;
  arguments: ASTNode[];
  position: SourcePosition;
}

// ============================================================================
// Operator Registry
// ============================================================================

export type Associativity = 'left' | 'right';

export interface OperatorDef {
  symbol: string;
  precedence: number;
  associativity: Associativity;
  arity: 1 | 2;
}

/**
 * Operator Registry for runtime operator configuration.
 * Enables extensibility for user-defined operators.
 */
export class OperatorRegistry {
  private operators = new Map<string, OperatorDef>();

  registerOperator(
    op: string,
    precedence: number,
    associativity: Associativity,
    arity: 1 | 2 = 2
  ): void {
    this.operators.set(op, { symbol: op, precedence, associativity, arity });
  }

  getOperator(symbol: string): OperatorDef | undefined {
    return this.operators.get(symbol);
  }

  hasOperator(symbol: string): boolean {
    return this.operators.has(symbol);
  }

  static createDefault(): OperatorRegistry {
    const r = new OperatorRegistry();
    // Precedence: +,- (10), *,/ (20), ^ (30, right-assoc)
    r.registerOperator('+', 10, 'left', 2);
    r.registerOperator('-', 10, 'left', 2);
    r.registerOperator('*', 20, 'left', 2);
    r.registerOperator('/', 20, 'left', 2);
    r.registerOperator('^', 30, 'right', 2);
    r.registerOperator('u+', 40, 'right', 1);
    r.registerOperator('u-', 40, 'right', 1);
    return r;
  }
}

// ============================================================================
// Parse Error
// ============================================================================

export class ParseError extends Error {
  constructor(message: string) {
    super(`Parse error: ${message}`);
    this.name = 'ParseError';
  }
}

// ============================================================================
// Binding Power
// ============================================================================

function bindingPower(op: OperatorDef): [number, number] {
  const { precedence: p, associativity: a } = op;
  return a === 'left' ? [p, p + 1] : [p + 1, p];
}

// ============================================================================
// Pratt Parser
// ============================================================================

class Parser {
  private tokens: Token[];
  private pos = 0;
  private registry: OperatorRegistry;

  constructor(tokens: Token[], registry: OperatorRegistry) {
    this.tokens = tokens;
    this.registry = registry;
    if (tokens.length === 0 || tokens[tokens.length - 1]!.type !== 'EOF') {
      this.tokens.push({ type: 'EOF', value: '', position: { offset: 0, line: 0, column: 0 } });
    }
  }

  private current(): Token {
    return this.tokens[this.pos]!;
  }

  private advance(): Token {
    const t = this.current();
    if (t.type !== 'EOF') this.pos++;
    return t;
  }

  private expect(type: TokenType): Token {
    const t = this.current();
    if (t.type !== type) throw new ParseError(`Expected ${type}, got ${t.type}`);
    return this.advance();
  }

  parse(): ASTNode {
    const result = this.expression(0);
    if (this.current().type !== 'EOF') {
      throw new ParseError(`Unexpected token: ${this.current().value}`);
    }
    return result;
  }

  private expression(minBp: number): ASTNode {
    let left = this.nud();

    while (true) {
      const t = this.current();
      if (t.type === 'EOF' || t.type === 'RPAREN' || t.type === 'COMMA') break;

      // Function call: identifier(...)
      if (t.type === 'LPAREN' && left.type === 'identifier') {
        left = this.parseCall(left.name, left.position);
        continue;
      }

      if (t.type !== 'OPERATOR') break;

      const opDef = this.registry.getOperator(t.value);
      if (!opDef || opDef.arity !== 2) break;

      const [leftBp, rightBp] = bindingPower(opDef);
      if (leftBp < minBp) break;

      this.advance();
      const right = this.expression(rightBp);
      left = { type: 'binary', operator: t.value, left, right, position: t.position };
    }

    return left;
  }

  private nud(): ASTNode {
    const t = this.advance();

    switch (t.type) {
      case 'NUMBER':
        return { type: 'literal', value: parseFloat(t.value), position: t.position };

      case 'IDENTIFIER':
        return { type: 'identifier', name: t.value, position: t.position };

      case 'LPAREN': {
        const expr = this.expression(0);
        this.expect('RPAREN');
        return expr;
      }

      case 'OPERATOR': {
        if (t.value === '+' || t.value === '-') {
          const op = t.value === '+' ? 'u+' : 'u-';
          const opDef = this.registry.getOperator(op);
          if (!opDef) throw new ParseError(`Unknown unary: ${t.value}`);
          const [, rightBp] = bindingPower(opDef);
          const operand = this.expression(rightBp);
          return { type: 'unary', operator: t.value, operand, position: t.position };
        }
        throw new ParseError(`Unexpected operator: ${t.value}`);
      }

      default:
        throw new ParseError(`Unexpected: ${t.type}`);
    }
  }

  private parseCall(callee: string, position: SourcePosition): CallNode {
    this.advance(); // consume '('
    const args: ASTNode[] = [];

    if (this.current().type !== 'RPAREN') {
      args.push(this.expression(0));
      while (this.current().type === 'COMMA') {
        this.advance();
        args.push(this.expression(0));
      }
    }

    this.expect('RPAREN');
    return { type: 'call', callee, arguments: args, position };
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse tokens into an AST using Pratt parser.
 */
export function parse(tokens: Token[], registry = OperatorRegistry.createDefault()): ASTNode {
  return new Parser(tokens, registry).parse();
}
