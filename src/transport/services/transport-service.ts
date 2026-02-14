/**
 * Transport Service
 * Handles client-daemon communication via Unix sockets, TCP, and stdio
 */

export interface TransportConfig {
  type: 'unix' | 'tcp' | 'stdio';
  address?: string; // Path for unix, host:port for tcp
}

export type ConnectionState = 'connecting' | 'connected' | 'closing' | 'closed';

export interface Connection {
  id: string;
  state: ConnectionState;
  send(data: string): Promise<void>;
  onMessage(callback: (data: string) => void): void;
  onClose(callback: () => void): void;
  close(): Promise<void>;
}

export interface TransportServer {
  listen(config: TransportConfig): Promise<void>;
  onConnection(callback: (conn: Connection) => void): void;
  close(): Promise<void>;
  isListening(): boolean;
  getAddress(): string | undefined;
}

export interface TransportClient {
  connect(config: TransportConfig): Promise<Connection>;
}

// Internal connection implementation
class ConnectionImpl implements Connection {
  id: string;
  state: ConnectionState = 'connecting';
  private messageCallbacks: ((data: string) => void)[] = [];
  private closeCallbacks: (() => void)[] = [];
  private socket: any; // Bun socket
  private buffer = '';

  constructor(id: string, socket: any) {
    this.id = id;
    this.socket = socket;
    this.state = 'connected';

    // Handle incoming data
    socket.data({
      data: (socket: any, data: Uint8Array) => {
        this.buffer += new TextDecoder().decode(data);

        // Process line-delimited messages
        let lines = this.buffer.split('\n');
        this.buffer = lines.pop() || ''; // Keep partial line

        for (const line of lines) {
          if (line.trim()) {
            for (const cb of this.messageCallbacks) {
              cb(line);
            }
          }
        }
      },
      close: () => {
        this.state = 'closed';
        for (const cb of this.closeCallbacks) {
          cb();
        }
      },
    });
  }

  async send(data: string): Promise<void> {
    if (this.state !== 'connected') {
      throw new Error(`Cannot send: connection is ${this.state}`);
    }
    this.socket.write(new TextEncoder().encode(data + '\n'));
  }

  onMessage(callback: (data: string) => void): void {
    this.messageCallbacks.push(callback);
  }

  onClose(callback: () => void): void {
    this.closeCallbacks.push(callback);
  }

  async close(): Promise<void> {
    if (this.state === 'closed' || this.state === 'closing') {
      return;
    }
    this.state = 'closing';
    this.socket.end();
    this.state = 'closed';
  }
}

// Unix socket transport implementation
class UnixSocketTransport implements TransportServer {
  private listener: any;
  private connectionCallbacks: ((conn: Connection) => void)[] = [];
  private connections = new Map<string, ConnectionImpl>();
  private config: TransportConfig | undefined;
  private connectionId = 0;

  async listen(config: TransportConfig): Promise<void> {
    if (config.type !== 'unix' || !config.address) {
      throw new Error('Unix socket transport requires unix type and address');
    }

    this.config = config;

    // Clean up stale socket
    try {
      await Bun.file(config.address).delete();
    } catch {
      // Socket doesn't exist, that's fine
    }

    this.listener = Bun.listen({
      unix: config.address,
      socket: {
        open: (socket: any) => {
          const conn = new ConnectionImpl(`conn-${++this.connectionId}`, socket);
          this.connections.set(conn.id, conn);

          conn.onClose(() => {
            this.connections.delete(conn.id);
          });

          for (const cb of this.connectionCallbacks) {
            cb(conn);
          }
        },
      },
    });
  }

  onConnection(callback: (conn: Connection) => void): void {
    this.connectionCallbacks.push(callback);
  }

  async close(): Promise<void> {
    // Close all connections
    for (const conn of this.connections.values()) {
      await conn.close();
    }
    this.connections.clear();

    // Stop listener
    if (this.listener) {
      this.listener.stop();
    }

    // Clean up socket file
    if (this.config?.address) {
      try {
        await Bun.file(this.config.address).delete();
      } catch {
        // Ignore
      }
    }
  }

  isListening(): boolean {
    return this.listener !== undefined;
  }

  getAddress(): string | undefined {
    return this.config?.address;
  }
}

// TCP transport implementation
class TcpTransport implements TransportServer {
  private listener: any;
  private connectionCallbacks: ((conn: Connection) => void)[] = [];
  private connections = new Map<string, ConnectionImpl>();
  private config: TransportConfig | undefined;
  private connectionId = 0;

  async listen(config: TransportConfig): Promise<void> {
    if (config.type !== 'tcp' || !config.address) {
      throw new Error('TCP transport requires tcp type and address');
    }

    this.config = config;

    const [hostname, portStr] = config.address.split(':');
    const port = parseInt(portStr, 10);

    this.listener = Bun.listen({
      hostname: hostname || '127.0.0.1',
      port: port,
      socket: {
        open: (socket: any) => {
          const conn = new ConnectionImpl(`conn-${++this.connectionId}`, socket);
          this.connections.set(conn.id, conn);

          conn.onClose(() => {
            this.connections.delete(conn.id);
          });

          for (const cb of this.connectionCallbacks) {
            cb(conn);
          }
        },
      },
    });
  }

  onConnection(callback: (conn: Connection) => void): void {
    this.connectionCallbacks.push(callback);
  }

  async close(): Promise<void> {
    for (const conn of this.connections.values()) {
      await conn.close();
    }
    this.connections.clear();

    if (this.listener) {
      this.listener.stop();
    }
  }

  isListening(): boolean {
    return this.listener !== undefined;
  }

  getAddress(): string | undefined {
    return this.config?.address;
  }
}

// Client implementation
class TransportClientImpl implements TransportClient {
  async connect(config: TransportConfig): Promise<Connection> {
    if (config.type === 'unix') {
      if (!config.address) {
        throw new Error('Unix socket requires address');
      }

      const socket = await Bun.connect({
        unix: config.address,
      });

      return new ConnectionImpl('client-conn', socket);
    }

    if (config.type === 'tcp') {
      if (!config.address) {
        throw new Error('TCP requires address');
      }

      const [hostname, portStr] = config.address.split(':');
      const port = parseInt(portStr, 10);

      const socket = await Bun.connect({
        hostname: hostname || '127.0.0.1',
        port: port,
      });

      return new ConnectionImpl('client-conn', socket);
    }

    throw new Error(`Unsupported transport type: ${config.type}`);
  }
}

// Main service
export class TransportService {
  createUnixServer(): TransportServer {
    return new UnixSocketTransport();
  }

  createTcpServer(): TransportServer {
    return new TcpTransport();
  }

  createClient(): TransportClient {
    return new TransportClientImpl();
  }
}

// Utility functions
export function getSocketPath(): string {
  const uid = process.getuid?.() ?? 1000;
  return `/tmp/calculathor-${uid}.sock`;
}

export function getTcpAddress(): string {
  return '127.0.0.1:7437';
}
