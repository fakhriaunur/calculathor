/**
 * Self-Learning Hooks System
 * Per ADR-006 - Enables adaptive behavior and pattern recognition
 */

export type HookType = 'session-start' | 'pre-eval' | 'post-eval' | 'session-end';

export interface HookContext {
  sessionId: string;
  timestamp: Date;
  [key: string]: unknown;
}

export interface SessionStartContext extends HookContext {
  type: 'session-start';
  clientId: string;
}

export interface PreEvalContext extends HookContext {
  type: 'pre-eval';
  expression: string;
}

export interface PostEvalContext extends HookContext {
  type: 'post-eval';
  expression: string;
  result: number;
  durationMs: number;
  error?: string;
}

export interface SessionEndContext extends HookContext {
  type: 'session-end';
  durationMs: number;
  evaluationsCount: number;
}

export type HookHandler<T extends HookContext> = (context: T) => void | Promise<void>;

export interface PatternEntry {
  id: string;
  pattern: string;
  replacement: string;
  frequency: number;
  lastUsed: Date;
}

export interface CachedResult {
  expression: string;
  result: number;
  timestamp: Date;
  hits: number;
}

/**
 * Self-Learning Hooks Manager
 */
export class HooksManager {
  private handlers = new Map<HookType, Array<HookHandler<any>>>();
  private patterns = new Map<string, PatternEntry>();
  private cache = new Map<string, CachedResult>();
  private sessionStats = new Map<string, { startTime: number; evaluations: number }>();
  private maxCacheSize = 1000;
  private maxPatterns = 100;

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Register a hook handler
   */
  on<T extends HookContext>(type: T['type'], handler: HookHandler<T>): void {
    const handlers = this.handlers.get(type) ?? [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }

  /**
   * Remove a hook handler
   */
  off<T extends HookContext>(type: T['type'], handler: HookHandler<T>): boolean {
    const handlers = this.handlers.get(type);
    if (!handlers) return false;

    const index = handlers.indexOf(handler);
    if (index === -1) return false;

    handlers.splice(index, 1);
    return true;
  }

  /**
   * Execute hooks for a given type
   */
  async execute<T extends HookContext>(type: T['type'], context: T): Promise<void> {
    const handlers = this.handlers.get(type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(context);
      } catch (error) {
        console.error(`Hook error (${type}):`, error);
      }
    }
  }

  /**
   * Register default handlers
   */
  private registerDefaultHandlers(): void {
    // Session start - load user patterns and preferences
    this.on<SessionStartContext>('session-start', (ctx) => {
      this.sessionStats.set(ctx.sessionId, {
        startTime: Date.now(),
        evaluations: 0,
      });
      console.log(`[hooks] Session started: ${ctx.sessionId}`);
    });

    // Pre-evaluation - check cache for common patterns
    this.on<PreEvalContext>('pre-eval', (ctx) => {
      // Could provide suggestions based on patterns here
      const cached = this.cache.get(ctx.expression);
      if (cached) {
        cached.hits++;
        cached.timestamp = new Date();
      }
    });

    // Post-evaluation - store result and learn patterns
    this.on<PostEvalContext>('post-eval', (ctx) => {
      // Update session stats
      const stats = this.sessionStats.get(ctx.sessionId);
      if (stats) {
        stats.evaluations++;
      }

      // Cache successful results
      if (!ctx.error) {
        this.addToCache(ctx.expression, ctx.result);
        this.learnPattern(ctx.expression, ctx.result);
      }
    });

    // Session end - persist learned data
    this.on<SessionEndContext>('session-end', (ctx) => {
      const stats = this.sessionStats.get(ctx.sessionId);
      if (stats) {
        ctx.durationMs = Date.now() - stats.startTime;
        ctx.evaluationsCount = stats.evaluations;
        this.sessionStats.delete(ctx.sessionId);
      }
      console.log(
        `[hooks] Session ended: ${ctx.sessionId} (${ctx.evaluationsCount} evaluations)`
      );
    });
  }

  /**
   * Add result to cache with LRU eviction
   */
  private addToCache(expression: string, result: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxCacheSize) {
      const oldest = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime()
      )[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }

    this.cache.set(expression, {
      expression,
      result,
      timestamp: new Date(),
      hits: 0,
    });
  }

  /**
   * Get cached result
   */
  getCached(expression: string): number | undefined {
    const cached = this.cache.get(expression);
    if (cached) {
      cached.hits++;
      return cached.result;
    }
    return undefined;
  }

  /**
   * Check if expression is in cache
   */
  hasCached(expression: string): boolean {
    return this.cache.has(expression);
  }

  /**
   * Learn patterns from successful evaluations
   */
  private learnPattern(expression: string, result: number): void {
    // Simple pattern: common subexpressions
    // In a real implementation, this would use more sophisticated pattern recognition

    // Example: detect repeated use of "pi / 2" -> cache as "pi_2"
    if (expression.includes('pi / 2')) {
      this.addPattern('pi / 2', String(Math.PI / 2));
    }

    // Detect "2 * pi" -> "tau"
    if (expression.includes('2 * pi') || expression.includes('2*pi')) {
      this.addPattern('2 * pi', String(Math.PI * 2));
    }
  }

  /**
   * Add a learned pattern
   */
  private addPattern(pattern: string, replacement: string): void {
    // Evict least used if at capacity
    if (this.patterns.size >= this.maxPatterns) {
      const leastUsed = Array.from(this.patterns.entries()).sort(
        (a, b) => a[1].frequency - b[1].frequency
      )[0];
      if (leastUsed) {
        this.patterns.delete(leastUsed[0]);
      }
    }

    const existing = this.patterns.get(pattern);
    if (existing) {
      existing.frequency++;
      existing.lastUsed = new Date();
    } else {
      this.patterns.set(pattern, {
        id: `pattern-${Date.now()}`,
        pattern,
        replacement,
        frequency: 1,
        lastUsed: new Date(),
      });
    }
  }

  /**
   * Get all learned patterns
   */
  getPatterns(): PatternEntry[] {
    return Array.from(this.patterns.values()).sort(
      (a, b) => b.frequency - a.frequency
    );
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRates: { expression: string; hits: number }[];
  } {
    const entries = Array.from(this.cache.values());
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRates: entries
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 10)
        .map((e) => ({ expression: e.expression, hits: e.hits })),
    };
  }

  /**
   * Clear all learned data
   */
  clear(): void {
    this.patterns.clear();
    this.cache.clear();
    this.sessionStats.clear();
  }

  /**
   * Get hooks manager statistics
   */
  getStats(): {
    registeredHandlers: number;
    patternsLearned: number;
    cacheEntries: number;
    activeSessions: number;
  } {
    return {
      registeredHandlers: Array.from(this.handlers.values()).reduce(
        (sum, h) => sum + h.length,
        0
      ),
      patternsLearned: this.patterns.size,
      cacheEntries: this.cache.size,
      activeSessions: this.sessionStats.size,
    };
  }
}

// Singleton instance
let defaultManager: HooksManager | undefined;

export function getHooksManager(): HooksManager {
  if (!defaultManager) {
    defaultManager = new HooksManager();
  }
  return defaultManager;
}

export function resetHooksManager(): void {
  defaultManager = undefined;
}
