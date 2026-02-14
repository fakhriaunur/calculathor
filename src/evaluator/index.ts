// Expression Evaluator - Functional Core
import type { ASTNode, SourcePosition } from '../parser/pratt';
export type { ASTNode, SourcePosition };

export interface FunctionDef {
  name: string;
  arity: number | 'variadic';
  fn: (...args: number[]) => number;
}

export interface EvalContext {
  functions: Map<string, FunctionDef>;
  constants: Map<string, number>;
}

export class EvalError extends Error {
  constructor(message: string, public readonly position: number) {
    super(message);
    this.name = 'EvalError';
    Object.setPrototypeOf(this, EvalError.prototype);
  }
}

const BUILT_IN_FUNCTIONS: FunctionDef[] = [
  { name: 'sin', arity: 1, fn: Math.sin },
  { name: 'cos', arity: 1, fn: Math.cos },
  { name: 'tan', arity: 1, fn: Math.tan },
  { name: 'log', arity: 1, fn: Math.log10 },
  { name: 'log10', arity: 1, fn: Math.log10 },
  { name: 'ln', arity: 1, fn: Math.log },
  { name: 'exp', arity: 1, fn: Math.exp },
  { name: 'sqrt', arity: 1, fn: Math.sqrt },
  { name: 'pow', arity: 2, fn: Math.pow },
  { name: 'abs', arity: 1, fn: Math.abs },
  { name: 'floor', arity: 1, fn: Math.floor },
  { name: 'ceil', arity: 1, fn: Math.ceil },
  { name: 'round', arity: 1, fn: Math.round },
  { name: 'min', arity: 'variadic', fn: (...a) => a.length ? Math.min(...a) : (() => { throw new Error('min requires 1+ args') })() },
  { name: 'max', arity: 'variadic', fn: (...a) => a.length ? Math.max(...a) : (() => { throw new Error('max requires 1+ args') })() },
];

const BUILT_IN_CONSTANTS: [string, number][] = [['pi', Math.PI], ['e', Math.E]];

export function createDefaultContext(): EvalContext {
  return {
    functions: new Map(BUILT_IN_FUNCTIONS.map(f => [f.name, f])),
    constants: new Map(BUILT_IN_CONSTANTS),
  };
}

export function evaluate(ast: ASTNode, context: EvalContext): number {
  return evalNode(ast, context);
}

function evalNode(node: ASTNode, ctx: EvalContext): number {
  switch (node.type) {
    case 'literal': return node.value;
    case 'identifier': return evalIdent(node, ctx);
    case 'unary': return evalUnary(node, ctx);
    case 'binary': return evalBinary(node, ctx);
    case 'call': return evalCall(node, ctx);
    default: throw new EvalError('Unknown node type', node.position.offset);
  }
}

function evalIdent(n: Extract<ASTNode, { type: 'identifier' }>, ctx: EvalContext): number {
  const v = ctx.constants.get(n.name);
  if (v === undefined) throw new EvalError(`Unknown identifier: ${n.name}`, n.position.offset);
  return v;
}

function evalUnary(n: Extract<ASTNode, { type: 'unary' }>, ctx: EvalContext): number {
  const op = evalNode(n.operand, ctx);
  switch (n.operator) {
    case '+': return +op;
    case '-': return -op;
    case '!': return op === 0 ? 1 : 0;
    default: throw new EvalError(`Unknown unary: ${n.operator}`, n.position.offset);
  }
}

function evalBinary(n: Extract<ASTNode, { type: 'binary' }>, ctx: EvalContext): number {
  const l = evalNode(n.left, ctx), r = evalNode(n.right, ctx);
  switch (n.operator) {
    case '+': return l + r;
    case '-': return l - r;
    case '*': return l * r;
    case '/':
      if (r === 0) throw new EvalError('Division by zero', n.position.offset);
      return l / r;
    case '%':
      if (r === 0) throw new EvalError('Modulo by zero', n.position.offset);
      return l % r;
    case '^':
    case '**': return Math.pow(l, r);
    case '==': return l === r ? 1 : 0;
    case '!=': return l !== r ? 1 : 0;
    case '<': return l < r ? 1 : 0;
    case '>': return l > r ? 1 : 0;
    case '<=': return l <= r ? 1 : 0;
    case '>=': return l >= r ? 1 : 0;
    default: throw new EvalError(`Unknown binary: ${n.operator}`, n.position.offset);
  }
}

function evalCall(n: Extract<ASTNode, { type: 'call' }>, ctx: EvalContext): number {
  const fn = ctx.functions.get(n.callee);
  if (!fn) throw new EvalError(`Unknown function: ${n.callee}`, n.position.offset);
  const args = n.arguments.map(a => evalNode(a, ctx));
  if (fn.arity !== 'variadic' && args.length !== fn.arity) {
    throw new EvalError(`'${n.callee}' expects ${fn.arity} args, got ${args.length}`, n.position.offset);
  }
  if (fn.arity === 'variadic' && args.length === 0) {
    throw new EvalError(`'${n.callee}' requires 1+ args`, n.position.offset);
  }
  try { return fn.fn(...args); }
  catch (e) { throw new EvalError(`'${n.callee}': ${e instanceof Error ? e.message : 'failed'}`, n.position.offset); }
}
