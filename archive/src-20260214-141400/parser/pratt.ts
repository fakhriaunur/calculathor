/**
 * Pratt Parser (Top-Down Operator Precedence)
 * Parses expressions with operator precedence using binding powers.
 */

// Token Types (interface from tokenizer)
export type TokenType = 'NUMBER' | 'IDENTIFIER' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
  line: number;
  column: number;
}

// AST Node Types
export type ASTNodeType = 'literal' | 'identifier' | 'unary' | 'binary' | 'call';

export interface ASTNode { type: ASTNodeType; position: number; }
export interface LiteralNode extends ASTNode { type: 'literal'; value: number; }
export interface IdentifierNode extends ASTNode { type: 'identifier'; name: string; }
export interface UnaryNode extends ASTNode { type: 'unary'; operator: string; operand: ASTNode; }
export interface BinaryNode extends ASTNode { type: 'binary'; operator: string; left: ASTNode; right: ASTNode; }
export interface CallNode extends ASTNode { type: 'call'; callee: string; arguments: ASTNode[]; }

// Operator Definitions
export interface OperatorDef { precedence: number; associativity: 'left' | 'right'; }

// Default operators: +-(1), */(2), ^(3), unary(4)
const DEFAULT_OPERATORS = new Map<string, OperatorDef>([
  ['+', { precedence: 10, associativity: 'left' }],
  ['-', { precedence: 10, associativity: 'left' }],
  ['*', { precedence: 20, associativity: 'left' }],
  ['/', { precedence: 20, associativity: 'left' }],
  ['^', { precedence: 30, associativity: 'right' }],
  ['u+', { precedence: 40, associativity: 'right' }],
  ['u-', { precedence: 40, associativity: 'right' }],
]);

export class PrattParser {
  private tokens: Token[];
  private position = 0;
  private operators: Map<string, OperatorDef>;

  constructor(tokens: Token[], operators?: Map<string, OperatorDef>) {
    this.tokens = tokens;
    this.operators = operators ? new Map(operators) : new Map(DEFAULT_OPERATORS);
  }

  parse(): ASTNode {
    const result = this.expression(0);
    if (this.current().type !== 'EOF') throw this.error('Unexpected token after expression');
    return result;
  }

  // Core Pratt algorithm
  private expression(minBp: number): ASTNode {
    let left = this.nud();

    while (true) {
      const token = this.current();
      if (token.type === 'EOF' || token.type === 'RPAREN' || token.type === 'COMMA') break;

      // Function call: identifier(...)
      if (token.type === 'LPAREN' && left.type === 'identifier') {
        left = this.parseFunctionCall(left as IdentifierNode);
        continue;
      }

      if (token.type !== 'OPERATOR') throw this.error(`Expected operator, got ${token.type}`);

      const op = token.value;
      const opDef = this.operators.get(op);
      if (!opDef) throw this.error(`Unknown operator: ${op}`);

      const [leftBp] = this.bindingPower(opDef);
      if (leftBp < minBp) break;

      this.advance();
      left = this.led(left, op, opDef);
    }

    return left;
  }

  // Null denotation - handles tokens at start of expression
  private nud(): ASTNode {
    const token = this.current();

    switch (token.type) {
      case 'NUMBER':
        this.advance();
        return { type: 'literal', value: parseFloat(token.value), position: token.position };

      case 'IDENTIFIER':
        this.advance();
        return { type: 'identifier', name: token.value, position: token.position };

      case 'OPERATOR':
        if (token.value === '+' || token.value === '-') {
          const opKey = token.value === '+' ? 'u+' : 'u-';
          const opDef = this.operators.get(opKey);
          if (!opDef) throw this.error(`Unknown prefix operator: ${token.value}`);
          this.advance();
          const [, rightBp] = this.bindingPower(opDef);
          const operand = this.expression(rightBp);
          return { type: 'unary', operator: token.value, operand, position: token.position };
        }
        throw this.error(`Unexpected operator: ${token.value}`);

      case 'LPAREN':
        this.advance();
        const expr = this.expression(0);
        this.expect('RPAREN', "Expected ')'");
        return expr;

      default:
        throw this.error(`Unexpected token: ${token.type}`);
    }
  }

  // Left denotation - handles infix operators
  private led(left: ASTNode, op: string, opDef: OperatorDef): BinaryNode {
    const [, rightBp] = this.bindingPower(opDef);
    const right = this.expression(rightBp);
    return { type: 'binary', operator: op, left, right, position: left.position };
  }

  private parseFunctionCall(callee: IdentifierNode): CallNode {
    this.advance();
    const args: ASTNode[] = [];

    if (this.current().type !== 'RPAREN') {
      do {
        args.push(this.expression(0));
        if (this.current().type === 'COMMA') this.advance();
        else break;
      } while (true);
    }

    this.expect('RPAREN', "Expected ')' after arguments");
    return { type: 'call', callee: callee.name, arguments: args, position: callee.position };
  }

  // Calculate binding powers: [left_bp, right_bp]
  private bindingPower(opDef: OperatorDef): [number, number] {
    const { precedence, associativity } = opDef;
    // Left-assoc: (a op b) op c -> left=precedence, right=precedence+1
    // Right-assoc: a op (b op c) -> left=precedence+1, right=precedence
    return associativity === 'left'
      ? [precedence, precedence + 1]
      : [precedence + 1, precedence];
  }

  private current(): Token { return this.tokens[this.position]; }

  private advance(): Token {
    const token = this.tokens[this.position];
    if (this.position < this.tokens.length - 1) this.position++;
    return token;
  }

  private expect(type: TokenType, message: string): void {
    if (this.current().type !== type) throw this.error(message);
    this.advance();
  }

  private error(message: string): SyntaxError {
    const t = this.current();
    return new SyntaxError(`${message} at line ${t.line}, column ${t.column} (${t.type}: ${t.value})`);
  }
}

// Parse tokens into AST
export function parse(tokens: Token[]): ASTNode {
  return new PrattParser(tokens).parse();
}

// Register a custom operator
export function registerOperator(ops: Map<string, OperatorDef>, symbol: string, def: OperatorDef): void {
  ops.set(symbol, def);
}
