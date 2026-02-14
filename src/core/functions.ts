/**
 * Function Registry for User-Defined Functions
 * Supports syntax: f(x) = x^2 + 2*x + 1
 */

import type { ASTNode } from '../parser/pratt';
import { parse, tokenize, Token } from '../parser/index';
import type { EvaluateContext } from '../evaluator/index';
import { evaluate } from '../evaluator/index';

// Types
export interface UserFunction {
  name: string;
  params: string[];
  body: ASTNode;
  createdAt: number;
}

export interface BuiltinFunction {
  name: string;
  arity: number;
  fn: (...args: number[]) => number;
}

export type FunctionDef =
  | { type: 'builtin'; def: BuiltinFunction }
  | { type: 'user'; def: UserFunction };

// AST Substitution for parameter replacement
export function substituteParams(
  node: ASTNode,
  paramMap: Map<string, ASTNode>
): ASTNode {
  switch (node.type) {
    case 'literal':
      return { ...node };

    case 'identifier': {
      const replacement = paramMap.get(node.name);
      if (replacement) {
        return { ...replacement };
      }
      return { ...node };
    }

    case 'unary':
      return {
        ...node,
        operand: substituteParams(node.operand, paramMap),
      };

    case 'binary':
      return {
        ...node,
        left: substituteParams(node.left, paramMap),
        right: substituteParams(node.right, paramMap),
      };

    case 'call':
      return {
        ...node,
        arguments: node.arguments.map((arg) => substituteParams(arg, paramMap)),
      };

    default:
      return { ...node };
  }
}

// Function Registry
export class FunctionRegistry {
  private builtins: Map<string, BuiltinFunction>;
  private userFunctions: Map<string, UserFunction>;
  private onChange?: (name: string, fn: UserFunction | null) => void;

  constructor(
    builtins?: Map<string, BuiltinFunction>,
    onChange?: (name: string, fn: UserFunction | null) => void
  ) {
    this.builtins = builtins ?? createDefaultBuiltins();
    this.userFunctions = new Map();
    this.onChange = onChange;
  }

  registerBuiltin(name: string, arity: number, fn: (...args: number[]) => number): void {
    this.builtins.set(name, { name, arity, fn });
  }

  registerUserFunction(def: UserFunction): void {
    if (this.builtins.has(def.name)) {
      throw new Error(`Cannot override built-in function '${def.name}'`);
    }
    this.userFunctions.set(def.name, def);
    this.onChange?.(def.name, def);
  }

  unregisterUserFunction(name: string): boolean {
    const existed = this.userFunctions.delete(name);
    if (existed) {
      this.onChange?.(name, null);
    }
    return existed;
  }

  lookup(name: string): FunctionDef | null {
    const builtin = this.builtins.get(name);
    if (builtin) {
      return { type: 'builtin', def: builtin };
    }
    const user = this.userFunctions.get(name);
    if (user) {
      return { type: 'user', def: user };
    }
    return null;
  }

  isBuiltin(name: string): boolean {
    return this.builtins.has(name);
  }

  isUserDefined(name: string): boolean {
    return this.userFunctions.has(name);
  }

  getUserFunctions(): UserFunction[] {
    return Array.from(this.userFunctions.values());
  }

  getBuiltinFunctions(): BuiltinFunction[] {
    return Array.from(this.builtins.values());
  }

  // For persistence layer
  serializeUserFunctions(): string {
    const data = Array.from(this.userFunctions.values()).map((fn) => ({
      name: fn.name,
      params: fn.params,
      body: fn.body,
      createdAt: fn.createdAt,
    }));
    return JSON.stringify(data);
  }

  deserializeUserFunctions(serialized: string): void {
    const data: UserFunction[] = JSON.parse(serialized);
    for (const fn of data) {
      this.userFunctions.set(fn.name, fn);
    }
  }
}

// Create default builtins matching evaluator's defaults
function createDefaultBuiltins(): Map<string, BuiltinFunction> {
  const builtins = new Map<string, BuiltinFunction>();

  const addFn = (name: string, arity: number, fn: (...args: number[]) => number) => {
    builtins.set(name, { name, arity, fn });
  };

  addFn('sin', 1, Math.sin);
  addFn('cos', 1, Math.cos);
  addFn('tan', 1, Math.tan);
  addFn('asin', 1, Math.asin);
  addFn('acos', 1, Math.acos);
  addFn('atan', 1, Math.atan);
  addFn('sqrt', 1, Math.sqrt);
  addFn('log', 1, Math.log);
  addFn('log10', 1, Math.log10);
  addFn('log2', 1, Math.log2);
  addFn('exp', 1, Math.exp);
  addFn('abs', 1, Math.abs);
  addFn('floor', 1, Math.floor);
  addFn('ceil', 1, Math.ceil);
  addFn('round', 1, Math.round);
  addFn('max', 2, Math.max);
  addFn('min', 2, Math.min);
  addFn('pow', 2, Math.pow);

  return builtins;
}

