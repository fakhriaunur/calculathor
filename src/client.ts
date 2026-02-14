/**
 * Calculathor Client
 *
 * Client library for communicating with the Calculathor daemon.
 * Supports both Unix sockets and TCP connections.
 *
 * Usage:
 *   const client = new CalculathorClient();
 *   await client.connect();
 *   const result = await client.evaluate('2 + 2');
 *   console.log(result); // 4
 *   await client.disconnect();
 */

import type { Socket } from 'bun';
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  EvaluateResult,
  RegisterFunctionResult,
  GetHistoryResult,
  HistoryEntry,
} from './daemon/types.ts';

// ============================================================================
// Configuration
// ============================================================================

export interface ClientOptions {
  /** Unix socket path (overrides auto-detection) */
  socketPath?: string;
  /** TCP host (default: 127.0.0.1) */
  host?: string;
  /** TCP port (default: 7437) */
  port?: number;
  /** Connection timeout in milliseconds */
  connectTimeout?: number;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** Prefer TCP over Unix socket */
  preferTcp?: boolean;
}

interface PendingRequest {
  resolve: (value: JSONRPCResponse) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// ============================================================================
// Client Implementation
// ============================================================================

export class CalculathorClient {
  private options: Required<ClientOptions>;
  private socket: Socket | null = null;
  private connected = false;
  private messageId = 0;
  private pendingRequests: Map<number | string, PendingRequest> = new Map();
  private buffer = '';

  constructor(options: ClientOptions = {}) {
    this.options = {
      socketPath: options.socketPath ?? getDefaultSocketPath(),
      host: options.host ?? '127.0.0.1',
      port: options.port ?? 7437,
      connectTimeout: options.connectTimeout ?? 5000,
      requestTimeout: options.requestTimeout ?? 30000,
      preferTcp: options.preferTcp ?? false,
    };
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to the daemon.
   * Attempts Unix socket first, falls back to TCP.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // Try Unix socket first (unless TCP is preferred)
    if (!this.options.preferTcp && process.platform !== 'win32') {
      try {
        await this.connectUnix();
        console.log(`[client] Connected via Unix socket: ${this.options.socketPath}`);
        return;
      } catch (error) {
        console.log('[client] Unix socket failed, trying TCP...');
      }
    }

    // Fall back to TCP
    await this.connectTcp();
    console.log(`[client] Connected via TCP: ${this.options.host}:${this.options.port}`);
  }

  /**
   * Disconnect from the daemon.
   */
  async disconnect(): Promise<void> {
    if (!this.socket) {
      return;
    }

    // Reject all pending requests
    for (const [id, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Disconnected'));
    }
    this.pendingRequests.clear();

    // Close socket - Bun sockets use end() method
    try {
      this.socket.end();
    } catch {
      // Ignore close errors
    }
    this.socket = null;
    this.connected = false;
    this.buffer = '';

    console.log('[client] Disconnected');
  }

  /**
   * Check if connected to daemon.
   */
  isConnected(): boolean {
    return this.connected;
  }

  // ============================================================================
  // JSON-RPC Methods
  // ============================================================================

  /**
   * Evaluate a mathematical expression.
   *
   * @param expression - The expression to evaluate (e.g., "2 + 3 * 4")
   * @returns The calculated result
   * @throws Error if evaluation fails
   *
   * @example
   *   const result = await client.evaluate('sin(pi / 2)');
   *   console.log(result); // 1
   */
  async evaluate(expression: string): Promise<number> {
    const response = await this.sendRequest('evaluate', { expression });

    if (response.error) {
      throw new Error(response.error.message);
    }

    const result = response.result as EvaluateResult;
    return result.result;
  }

  /**
   * Register a user-defined function.
   *
   * @param name - Function name (must be valid identifier)
   * @param params - Parameter names
   * @param body - JavaScript expression body
   * @returns Success confirmation
   * @throws Error if registration fails
   *
   * @example
   *   await client.registerFunction('square', ['x'], 'x * x');
   *   const result = await client.evaluate('square(5)'); // 25
   */
  async registerFunction(
    name: string,
    params: string[],
    body: string
  ): Promise<RegisterFunctionResult> {
    const response = await this.sendRequest('registerFunction', {
      name,
      params,
      body,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result as RegisterFunctionResult;
  }

  /**
   * Get calculation history.
   *
   * @param limit - Maximum number of entries to return (most recent first)
   * @returns Array of history entries
   *
   * @example
   *   const history = await client.getHistory(10);
   *   history.forEach(entry => {
   *     console.log(`${entry.expression} = ${entry.result}`);
   *   });
   */
  async getHistory(limit?: number): Promise<HistoryEntry[]> {
    const response = await this.sendRequest('getHistory', limit !== undefined ? { limit } : {});

    if (response.error) {
      throw new Error(response.error.message);
    }

    const result = response.result as GetHistoryResult;
    return result.entries;
  }

  /**
   * Ping the daemon to check if it's alive.
   *
   * @returns Pong response with timestamp
   */
  async ping(): Promise<{ pong: true; timestamp: number }> {
    const response = await this.sendRequest('ping', {});

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result as { pong: true; timestamp: number };
  }

  // ============================================================================
  // Low-level Communication
  // ============================================================================

  private async connectUnix(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Unix socket connection timeout'));
      }, this.options.connectTimeout);

      let timeoutCleared = false;

      const clearConnTimeout = () => {
        if (!timeoutCleared) {
          clearTimeout(timeout);
          timeoutCleared = true;
        }
      };

      Bun.connect({
        unix: this.options.socketPath,
        socket: {
          open: (socket) => {
            clearConnTimeout();
            this.socket = socket;
            this.connected = true;
            resolve();
          },
          close: () => {
            this.handleDisconnect();
          },
          data: (socket, data) => {
            this.handleData(data);
          },
          error: (socket, error) => {
            clearConnTimeout();
            reject(error);
          },
        },
      }).catch((error) => {
        clearConnTimeout();
        reject(error);
      });
    });
  }

