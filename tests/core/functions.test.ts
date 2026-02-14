/**
 * Tests for User-Defined Functions
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  FunctionRegistry,
  parseFunctionDefinition,
  substituteParams,
  createUserFunction,
  evaluateWithUserFunctions,
  UserFunction,
  FunctionParseError,
} from '../../src/core/functions';
import { parse, tokenize } from '../../src/parser/index';
import { createDefaultContext, evaluate } from '../../src/evaluator/index';

describe('FunctionRegistry', () => {
  let registry: FunctionRegistry;

  beforeEach(() => {
    registry = new FunctionRegistry();
  });

  describe('registerBuiltin', () => {
    it('should register a built-in function', () => {
      registry.registerBuiltin('custom', 1, (x) => x * 2);

      const def = registry.lookup('custom');
      expect(def).toBeDefined();
      expect(def?.type).toBe('builtin');
      expect(def?.def.name).toBe('custom');
    });

    it('should override existing built-in', () => {
      registry.registerBuiltin('sin', 1, (x) => x * 2);

      const def = registry.lookup('sin');
      expect(def?.type).toBe('builtin');
    });
  });

  describe('registerUserFunction', () => {
    it('should register a user function', () => {
      const fn: UserFunction = {
        name: 'square',
        params: ['x'],
        body: { type: 'identifier', name: 'x' },
        createdAt: Date.now(),
      };

      registry.registerUserFunction(fn);

      const def = registry.lookup('square');
      expect(def).toBeDefined();
      expect(def?.type).toBe('user');
      expect(def?.def.name).toBe('square');
    });

    it('should throw when trying to override built-in', () => {
      const fn: UserFunction = {
        name: 'sin',
        params: ['x'],
        body: { type: 'identifier', name: 'x' },
        createdAt: Date.now(),
      };

      expect(() => registry.registerUserFunction(fn)).toThrow(
        "Cannot override built-in function 'sin'"
      );
    });
  });

  describe('lookup', () => {
    it('should return null for unknown function', () => {
      expect(registry.lookup('unknown')).toBeNull();
    });

    it('should lookup built-in function', () => {
      const def = registry.lookup('sin');
      expect(def?.type).toBe('builtin');
      expect(def?.def.name).toBe('sin');
    });

    it('should prefer user function over built-in check', () => {
      const fn: UserFunction = {
        name: 'myFunc',
        params: ['x'],
        body: { type: 'identifier', name: 'x' },
        createdAt: Date.now(),
      };
      registry.registerUserFunction(fn);

      const def = registry.lookup('myFunc');
      expect(def?.type).toBe('user');
    });
  });

  describe('isBuiltin', () => {
    it('should return true for built-in functions', () => {
      expect(registry.isBuiltin('sin')).toBe(true);
      expect(registry.isBuiltin('sqrt')).toBe(true);
    });

    it('should return false for user functions', () => {
      const fn: UserFunction = {
        name: 'custom',
        params: ['x'],
        body: { type: 'identifier', name: 'x' },
        createdAt: Date.now(),
      };
      registry.registerUserFunction(fn);

      expect(registry.isBuiltin('custom')).toBe(false);
    });
  });

  describe('getUserFunctions', () => {
    it('should return empty array initially', () => {
      expect(registry.getUserFunctions()).toEqual([]);
    });

    it('should return all user functions', () => {
      const fn1: UserFunction = {
        name: 'f1',
        params: ['x'],
        body: { type: 'identifier', name: 'x' },
        createdAt: 1000,
      };
      const fn2: UserFunction = {
        name: 'f2',
        params: ['y'],
        body: { type: 'identifier', name: 'y' },
        createdAt: 2000,
      };

      registry.registerUserFunction(fn1);
      registry.registerUserFunction(fn2);

      const fns = registry.getUserFunctions();
      expect(fns).toHaveLength(2);
      expect(fns.map((f) => f.name).sort()).toEqual(['f1', 'f2']);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize user functions', () => {
      const fn: UserFunction = {
        name: 'square',
        params: ['x'],
        body: {
          type: 'binary',
          operator: '*',
          left: { type: 'identifier', name: 'x' },
          right: { type: 'identifier', name: 'x' },
        },
        createdAt: 12345,
      };

      registry.registerUserFunction(fn);

      const serialized = registry.serializeUserFunctions();
      const newRegistry = new FunctionRegistry();
      newRegistry.deserializeUserFunctions(serialized);

      const retrieved = newRegistry.lookup('square');
      expect(retrieved?.type).toBe('user');
      expect(retrieved?.def.name).toBe('square');
      expect((retrieved?.def as UserFunction).params).toEqual(['x']);
    });
  });

  describe('onChange callback', () => {
    it('should call callback when registering user function', () => {
      const changes: Array<{ name: string; fn: UserFunction | null }> = [];
      const onChange = (name: string, fn: UserFunction | null) => {
        changes.push({ name, fn });
      };

      const registryWithCallback = new FunctionRegistry(undefined, onChange);

      const fn: UserFunction = {
        name: 'test',
        params: ['x'],
        body: { type: 'identifier', name: 'x' },
        createdAt: Date.now(),
      };

      registryWithCallback.registerUserFunction(fn);

      expect(changes).toHaveLength(1);
      expect(changes[0].name).toBe('test');
      expect(changes[0].fn).toEqual(fn);
    });

    it('should call callback when unregistering', () => {
      const changes: Array<{ name: string; fn: UserFunction | null }> = [];
      const onChange = (name: string, fn: UserFunction | null) => {
        changes.push({ name, fn });
      };

      const registryWithCallback = new FunctionRegistry(undefined, onChange);

      const fn: UserFunction = {
        name: 'test',
        params: ['x'],
        body: { type: 'identifier', name: 'x' },
        createdAt: Date.now(),
      };

      registryWithCallback.registerUserFunction(fn);
      registryWithCallback.unregisterUserFunction('test');

      expect(changes).toHaveLength(2);
      expect(changes[1].name).toBe('test');
      expect(changes[1].fn).toBeNull();
    });
  });
});

describe('parseFunctionDefinition', () => {
  it('should parse simple function: f(x) = x + 1', () => {
    const result = parseFunctionDefinition('f(x) = x + 1');

    expect(result.name).toBe('f');
    expect(result.params).toEqual(['x']);
    expect(result.body.type).toBe('binary');
  });

  it('should parse function with multiple params: g(x, y) = x * y', () => {
    const result = parseFunctionDefinition('g(x, y) = x * y');

    expect(result.name).toBe('g');
    expect(result.params).toEqual(['x', 'y']);
    expect(result.body.type).toBe('binary');
  });

  it('should parse quadratic function: f(x) = x^2 + 2*x + 1', () => {
    const result = parseFunctionDefinition('f(x) = x^2 + 2*x + 1');

    expect(result.name).toBe('f');
    expect(result.params).toEqual(['x']);
    expect(result.body.type).toBe('binary');
  });

  it('should parse function with complex body: h(a, b, c) = a^2 + b^2 + c^2', () => {
    const result = parseFunctionDefinition('h(a, b, c) = a^2 + b^2 + c^2');

    expect(result.name).toBe('h');
    expect(result.params).toEqual(['a', 'b', 'c']);
  });

  it('should handle whitespace variations', () => {
    const result = parseFunctionDefinition('f(x)=x+1');

    expect(result.name).toBe('f');
    expect(result.params).toEqual(['x']);
  });

  it('should throw on empty body', () => {
    expect(() => parseFunctionDefinition('f(x) =')).toThrow(FunctionParseError);
  });

  it('should throw on missing equals', () => {
    expect(() => parseFunctionDefinition('f(x) x + 1')).toThrow(FunctionParseError);
  });

  it('should throw on missing name', () => {
    expect(() => parseFunctionDefinition('(x) = x + 1')).toThrow(FunctionParseError);
  });

  it('should throw on missing parens', () => {
    expect(() => parseFunctionDefinition('f x = x + 1')).toThrow(FunctionParseError);
  });
});

describe('substituteParams', () => {
  it('should substitute single parameter', () => {
    const node = { type: 'identifier', name: 'x' } as const;
    const paramMap = new Map([['x', { type: 'literal', value: 5 } as const]]);

    const result = substituteParams(node, paramMap);

    expect(result.type).toBe('literal');
    expect((result as { value: number }).value).toBe(5);
  });

  it('should leave non-matching identifiers unchanged', () => {
    const node = { type: 'identifier', name: 'y' } as const;
    const paramMap = new Map([['x', { type: 'literal', value: 5 } as const]]);

    const result = substituteParams(node, paramMap);

    expect(result.type).toBe('identifier');
    expect((result as { name: string }).name).toBe('y');
  });

  it('should substitute in binary expressions', () => {
    const node = {
      type: 'binary',
      operator: '+',
      left: { type: 'identifier', name: 'x' },
      right: { type: 'identifier', name: 'y' },
    } as const;

    const paramMap = new Map([
      ['x', { type: 'literal', value: 3 }],
      ['y', { type: 'literal', value: 4 }],
    ]);

    const result = substituteParams(node, paramMap);

    expect(result.type).toBe('binary');
    expect((result as { left: { value: number } }).left.value).toBe(3);
    expect((result as { right: { value: number } }).right.value).toBe(4);
  });

  it('should substitute in unary expressions', () => {
    const node = {
      type: 'unary',
      operator: '-',
      operand: { type: 'identifier', name: 'x' },
    } as const;

    const paramMap = new Map([['x', { type: 'literal', value: 5 }]]);

    const result = substituteParams(node, paramMap);

    expect(result.type).toBe('unary');
    expect((result as { operand: { value: number } }).operand.value).toBe(5);
  });

  it('should substitute in function calls', () => {
    const node = {
      type: 'call',
      callee: 'sin',
      arguments: [{ type: 'identifier', name: 'x' }],
    } as const;

    const paramMap = new Map([['x', { type: 'literal', value: 1.57 }]]);

    const result = substituteParams(node, paramMap);

    expect(result.type).toBe('call');
    expect((result as { arguments: [{ value: number }] }).arguments[0].value).toBe(1.57);
  });

  it('should handle nested substitutions', () => {
    const node = {
      type: 'binary',
      operator: '*',
      left: { type: 'identifier', name: 'x' },
      right: {
        type: 'binary',
        operator: '+',
        left: { type: 'identifier', name: 'y' },
        right: { type: 'literal', value: 2 },
      },
    } as const;

    const paramMap = new Map([
      ['x', { type: 'literal', value: 3 }],
      ['y', { type: 'literal', value: 4 }],
    ]);

    const result = substituteParams(node, paramMap);

    expect(result.type).toBe('binary');
    expect((result as { left: { value: number } }).left.value).toBe(3);
  });
});

describe('evaluateWithUserFunctions', () => {
  let registry: FunctionRegistry;
  let context: ReturnType<typeof createDefaultContext>;

  beforeEach(() => {
    registry = new FunctionRegistry();
    context = createDefaultContext();
  });

  it('should evaluate user-defined square function', () => {
    // Define f(x) = x^2
    const fnDef = parseFunctionDefinition('f(x) = x^2');
    const userFn = createUserFunction(fnDef.name, fnDef.params, fnDef.body);
    registry.registerUserFunction(userFn);

    // Evaluate f(5)
    const callNode = {
      type: 'call',
      callee: 'f',
      arguments: [{ type: 'literal', value: 5 }],
    } as const;

    const result = evaluateWithUserFunctions(callNode, context, registry);
    expect(result).toBe(25);
  });

  it('should evaluate quadratic function', () => {
    // Define f(x) = x^2 + 2*x + 1
    const fnDef = parseFunctionDefinition('f(x) = x^2 + 2*x + 1');
    const userFn = createUserFunction(fnDef.name, fnDef.params, fnDef.body);
    registry.registerUserFunction(userFn);

    // Evaluate f(3) = 9 + 6 + 1 = 16
    const callNode = {
      type: 'call',
      callee: 'f',
      arguments: [{ type: 'literal', value: 3 }],
    } as const;

    const result = evaluateWithUserFunctions(callNode, context, registry);
    expect(result).toBe(16);
  });

  it('should evaluate multi-parameter function', () => {
    // Define g(x, y) = x * y + x + y
    const fnDef = parseFunctionDefinition('g(x, y) = x * y + x + y');
    const userFn = createUserFunction(fnDef.name, fnDef.params, fnDef.body);
    registry.registerUserFunction(userFn);

    // Evaluate g(2, 3) = 6 + 2 + 3 = 11
    const callNode = {
      type: 'call',
      callee: 'g',
      arguments: [
        { type: 'literal', value: 2 },
        { type: 'literal', value: 3 },
      ],
    } as const;

    const result = evaluateWithUserFunctions(callNode, context, registry);
    expect(result).toBe(11);
  });

  it('should throw on wrong number of arguments', () => {
    const fnDef = parseFunctionDefinition('f(x) = x + 1');
    const userFn = createUserFunction(fnDef.name, fnDef.params, fnDef.body);
    registry.registerUserFunction(userFn);

    const callNode = {
      type: 'call',
      callee: 'f',
      arguments: [
        { type: 'literal', value: 1 },
        { type: 'literal', value: 2 },
      ],
    } as const;

    expect(() => evaluateWithUserFunctions(callNode, context, registry)).toThrow(
      "Function 'f' expects 1 arguments, got 2"
    );
  });

  it('should fall back to built-in when not user-defined', () => {
    // sin should still work as built-in
    const callNode = {
      type: 'call',
      callee: 'sin',
      arguments: [{ type: 'literal', value: 0 }],
    } as const;

    const result = evaluateWithUserFunctions(callNode, context, registry);
    expect(result).toBeCloseTo(0);
  });

  it('should evaluate nested user function calls', () => {
    // Define f(x) = x^2
    const fDef = parseFunctionDefinition('f(x) = x^2');
    const fFn = createUserFunction(fDef.name, fDef.params, fDef.body);
    registry.registerUserFunction(fFn);

    // Define g(x) = f(x) + 1
    const gDef = parseFunctionDefinition('g(x) = f(x) + 1');
    const gFn = createUserFunction(gDef.name, gDef.params, gDef.body);
    registry.registerUserFunction(gFn);

    // Evaluate g(3) = f(3) + 1 = 9 + 1 = 10
    const callNode = {
      type: 'call',
      callee: 'g',
      arguments: [{ type: 'literal', value: 3 }],
    } as const;

    const result = evaluateWithUserFunctions(callNode, context, registry);
    expect(result).toBe(10);
  });
});

describe('Integration: parse -> evaluate with user functions', () => {
  let registry: FunctionRegistry;

  beforeEach(() => {
    registry = new FunctionRegistry();
  });

  it('should parse and evaluate complete workflow', () => {
    // Define f(x) = 2*x + 1
    const fnDef = parseFunctionDefinition('f(x) = 2*x + 1');
    const userFn = createUserFunction(fnDef.name, fnDef.params, fnDef.body);
    registry.registerUserFunction(userFn);

    // Parse a call to f
    const tokens = tokenize('f(5)');
    const ast = parse(tokens);

    // Evaluate
    const context = createDefaultContext();
    const result = evaluateWithUserFunctions(ast, context, registry);

    expect(result).toBe(11); // 2*5 + 1 = 11
  });

  it('should handle user function in complex expression', () => {
    // Define square(x) = x^2
    const fnDef = parseFunctionDefinition('square(x) = x^2');
    const userFn = createUserFunction(fnDef.name, fnDef.params, fnDef.body);
    registry.registerUserFunction(userFn);

    // Parse: square(3) + square(4)
    const tokens = tokenize('square(3) + square(4)');
    const ast = parse(tokens);

    const context = createDefaultContext();
    const result = evaluateWithUserFunctions(ast, context, registry);

    expect(result).toBe(25); // 9 + 16 = 25
  });
});

describe('createUserFunction', () => {
  it('should create a UserFunction with timestamp', () => {
    const body = { type: 'identifier', name: 'x' } as const;
    const before = Date.now();

    const fn = createUserFunction('test', ['x'], body);

    const after = Date.now();

    expect(fn.name).toBe('test');
    expect(fn.params).toEqual(['x']);
    expect(fn.body).toEqual(body);
    expect(fn.createdAt).toBeGreaterThanOrEqual(before);
    expect(fn.createdAt).toBeLessThanOrEqual(after);
  });
});
