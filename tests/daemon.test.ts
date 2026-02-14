/**
 * Tests for Calculathor Daemon
 *
 * Tests JSON-RPC protocol, session management, and method handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { startDaemon, stopDaemon, isRunning } from '../src/daemon/index.ts';
import { CalculathorClient } from '../src/client.ts';

const TEST_PORT = 17437; // Use different port to avoid conflicts

describe('Daemon', () => {
  let client: CalculathorClient;

  beforeEach(async () => {
    // Start daemon with TCP only for testing (to avoid socket file issues)
    startDaemon({ port: TEST_PORT, preferTcp: true });

    // Wait for server to start
    await new Promise(r => setTimeout(r, 100));

    // Create client
    client = new CalculathorClient({
      port: TEST_PORT,
      preferTcp: true,
    });

    await client.connect();
  });

  afterEach(async () => {
    await client.disconnect().catch(() => {});
    stopDaemon();
    await new Promise(r => setTimeout(r, 50));
  });

  describe('Connection', () => {
    it('should connect to daemon', () => {
      expect(client.isConnected()).toBe(true);
    });

    it('should respond to ping', async () => {
      const result = await client.ping();
      expect(result.pong).toBe(true);
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  describe('evaluate', () => {
    it('should evaluate simple arithmetic', async () => {
      const result = await client.evaluate('2 + 2');
      expect(result).toBe(4);
    });

    it('should evaluate with operator precedence', async () => {
      const result = await client.evaluate('2 + 3 * 4');
      expect(result).toBe(14);
    });

    it('should evaluate with parentheses', async () => {
      const result = await client.evaluate('(2 + 3) * 4');
      expect(result).toBe(20);
    });

    it('should evaluate floating point', async () => {
      const result = await client.evaluate('3.14 * 2');
      expect(result).toBeCloseTo(6.28, 2);
    });

    it('should evaluate exponentiation', async () => {
      const result = await client.evaluate('2 ^ 10');
      expect(result).toBe(1024);
    });

    it('should evaluate unary operators', async () => {
      const result = await client.evaluate('-5 + 3');
      expect(result).toBe(-2);
    });

    it('should evaluate built-in functions', async () => {
      const result = await client.evaluate('sqrt(16)');
      expect(result).toBe(4);
    });

    it('should evaluate constants', async () => {
      const result = await client.evaluate('pi');
      expect(result).toBeCloseTo(Math.PI, 5);
    });

    it('should evaluate complex expressions', async () => {
      const result = await client.evaluate('sin(pi / 2) + cos(0)');
      expect(result).toBeCloseTo(2, 5);
    });

    it('should throw on division by zero', async () => {
      expect(client.evaluate('1 / 0')).rejects.toThrow();
    });

    it('should throw on invalid expression', async () => {
      expect(client.evaluate('2 + * 3')).rejects.toThrow();
    });

    it('should throw on unknown identifier', async () => {
      expect(client.evaluate('unknown_var')).rejects.toThrow();
    });
  });

  describe('registerFunction', () => {
    it('should register a simple function', async () => {
      const result = await client.registerFunction('double', ['x'], 'x * 2');
      expect(result.success).toBe(true);
      expect(result.name).toBe('double');
    });

    it('should use registered function in evaluation', async () => {
      await client.registerFunction('square', ['x'], 'x * x');
      const result = await client.evaluate('square(5)');
      expect(result).toBe(25);
    });

    it('should use multi-parameter function', async () => {
      await client.registerFunction('hypot', ['a', 'b'], 'sqrt(a^2 + b^2)');
      const result = await client.evaluate('hypot(3, 4)');
      expect(result).toBe(5);
    });

    it('should throw on invalid function name', async () => {
      expect(client.registerFunction('123invalid', ['x'], 'x')).rejects.toThrow();
    });

    it('should throw on empty body', async () => {
      expect(client.registerFunction('empty', ['x'], '')).rejects.toThrow();
    });

    it('should throw on forbidden patterns', async () => {
      expect(client.registerFunction('evil', ['x'], 'eval("1")')).rejects.toThrow();
    });
  });

  describe('getHistory', () => {
    it('should return empty history initially', async () => {
      const history = await client.getHistory();
      expect(history).toEqual([]);
    });

    it('should record evaluations in history', async () => {
      await client.evaluate('1 + 1');
      await client.evaluate('2 + 2');

      const history = await client.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].expression).toBe('1 + 1');
      expect(history[0].result).toBe(2);
      expect(history[1].expression).toBe('2 + 2');
      expect(history[1].result).toBe(4);
    });

    it('should respect limit parameter', async () => {
      await client.evaluate('1');
      await client.evaluate('2');
      await client.evaluate('3');

      const history = await client.getHistory(2);
      expect(history.length).toBe(2);
      expect(history[0].expression).toBe('2');
      expect(history[1].expression).toBe('3');
    });

    it('should include timestamps', async () => {
      const before = Date.now();
      await client.evaluate('42');
      const after = Date.now();

      const history = await client.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Session Isolation', () => {
    it('should isolate history between clients', async () => {
      // Create second client
      const client2 = new CalculathorClient({
        port: TEST_PORT,
        preferTcp: true,
      });
      await client2.connect();

      try {
        // Add history with client 1
        await client.evaluate('1 + 1');

        // Client 2 should have empty history
        const history2 = await client2.getHistory();
        expect(history2.length).toBe(0);

        // Client 1 should have history
        const history1 = await client.getHistory();
        expect(history1.length).toBe(1);
      } finally {
        await client2.disconnect();
      }
    });

    it('should isolate functions between clients', async () => {
      // Create second client
      const client2 = new CalculathorClient({
        port: TEST_PORT,
        preferTcp: true,
      });
      await client2.connect();

      try {
        // Register function with client 1
        await client.registerFunction('client1Fn', ['x'], 'x * 2');

        // Client 2 should not have access
        await expect(client2.evaluate('client1Fn(5)')).rejects.toThrow();

        // Client 1 should work
        const result = await client.evaluate('client1Fn(5)');
        expect(result).toBe(10);
      } finally {
        await client2.disconnect();
      }
    });
  });
});

describe('Daemon Lifecycle', () => {
  it('should start and stop', () => {
    expect(isRunning()).toBe(false);

    startDaemon({ port: TEST_PORT + 1 });
    expect(isRunning()).toBe(true);

    stopDaemon();
    expect(isRunning()).toBe(false);
  });

  it('should handle multiple start calls gracefully', () => {
    startDaemon({ port: TEST_PORT + 2 });
    startDaemon({ port: TEST_PORT + 3 }); // Should not throw

    expect(isRunning()).toBe(true);

    stopDaemon();
  });
});
