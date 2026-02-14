/**
 * Shared kernel - types and utilities used across all bounded contexts
 */

// Branded types
export {
  type Brand,
  type ExpressionId,
  type FunctionId,
  type ConstantId,
  type SessionId,
  type EventId,
  type RegistryId,
  generateId,
  generateExpressionId,
  generateFunctionId,
  generateConstantId,
  generateSessionId,
  generateEventId,
} from './types/branded';

// Result type
export {
  type Result,
  ok,
  err,
  tryCatch,
  tryCatchAsync,
  map,
  flatMap,
  getOrElse,
  unwrap,
} from './utils/result';
