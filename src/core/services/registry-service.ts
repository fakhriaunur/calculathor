/**
 * Registry Service
 * Manages operators, functions, and constants for expression evaluation
 */

import { type FunctionId, type ConstantId, generateFunctionId, generateConstantId } from '../../shared/types/branded';

export interface OperatorDef {
  symbol: string;
  precedence: number;
  associativity: 'left' | 'right';
  arity: 1 | 2;
}

export interface FunctionDef {
  name: string;
  arity: number | 'variadic';
  fn: (...args: number[]) => number;
}

export interface ConstantDef {
  id: ConstantId;
  name: string;
  value: number;
}

export interface FunctionEntry extends FunctionDef {
  id: FunctionId;
}

export class RegistryService {
  private operators = new Map<string, OperatorDef>();
  private functions = new Map<string, FunctionEntry>();
  private constants = new Map<string, ConstantDef>();

  // Operator Management
  registerOperator(def: OperatorDef): void {
    this.operators.set(def.symbol, def);
  }

  getOperator(symbol: string): OperatorDef | undefined {
    return this.operators.get(symbol);
  }

  listOperators(): OperatorDef[] {
    return Array.from(this.operators.values());
  }

  hasOperator(symbol: string): boolean {
    return this.operators.has(symbol);
  }

  // Function Management
  registerFunction(def: FunctionDef): void {
    const entry: FunctionEntry = {
      ...def,
      id: generateFunctionId(),
    };
    this.functions.set(def.name, entry);
  }

  getFunction(name: string): FunctionDef | undefined {
    return this.functions.get(name);
  }

  unregisterFunction(name: string): boolean {
    return this.functions.delete(name);
  }

  listFunctions(): FunctionDef[] {
    return Array.from(this.functions.values());
  }

  hasFunction(name: string): boolean {
    return this.functions.has(name);
  }

  // Constant Management
  registerConstant(name: string, value: number): void {
    const constant: ConstantDef = {
      id: generateConstantId(),
      name,
      value,
    };
    this.constants.set(name, constant);
  }

  getConstant(name: string): number | undefined {
    return this.constants.get(name)?.value;
  }

  listConstants(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [name, def] of this.constants) {
      result.set(name, def.value);
    }
    return result;
  }

  hasConstant(name: string): boolean {
    return this.constants.has(name);
  }

  unregisterConstant(name: string): boolean {
    return this.constants.delete(name);
  }

  // Bulk Operations
  clearOperators(): void {
    this.operators.clear();
  }

  clearFunctions(): void {
    this.functions.clear();
  }

  clearConstants(): void {
    this.constants.clear();
  }

  clear(): void {
    this.clearOperators();
    this.clearFunctions();
    this.clearConstants();
  }

  /**
   * Create registry with standard operators, functions, and constants
   */
  static createStandard(): RegistryService {
    const registry = new RegistryService();

    // Register standard operators
    // Comparison (precedence 20)
    registry.registerOperator({ symbol: '==', precedence: 20, associativity: 'left', arity: 2 });
    registry.registerOperator({ symbol: '!=', precedence: 20, associativity: 'left', arity: 2 });
    registry.registerOperator({ symbol: '<', precedence: 20, associativity: 'left', arity: 2 });
    registry.registerOperator({ symbol: '>', precedence: 20, associativity: 'left', arity: 2 });
    registry.registerOperator({ symbol: '<=', precedence: 20, associativity: 'left', arity: 2 });
    registry.registerOperator({ symbol: '>=', precedence: 20, associativity: 'left', arity: 2 });

    // Additive (precedence 30)
    registry.registerOperator({ symbol: '+', precedence: 30, associativity: 'left', arity: 2 });
    registry.registerOperator({ symbol: '-', precedence: 30, associativity: 'left', arity: 2 });

    // Multiplicative (precedence 40)
    registry.registerOperator({ symbol: '*', precedence: 40, associativity: 'left', arity: 2 });
    registry.registerOperator({ symbol: '/', precedence: 40, associativity: 'left', arity: 2 });
    registry.registerOperator({ symbol: '%', precedence: 40, associativity: 'left', arity: 2 });

    // Exponentiation (precedence 50, right-associative)
    registry.registerOperator({ symbol: '^', precedence: 50, associativity: 'right', arity: 2 });

    // Unary operators (precedence 60)
    registry.registerOperator({ symbol: 'u+', precedence: 60, associativity: 'right', arity: 1 });
    registry.registerOperator({ symbol: 'u-', precedence: 60, associativity: 'right', arity: 1 });

    // Register standard functions
    // Trigonometric
    registry.registerFunction({ name: 'sin', arity: 1, fn: Math.sin });
    registry.registerFunction({ name: 'cos', arity: 1, fn: Math.cos });
    registry.registerFunction({ name: 'tan', arity: 1, fn: Math.tan });
    registry.registerFunction({ name: 'asin', arity: 1, fn: Math.asin });
    registry.registerFunction({ name: 'acos', arity: 1, fn: Math.acos });
    registry.registerFunction({ name: 'atan', arity: 1, fn: Math.atan });
    registry.registerFunction({ name: 'atan2', arity: 2, fn: Math.atan2 });

    // Hyperbolic
    registry.registerFunction({ name: 'sinh', arity: 1, fn: Math.sinh });
    registry.registerFunction({ name: 'cosh', arity: 1, fn: Math.cosh });
    registry.registerFunction({ name: 'tanh', arity: 1, fn: Math.tanh });

    // Exponential and logarithmic
    registry.registerFunction({ name: 'exp', arity: 1, fn: Math.exp });
    registry.registerFunction({ name: 'log', arity: 1, fn: Math.log10 });
    registry.registerFunction({ name: 'ln', arity: 1, fn: Math.log });
    registry.registerFunction({ name: 'log2', arity: 1, fn: Math.log2 });
    registry.registerFunction({ name: 'sqrt', arity: 1, fn: Math.sqrt });
    registry.registerFunction({ name: 'cbrt', arity: 1, fn: Math.cbrt });

    // Rounding
    registry.registerFunction({ name: 'abs', arity: 1, fn: Math.abs });
    registry.registerFunction({ name: 'floor', arity: 1, fn: Math.floor });
    registry.registerFunction({ name: 'ceil', arity: 1, fn: Math.ceil });
    registry.registerFunction({ name: 'round', arity: 1, fn: Math.round });
    registry.registerFunction({ name: 'trunc', arity: 1, fn: Math.trunc });

    // Min/Max
    registry.registerFunction({ name: 'min', arity: 'variadic', fn: Math.min });
    registry.registerFunction({ name: 'max', arity: 'variadic', fn: Math.max });

    // Other
    registry.registerFunction({ name: 'sign', arity: 1, fn: Math.sign });
    registry.registerFunction({ name: 'random', arity: 0, fn: Math.random });

    // Register standard constants
    registry.registerConstant('pi', Math.PI);
    registry.registerConstant('e', Math.E);
    registry.registerConstant('phi', 1.618033988749895);
    registry.registerConstant('tau', Math.PI * 2);
    registry.registerConstant('sqrt2', Math.SQRT2);
    registry.registerConstant('ln2', Math.LN2);
    registry.registerConstant('ln10', Math.LN10);

    return registry;
  }
}
