/**
 * User Functions Repository Implementation
 * Manages user-defined functions
 */

import type { DatabaseService } from "../database";
import type {
  UserFunction,
  UserFunctionInput,
  IFunctionRepository,
} from "../types";

// ============================================================================
// SQL Queries
// ============================================================================

const SQL = {
  INSERT: `
    INSERT INTO user_functions (name, params, body, created_at)
    VALUES (?, ?, ?, ?)
  `,
  UPDATE: `
    UPDATE user_functions
    SET params = ?, body = ?, created_at = ?
    WHERE name = ?
  `,
  SELECT_BY_NAME: `
    SELECT id, name, params, body, created_at
    FROM user_functions
    WHERE name = ?
  `,
  SELECT_ALL: `
    SELECT id, name, params, body, created_at
    FROM user_functions
    ORDER BY name ASC
  `,
  DELETE: `
    DELETE FROM user_functions WHERE name = ?
  `,
  EXISTS: `
    SELECT 1 as exists_flag FROM user_functions WHERE name = ?
  `,
} as const;

// ============================================================================
// Row Mapper
// ============================================================================

interface FunctionRow {
  id: number;
  name: string;
  params: string;
  body: string;
  created_at: number;
}

function mapRowToFunction(row: FunctionRow): UserFunction {
  return {
    id: row.id,
    name: row.name,
    params: JSON.parse(row.params) as string[],
    body: row.body,
    createdAt: row.created_at,
  };
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class FunctionRepository implements IFunctionRepository {
  constructor(private db: DatabaseService) {}

  /**
   * Save a user function (insert or update if exists)
   */
  async save(func: UserFunctionInput): Promise<void> {
    const timestamp = func.createdAt ?? Date.now();
    const paramsJson = JSON.stringify(func.params);

    // Check if function already exists
    const exists = await this.exists(func.name);

    if (exists) {
      // Update existing function
      this.db.run(SQL.UPDATE, [paramsJson, func.body, timestamp, func.name]);
    } else {
      // Insert new function
      this.db.run(SQL.INSERT, [func.name, paramsJson, func.body, timestamp]);
    }
  }

  /**
   * Find a function by name
   */
  async findByName(name: string): Promise<UserFunction | null> {
    const row = this.db.queryOne<FunctionRow>(SQL.SELECT_BY_NAME, [name]);

    if (!row) {
      return null;
    }

    return mapRowToFunction(row);
  }

  /**
   * Get all user functions
   */
  async getAll(): Promise<UserFunction[]> {
    const rows = this.db.query<FunctionRow>(SQL.SELECT_ALL);
    return rows.map(mapRowToFunction);
  }

  /**
   * Delete a function by name
   */
  async delete(name: string): Promise<void> {
    this.db.run(SQL.DELETE, [name]);
  }

  /**
   * Update an existing function
   */
  async update(
    name: string,
    func: Partial<UserFunctionInput>
  ): Promise<void> {
    const existing = await this.findByName(name);

    if (!existing) {
      throw new Error(`Function '${name}' not found`);
    }

    const timestamp = func.createdAt ?? Date.now();
    const paramsJson = func.params ? JSON.stringify(func.params) : JSON.stringify(existing.params);
    const body = func.body ?? existing.body;

    this.db.run(SQL.UPDATE, [paramsJson, body, timestamp, name]);
  }

  /**
   * Check if a function exists
   */
  private async exists(name: string): Promise<boolean> {
    const result = this.db.queryOne<{ exists_flag: number }>(SQL.EXISTS, [name]);
    return result !== null;
  }
}