  private async connectTcp(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('TCP connection timeout'));
      }, this.options.connectTimeout);

      let timeoutCleared = false;

      const clearConnTimeout = () => {
        if (!timeoutCleared) {
          clearTimeout(timeout);
          timeoutCleared = true;
        }
      };

      Bun.connect({
        hostname: this.options.host,
        port: this.options.port,
        socket: {
          open: (socket) => {
            clearConnTimeout();
            this.socket = socket;
            this.connected = true;
            resolve();
          },
          close: () => {
            this.handleDisconnect();
          },
          data: (socket, data) => {
            this.handleData(data);
          },
          error: (socket, error) => {
            clearConnTimeout();
            reject(error);
          },
        },
      }).catch((error) => {
        clearConnTimeout();
        reject(error);
      });
    });
  }

  private handleDisconnect(): void {
    this.connected = false;
    this.socket = null;

    // Reject all pending requests
    for (const [id, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString('utf-8');

    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line) as JSONRPCResponse;
          this.handleResponse(response);
        } catch (error) {
          console.error('[client] Failed to parse response:', line);
        }
      }
    }
  }

  private handleResponse(response: JSONRPCResponse): void {
    const id = response.id;
    if (id === undefined || id === null) {
      console.log('[client] Received notification:', response);
      return;
    }

    const request = this.pendingRequests.get(id);
    if (!request) {
      console.warn('[client] Received response for unknown request:', id);
      return;
    }

    clearTimeout(request.timeout);
    this.pendingRequests.delete(id);
    request.resolve(response);
  }

  private async sendRequest(
    method: string,
    params: unknown
  ): Promise<JSONRPCResponse> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to daemon');
    }

    const id = ++this.messageId;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.options.requestTimeout);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout,
      });

      // Send request
      const data = JSON.stringify(request) + '\n';
      this.socket!.write(data);
    });
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Evaluate an expression using a one-shot client connection.
 * Automatically connects, evaluates, and disconnects.
 *
 * @param expression - Expression to evaluate
 * @param options - Client options
 * @returns Evaluation result
 *
 * @example
 *   const result = await quickEval('2 + 2');
 *   console.log(result); // 4
 */
export async function quickEval(expression: string, options?: ClientOptions): Promise<number> {
  const client = new CalculathorClient(options);
  try {
    await client.connect();
    return await client.evaluate(expression);
  } finally {
    await client.disconnect();
  }
}

/**
 * Check if daemon is running.
 *
 * @param options - Client options
 * @returns True if daemon responds to ping
 */
export async function isDaemonRunning(options?: ClientOptions): Promise<boolean> {
  const client = new CalculathorClient(options);
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    await client.disconnect().catch(() => {});
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function getDefaultSocketPath(): string {
  if (process.env.CALCULATHOR_SOCKET) {
    return process.env.CALCULATHOR_SOCKET;
  }

  if (process.env.XDG_RUNTIME_DIR) {
    return `${process.env.XDG_RUNTIME_DIR}/calculathor/socket`;
  }

  if (process.platform === 'darwin') {
    return `${process.env.HOME}/Library/Caches/calculathor/socket`;
  }

  const uid = process.getuid?.() ?? 0;
  return `/tmp/calculathor-${uid}/socket`;
}

// ============================================================================
// Exports
// ============================================================================

export type {
  ClientOptions,
  EvaluateResult,
  RegisterFunctionResult,
  GetHistoryResult,
  HistoryEntry,
} from './daemon/types.ts';
