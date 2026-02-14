/**
 * History Repository Implementation
 * Manages calculation history entries
 */

import type { DatabaseService } from "../database";
import type {
  HistoryEntry,
  HistoryEntryInput,
  IHistoryRepository,
} from "../types";

// ============================================================================
// SQL Queries
// ============================================================================

const SQL = {
  INSERT: `
    INSERT INTO history (expression, result, error, timestamp)
    VALUES (?, ?, ?, ?)
  `,
  SELECT_BY_ID: `
    SELECT id, expression, result, error, timestamp
    FROM history
    WHERE id = ?
  `,
  SELECT_RECENT: `
    SELECT id, expression, result, error, timestamp
    FROM history
    ORDER BY timestamp DESC
    LIMIT ?
  `,
  SEARCH: `
    SELECT id, expression, result, error, timestamp
    FROM history
    WHERE expression LIKE ?
    ORDER BY timestamp DESC
  `,
  DELETE: `
    DELETE FROM history WHERE id = ?
  `,
  CLEAR: `
    DELETE FROM history
  `,
  COUNT: `
    SELECT COUNT(*) as count FROM history
  `,
} as const;

// ============================================================================
// Row Mapper
// ============================================================================

interface HistoryRow {
  id: number;
  expression: string;
  result: number | null;
  error: string | null;
  timestamp: number;
}

function mapRowToEntry(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    expression: row.expression,
    result: row.result,
    error: row.error,
    timestamp: row.timestamp,
  };
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class HistoryRepository implements IHistoryRepository {
  constructor(private db: DatabaseService) {}

  /**
   * Add a new history entry
   */
  async add(entry: HistoryEntryInput): Promise<void> {
    const timestamp = entry.timestamp ?? Date.now();

    this.db.run(SQL.INSERT, [
      entry.expression,
      entry.result,
      entry.error,
      timestamp,
    ]);
  }

  /**
   * Get a history entry by ID
   */
  async getById(id: number): Promise<HistoryEntry | null> {
    const row = this.db.queryOne<HistoryRow>(SQL.SELECT_BY_ID, [id]);

    if (!row) {
      return null;
    }

    return mapRowToEntry(row);
  }

  /**
   * Get recent history entries ordered by timestamp (newest first)
   */
  async getRecent(limit: number): Promise<HistoryEntry[]> {
    const rows = this.db.query<HistoryRow>(SQL.SELECT_RECENT, [limit]);
    return rows.map(mapRowToEntry);
  }

  /**
   * Search history entries by expression pattern
   * Uses SQL LIKE pattern matching
   */
  async search(query: string): Promise<HistoryEntry[]> {
    // Escape special LIKE characters and wrap with wildcards
    const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`;
    const rows = this.db.query<HistoryRow>(SQL.SEARCH, [pattern]);
    return rows.map(mapRowToEntry);
  }

  /**
   * Delete a history entry by ID
   */
  async delete(id: number): Promise<void> {
    this.db.run(SQL.DELETE, [id]);
  }

  /**
   * Clear all history entries
   */
  async clear(): Promise<void> {
    this.db.exec(SQL.CLEAR);
  }

  /**
   * Get total count of history entries
   */
  async count(): Promise<number> {
    const result = this.db.queryOne<{ count: number }>(SQL.COUNT);
    return result?.count ?? 0;
  }
}
