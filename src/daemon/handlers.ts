/**
 * JSON-RPC Method Handlers for Calculathor Daemon
 *
 * Implements the core methods:
 * - evaluate: Evaluate a mathematical expression
 * - registerFunction: Register a user-defined function
 * - getHistory: Get calculation history for session
 */

import { tokenize } from '../parser/tokenizer.ts';
import { parse } from '../parser/pratt.ts';
import { evaluate, createDefaultContext } from '../evaluator/index.ts';
import type {
  MethodHandler,
  SessionState,
  EvaluateParams,
  EvaluateResult,
  RegisterFunctionParams,
  RegisterFunctionResult,
  GetHistoryParams,
  GetHistoryResult,
  HistoryEntry,
} from './types.ts';
import { SessionManager } from './session.ts';

// ============================================================================
// Handler Registry
// ============================================================================

export function createHandlers(sessionManager: SessionManager): Map<string, MethodHandler> {
  const handlers = new Map<string, MethodHandler>();

  handlers.set('evaluate', createEvaluateHandler(sessionManager));
  handlers.set('registerFunction', createRegisterFunctionHandler(sessionManager));
  handlers.set('getHistory', createGetHistoryHandler(sessionManager));
  handlers.set('ping', pingHandler);

  return handlers;
}

// ============================================================================
// Evaluate Handler
// ============================================================================

function createEvaluateHandler(sessionManager: SessionManager): MethodHandler {
  return (params: unknown, session: SessionState): EvaluateResult => {
    const { expression } = validateEvaluateParams(params);

    // Tokenize
    const tokens = tokenize(expression);

    // Parse to AST
    const ast = parse(tokens);

    // Create evaluation context with session functions
    const context = createSessionContext(session);

    // Evaluate
    const result = evaluate(ast, context);

    // Record in history
    sessionManager.addHistoryEntry(session, {
      expression,
      result,
    });

    return { result };
  };
}

function validateEvaluateParams(params: unknown): EvaluateParams {
  if (typeof params !== 'object' || params === null) {
    throw new Error('Invalid params: expected object');
  }

  const { expression } = params as { expression?: unknown };

  if (typeof expression !== 'string' || expression === '') {
    throw new Error('Invalid params: expression must be a non-empty string');
  }

  return { expression };
}

// ============================================================================
// Register Function Handler
// ============================================================================

function createRegisterFunctionHandler(sessionManager: SessionManager): MethodHandler {
  return (params: unknown, session: SessionState): RegisterFunctionResult => {
    const { name, params: fnParams, body } = validateRegisterFunctionParams(params);

    // Validate function name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error('Invalid function name: must be a valid identifier');
    }

    // Validate parameter names
    for (const param of fnParams) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(param)) {
        throw new Error(`Invalid parameter name: ${param}`);
      }
    }

    // Register the function
    sessionManager.registerFunction(session, name, fnParams, body);

    return { success: true, name };
  };
}

function validateRegisterFunctionParams(params: unknown): RegisterFunctionParams {
  if (typeof params !== 'object' || params === null) {
    throw new Error('Invalid params: expected object');
  }

  const { name, params: fnParams, body } = params as {
    name?: unknown;
    params?: unknown;
    body?: unknown;
  };

  if (typeof name !== 'string' || name === '') {
    throw new Error('Invalid params: name must be a non-empty string');
  }

  if (!Array.isArray(fnParams) || !fnParams.every(p => typeof p === 'string')) {
    throw new Error('Invalid params: params must be an array of strings');
  }

  if (typeof body !== 'string' || body === '') {
    throw new Error('Invalid params: body must be a non-empty string');
  }

  return {
    name,
    params: fnParams as string[],
    body,
  };
}

// ============================================================================
// Get History Handler
// ============================================================================

function createGetHistoryHandler(sessionManager: SessionManager): MethodHandler {
  return (params: unknown, session: SessionState): GetHistoryResult => {
    const { limit } = validateGetHistoryParams(params);

    const entries = sessionManager.getHistory(session, limit);

    return { entries };
  };
}

function validateGetHistoryParams(params: unknown): GetHistoryParams {
  if (params === undefined || params === null) {
    return {};
  }

  if (typeof params !== 'object') {
    throw new Error('Invalid params: expected object or undefined');
  }

  const { limit } = params as { limit?: unknown };

  if (limit !== undefined) {
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 0) {
      throw new Error('Invalid params: limit must be a non-negative integer');
    }
  }

  return { limit: limit as number | undefined };
}

// ============================================================================
// Ping Handler
// ============================================================================

const pingHandler: MethodHandler = (): { pong: true; timestamp: number } => {
  return { pong: true, timestamp: Date.now() };
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an evaluation context that includes session-specific functions.
 */
function createSessionContext(session: SessionState): {
  functions: Map<string, (...args: number[]) => number>;
  constants: Map<string, number>;
  variables: Map<string, number>;
} {
  const baseContext = createDefaultContext();

  // Create new maps to avoid mutating the shared default context
  const functions = new Map(baseContext.functions);
  const constants = new Map(baseContext.constants);
  const variables = new Map(session.variables);

  // Add session-specific functions
  for (const userFn of session.functions.values()) {
    functions.set(userFn.name, userFn.fn);
  }

  // Add session variables to constants (they work the same way in expressions)
  for (const [name, value] of session.variables.entries()) {
    constants.set(name, value);
  }

  return { functions, constants, variables };
}
