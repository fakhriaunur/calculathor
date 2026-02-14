/**
 * Persistence Service
 * Main entry point for the persistence layer
 *
 * Provides repository pattern access to:
 * - History entries (calculation history)
 * - User functions (custom user-defined functions)
 * - Settings (application configuration)
 *
 * @example
 * ```typescript
 * const persistence = new PersistenceService('./data/calculathor.db');
 * await persistence.migrate();
 *
 * // Add history entry
 * await persistence.history.add({
 *   expression: '2 + 2',
 *   result: 4,
 *   error: null
 * });
 *
 * // Save user function
 * await persistence.functions.save({
 *   name: 'square',
 *   params: ['x'],
 *   body: 'x * x'
 * });
 *
 * // Get setting
 * const precision = await persistence.settings.get('precision');
 * ```
 */

import { DatabaseService } from "./database";
import { HistoryRepository } from "./repositories/history";
import { FunctionRepository } from "./repositories/functions";
import { SettingsRepository } from "./repositories/settings";
import type {
  IHistoryRepository,
  IFunctionRepository,
  ISettingsRepository,
} from "./types";

// Re-export types for consumers
export type {
  HistoryEntry,
  HistoryEntryInput,
  UserFunction,
  UserFunctionInput,
  Setting,
  IHistoryRepository,
  IFunctionRepository,
  ISettingsRepository,
  Migration,
  SchemaVersion,
  Timestamp,
  Branded,
} from "./types";

export { DatabaseService } from "./database";
export { HistoryRepository } from "./repositories/history";
export { FunctionRepository } from "./repositories/functions";
export { SettingsRepository } from "./repositories/settings";

// ============================================================================
// Persistence Service
// ============================================================================

export interface IPersistenceService {
  history: IHistoryRepository;
  functions: IFunctionRepository;
  settings: ISettingsRepository;
  migrate(): Promise<void>;
  close(): void;
}

export class PersistenceService implements IPersistenceService {
  private db: DatabaseService;

  readonly history: IHistoryRepository;
  readonly functions: IFunctionRepository;
  readonly settings: ISettingsRepository;

  /**
   * Create a new PersistenceService
   * @param dbPath - Path to the SQLite database file
   */
  constructor(dbPath: string) {
    this.db = new DatabaseService(dbPath);
    this.history = new HistoryRepository(this.db);
    this.functions = new FunctionRepository(this.db);
    this.settings = new SettingsRepository(this.db);
  }

  /**
   * Run database migrations to ensure schema is up to date
   */
  async migrate(): Promise<void> {
    await this.db.migrate();
  }

  /**
   * Close the database connection
   * Should be called when shutting down the application
   */
  close(): void {
    this.db.close();
  }

  /**
   * Check if the database connection is healthy
   */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      this.db.exec("SELECT 1");
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a PersistenceService with default configuration
 * Uses in-memory database if no path is provided
 */
export function createPersistenceService(
  dbPath?: string
): PersistenceService {
  const path = dbPath ?? ":memory:";
  return new PersistenceService(path);
}

/**
 * Create and migrate a PersistenceService in one call
 */
export async function initPersistenceService(
  dbPath?: string
): Promise<PersistenceService> {
  const service = createPersistenceService(dbPath);
  await service.migrate();
  return service;
}
