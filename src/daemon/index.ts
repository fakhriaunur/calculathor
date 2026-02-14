#!/usr/bin/env bun
/**
 * Daemon Process for Calculathor
 * Manages sessions and handles JSON-RPC requests
 */

import { TransportService } from '../transport/services/transport-service';
import { JSONRPCServer, JSONRPC_ERRORS } from './rpc-server';
import { tokenize } from '../core/pure/tokenizer';
import { PrattParser } from '../core/pure/pratt-parser';
import { evaluate } from '../core/pure/evaluator';
import { RegistryService } from '../core/services/registry-service';

interface Session {
  id: string;
  variables: Map<string, number>;
  history: Array<{ input: string; result: string; timestamp: Date }>;
  lastActivity: Date;
}

class Daemon {
  private server = new JSONRPCServer();
  private transport = new TransportService();
  private registry = RegistryService.createStandard();
  private parser = new PrattParser(this.registry);
  private sessions = new Map<string, Session>();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.setupMethods();
    this.startCleanupInterval();
  }

  private setupMethods(): void {
    // Evaluate expression
    this.server.registerMethod('eval', (params: unknown) => {
      const { expr, sessionId } = params as { expr: string; sessionId?: string };

      if (!expr) {
        throw new Error('Expression required');
      }

      const session = sessionId ? this.getOrCreateSession(sessionId) : null;

      try {
        const tokens = tokenize(expr);
        const { ast } = this.parser.parse(tokens);
        const result = evaluate(ast, {
          registry: this.registry,
          variables: session?.variables,
        });

        // Store in history
        if (session) {
          session.history.push({
            input: expr,
            result: String(result),
            timestamp: new Date(),
          });
          session.lastActivity = new Date();
        }

        return result;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Evaluation error');
      }
    });

    // Get/set variable
    this.server.registerMethod('get_var', (params: unknown) => {
      const { sessionId, name } = params as { sessionId: string; name: string };
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      return session.variables.get(name) ?? null;
    });

    this.server.registerMethod('set_var', (params: unknown) => {
      const { sessionId, name, value } = params as {
        sessionId: string;
        name: string;
        value: number;
      };
      const session = this.getOrCreateSession(sessionId);
      session.variables.set(name, value);
      session.lastActivity = new Date();
      return value;
    });

    // Get all variables
    this.server.registerMethod('get_vars', (params: unknown) => {
      const { sessionId } = params as { sessionId: string };
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {};
      }
      const vars: Record<string, number> = {};
      for (const [key, value] of session.variables) {
        vars[key] = value;
      }
      return vars;
    });

    // Clear variables
    this.server.registerMethod('clear_vars', (params: unknown) => {
      const { sessionId } = params as { sessionId: string };
      const session = this.sessions.get(sessionId);
      if (session) {
        session.variables.clear();
        session.lastActivity = new Date();
      }
      return true;
    });

    // Get history
    this.server.registerMethod('get_history', (params: unknown) => {
      const { sessionId, limit = 100 } = params as {
        sessionId: string;
        limit?: number;
      };
      const session = this.sessions.get(sessionId);
      if (!session) {
        return [];
      }
      return session.history.slice(-limit);
    });

    // Ping/health check
    this.server.registerMethod('ping', () => {
      return 'pong';
    });

    // Get available functions
    this.server.registerMethod('get_functions', () => {
      return this.registry.listFunctions().map((f) => ({
        name: f.name,
        arity: f.arity,
      }));
    });

    // Get available constants
    this.server.registerMethod('get_constants', () => {
      const constants: Record<string, number> = {};
      for (const [name, value] of this.registry.listConstants()) {
        constants[name] = value;
      }
      return constants;
    });
  }

  private getOrCreateSession(sessionId: string): Session {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        variables: new Map(),
        history: [],
        lastActivity: new Date(),
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions) {
        if (now - session.lastActivity.getTime() > this.sessionTimeout) {
          this.sessions.delete(id);
          console.log(`Session ${id} expired`);
        }
      }
    }, 60 * 1000); // Check every minute
  }

  async start(): Promise<void> {
    const uid = process.getuid?.() ?? 1000;
    const socketPath = `/tmp/calculathor-${uid}.sock`;

    // Clean up stale socket
    try {
      await Bun.file(socketPath).delete();
    } catch {
      // Socket doesn't exist
    }

    const unixServer = this.transport.createUnixServer();

    unixServer.onConnection((conn) => {
      console.log(`Client connected: ${conn.id}`);

      conn.onMessage(async (data) => {
        const response = await this.server.handleMessage(data);
        if (response) {
          conn.send(response);
        }
      });

      conn.onClose(() => {
        console.log(`Client disconnected: ${conn.id}`);
      });
    });

    await unixServer.listen({
      type: 'unix',
      address: socketPath,
    });

    console.log(`Daemon listening on ${socketPath}`);

    // Also listen on TCP as fallback
    const tcpServer = this.transport.createTcpServer();
    tcpServer.onConnection((conn) => {
      console.log(`TCP client connected: ${conn.id}`);

      conn.onMessage(async (data) => {
        const response = await this.server.handleMessage(data);
        if (response) {
          conn.send(response);
        }
      });

      conn.onClose(() => {
        console.log(`TCP client disconnected: ${conn.id}`);
      });
    });

    try {
      await tcpServer.listen({
        type: 'tcp',
        address: '127.0.0.1:7437',
      });
      console.log('Daemon listening on 127.0.0.1:7437');
    } catch (error) {
      console.error('Failed to start TCP server:', error);
    }

    // Keep running
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

// Start daemon
const daemon = new Daemon();
daemon.start().catch((error) => {
  console.error('Daemon error:', error);
  process.exit(1);
});
