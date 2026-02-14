// Expression Evaluator for Calculathor
// Evaluates AST nodes from the Pratt parser to JavaScript numbers

export interface ASTNode {
  type: 'literal' | 'identifier' | 'unary' | 'binary' | 'call';
  position: number;
}

export interface LiteralNode extends ASTNode {
  type: 'literal';
  value: number | string;
}

export interface IdentifierNode extends ASTNode {
  type: 'identifier';
  name: string;
}

export interface UnaryNode extends ASTNode {
  type: 'unary';
  operator: string;
  operand: ASTNode;
}

export interface BinaryNode extends ASTNode {
  type: 'binary';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface CallNode extends ASTNode {
  type: 'call';
  callee: string;
  arguments: ASTNode[];
}

export type FunctionDef = (...args: number[]) => number;

export interface EvalContext {
  functions: Map<string, FunctionDef>;
  constants: Map<string, number>;
}

export class EvalError extends Error {
  constructor(message: string, public position: number) {
    super(`${message} at position ${position}`);
    this.name = 'EvalError';
  }
}

// Built-in mathematical functions
const builtinFunctions: Map<string, FunctionDef> = new Map([
  // Trigonometric functions (radians)
  ['sin', Math.sin],
  ['cos', Math.cos],
  ['tan', Math.tan],

  // Logarithmic functions
  ['log', Math.log],       // natural log
  ['log10', Math.log10],
  ['log2', Math.log2],
  ['ln', Math.log],        // alias for log
  ['exp', Math.exp],

  // Other math functions
  ['sqrt', Math.sqrt],
  ['abs', Math.abs],
  ['floor', Math.floor],
  ['ceil', Math.ceil],
  ['round', Math.round],
  ['pow', Math.pow],

  // Min/max (variadic)
  ['min', (...args: number[]) => Math.min(...args)],
  ['max', (...args: number[]) => Math.max(...args)],
]);

// Built-in constants
const builtinConstants: Map<string, number> = new Map([
  ['pi', Math.PI],
  ['e', Math.E],
]);

/**
 * Creates a default evaluation context with built-in functions and constants
 */
export function createDefaultContext(): EvalContext {
  return {
    functions: new Map(builtinFunctions),
    constants: new Map(builtinConstants),
  };
}

/**
 * Evaluates an AST node to a number
 */
export function evaluate(ast: ASTNode, context: EvalContext): number {
  switch (ast.type) {
    case 'literal':
      return evaluateLiteral(ast as LiteralNode);

    case 'identifier':
      return evaluateIdentifier(ast as IdentifierNode, context);

    case 'unary':
      return evaluateUnary(ast as UnaryNode, context);

    case 'binary':
      return evaluateBinary(ast as BinaryNode, context);

    case 'call':
      return evaluateCall(ast as CallNode, context);

    default:
      throw new EvalError(`Unknown AST node type: ${(ast as ASTNode).type}`, ast.position);
  }
}

function evaluateLiteral(node: LiteralNode): number {
  if (typeof node.value === 'number') {
    return node.value;
  }
  // String literals that are numbers (from tokenizer)
  const num = parseFloat(node.value);
  if (isNaN(num)) {
    throw new EvalError(`Invalid numeric literal: ${node.value}`, node.position);
  }
  return num;
}

function evaluateIdentifier(node: IdentifierNode, context: EvalContext): number {
  const value = context.constants.get(node.name);
  if (value === undefined) {
    throw new EvalError(`Undefined constant: ${node.name}`, node.position);
  }
  return value;
}

function evaluateUnary(node: UnaryNode, context: EvalContext): number {
  const operand = evaluate(node.operand, context);

  switch (node.operator) {
    case '+':
      return +operand;
    case '-':
      return -operand;
    default:
      throw new EvalError(`Unknown unary operator: ${node.operator}`, node.position);
  }
}

function evaluateBinary(node: BinaryNode, context: EvalContext): number {
  // Short-circuit for logical operators (not needed for basic math)
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
        throw new EvalError('Division by zero', node.position);
      }
      return left / right;
    case '%':
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
      throw new EvalError(`Unknown binary operator: ${node.operator}`, node.position);
  }
}

function evaluateCall(node: CallNode, context: EvalContext): number {
  const func = context.functions.get(node.callee);
  if (func === undefined) {
    throw new EvalError(`Undefined function: ${node.callee}`, node.position);
  }

  const args = node.arguments.map(arg => evaluate(arg, context));

  try {
    return func(...args);
  } catch (error) {
    if (error instanceof EvalError) {
      throw error;
    }
    throw new EvalError(
      `Function '${node.callee}' failed: ${error instanceof Error ? error.message : String(error)}`,
      node.position
    );
  }
}

export default {
  evaluate,
  createDefaultContext,
  EvalError,
};
