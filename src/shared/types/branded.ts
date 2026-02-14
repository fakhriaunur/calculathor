/**
 * Branded types for type safety
 * Prevents mixing different ID types accidentally
 */

export type Brand<K, T> = K & { __brand: T };

// ID Types
export type ExpressionId = Brand<string, 'ExpressionId'>;
export type FunctionId = Brand<string, 'FunctionId'>;
export type ConstantId = Brand<string, 'ConstantId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type EventId = Brand<string, 'EventId'>;
export type RegistryId = Brand<string, 'RegistryId'>;

/**
 * Generate a unique branded ID
 */
export function generateId<T>(prefix: string): Brand<string, T> {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}` as Brand<string, T>;
}

/**
 * Generate expression ID
 */
export function generateExpressionId(): ExpressionId {
  return generateId<ExpressionId>('expr');
}

/**
 * Generate function ID
 */
export function generateFunctionId(): FunctionId {
  return generateId<FunctionId>('fn');
}

/**
 * Generate constant ID
 */
export function generateConstantId(): ConstantId {
  return generateId<ConstantId>('const');
}

/**
 * Generate session ID
 */
export function generateSessionId(): SessionId {
  return generateId<SessionId>('sess');
}

/**
 * Generate event ID
 */
export function generateEventId(): EventId {
  return generateId<EventId>('evt');
}
