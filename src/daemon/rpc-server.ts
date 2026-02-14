/**
 * JSON-RPC Protocol Handler
 * Handles JSON-RPC 2.0 requests/responses for the daemon
 */

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id?: string | number | null;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: JSONRPCError;
  id: string | number | null;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse;

// Standard JSON-RPC error codes
export const JSONRPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Application-specific errors
  CALCULATION_ERROR: -32000,
  UNDEFINED_VARIABLE: -32001,
  INVALID_EXPRESSION: -32002,
} as const;

export class JSONRPCErrorException extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'JSONRPCError';
  }
}

export type MethodHandler = (params: unknown) => unknown | Promise<unknown>;

export class JSONRPCServer {
  private methods = new Map<string, MethodHandler>();

  /**
   * Register a method handler
   */
  registerMethod(name: string, handler: MethodHandler): void {
    this.methods.set(name, handler);
  }

  /**
   * Unregister a method
   */
  unregisterMethod(name: string): boolean {
    return this.methods.delete(name);
  }

  /**
   * Handle a raw JSON-RPC message
   */
  async handleMessage(message: string): Promise<string | null> {
    let request: JSONRPCRequest;

    // Parse the message
    try {
      const parsed = JSON.parse(message);
      if (!this.isValidRequest(parsed)) {
        return this.createErrorResponse(
          null,
          JSONRPC_ERRORS.INVALID_REQUEST,
          'Invalid JSON-RPC request'
        );
      }
      request = parsed;
    } catch {
      return this.createErrorResponse(
        null,
        JSONRPC_ERRORS.PARSE_ERROR,
        'Parse error'
      );
    }

    // Handle notification (no id)
    if (request.id === undefined) {
      await this.handleRequest(request);
      return null;
    }

    // Handle request
    try {
      const result = await this.handleRequest(request);
      return this.createSuccessResponse(request.id, result);
    } catch (error) {
      if (error instanceof JSONRPCErrorException) {
        return this.createErrorResponse(
          request.id,
          error.code,
          error.message,
          error.data
        );
      }

      return this.createErrorResponse(
        request.id,
        JSONRPC_ERRORS.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal error'
      );
    }
  }

  /**
   * Handle a request object
   */
  private async handleRequest(request: JSONRPCRequest): Promise<unknown> {
    const handler = this.methods.get(request.method);
    if (!handler) {
      throw new JSONRPCErrorException(
        JSONRPC_ERRORS.METHOD_NOT_FOUND,
        `Method not found: ${request.method}`
      );
    }

    return await handler(request.params);
  }

  /**
   * Validate JSON-RPC request structure
   */
  private isValidRequest(data: unknown): data is JSONRPCRequest {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const req = data as Record<string, unknown>;

    // Must have jsonrpc: "2.0"
    if (req.jsonrpc !== '2.0') {
      return false;
    }

    // Must have method as string
    if (typeof req.method !== 'string') {
      return false;
    }

    // id is optional but must be string, number, or null if present
    if (
      req.id !== undefined &&
      typeof req.id !== 'string' &&
      typeof req.id !== 'number' &&
      req.id !== null
    ) {
      return false;
    }

    return true;
  }

  /**
   * Create success response
   */
  private createSuccessResponse(
    id: string | number | null,
    result: unknown
  ): string {
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      result,
      id,
    };
    return JSON.stringify(response);
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
  ): string {
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        data,
      },
      id,
    };
    return JSON.stringify(response);
  }

  /**
   * Create a request message
   */
  static createRequest(
    method: string,
    params?: unknown,
    id?: string | number
  ): string {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };
    return JSON.stringify(request);
  }

  /**
   * Create a notification message (no id)
   */
  static createNotification(method: string, params?: unknown): string {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method,
      params,
    };
    return JSON.stringify(request);
  }
}
