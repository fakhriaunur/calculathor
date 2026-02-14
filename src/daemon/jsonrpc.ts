/**
 * JSON-RPC 2.0 Protocol Handler
 *
 * Implements line-delimited JSON-RPC 2.0 protocol as specified in ADR-003.
 * Handles request parsing, method dispatch, and response formatting.
 */

import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  ErrorCodeType,
  MethodHandler,
  SessionState,
} from './types.ts';
import { ErrorCode } from './types.ts';

// ============================================================================
// Request Parsing
// ============================================================================

/**
 * Parse a line of input as a JSON-RPC request.
 * Returns null for notifications (requests without id) or parse errors.
 */
export function parseRequest(line: string): JSONRPCRequest | JSONRPCError | null {
  // Trim whitespace
  line = line.trim();

  if (!line) {
    return null;
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    return createError(null, ErrorCode.PARSE_ERROR, 'Parse error: Invalid JSON');
  }

  // Validate JSON-RPC request structure
  if (!isValidRequest(parsed)) {
    const id = typeof parsed === 'object' && parsed !== null && 'id' in parsed
      ? (parsed as { id: unknown }).id
      : null;
    return createError(id as number | string | null, ErrorCode.INVALID_REQUEST, 'Invalid Request: Not a valid JSON-RPC 2.0 request');
  }

  return parsed as JSONRPCRequest;
}

/**
 * Type guard to validate JSON-RPC request structure.
 */
function isValidRequest(value: unknown): value is JSONRPCRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Must have jsonrpc: "2.0"
  if (obj.jsonrpc !== '2.0') {
    return false;
  }

  // Must have method as string
  if (typeof obj.method !== 'string' || obj.method === '') {
    return false;
  }

  // id can be string, number, null, or undefined (for notifications)
  if (obj.id !== undefined &&
      typeof obj.id !== 'string' &&
      typeof obj.id !== 'number' &&
      obj.id !== null) {
    return false;
  }

  // params, if present, must be object or array
  if (obj.params !== undefined &&
      typeof obj.params !== 'object') {
    return false;
  }

  return true;
}

// ============================================================================
// Response Creation
// ============================================================================

/**
 * Create a successful JSON-RPC response.
 */
export function createSuccess(id: number | string | null, result: unknown): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create an error JSON-RPC response.
 */
export function createError(
  id: number | string | null,
  code: ErrorCodeType,
  message: string,
  data?: unknown
): JSONRPCError {
  return {
    code,
    message,
    data,
  };
}

/**
 * Create a full JSON-RPC error response.
 */
export function createErrorResponse(
  id: number | string | null,
  code: ErrorCodeType,
  message: string,
  data?: unknown
): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

// ============================================================================
// Method Dispatch
// ============================================================================

/**
 * Route a request to the appropriate handler.
 */
export async function dispatchRequest(
  request: JSONRPCRequest,
  handlers: Map<string, MethodHandler>,
  session: SessionState
): Promise<JSONRPCResponse | null> {
  // Notifications (no id) don't require a response
  const isNotification = request.id === undefined || request.id === null;

  const handler = handlers.get(request.method);

  if (!handler) {
    if (isNotification) {
      return null;
    }
    return createErrorResponse(
      request.id,
      ErrorCode.METHOD_NOT_FOUND,
      `Method not found: ${request.method}`
    );
  }

  try {
    const result = await handler(request.params, session);

    if (isNotification) {
      return null;
    }

    return createSuccess(request.id, result);
  } catch (error) {
    if (isNotification) {
      return null;
    }

    // Map known error types to appropriate codes
    if (error instanceof SyntaxError || error instanceof Error) {
      const message = error.message;

      if (message.includes('Parse error') || message.includes('Unexpected')) {
        return createErrorResponse(
          request.id,
          ErrorCode.INVALID_EXPRESSION,
          message
        );
      }

      if (message.includes('Division by zero')) {
        return createErrorResponse(
          request.id,
          ErrorCode.CALCULATION_ERROR,
          message
        );
      }

      if (message.includes('Unknown identifier')) {
        return createErrorResponse(
          request.id,
          ErrorCode.UNDEFINED_VARIABLE,
          message
        );
      }

      if (message.includes('Unknown function')) {
        return createErrorResponse(
          request.id,
          ErrorCode.CALCULATION_ERROR,
          message
        );
      }
    }

    return createErrorResponse(
      request.id,
      ErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize a response to line-delimited JSON.
 */
export function serializeResponse(response: JSONRPCResponse): string {
  return JSON.stringify(response) + '\n';
}

/**
 * Process a buffer of data, extracting complete JSON-RPC messages.
 * Returns array of parsed requests and remaining buffer content.
 */
export function processBuffer(
  buffer: string,
  newData: string
): { requests: (JSONRPCRequest | JSONRPCError)[]; remaining: string } {
  const combined = buffer + newData;
  const lines = combined.split('\n');

  // Last element is incomplete line (or empty string if ends with newline)
  const remaining = lines.pop() ?? '';

  const requests: (JSONRPCRequest | JSONRPCError)[] = [];

  for (const line of lines) {
    const request = parseRequest(line);
    if (request !== null) {
      requests.push(request);
    }
  }

  return { requests, remaining };
}
