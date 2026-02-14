/**
 * Persistence Service
 * Manages sessions, history, and settings storage
 */

import { generateSessionId, type SessionId } from '../../shared/types/branded';

export interface Session {
  id: string;
  clientId: string;
  status: 'active' | 'suspended' | 'terminated';
  createdAt: Date;
  lastActivityAt: Date;
  variables: Map<string, number>;
}

export interface HistoryEntry {
  id: string;
  sessionId: string;
  input: string;
  result: string;
  error?: string;
  timestamp: Date;
}

export interface PersistenceConfig {
  sessionTimeoutMs?: number;
  maxHistoryPerSession?: number;
}

export class PersistenceService {
  private sessions = new Map<string, Session>();
  private history = new Map<string, HistoryEntry[]>();
  private config: Required<PersistenceConfig>;

  constructor(config: PersistenceConfig = {}) {
    this.config = {
      sessionTimeoutMs: config.sessionTimeoutMs ?? 30 * 60 * 1000, // 30 min
      maxHistoryPerSession: config.maxHistoryPerSession ?? 1000,
    };
  }

  /**
   * Create a new session
   */
  createSession(clientId: string): Session {
    const session: Session = {
      id: generateSessionId(),
      clientId,
      status: 'active',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      variables: new Map(),
    };

    this.sessions.set(session.id, session);
    this.history.set(session.id, []);

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * Get or create session for client
   */
  getOrCreateSession(clientId: string): Session {
    // Find existing active session for client
    for (const session of this.sessions.values()) {
      if (session.clientId === clientId && session.status === 'active') {
        // Check if timed out
        if (this.isSessionTimedOut(session)) {
          session.status = 'suspended';
        } else {
          session.lastActivityAt = new Date();
          return session;
        }
      }
    }

    // Create new session
    return this.createSession(clientId);
  }

  /**
   * Update session activity
   */
  touchSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session || session.status === 'terminated') {
      return false;
    }

    session.lastActivityAt = new Date();
    return true;
  }

  /**
   * Suspend a session (can be resumed)
   */
  suspendSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session || session.status === 'terminated') {
      return false;
    }

    session.status = 'suspended';
    return true;
  }

  /**
   * Resume a suspended session
   */
  resumeSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session || session.status !== 'suspended') {
      return false;
    }

    session.status = 'active';
    session.lastActivityAt = new Date();
    return true;
  }

  /**
   * Terminate a session (permanent)
   */
  terminateSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }

    session.status = 'terminated';
    // Clear history for terminated sessions
    this.history.delete(id);
    return true;
  }

  /**
   * List all sessions
   */
  listSessions(options?: { status?: Session['status']; clientId?: string }): Session[] {
    let sessions = Array.from(this.sessions.values());

    if (options?.status) {
      sessions = sessions.filter((s) => s.status === options.status);
    }

    if (options?.clientId) {
      sessions = sessions.filter((s) => s.clientId === options.clientId);
    }

    return sessions;
  }

  /**
   * Get session variable
   */
  getVariable(sessionId: string, name: string): number | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'terminated') {
      return undefined;
    }
    return session.variables.get(name);
  }

  /**
   * Set session variable
   */
  setVariable(sessionId: string, name: string, value: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'terminated') {
      return false;
    }

    session.variables.set(name, value);
    session.lastActivityAt = new Date();
    return true;
  }

  /**
   * Get all session variables
   */
  getVariables(sessionId: string): Map<string, number> | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'terminated') {
      return undefined;
    }
    return new Map(session.variables);
  }

  /**
   * Clear session variables
   */
  clearVariables(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'terminated') {
      return false;
    }

    session.variables.clear();
    session.lastActivityAt = new Date();
    return true;
  }

  /**
   * Add history entry
   */
  addHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
    const session = this.sessions.get(entry.sessionId);
    if (!session || session.status === 'terminated') {
      throw new Error('Session not found or terminated');
    }

    const fullEntry: HistoryEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date(),
    };

    let sessionHistory = this.history.get(entry.sessionId) ?? [];
    sessionHistory.push(fullEntry);

    // Enforce max history limit
    if (sessionHistory.length > this.config.maxHistoryPerSession) {
      sessionHistory = sessionHistory.slice(-this.config.maxHistoryPerSession);
    }

    this.history.set(entry.sessionId, sessionHistory);
    session.lastActivityAt = new Date();

    return fullEntry;
  }

  /**
   * Get session history
   */
  getHistory(sessionId: string, limit?: number): HistoryEntry[] {
    const entries = this.history.get(sessionId) ?? [];
    if (limit) {
      return entries.slice(-limit);
    }
    return entries;
  }

  /**
   * Clear session history
   */
  clearHistory(sessionId: string): boolean {
    this.history.set(sessionId, []);
    return true;
  }

  /**
   * Check if session is timed out
   */
  private isSessionTimedOut(session: Session): boolean {
    const now = Date.now();
    const lastActivity = session.lastActivityAt.getTime();
    return now - lastActivity > this.config.sessionTimeoutMs;
  }

  /**
   * Clean up timed out sessions
   */
  cleanupTimedOutSessions(): number {
    let cleaned = 0;
    for (const [id, session] of this.sessions) {
      if (session.status === 'active' && this.isSessionTimedOut(session)) {
        session.status = 'suspended';
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    suspendedSessions: number;
    terminatedSessions: number;
    totalHistoryEntries: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const historyEntries = Array.from(this.history.values()).reduce(
      (sum, entries) => sum + entries.length,
      0
    );

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === 'active').length,
      suspendedSessions: sessions.filter((s) => s.status === 'suspended').length,
      terminatedSessions: sessions.filter((s) => s.status === 'terminated').length,
      totalHistoryEntries: historyEntries,
    };
  }
}
