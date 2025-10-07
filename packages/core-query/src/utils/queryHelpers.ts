/**
 * Query building and utility functions
 *
 * Provides helpers for constructing SQL queries, templates for common
 * dashboard patterns, and utilities for query manipulation.
 */

/**
 * Options for building JOIN queries
 */
export interface JoinOptions {
  /** Tables to join (first is base table) */
  tables: Array<{
    name: string;
    alias?: string;
  }>;
  /** Join conditions */
  on: Array<{
    left: string; // e.g., "sales.employee_id"
    right: string; // e.g., "employees.id"
    type?: "INNER" | "LEFT" | "RIGHT" | "FULL";
  }>;
  /** Columns to select (empty = all) */
  select?: string[];
  /** WHERE clause conditions */
  where?: string;
  /** GROUP BY columns */
  groupBy?: string[];
  /** ORDER BY clause */
  orderBy?: Array<{ column: string; direction: "ASC" | "DESC" }>;
  /** LIMIT clause */
  limit?: number;
}

/**
 * Build a JOIN query from options
 *
 * @param options - Join configuration
 * @returns SQL query string
 *
 * @example
 * ```typescript
 * const sql = buildJoinQuery({
 *   tables: [
 *     { name: "sales", alias: "s" },
 *     { name: "employees", alias: "e" }
 *   ],
 *   on: [{ left: "s.employee_id", right: "e.id" }],
 *   select: ["s.amount", "e.name", "e.department"],
 *   where: "s.amount > 1000",
 *   groupBy: ["e.department"]
 * });
 * // SELECT s.amount, e.name, e.department FROM sales AS s
 * // INNER JOIN employees AS e ON s.employee_id = e.id
 * // WHERE s.amount > 1000
 * // GROUP BY e.department
 * ```
 */
export function buildJoinQuery(options: JoinOptions): string {
  const { tables, on, select, where, groupBy, orderBy, limit } = options;

  if (tables.length < 2) {
    throw new Error("JOIN requires at least 2 tables");
  }

  if (on.length === 0) {
    throw new Error("JOIN requires at least one ON condition");
  }

  // Build SELECT clause
  const selectClause = select && select.length > 0 ? select.join(", ") : "*";

  // Build FROM clause with first table
  const baseTable = tables[0];
  let fromClause = baseTable.name;
  if (baseTable.alias) {
    fromClause += ` AS ${baseTable.alias}`;
  }

  // Build JOIN clauses
  const joinClauses: string[] = [];
  for (let i = 1; i < tables.length; i++) {
    const table = tables[i];
    const joinCondition = on[i - 1];
    const joinType = joinCondition?.type || "INNER";

    let joinClause = `${joinType} JOIN ${table.name}`;
    if (table.alias) {
      joinClause += ` AS ${table.alias}`;
    }
    joinClause += ` ON ${joinCondition.left} = ${joinCondition.right}`;

    joinClauses.push(joinClause);
  }

  // Build complete query
  let query = `SELECT ${selectClause}\nFROM ${fromClause}`;

  if (joinClauses.length > 0) {
    query += "\n" + joinClauses.join("\n");
  }

  if (where) {
    query += `\nWHERE ${where}`;
  }

  if (groupBy && groupBy.length > 0) {
    query += `\nGROUP BY ${groupBy.join(", ")}`;
  }

  if (orderBy && orderBy.length > 0) {
    const orderClauses = orderBy.map((o) => `${o.column} ${o.direction}`);
    query += `\nORDER BY ${orderClauses.join(", ")}`;
  }

  if (limit !== undefined) {
    query += `\nLIMIT ${limit}`;
  }

  return query;
}

/**
 * Options for aggregation queries
 */
export interface AggregateOptions {
  /** Table name */
  table: string;
  /** Field to aggregate */
  field: string;
  /** Aggregation operation */
  operation: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "COUNT_DISTINCT";
  /** Columns to group by */
  groupBy?: string[];
  /** WHERE clause conditions */
  where?: string;
  /** HAVING clause conditions (for filtered aggregations) */
  having?: string;
  /** ORDER BY clause */
  orderBy?: Array<{ column: string; direction: "ASC" | "DESC" }>;
  /** LIMIT clause */
  limit?: number;
  /** Alias for aggregated column */
  alias?: string;
}

/**
 * Build an aggregation query
 *
 * @param options - Aggregation configuration
 * @returns SQL query string
 *
 * @example
 * ```typescript
 * const sql = buildAggregateQuery({
 *   table: "sales",
 *   field: "amount",
 *   operation: "SUM",
 *   groupBy: ["region"],
 *   alias: "total_sales"
 * });
 * // SELECT region, SUM(amount) AS total_sales
 * // FROM sales
 * // GROUP BY region
 * ```
 */
