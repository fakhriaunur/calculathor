/**
 * Calculathor Daemon - Tracer 3 Implementation
 *
 * Bun socket server implementing JSON-RPC 2.0 protocol.
 * Supports Unix sockets (primary) and TCP fallback.
 *
 * Architecture based on:
 * - ADR-003: Hybrid Daemon Architecture
 * - DDD-003: Transport Bounded Context
 */

import type { Socket } from 'bun';
import type {
  DaemonOptions,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  ConnectionState,
} from './types.ts';
import { ErrorCode } from './types.ts';
import { SessionManager } from './session.ts';
import { createHandlers } from './handlers.ts';
import {
  parseRequest,
  dispatchRequest,
  createErrorResponse,
  serializeResponse,
  processBuffer,
} from './jsonrpc.ts';

// Re-export types for consumers
export type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
} from './types.ts';

// ============================================================================
// Server State
// ============================================================================

interface ServerState {
  unixServer?: ReturnType<typeof Bun.listen>;
  tcpServer?: ReturnType<typeof Bun.listen>;
  sessionManager: SessionManager;
  handlers: Map<string, (params: unknown, session: ReturnType<SessionManager['createSession']>) => unknown>;
  connections: Map<Socket, ConnectionState>;
  isRunning: boolean;
}

let serverState: ServerState | null = null;

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_PORT = 7437; // "CALC" on phone keypad
const DEFAULT_SOCKET_PATH = getDefaultSocketPath();

function getDefaultSocketPath(): string {
  // Check environment variables first
  if (process.env.CALCULATHOR_SOCKET) {
    return process.env.CALCULATHOR_SOCKET;
  }

  // XDG runtime directory (preferred on Linux)
  if (process.env.XDG_RUNTIME_DIR) {
    return `${process.env.XDG_RUNTIME_DIR}/calculathor/socket`;
  }

  // macOS
  if (process.platform === 'darwin') {
    return `${process.env.HOME}/Library/Caches/calculathor/socket`;
  }

  // Linux fallback
  const uid = process.getuid?.() ?? 0;
  return `/tmp/calculathor-${uid}/socket`;
}

// ============================================================================
// Daemon Lifecycle
// ============================================================================

/**
 * Start the Calculathor daemon with both Unix socket and TCP fallback.
 */
