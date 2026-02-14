/**
 * Expression Evaluator
 * Evaluates AST nodes to produce numeric results
 */

import { type ASTNode, type LiteralNode, type IdentifierNode, type UnaryNode, type BinaryNode, type CallNode } from './pratt-parser';
import { type RegistryService } from '../services/registry-service';

export interface EvaluateContext {
  registry: RegistryService;
  variables?: Map<string, number>;
}

export class EvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}

/**
 * Evaluate an AST node to produce a numeric result
 */
export function evaluate(ast: ASTNode, context: EvaluateContext): number {
  switch (ast.type) {
    case 'literal':
      return evaluateLiteral(ast);

    case 'identifier':
      return evaluateIdentifier(ast, context);

    case 'unary':
      return evaluateUnary(ast, context);

    case 'binary':
      return evaluateBinary(ast, context);

    case 'call':
      return evaluateCall(ast, context);

    default:
      throw new EvaluationError(`Unknown AST node type: ${(ast as any).type}`);
  }
}

function evaluateLiteral(node: LiteralNode): number {
  return node.value;
}

function evaluateIdentifier(node: IdentifierNode, context: EvaluateContext): number {
  // Check variables first
  if (context.variables?.has(node.name)) {
    return context.variables.get(node.name)!;
  }

  // Check constants
  const constant = context.registry.getConstant(node.name);
  if (constant !== undefined) {
    return constant;
  }

  throw new EvaluationError(`Undefined identifier: ${node.name}`);
}

function evaluateUnary(node: UnaryNode, context: EvaluateContext): number {
  const operand = evaluate(node.operand, context);

  switch (node.operator) {
    case '+':
      return +operand;
    case '-':
      return -operand;
    default:
      throw new EvaluationError(`Unknown unary operator: ${node.operator}`);
  }
}

function evaluateBinary(node: BinaryNode, context: EvaluateContext): number {
  const left = evaluate(node.left, context);
  const right = evaluate(node.right, context);

  switch (node.operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      if (right === 0) {
        throw new EvaluationError('Division by zero');
      }
      return left / right;
    case '%':
      if (right === 0) {
        throw new EvaluationError('Modulo by zero');
      }
      return left % right;
    case '^':
      return Math.pow(left, right);
    case '==':
      return left === right ? 1 : 0;
    case '!=':
      return left !== right ? 1 : 0;
    case '<':
      return left < right ? 1 : 0;
    case '>':
      return left > right ? 1 : 0;
    case '<=':
      return left <= right ? 1 : 0;
    case '>=':
      return left >= right ? 1 : 0;
    default:
      throw new EvaluationError(`Unknown binary operator: ${node.operator}`);
  }
}

function evaluateCall(node: CallNode, context: EvaluateContext): number {
  const fn = context.registry.getFunction(node.callee);
  if (!fn) {
    throw new EvaluationError(`Unknown function: ${node.callee}`);
  }

  // Evaluate arguments
  const args = node.arguments.map((arg) => evaluate(arg, context));

  // Check arity
  if (fn.arity !== 'variadic' && args.length !== fn.arity) {
    throw new EvaluationError(
      `${node.callee} expects ${fn.arity} arguments, got ${args.length}`
    );
  }

  return fn.fn(...args);
}

/**
 * Convenience function to evaluate expression string
 */
export function evaluateExpression(
  input: string,
  tokenizer: { tokenize: (input: string) => any[] },
  parser: { parse: (tokens: any[]) => { ast: ASTNode } },
  context: EvaluateContext
): number {
  const tokens = tokenizer.tokenize(input);
  const { ast } = parser.parse(tokens);
  return evaluate(ast, context);
}

/**
 * Create evaluator with standard registry
 */
export function createStandardEvaluator(): {
  registry: RegistryService;
  evaluate: (input: string, variables?: Map<string, number>) => number;
} {
  const { RegistryService } = require('../services/registry-service');
  const { PrattParser } = require('./pratt-parser');
  const { tokenize } = require('./tokenizer');

  const registry = RegistryService.createStandard();
  const parser = new PrattParser(registry);

  return {
    registry,
    evaluate: (input: string, variables?: Map<string, number>) => {
      const tokens = tokenize(input);
      const { ast } = parser.parse(tokens);
      return evaluate(ast, { registry, variables });
    },
  };
}
