/**
 * Settings Repository Implementation
 * Manages application settings as key-value pairs
 */

import type { DatabaseService } from "../database";
import type { ISettingsRepository, Setting } from "../types";

// ============================================================================
// SQL Queries
// ============================================================================

const SQL = {
  INSERT_OR_UPDATE: `
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value
  `,
  SELECT_BY_KEY: `
    SELECT key, value
    FROM settings
    WHERE key = ?
  `,
  SELECT_ALL: `
    SELECT key, value
    FROM settings
  `,
  DELETE: `
    DELETE FROM settings WHERE key = ?
  `,
} as const;

// ============================================================================
// Row Mapper
// ============================================================================

interface SettingsRow {
  key: string;
  value: string;
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SettingsRepository implements ISettingsRepository {
  constructor(private db: DatabaseService) {}

  /**
   * Get a setting value by key
   * Returns null if not found
   */
  async get(key: string): Promise<string | null> {
    const row = this.db.queryOne<SettingsRow>(SQL.SELECT_BY_KEY, [key]);
    return row?.value ?? null;
  }

  /**
   * Set a setting value (insert or update)
   */
  async set(key: string, value: string): Promise<void> {
    this.db.run(SQL.INSERT_OR_UPDATE, [key, value]);
  }

  /**
   * Delete a setting by key
   */
  async delete(key: string): Promise<void> {
    this.db.run(SQL.DELETE, [key]);
  }

  /**
   * Get all settings as a key-value record
   */
  async getAll(): Promise<Record<string, string>> {
    const rows = this.db.query<SettingsRow>(SQL.SELECT_ALL);

    return rows.reduce(
      (acc, row) => {
        acc[row.key] = row.value;
        return acc;
      },
      {} as Record<string, string>
    );
  }

  /**
   * Get a setting and parse it as JSON
   */
  async getJson<T>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get(key);

    if (value === null) {
      return defaultValue;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Set a setting value as JSON
   */
  async setJson<T>(key: string, value: T): Promise<void> {
    await this.set(key, JSON.stringify(value));
  }
}
