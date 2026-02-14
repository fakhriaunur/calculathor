import { describe, it, expect, beforeEach } from 'bun:test';
import { PersistenceService } from '../../src/persistence/services/persistence-service';

describe('PersistenceService', () => {
  let service: PersistenceService;

  beforeEach(() => {
    service = new PersistenceService();
  });

  describe('session management', () => {
    it('creates a session', () => {
      const session = service.createSession('client-1');
      expect(session.clientId).toBe('client-1');
      expect(session.status).toBe('active');
      expect(session.variables).toBeDefined();
    });

    it('gets session by id', () => {
      const session = service.createSession('client-1');
      const retrieved = service.getSession(session.id);
      expect(retrieved?.id).toBe(session.id);
    });

    it('returns undefined for unknown session', () => {
      expect(service.getSession('unknown')).toBeUndefined();
    });

    it('gets or creates session', () => {
      const session1 = service.getOrCreateSession('client-1');
      const session2 = service.getOrCreateSession('client-1');
      expect(session1.id).toBe(session2.id);
    });

    it('creates new session if previous is suspended', () => {
      const session1 = service.createSession('client-1');
      service.suspendSession(session1.id);
      const session2 = service.getOrCreateSession('client-1');
      expect(session2.id).not.toBe(session1.id);
    });
  });

  describe('session lifecycle', () => {
    it('suspends session', () => {
      const session = service.createSession('client-1');
      expect(service.suspendSession(session.id)).toBe(true);
      expect(service.getSession(session.id)?.status).toBe('suspended');
    });

    it('resumes session', () => {
      const session = service.createSession('client-1');
      service.suspendSession(session.id);
      expect(service.resumeSession(session.id)).toBe(true);
      expect(service.getSession(session.id)?.status).toBe('active');
    });

    it('terminates session', () => {
      const session = service.createSession('client-1');
      expect(service.terminateSession(session.id)).toBe(true);
      expect(service.getSession(session.id)?.status).toBe('terminated');
    });

    it('cannot resume terminated session', () => {
      const session = service.createSession('client-1');
      service.terminateSession(session.id);
      expect(service.resumeSession(session.id)).toBe(false);
    });

    it('returns false for unknown session', () => {
      expect(service.suspendSession('unknown')).toBe(false);
      expect(service.resumeSession('unknown')).toBe(false);
      expect(service.terminateSession('unknown')).toBe(false);
    });
  });

  describe('variables', () => {
    it('sets variable', () => {
      const session = service.createSession('client-1');
      expect(service.setVariable(session.id, 'x', 10)).toBe(true);
      expect(service.getVariable(session.id, 'x')).toBe(10);
    });

    it('updates variable', () => {
      const session = service.createSession('client-1');
      service.setVariable(session.id, 'x', 10);
      service.setVariable(session.id, 'x', 20);
      expect(service.getVariable(session.id, 'x')).toBe(20);
    });

    it('returns undefined for undefined variable', () => {
      const session = service.createSession('client-1');
      expect(service.getVariable(session.id, 'unknown')).toBeUndefined();
    });

    it('gets all variables', () => {
      const session = service.createSession('client-1');
      service.setVariable(session.id, 'x', 1);
      service.setVariable(session.id, 'y', 2);
      const vars = service.getVariables(session.id);
      expect(vars?.size).toBe(2);
      expect(vars?.get('x')).toBe(1);
      expect(vars?.get('y')).toBe(2);
    });

    it('clears variables', () => {
      const session = service.createSession('client-1');
      service.setVariable(session.id, 'x', 10);
      expect(service.clearVariables(session.id)).toBe(true);
      expect(service.getVariables(session.id)?.size).toBe(0);
    });

    it('returns false for terminated session', () => {
      const session = service.createSession('client-1');
      service.terminateSession(session.id);
      expect(service.setVariable(session.id, 'x', 10)).toBe(false);
    });
  });

  describe('history', () => {
    it('adds history entry', () => {
      const session = service.createSession('client-1');
      const entry = service.addHistory({
        sessionId: session.id,
        input: '2 + 2',
        result: '4',
      });
      expect(entry.input).toBe('2 + 2');
      expect(entry.result).toBe('4');
    });

    it('gets history', () => {
      const session = service.createSession('client-1');
      service.addHistory({ sessionId: session.id, input: '1', result: '1' });
      service.addHistory({ sessionId: session.id, input: '2', result: '2' });
      const history = service.getHistory(session.id);
      expect(history).toHaveLength(2);
    });

    it('gets limited history', () => {
      const session = service.createSession('client-1');
      for (let i = 0; i < 5; i++) {
        service.addHistory({ sessionId: session.id, input: `${i}`, result: `${i}` });
      }
      const history = service.getHistory(session.id, 3);
      expect(history).toHaveLength(3);
    });

    it('clears history', () => {
      const session = service.createSession('client-1');
      service.addHistory({ sessionId: session.id, input: '1', result: '1' });
      service.clearHistory(session.id);
      expect(service.getHistory(session.id)).toHaveLength(0);
    });

    it('throws for terminated session', () => {
      const session = service.createSession('client-1');
      service.terminateSession(session.id);
      expect(() =>
        service.addHistory({ sessionId: session.id, input: '1', result: '1' })
      ).toThrow();
    });
  });

  describe('listing sessions', () => {
    it('lists all sessions', () => {
      service.createSession('client-1');
      service.createSession('client-2');
      const sessions = service.listSessions();
      expect(sessions).toHaveLength(2);
    });

    it('filters by status', () => {
      const session = service.createSession('client-1');
      service.suspendSession(session.id);
      service.createSession('client-2');
      const active = service.listSessions({ status: 'active' });
      expect(active).toHaveLength(1);
    });

    it('filters by client', () => {
      service.createSession('client-1');
      service.createSession('client-2');
      const sessions = service.listSessions({ clientId: 'client-1' });
      expect(sessions).toHaveLength(1);
    });
  });

  describe('statistics', () => {
    it('returns stats', () => {
      const s1 = service.createSession('client-1');
      const s2 = service.createSession('client-2');
      const s3 = service.createSession('client-3');
      service.suspendSession(s1.id);
      service.terminateSession(s2.id);

      const stats = service.getStats();
      expect(stats.totalSessions).toBe(3);
      expect(stats.activeSessions).toBe(1);
      expect(stats.suspendedSessions).toBe(1);
      expect(stats.terminatedSessions).toBe(1);
    });
  });
});
