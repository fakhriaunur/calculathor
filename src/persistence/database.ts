/**
 * Database connection and migration management
 * Uses Bun's native SQLite API
 */

import { Database, type SQLQueryBindings } from "bun:sqlite";
import type { Migration } from "./types";

// ============================================================================
// Schema Migrations
// ============================================================================

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    up: `
      -- Schema version tracking
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );

      -- History entries table
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expression TEXT NOT NULL,
        result REAL,
        error TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_history_expression ON history(expression);

      -- User functions table
      CREATE TABLE IF NOT EXISTS user_functions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        params TEXT NOT NULL, -- JSON array
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_functions_name ON user_functions(name);

      -- Settings table
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Insert schema version
      INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (1, ?);
    `,
    down: `
      DROP TABLE IF EXISTS schema_version;
      DROP TABLE IF EXISTS history;
      DROP TABLE IF EXISTS user_functions;
      DROP TABLE IF EXISTS settings;
    `,
  },
];

// ============================================================================
// Database Service
// ============================================================================

export class DatabaseService {
  private db: Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    // Enable WAL mode for better concurrent performance
    this.db.exec("PRAGMA journal_mode = WAL;");
    // Enable foreign keys
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  /**
   * Get the underlying database instance
   */
  getDatabase(): Database {
    return this.db;
  }

  /**
   * Run migrations to bring the database to the latest schema version
   */
  async migrate(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const targetVersion = MIGRATIONS.length;

    if (currentVersion >= targetVersion) {
      console.log(`Database is at version ${currentVersion}, no migrations needed`);
      return;
    }

    console.log(`Migrating database from version ${currentVersion} to ${targetVersion}`);

    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        await this.applyMigration(migration);
      }
    }

    console.log(`Database migration complete, now at version ${targetVersion}`);
  }

  /**
   * Get the current schema version
   */
  private async getCurrentVersion(): Promise<number> {
    try {
      // Check if schema_version table exists
      const tableCheck = this.db.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`
      ).get();

      if (!tableCheck) {
        return 0; // No schema version table, assume fresh database
      }

      const result = this.db.query(
        "SELECT MAX(version) as version FROM schema_version"
      ).get() as { version: number | null } | undefined;

      return result?.version ?? 0;
    } catch (error) {
      console.error("Error getting schema version:", error);
      return 0;
    }
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<void> {
    console.log(`Applying migration ${migration.version}: ${migration.name}`);

    try {
      // Run the migration in a transaction
      this.db.transaction(() => {
        this.db.exec(migration.up);
        // Update schema version (the migration already does this, but double-check)
        this.db.run(
          "INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)",
          [migration.version, Date.now()]
        );
      })();

      console.log(`Migration ${migration.version} applied successfully`);
    } catch (error) {
      console.error(`Failed to apply migration ${migration.version}:`, error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Run a query and return all results
   */
  query<T = unknown>(sql: string, params?: SQLQueryBindings[]): T[] {
    return this.db.query(sql).all(...(params ?? [])) as T[];
  }

  /**
   * Run a query and return the first result
   */
  queryOne<T = unknown>(sql: string, params?: SQLQueryBindings[]): T | null {
    return this.db.query(sql).get(...(params ?? [])) as T | null;
  }

  /**
   * Execute a statement (INSERT, UPDATE, DELETE)
   */
  run(sql: string, params?: SQLQueryBindings[]): { lastInsertRowid: number | bigint; changes: number } {
    return this.db.run(sql, params ?? []);
  }

  /**
   * Execute raw SQL
   */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Execute within a transaction
   */
  transaction<T>(callback: () => T): T {
    return this.db.transaction(callback)();
  }
}
