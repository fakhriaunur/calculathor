/**
 * Session Management for Calculathor Daemon
 *
 * Manages per-client state including:
 * - Variables (for future use)
 * - History entries
 * - User-defined functions
 *
 * Follows DDD Session Context from ADR-003
 */

import type {
  SessionState,
  UserFunction,
  HistoryEntry,
} from './types.ts';

// ============================================================================
// Session Manager
// ============================================================================

export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private sessionTimeoutMs: number;
  private maxHistoryPerSession: number;
  private cleanupInterval?: Timer;

  constructor(options: {
    sessionTimeoutMs?: number;
    maxHistoryPerSession?: number;
  } = {}) {
    this.sessionTimeoutMs = options.sessionTimeoutMs ?? 30 * 60 * 1000; // 30 minutes
    this.maxHistoryPerSession = options.maxHistoryPerSession ?? 1000;
    this.startCleanupInterval();
  }

  /**
   * Create a new session with unique ID.
   */
  createSession(): SessionState {
    const id = generateSessionId();
    const session: SessionState = {
      id,
      variables: new Map(),
      functions: new Map(),
      history: [],
      lastActivity: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Get session by ID.
   */
  getSession(id: string): SessionState | undefined {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivity = Date.now();
    }
    return session;
  }

  /**
   * Remove a session and clean up resources.
   */
  removeSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  /**
   * Get all active session IDs.
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get count of active sessions.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up idle sessions that have exceeded timeout.
   */
  cleanupIdleSessions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeoutMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Stop the cleanup interval (for graceful shutdown).
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Start automatic cleanup of idle sessions.
   */
  private startCleanupInterval(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.cleanupIdleSessions();
      if (cleaned > 0) {
        console.log(`[daemon] Cleaned up ${cleaned} idle session(s)`);
      }
    }, 5 * 60 * 1000);
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  /**
   * Add a history entry to a session.
   */
  addHistoryEntry(session: SessionState, entry: Omit<HistoryEntry, 'timestamp'>): void {
    const fullEntry: HistoryEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    session.history.push(fullEntry);

    // Keep history within limit
    if (session.history.length > this.maxHistoryPerSession) {
      session.history.shift();
    }

    session.lastActivity = Date.now();
  }

  /**
   * Get history entries for a session, optionally limited.
   */
  getHistory(session: SessionState, limit?: number): HistoryEntry[] {
    const entries = session.history;
    if (limit && limit > 0 && limit < entries.length) {
      return entries.slice(-limit);
    }
    return [...entries];
  }

  /**
   * Register a user-defined function in a session.
   */
  registerFunction(session: SessionState, name: string, params: string[], body: string): void {
    // Create the function from the body
    const fn = createUserFunction(params, body);

    const userFn: UserFunction = {
      name,
      params,
      body,
      fn,
    };

    session.functions.set(name, userFn);
    session.lastActivity = Date.now();
  }

  /**
   * Get all user-defined functions for a session.
   */
  getFunctions(session: SessionState): UserFunction[] {
    return Array.from(session.functions.values());
  }

  /**
   * Get a specific user-defined function.
   */
  getFunction(session: SessionState, name: string): UserFunction | undefined {
    return session.functions.get(name);
  }

  /**
   * Clear all session state.
   */
  clearSession(session: SessionState): void {
    session.variables.clear();
    session.functions.clear();
    session.history = [];
    session.lastActivity = Date.now();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a user-defined function from parameter names and body.
 *
 * The body is a JavaScript expression that can reference the parameters.
 * For security, we validate the body before creating the function.
 */
function createUserFunction(params: string[], body: string): (...args: number[]) => number {
  // Basic validation: check for dangerous patterns
  const dangerousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /constructor/,
    /prototype/,
    /__proto__/,
    /import\s*\(/,
    /require\s*\(/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(body)) {
      throw new Error('Function body contains forbidden patterns');
    }
  }

  try {
    // Create function with parameters and body
    const fn = new Function(...params, `return (${body});`);
    return (...args: number[]) => {
      const result = fn(...args);
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Function must return a finite number');
      }
      return result;
    };
  } catch (error) {
    throw new Error(`Invalid function body: ${error instanceof Error ? error.message : String(error)}`);
  }
}
