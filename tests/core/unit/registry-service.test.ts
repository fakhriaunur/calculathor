import { describe, it, expect, beforeEach } from 'bun:test';
import { RegistryService, type OperatorDef, type FunctionDef } from '../../../src/core/services/registry-service';

describe('RegistryService', () => {
  let registry: RegistryService;

  beforeEach(() => {
    registry = new RegistryService();
  });

  describe('operator management', () => {
    it('registers an operator', () => {
      const op: OperatorDef = {
        symbol: '+',
        precedence: 30,
        associativity: 'left',
        arity: 2
      };
      registry.registerOperator(op);
      expect(registry.hasOperator('+')).toBe(true);
    });

    it('retrieves an operator', () => {
      registry.registerOperator({ symbol: '*', precedence: 40, associativity: 'left', arity: 2 });
      const op = registry.getOperator('*');
      expect(op).toBeDefined();
      expect(op?.precedence).toBe(40);
    });

    it('returns undefined for unknown operator', () => {
      expect(registry.getOperator('unknown')).toBeUndefined();
    });

    it('lists all operators', () => {
      registry.registerOperator({ symbol: '+', precedence: 30, associativity: 'left', arity: 2 });
      registry.registerOperator({ symbol: '-', precedence: 30, associativity: 'left', arity: 2 });
      expect(registry.listOperators()).toHaveLength(2);
    });
  });

  describe('function management', () => {
    it('registers a function', () => {
      const fn: FunctionDef = {
        name: 'custom',
        arity: 1,
        fn: (x) => x * 2
      };
      registry.registerFunction(fn);
      expect(registry.hasFunction('custom')).toBe(true);
    });

    it('retrieves a function', () => {
      registry.registerFunction({
        name: 'double',
        arity: 1,
        fn: (x) => x * 2
      });
      const fn = registry.getFunction('double');
      expect(fn).toBeDefined();
      expect(fn?.fn(5)).toBe(10);
    });

    it('unregisters a function', () => {
      registry.registerFunction({ name: 'temp', arity: 0, fn: () => 42 });
      expect(registry.unregisterFunction('temp')).toBe(true);
      expect(registry.hasFunction('temp')).toBe(false);
    });

    it('returns false when unregistering unknown function', () => {
      expect(registry.unregisterFunction('unknown')).toBe(false);
    });

    it('handles variadic functions', () => {
      registry.registerFunction({
        name: 'sum',
        arity: 'variadic',
        fn: (...args) => args.reduce((a, b) => a + b, 0)
      });
      const fn = registry.getFunction('sum');
      expect(fn?.arity).toBe('variadic');
    });
  });

  describe('constant management', () => {
    it('registers a constant', () => {
      registry.registerConstant('answer', 42);
      expect(registry.hasConstant('answer')).toBe(true);
    });

    it('retrieves a constant value', () => {
      registry.registerConstant('pi_approx', 3.14);
      expect(registry.getConstant('pi_approx')).toBe(3.14);
    });

    it('lists all constants', () => {
      registry.registerConstant('a', 1);
      registry.registerConstant('b', 2);
      const constants = registry.listConstants();
      expect(constants.size).toBe(2);
      expect(constants.get('a')).toBe(1);
    });

    it('unregisters a constant', () => {
      registry.registerConstant('temp', 100);
      expect(registry.unregisterConstant('temp')).toBe(true);
      expect(registry.hasConstant('temp')).toBe(false);
    });
  });

  describe('standard registry', () => {
    let stdRegistry: RegistryService;

    beforeEach(() => {
      stdRegistry = RegistryService.createStandard();
    });

    it('has standard operators', () => {
      expect(stdRegistry.hasOperator('+')).toBe(true);
      expect(stdRegistry.hasOperator('-')).toBe(true);
      expect(stdRegistry.hasOperator('*')).toBe(true);
      expect(stdRegistry.hasOperator('/')).toBe(true);
      expect(stdRegistry.hasOperator('^')).toBe(true);
    });

    it('has comparison operators', () => {
      expect(stdRegistry.hasOperator('==')).toBe(true);
      expect(stdRegistry.hasOperator('!=')).toBe(true);
      expect(stdRegistry.hasOperator('<')).toBe(true);
      expect(stdRegistry.hasOperator('>')).toBe(true);
      expect(stdRegistry.hasOperator('<=')).toBe(true);
      expect(stdRegistry.hasOperator('>=')).toBe(true);
    });

    it('has unary operators', () => {
      expect(stdRegistry.hasOperator('u+')).toBe(true);
      expect(stdRegistry.hasOperator('u-')).toBe(true);
    });

    it('has correct precedence for operators', () => {
      const plus = stdRegistry.getOperator('+');
      const mult = stdRegistry.getOperator('*');
      const pow = stdRegistry.getOperator('^');

      expect(plus?.precedence).toBe(30);
      expect(mult?.precedence).toBe(40);
      expect(pow?.precedence).toBe(50);
    });

    it('has standard math functions', () => {
      expect(stdRegistry.hasFunction('sin')).toBe(true);
      expect(stdRegistry.hasFunction('cos')).toBe(true);
      expect(stdRegistry.hasFunction('tan')).toBe(true);
      expect(stdRegistry.hasFunction('sqrt')).toBe(true);
      expect(stdRegistry.hasFunction('log')).toBe(true);
    });

    it('has min/max functions', () => {
      expect(stdRegistry.hasFunction('min')).toBe(true);
      expect(stdRegistry.hasFunction('max')).toBe(true);

      const minFn = stdRegistry.getFunction('min');
      const maxFn = stdRegistry.getFunction('max');

      expect(minFn?.fn(1, 5, 3)).toBe(1);
      expect(maxFn?.fn(1, 5, 3)).toBe(5);
    });

    it('has standard constants', () => {
      expect(stdRegistry.hasConstant('pi')).toBe(true);
      expect(stdRegistry.hasConstant('e')).toBe(true);
      expect(stdRegistry.hasConstant('phi')).toBe(true);
      expect(stdRegistry.hasConstant('tau')).toBe(true);
    });

    it('has correct pi value', () => {
      expect(stdRegistry.getConstant('pi')).toBe(Math.PI);
    });

    it('has correct e value', () => {
      expect(stdRegistry.getConstant('e')).toBe(Math.E);
    });

    it('functions work correctly', () => {
      const sin = stdRegistry.getFunction('sin');
      expect(sin?.fn(Math.PI / 2)).toBeCloseTo(1, 10);

      const sqrt = stdRegistry.getFunction('sqrt');
      expect(sqrt?.fn(16)).toBe(4);
    });
  });

  describe('clear operations', () => {
    it('clears operators', () => {
      registry.registerOperator({ symbol: '+', precedence: 30, associativity: 'left', arity: 2 });
      registry.clearOperators();
      expect(registry.hasOperator('+')).toBe(false);
    });

    it('clears functions', () => {
      registry.registerFunction({ name: 'fn', arity: 0, fn: () => 1 });
      registry.clearFunctions();
      expect(registry.hasFunction('fn')).toBe(false);
    });

    it('clears constants', () => {
      registry.registerConstant('x', 10);
      registry.clearConstants();
      expect(registry.hasConstant('x')).toBe(false);
    });

    it('clears all', () => {
      registry.registerOperator({ symbol: '+', precedence: 30, associativity: 'left', arity: 2 });
      registry.registerFunction({ name: 'fn', arity: 0, fn: () => 1 });
      registry.registerConstant('x', 10);

      registry.clear();

      expect(registry.hasOperator('+')).toBe(false);
      expect(registry.hasFunction('fn')).toBe(false);
      expect(registry.hasConstant('x')).toBe(false);
    });
  });
});
