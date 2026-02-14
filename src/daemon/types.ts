/**
 * JSON-RPC 2.0 Types for Calculathor Daemon
 *
 * Based on ADR-003 and DDD-003 Transport Context
 */

// ============================================================================
// JSON-RPC 2.0 Message Types
// ============================================================================

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string | null;
  method: string;
  params?: unknown;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================================================
// Error Codes (JSON-RPC 2.0 + Application Specific)
// ============================================================================

export const ErrorCode = {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // Application-specific errors (start at -32000)
  CALCULATION_ERROR: -32000,
  UNDEFINED_VARIABLE: -32001,
  INVALID_EXPRESSION: -32002,
  TIMEOUT_ERROR: -32003,
  TRANSPORT_ERROR: -32004,
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

// ============================================================================
// Session Types
// ============================================================================

export interface SessionState {
  id: string;
  variables: Map<string, number>;
  functions: Map<string, UserFunction>;
  history: HistoryEntry[];
  lastActivity: number;
}

export interface UserFunction {
  name: string;
  params: string[];
  body: string; // JavaScript function body
  fn: (...args: number[]) => number;
}

export interface HistoryEntry {
  timestamp: number;
  expression: string;
  result: number;
  error?: string;
}

// ============================================================================
// Method Parameters and Results
// ============================================================================

export interface EvaluateParams {
  expression: string;
}

export interface EvaluateResult {
  result: number;
}

export interface RegisterFunctionParams {
  name: string;
  params: string[];
  body: string;
}

export interface RegisterFunctionResult {
  success: boolean;
  name: string;
}

export interface GetHistoryParams {
  limit?: number;
}

export interface GetHistoryResult {
  entries: HistoryEntry[];
}

// ============================================================================
// Daemon Configuration
// ============================================================================

export interface DaemonOptions {
  socketPath?: string;
  port?: number;
  sessionTimeoutMs?: number;
  maxHistoryPerSession?: number;
}

export interface SocketAddress {
  type: 'unix' | 'tcp';
  path?: string;
  host?: string;
  port?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type MethodHandler = (
  params: unknown,
  session: SessionState
) => Promise<unknown> | unknown;

export interface ConnectionState {
  socket: Bun.Socket;
  sessionId: string;
  buffer: string;
}
