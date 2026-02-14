/**
 * Type definitions for the Persistence layer
 * Following DDD-002-persistence-context.md
 */

// ============================================================================
// Domain Types
// ============================================================================

/** Branded type for type safety */
export type Branded<T, B> = T & { __brand: B };

export type Timestamp = number;

// ============================================================================
// History Types
// ============================================================================

export interface HistoryEntry {
  id: number;
  expression: string;
  result: number | null;
  error: string | null;
  timestamp: Timestamp;
}

export interface HistoryEntryInput {
  expression: string;
  result: number | null;
  error: string | null;
  timestamp?: Timestamp;
}

// ============================================================================
// User Function Types
// ============================================================================

export interface UserFunction {
  id: number;
  name: string;
  params: string[];
  body: string;
  createdAt: Timestamp;
}

export interface UserFunctionInput {
  name: string;
  params: string[];
  body: string;
  createdAt?: Timestamp;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface Setting {
  key: string;
  value: string;
}

// ============================================================================
// Repository Interfaces
// ============================================================================

export interface IHistoryRepository {
  add(entry: HistoryEntryInput): Promise<void>;
  getRecent(limit: number): Promise<HistoryEntry[]>;
  search(query: string): Promise<HistoryEntry[]>;
  getById(id: number): Promise<HistoryEntry | null>;
  delete(id: number): Promise<void>;
  clear(): Promise<void>;
}

export interface IFunctionRepository {
  save(func: UserFunctionInput): Promise<void>;
  findByName(name: string): Promise<UserFunction | null>;
  getAll(): Promise<UserFunction[]>;
  delete(name: string): Promise<void>;
  update(name: string, func: Partial<UserFunctionInput>): Promise<void>;
}

export interface ISettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  getAll(): Promise<Record<string, string>>;
}

// ============================================================================
// Migration Types
// ============================================================================

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export interface SchemaVersion {
  version: number;
  appliedAt: Timestamp;
}