export function startDaemon(options: DaemonOptions = {}): void {
  if (serverState?.isRunning) {
    console.log('[daemon] Already running');
    return;
  }

  const socketPath = options.socketPath ?? DEFAULT_SOCKET_PATH;
  const port = options.port ?? DEFAULT_PORT;

  // Initialize session manager
  const sessionManager = new SessionManager({
    sessionTimeoutMs: options.sessionTimeoutMs,
    maxHistoryPerSession: options.maxHistoryPerSession,
  });

  // Create method handlers
  const handlers = createHandlers(sessionManager);

  // Initialize server state
  serverState = {
    sessionManager,
    handlers,
    connections: new Map(),
    isRunning: false,
  };

  // Try to start Unix socket server
  let unixStarted = false;
  try {
    if (process.platform !== 'win32') {
      serverState.unixServer = startUnixServer(socketPath);
      unixStarted = true;
      console.log(`[daemon] Unix socket listening on ${socketPath}`);
    }
  } catch (error) {
    console.warn(`[daemon] Unix socket failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Start TCP server as fallback/alternative
  try {
    serverState.tcpServer = startTcpServer(port);
    console.log(`[daemon] TCP server listening on 127.0.0.1:${port}`);
  } catch (error) {
    console.error(`[daemon] TCP server failed: ${error instanceof Error ? error.message : String(error)}`);

    // If neither server started, throw error
    if (!unixStarted) {
      throw new Error('Failed to start any server');
    }
  }

  serverState.isRunning = true;
  console.log('[daemon] Started successfully');

  // Handle graceful shutdown
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

/**
 * Stop the daemon and clean up resources.
 */
export function stopDaemon(): void {
  if (!serverState) {
    return;
  }

  console.log('[daemon] Stopping...');

  // Close all connections
  for (const [socket, state] of serverState.connections.entries()) {
    // Remove session
    serverState.sessionManager.removeSession(state.sessionId);
    // Close socket
    socket.end();
  }
  serverState.connections.clear();

  // Stop session manager cleanup
  serverState.sessionManager.stop();

  // Stop servers
  if (serverState.unixServer) {
    serverState.unixServer.stop(true);
    // Clean up socket file
    try {
      const socketPath = getDefaultSocketPath();
      if (Bun.file(socketPath).exists()) {
        // Note: Bun.file().delete() doesn't exist, using Node API through Bun
        const { unlinkSync } = require('fs');
        unlinkSync(socketPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  if (serverState.tcpServer) {
    serverState.tcpServer.stop(true);
  }

  serverState.isRunning = false;
  serverState = null;

  console.log('[daemon] Stopped');
}

/**
 * Check if the daemon is running.
 */
export function isRunning(): boolean {
  return serverState?.isRunning ?? false;
}

// ============================================================================
// Server Implementations
// ============================================================================

function startUnixServer(socketPath: string): ReturnType<typeof Bun.listen> {
  // Ensure directory exists
  const { mkdirSync, unlinkSync } = require('fs');
  const { dirname } = require('path');

  try {
    mkdirSync(dirname(socketPath), { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  // Remove stale socket file if it exists
  try {
    unlinkSync(socketPath);
  } catch {
    // Socket file might not exist
  }

  const server = Bun.listen({
    unix: socketPath,
    socket: createSocketHandler(),
  });

  // Set socket permissions (user only)
  try {
    const { chmodSync } = require('fs');
    chmodSync(socketPath, 0o600);
  } catch {
    // Ignore permission errors
  }

  return server;
}

function startTcpServer(port: number): ReturnType<typeof Bun.listen> {
  return Bun.listen({
    hostname: '127.0.0.1',
    port,
    socket: createSocketHandler(),
  });
}

// ============================================================================
// Socket Handler Factory
// ============================================================================

function createSocketHandler(): {
  open: (socket: Socket) => void;
  close: (socket: Socket) => void;
  data: (socket: Socket, data: Buffer) => void;
  error: (socket: Socket, error: Error) => void;
} {
  return {
    open: (socket: Socket) => {
      if (!serverState) return;

      // Create new session for this connection
      const session = serverState.sessionManager.createSession();

      // Track connection
      const connState: ConnectionState = {
        socket,
        sessionId: session.id,
        buffer: '',
      };
      serverState.connections.set(socket, connState);

      console.log(`[daemon] Client connected: ${session.id}`);
    },

    close: (socket: Socket) => {
      if (!serverState) return;

      const connState = serverState.connections.get(socket);
      if (connState) {
        // Clean up session
        serverState.sessionManager.removeSession(connState.sessionId);
        serverState.connections.delete(socket);
        console.log(`[daemon] Client disconnected: ${connState.sessionId}`);
      }
    },

    data: (socket: Socket, data: Buffer) => {
      if (!serverState) return;

      const connState = serverState.connections.get(socket);
      if (!connState) return;

      // Convert buffer to string and process
      const text = data.toString('utf-8');
      const { requests, remaining } = processBuffer(connState.buffer, text);
      connState.buffer = remaining;

      // Process each complete request
      for (const request of requests) {
        if ('code' in request) {
          // It's an error (JSONRPCError)
          const response = createErrorResponse(
            null,
            request.code,
            request.message,
            request.data
          );
          socket.write(serializeResponse(response));
        } else {
          // It's a valid request
          handleRequest(socket, request, connState);
        }
      }
    },

    error: (socket: Socket, error: Error) => {
      console.error(`[daemon] Socket error: ${error.message}`);
      socket.end();
    },
  };
}

// ============================================================================
// Request Handling
// ============================================================================

async function handleRequest(
  socket: Socket,
  request: JSONRPCRequest,
  connState: ConnectionState
): Promise<void> {
  if (!serverState) return;

  const session = serverState.sessionManager.getSession(connState.sessionId);
  if (!session) {
    // Session expired or invalid
    const response = createErrorResponse(
      request.id ?? null,
      ErrorCode.INTERNAL_ERROR,
      'Session expired'
    );
    socket.write(serializeResponse(response));
    return;
  }

  // Dispatch to handler
  const response = await dispatchRequest(
    request,
    serverState.handlers,
    session
  );

  // Send response (unless it's a notification)
  if (response !== null) {
    socket.write(serializeResponse(response));
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

function gracefulShutdown(): void {
  console.log('\n[daemon] Received shutdown signal');
  stopDaemon();
  process.exit(0);
}
