import { describe, it, expect, beforeEach } from 'bun:test';
import { HooksManager, resetHooksManager } from '../../src/hooks/index';

describe('HooksManager', () => {
  let hooks: HooksManager;

  beforeEach(() => {
    resetHooksManager();
    hooks = new HooksManager();
  });

  describe('registration', () => {
    it('registers a handler', async () => {
      let called = false;
      hooks.on('session-start', () => {
        called = true;
      });

      await hooks.execute('session-start', {
        type: 'session-start',
        sessionId: 'test',
        clientId: 'client',
        timestamp: new Date(),
      });

      expect(called).toBe(true);
    });

    it('registers multiple handlers', async () => {
      let count = 0;
      hooks.on('session-start', () => count++);
      hooks.on('session-start', () => count++);

      await hooks.execute('session-start', {
        type: 'session-start',
        sessionId: 'test',
        clientId: 'client',
        timestamp: new Date(),
      });

      expect(count).toBe(2);
    });

    it('removes a handler', () => {
      const handler = () => {};
      hooks.on('session-start', handler);
      expect(hooks.off('session-start', handler)).toBe(true);
      expect(hooks.off('session-start', handler)).toBe(false);
    });
  });

  describe('session hooks', () => {
    it('tracks session stats', async () => {
      const sessionId = 'test-session';

      await hooks.execute('session-start', {
        type: 'session-start',
        sessionId,
        clientId: 'client',
        timestamp: new Date(),
      });

      await hooks.execute('post-eval', {
        type: 'post-eval',
        sessionId,
        expression: '1 + 1',
        result: 2,
        durationMs: 1,
        timestamp: new Date(),
      });

      const stats = hooks.getStats();
      expect(stats.activeSessions).toBe(1);
    });

    it('cleans up session on end', async () => {
      const sessionId = 'test-session';

      await hooks.execute('session-start', {
        type: 'session-start',
        sessionId,
        clientId: 'client',
        timestamp: new Date(),
      });

      await hooks.execute('session-end', {
        type: 'session-end',
        sessionId,
        durationMs: 0,
        evaluationsCount: 0,
        timestamp: new Date(),
      });

      const stats = hooks.getStats();
      expect(stats.activeSessions).toBe(0);
    });
  });

  describe('cache', () => {
    it('caches evaluated results', async () => {
      const sessionId = 'test-session';

      await hooks.execute('post-eval', {
        type: 'post-eval',
        sessionId,
        expression: '2 + 2',
        result: 4,
        durationMs: 1,
        timestamp: new Date(),
      });

      expect(hooks.hasCached('2 + 2')).toBe(true);
      expect(hooks.getCached('2 + 2')).toBe(4);
    });

    it('tracks cache hits', async () => {
      const sessionId = 'test-session';

      await hooks.execute('post-eval', {
        type: 'post-eval',
        sessionId,
        expression: 'test',
        result: 42,
        durationMs: 1,
        timestamp: new Date(),
      });

      await hooks.execute('pre-eval', {
        type: 'pre-eval',
        sessionId,
        expression: 'test',
        timestamp: new Date(),
      });

      const stats = hooks.getCacheStats();
      expect(stats.hitRates[0].hits).toBe(1);
    });
  });

  describe('pattern learning', () => {
    it('learns pi/2 pattern', async () => {
      const sessionId = 'test-session';

      await hooks.execute('post-eval', {
        type: 'post-eval',
        sessionId,
        expression: 'sin(pi / 2)',
        result: 1,
        durationMs: 1,
        timestamp: new Date(),
      });

      const patterns = hooks.getPatterns();
      const piPattern = patterns.find((p) => p.pattern === 'pi / 2');
      expect(piPattern).toBeDefined();
    });

    it('learns 2*pi pattern', async () => {
      const sessionId = 'test-session';

      await hooks.execute('post-eval', {
        type: 'post-eval',
        sessionId,
        expression: '2 * pi',
        result: Math.PI * 2,
        durationMs: 1,
        timestamp: new Date(),
      });

      const patterns = hooks.getPatterns();
      const tauPattern = patterns.find((p) => p.pattern === '2 * pi');
      expect(tauPattern).toBeDefined();
    });

    it('increments pattern frequency', async () => {
      const sessionId = 'test-session';

      for (let i = 0; i < 3; i++) {
        await hooks.execute('post-eval', {
          type: 'post-eval',
          sessionId,
          expression: 'sin(pi / 2)',
          result: 1,
          durationMs: 1,
          timestamp: new Date(),
        });
      }

      const patterns = hooks.getPatterns();
      const piPattern = patterns.find((p) => p.pattern === 'pi / 2');
      expect(piPattern?.frequency).toBe(3);
    });
  });

  describe('statistics', () => {
    it('returns stats', async () => {
      hooks.on('session-start', () => {});
      hooks.on('post-eval', () => {});

      await hooks.execute('session-start', {
        type: 'session-start',
        sessionId: 'test',
        clientId: 'client',
        timestamp: new Date(),
      });

      const stats = hooks.getStats();
      expect(stats.registeredHandlers).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('continues on handler error', async () => {
      let secondCalled = false;

      hooks.on('session-start', () => {
        throw new Error('Handler error');
      });

      hooks.on('session-start', () => {
        secondCalled = true;
      });

      await hooks.execute('session-start', {
        type: 'session-start',
        sessionId: 'test',
        clientId: 'client',
        timestamp: new Date(),
      });

      expect(secondCalled).toBe(true);
    });
  });

  describe('clear', () => {
    it('clears all data', async () => {
      const sessionId = 'test-session';

      await hooks.execute('session-start', {
        type: 'session-start',
        sessionId,
        clientId: 'client',
        timestamp: new Date(),
      });

      await hooks.execute('post-eval', {
        type: 'post-eval',
        sessionId,
        expression: 'test',
        result: 42,
        durationMs: 1,
        timestamp: new Date(),
      });

      hooks.clear();

      const stats = hooks.getStats();
      expect(stats.patternsLearned).toBe(0);
      expect(stats.cacheEntries).toBe(0);
    });
  });
});
