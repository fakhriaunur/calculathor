/**
 * Pratt Parser (Top-Down Operator Precedence)
 * Parses tokens into an Abstract Syntax Tree (AST)
 */

import { type Token, type TokenType, type SourcePosition } from './tokenizer';
import { type OperatorDef, RegistryService } from '../services/registry-service';

export type ASTNode =
  | LiteralNode
  | IdentifierNode
  | UnaryNode
  | BinaryNode
  | CallNode;

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

export interface ParseResult {
  ast: ASTNode;
  tokens: Token[];
}

export class ParseError extends Error {
  constructor(
    message: string,
    public position: SourcePosition
  ) {
    super(`${message} at line ${position.line}, column ${position.column}`);
    this.name = 'ParseError';
  }
}

export class PrattParser {
  private tokens: Token[] = [];
  private position = 0;
  private registry: RegistryService;

  constructor(registry?: RegistryService) {
    this.registry = registry ?? RegistryService.createStandard();
  }

  /**
   * Parse tokens into an AST
   */
  parse(tokens: Token[]): ParseResult {
    this.tokens = tokens;
    this.position = 0;

    const ast = this.expression(0);

    // Check for unexpected tokens after parsing
    const current = this.current();
    if (current.type !== 'EOF') {
      throw new ParseError(
        `Unexpected token: ${current.type}`,
        current.position
      );
    }

    return { ast, tokens };
  }

  /**
   * Parse expression with minimum binding power
   */
  private expression(minBp: number): ASTNode {
    // Parse the left side using nud (null denotation)
    let left = this.nud();

    // Parse infix operators using led (left denotation)
    while (true) {
      const token = this.current();

      // Stop at EOF or delimiters
      if (
        token.type === 'EOF' ||
        token.type === 'RPAREN' ||
        token.type === 'COMMA'
      ) {
        break;
      }

      // Handle function calls: identifier followed by '('
      if (token.type === 'LPAREN' && left.type === 'identifier') {
        left = this.parseFunctionCall(left as IdentifierNode);
        continue;
      }

      // Must be an operator
      if (token.type !== 'OPERATOR') {
        throw new ParseError(
          `Expected operator, got ${token.type}`,
          token.position
        );
      }

      const opDef = this.registry.getOperator(token.value);
      if (!opDef) {
        throw new ParseError(
          `Unknown operator: ${token.value}`,
          token.position
        );
      }

      // Only handle binary operators in led
      if (opDef.arity !== 2) {
        break;
      }

      const [leftBp, rightBp] = this.bindingPower(opDef);

      // If left binding power is less than minimum, we're done
      if (leftBp < minBp) {
        break;
      }

      // Consume operator
      this.advance();

      // Parse right side with right binding power
      const right = this.expression(rightBp);

      // Build binary node
      left = {
        type: 'binary',
        operator: token.value,
        left,
        right,
        position: left.position,
      };
    }

    return left;
  }

  /**
   * Null denotation - handles tokens at expression start
   */
  private nud(): ASTNode {
    const token = this.current();

    switch (token.type) {
      case 'NUMBER':
        this.advance();
        return {
          type: 'literal',
          value: parseFloat(token.value),
          position: token.position,
        };

      case 'IDENTIFIER':
        this.advance();
        return {
          type: 'identifier',
          name: token.value,
          position: token.position,
        };

      case 'OPERATOR':
        // Prefix operators (unary +, -)
        if (token.value === '+' || token.value === '-') {
          const op = token.value === '+' ? 'u+' : 'u-';
          const opDef = this.registry.getOperator(op);
          if (!opDef) {
            throw new ParseError(
              `Unary operator not registered: ${op}`,
              token.position
            );
          }

          this.advance();
          const [, rightBp] = this.bindingPower(opDef);
          const operand = this.expression(rightBp);

          return {
            type: 'unary',
            operator: token.value,
            operand,
            position: token.position,
          };
        }

        throw new ParseError(
          `Unexpected operator: ${token.value}`,
          token.position
        );

      case 'LPAREN':
        this.advance(); // consume '('
        const expr = this.expression(0);
        this.expect('RPAREN', "Expected ')'");
        return expr;

      default:
        throw new ParseError(
          `Unexpected token: ${token.type}`,
          token.position
        );
    }
  }

  /**
   * Parse function call
   */
  private parseFunctionCall(callee: IdentifierNode): CallNode {
    this.expect('LPAREN', "Expected '('");

    const args: ASTNode[] = [];

    // Empty argument list
    if (this.current().type === 'RPAREN') {
      this.advance();
      return {
        type: 'call',
        callee: callee.name,
        arguments: args,
        position: callee.position,
      };
    }

    // Parse arguments
    while (true) {
      args.push(this.expression(0));

      if (this.current().type === 'COMMA') {
        this.advance();
        continue;
      }

      if (this.current().type === 'RPAREN') {
        this.advance();
        break;
      }

      throw new ParseError(
        "Expected ',' or ')'",
        this.current().position
      );
    }

    return {
      type: 'call',
      callee: callee.name,
      arguments: args,
      position: callee.position,
    };
  }

  /**
   * Calculate binding power for operator
   */
  private bindingPower(opDef: OperatorDef): [number, number] {
    const { precedence, associativity } = opDef;

    if (associativity === 'left') {
      // Left-associative: (a op b) op c
      // Left bp higher so we group left first
      return [precedence, precedence + 1];
    } else {
      // Right-associative: a op (b op c)
      // Right bp higher so we group right first
      return [precedence + 1, precedence];
    }
  }

  /**
   * Get current token
   */
  private current(): Token {
    return this.tokens[this.position] ?? this.tokens[this.tokens.length - 1];
  }

  /**
   * Advance to next token
   */
  private advance(): Token {
    const token = this.current();
    if (this.position < this.tokens.length - 1) {
      this.position++;
    }
    return token;
  }

  /**
   * Expect specific token type
   */
  private expect(type: TokenType, message: string): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new ParseError(message, token.position);
    }
    return this.advance();
  }
}

/**
 * Convenience function to parse expression string
 */
export function parse(
  input: string,
  tokenizer: { tokenize: (input: string) => Token[] },
  registry?: RegistryService
): ParseResult {
  const tokens = tokenizer.tokenize(input);
  const parser = new PrattParser(registry);
  return parser.parse(tokens);
}

/**
 * Format AST for debugging
 */
export function formatAST(node: ASTNode, indent = 0): string {
  const spaces = '  '.repeat(indent);

  switch (node.type) {
    case 'literal':
      return `${spaces}Literal(${node.value})`;

    case 'identifier':
      return `${spaces}Identifier(${node.name})`;

    case 'unary':
      return `${spaces}Unary(${node.operator})\n${formatAST(
        node.operand,
        indent + 1
      )}`;

    case 'binary':
      return `${spaces}Binary(${node.operator})\n${formatAST(
        node.left,
        indent + 1
      )}\n${formatAST(node.right, indent + 1)}`;

    case 'call':
      const args = node.arguments
        .map((arg) => formatAST(arg, indent + 1))
        .join('\n');
      return `${spaces}Call(${node.callee})\n${args}`;

    default:
      return `${spaces}Unknown`;
  }
}