// Parser for function definitions: "f(x) = x^2 + 1"
export interface ParseFunctionResult {
  name: string;
  params: string[];
  body: ASTNode;
}

export class FunctionParseError extends Error {
  constructor(message: string, public position?: number) {
    super(message);
    this.name = 'FunctionParseError';
  }
}

export function parseFunctionDefinition(input: string): ParseFunctionResult {
  const trimmed = input.trim();

  // Tokenize
  const tokens = tokenize(trimmed);

  // Parse: name(param1, param2, ...) = expression
  const parser = new FunctionDefinitionParser(tokens);
  return parser.parse();
}

class FunctionDefinitionParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private peek(offset: number): Token | null {
    const idx = this.pos + offset;
    return idx < this.tokens.length ? this.tokens[idx] : null;
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: string, value?: string): Token {
    const token = this.current();
    if (token.type !== type || (value && token.value !== value)) {
      throw new FunctionParseError(
        `Expected ${type}${value ? ` '${value}'` : ''}, got ${token.type} '${token.value}'`,
        token.position.offset
      );
    }
    return this.advance();
  }

  parse(): ParseFunctionResult {
    // Expect function name (identifier)
    const nameToken = this.expect('IDENTIFIER');
    const name = nameToken.value;

    // Expect opening paren
    this.expect('LPAREN');

    // Parse parameters
    const params: string[] = [];
    if (this.current().type !== 'RPAREN') {
      const param = this.expect('IDENTIFIER');
      params.push(param.value);

      while (this.current().type === 'COMMA') {
        this.advance(); // consume comma
        const nextParam = this.expect('IDENTIFIER');
        params.push(nextParam.value);
      }
    }

    // Expect closing paren
    this.expect('RPAREN');

    // Expect equals sign
    this.expect('OPERATOR', '=');

    // Parse the body expression (remaining tokens)
    const bodyTokens = this.tokens.slice(this.pos);
    if (bodyTokens.length === 0 || (bodyTokens.length === 1 && bodyTokens[0].type === 'EOF')) {
      throw new FunctionParseError('Function body cannot be empty');
    }

    // Remove EOF token from body for parsing
    const bodyTokensWithoutEOF = bodyTokens.filter((t) => t.type !== 'EOF');
    if (bodyTokensWithoutEOF.length === 0) {
      throw new FunctionParseError('Function body cannot be empty');
    }

    const body = parse([...bodyTokensWithoutEOF, { type: 'EOF', value: '', position: { offset: 0, line: 1, column: 1 } }]);

    return { name, params, body };
  }
}

// Evaluate with user function support
export function evaluateWithUserFunctions(
  node: ASTNode,
  context: EvaluateContext,
  registry: FunctionRegistry
): number {
  // Create a wrapped functions map that checks user functions first
  const wrappedFunctions = new Proxy(context.functions, {
    get: (target, prop: string) => {
      // Check if it's a user-defined function
      const funcDef = registry.lookup(prop);
      if (funcDef?.type === 'user') {
        // Return a wrapper that evaluates the user function
        return (...args: number[]) => {
          const userFn = funcDef.def;

          if (args.length !== userFn.params.length) {
            throw new Error(
              `Function '${prop}' expects ${userFn.params.length} arguments, got ${args.length}`
            );
          }

          // Create parameter map
          const paramMap = new Map<string, ASTNode>();
          for (let i = 0; i < userFn.params.length; i++) {
            paramMap.set(userFn.params[i], {
              type: 'literal',
              value: args[i],
            } as ASTNode);
          }

          // Substitute and evaluate
          const substitutedBody = substituteParams(userFn.body, paramMap);
          return evaluateWithUserFunctions(substitutedBody, context, registry);
        };
      }

      // Fall through to built-in
      return target.get(prop);
    },
  });

  const wrappedContext: EvaluateContext = {
    ...context,
    functions: wrappedFunctions,
  };

  return evaluate(node, wrappedContext);
}

// Utility to create a UserFunction from parsed definition
export function createUserFunction(
  name: string,
  params: string[],
  body: ASTNode
): UserFunction {
  return {
    name,
    params,
    body,
    createdAt: Date.now(),
  };
}