export function buildAggregateQuery(options: AggregateOptions): string {
  const {
    table,
    field,
    operation,
    groupBy,
    where,
    having,
    orderBy,
    limit,
    alias,
  } = options;

  // Build aggregation expression
  let aggExpr: string;
  if (operation === "COUNT_DISTINCT") {
    aggExpr = `COUNT(DISTINCT ${field})`;
  } else {
    aggExpr = `${operation}(${field})`;
  }

  if (alias) {
    aggExpr += ` AS ${alias}`;
  }

  // Build SELECT clause
  const selectParts: string[] = [];
  if (groupBy && groupBy.length > 0) {
    selectParts.push(...groupBy);
  }
  selectParts.push(aggExpr);

  let query = `SELECT ${selectParts.join(", ")}\nFROM ${table}`;

  if (where) {
    query += `\nWHERE ${where}`;
  }

  if (groupBy && groupBy.length > 0) {
    query += `\nGROUP BY ${groupBy.join(", ")}`;
  }

  if (having) {
    query += `\nHAVING ${having}`;
  }

  if (orderBy && orderBy.length > 0) {
    const orderClauses = orderBy.map((o) => `${o.column} ${o.direction}`);
    query += `\nORDER BY ${orderClauses.join(", ")}`;
  }

  if (limit !== undefined) {
    query += `\nLIMIT ${limit}`;
  }

  return query;
}

/**
 * Sanitize SQL identifier (table/column name)
 *
 * @param identifier - Identifier to sanitize
 * @returns Sanitized identifier wrapped in quotes
 */
export function sanitizeIdentifier(identifier: string): string {
  // Remove quotes and escape internal quotes
  const cleaned = identifier.replace(/"/g, '""');
  return `"${cleaned}"`;
}

/**
 * Escape string value for SQL
 *
 * @param value - String value to escape
 * @returns Escaped string value
 */
export function escapeString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Build parameterized query with placeholder replacement
 *
 * @param sql - SQL with $param placeholders
 * @param params - Parameter values
 * @returns SQL with parameters substituted
 *
 * @example
 * ```typescript
 * const sql = buildParameterizedQuery(
 *   "SELECT * FROM sales WHERE region = $region AND amount > $minAmount",
 *   { region: "North", minAmount: 1000 }
 * );
 * // SELECT * FROM sales WHERE region = 'North' AND amount > 1000
 * ```
 */
export function buildParameterizedQuery(
  sql: string,
  params: Record<string, unknown>
): string {
  let result = sql;

  for (const [key, value] of Object.entries(params)) {
    const placeholder = `$${key}`;
    let replacement: string;

    if (value === null || value === undefined) {
      replacement = "NULL";
    } else if (typeof value === "string") {
      replacement = `'${escapeString(value)}'`;
    } else if (typeof value === "number" || typeof value === "boolean") {
      replacement = String(value);
    } else if (value instanceof Date) {
      replacement = `'${value.toISOString()}'`;
    } else {
      replacement = `'${escapeString(JSON.stringify(value))}'`;
    }

    result = result.replace(
      new RegExp(`\\${placeholder}\\b`, "g"),
      replacement
    );
  }

  return result;
}

/**
 * Build query for table introspection
 *
 * @param tableName - Name of table to inspect
 * @returns SQL query to get table metadata
 */
export function buildTableInfoQuery(tableName: string): string {
  return `
    SELECT 
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = '${escapeString(tableName)}'
    ORDER BY ordinal_position
  `;
}

/**
 * Build query to count rows in a table
 *
 * @param tableName - Name of table
 * @param where - Optional WHERE clause
 * @returns SQL query to count rows
 */
export function buildCountQuery(tableName: string, where?: string): string {
  let query = `SELECT COUNT(*) AS count FROM ${sanitizeIdentifier(tableName)}`;
  if (where) {
    query += ` WHERE ${where}`;
  }
  return query;
}

/**
 * Build query for data sampling
 *
 * @param tableName - Name of table
 * @param options - Sampling options
 * @returns SQL query to sample data
 */
export function buildSampleQuery(
  tableName: string,
  options?: {
    limit?: number;
    random?: boolean;
    where?: string;
  }
): string {
  const limit = options?.limit ?? 100;
  let query = `SELECT * FROM ${sanitizeIdentifier(tableName)}`;

  if (options?.where) {
    query += ` WHERE ${options.where}`;
  }

  if (options?.random) {
    query += " ORDER BY RANDOM()";
  }

  query += ` LIMIT ${limit}`;

  return query;
}

/**
 * Extract table names from SQL query (basic parser)
 *
 * @param sql - SQL query
 * @returns Array of table names found in query
 */
export function extractTableNames(sql: string): string[] {
  const tables: string[] = [];
  const fromRegex = /FROM\s+([a-zA-Z0-9_"]+)/gi;
  const joinRegex = /JOIN\s+([a-zA-Z0-9_"]+)/gi;

  let match;
  while ((match = fromRegex.exec(sql)) !== null) {
    tables.push(match[1].replace(/"/g, ""));
  }
  while ((match = joinRegex.exec(sql)) !== null) {
    tables.push(match[1].replace(/"/g, ""));
  }

  return Array.from(new Set(tables));
}
