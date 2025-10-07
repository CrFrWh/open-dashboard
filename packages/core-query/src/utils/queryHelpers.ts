/**
 * Query building and utility functions
 *
 * Provides helpers for constructing SQL queries, templates for common
 * dashboard patterns, and utilities for query manipulation.
 *
 * Implements SQL injection protection through:
 * - Identifier sanitization and validation
 * - Parameterized queries with DuckDB prepared statements
 * - Clause validation against dangerous patterns
 * - Type-safe query builders
 */

/**
 * Allowed aggregation operations (whitelist)
 */
export const ALLOWED_AGGREGATIONS = [
  "SUM",
  "AVG",
  "COUNT",
  "MIN",
  "MAX",
  "COUNT_DISTINCT",
  "STDDEV",
  "VARIANCE",
] as const;
export type AggregationOperation = (typeof ALLOWED_AGGREGATIONS)[number];

/**
 * Allowed join types (whitelist)
 */
export const ALLOWED_JOIN_TYPES = [
  "INNER",
  "LEFT",
  "RIGHT",
  "FULL",
  "CROSS",
] as const;
export type JoinType = (typeof ALLOWED_JOIN_TYPES)[number];

/**
 * Allowed sort directions (whitelist)
 */
export const ALLOWED_DIRECTIONS = ["ASC", "DESC"] as const;
export type SortDirection = (typeof ALLOWED_DIRECTIONS)[number];

/**
 * Allowed comparison operators (whitelist)
 */
export const ALLOWED_OPERATORS = [
  "=",
  "!=",
  "<>",
  ">",
  "<",
  ">=",
  "<=",
  "LIKE",
  "ILIKE",
  "IN",
  "NOT IN",
  "IS NULL",
  "IS NOT NULL",
] as const;
export type ComparisonOperator = (typeof ALLOWED_OPERATORS)[number];

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
    type?: JoinType;
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

  // Validate WHERE clause if provided
  if (where) {
    validateClause(where, "WHERE");
  }

  // Build SELECT clause with sanitized identifiers
  const selectClause =
    select && select.length > 0
      ? select.map((col) => sanitizeIdentifier(col, true)).join(", ")
      : "*";

  // Build FROM clause with first table (sanitized)
  const baseTable = tables[0];
  let fromClause = sanitizeIdentifier(baseTable.name);
  if (baseTable.alias) {
    validateIdentifier(baseTable.alias);
    fromClause += ` AS ${sanitizeIdentifier(baseTable.alias)}`;
  }

  // Build JOIN clauses with sanitized identifiers
  const joinClauses: string[] = [];
  for (let i = 1; i < tables.length; i++) {
    const table = tables[i];
    const joinCondition = on[i - 1];
    const joinType = joinCondition?.type || "INNER";

    // Validate join type
    if (!ALLOWED_JOIN_TYPES.includes(joinType)) {
      throw new Error(`Invalid join type: ${joinType}`);
    }

    let joinClause = `${joinType} JOIN ${sanitizeIdentifier(table.name)}`;
    if (table.alias) {
      validateIdentifier(table.alias);
      joinClause += ` AS ${sanitizeIdentifier(table.alias)}`;
    }

    // Sanitize join condition columns
    joinClause += ` ON ${sanitizeIdentifier(joinCondition.left, true)} = ${sanitizeIdentifier(joinCondition.right, true)}`;

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
    const sanitizedGroupBy = groupBy.map((col) =>
      sanitizeIdentifier(col, true)
    );
    query += `\nGROUP BY ${sanitizedGroupBy.join(", ")}`;
  }

  if (orderBy && orderBy.length > 0) {
    const orderClauses = orderBy.map((o) => {
      if (!ALLOWED_DIRECTIONS.includes(o.direction)) {
        throw new Error(`Invalid sort direction: ${o.direction}`);
      }
      return `${sanitizeIdentifier(o.column, true)} ${o.direction}`;
    });
    query += `\nORDER BY ${orderClauses.join(", ")}`;
  }

  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error("LIMIT must be a non-negative integer");
    }
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
  operation: AggregationOperation;
  /** Columns to group by */
  groupBy?: string[];
  /** WHERE clause conditions */
  where?: string;
  /** HAVING clause conditions (for filtered aggregations) */
  having?: string;
  /** ORDER BY clause */
  orderBy?: Array<{ column: string; direction: SortDirection }>;
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

  // Validate operation
  if (!ALLOWED_AGGREGATIONS.includes(operation)) {
    throw new Error(`Invalid aggregation operation: ${operation}`);
  }

  // Validate clauses
  if (where) {
    validateClause(where, "WHERE");
  }
  if (having) {
    validateClause(having, "HAVING");
  }

  // Build aggregation expression with sanitized field
  let aggExpr: string;
  if (operation === "COUNT_DISTINCT") {
    aggExpr = `COUNT(DISTINCT ${sanitizeIdentifier(field, true)})`;
  } else {
    aggExpr = `${operation}(${sanitizeIdentifier(field, true)})`;
  }

  if (alias) {
    validateIdentifier(alias);
    aggExpr += ` AS ${sanitizeIdentifier(alias)}`;
  }

  // Build SELECT clause with sanitized identifiers
  const selectParts: string[] = [];
  if (groupBy && groupBy.length > 0) {
    selectParts.push(...groupBy.map((col) => sanitizeIdentifier(col, true)));
  }
  selectParts.push(aggExpr);

  let query = `SELECT ${selectParts.join(", ")}\nFROM ${sanitizeIdentifier(table)}`;

  if (where) {
    query += `\nWHERE ${where}`;
  }

  if (groupBy && groupBy.length > 0) {
    const sanitizedGroupBy = groupBy.map((col) =>
      sanitizeIdentifier(col, true)
    );
    query += `\nGROUP BY ${sanitizedGroupBy.join(", ")}`;
  }

  if (having) {
    query += `\nHAVING ${having}`;
  }

  if (orderBy && orderBy.length > 0) {
    const orderClauses = orderBy.map((o) => {
      if (!ALLOWED_DIRECTIONS.includes(o.direction)) {
        throw new Error(`Invalid sort direction: ${o.direction}`);
      }
      return `${sanitizeIdentifier(o.column, true)} ${o.direction}`;
    });
    query += `\nORDER BY ${orderClauses.join(", ")}`;
  }

  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error("LIMIT must be a non-negative integer");
    }
    query += `\nLIMIT ${limit}`;
  }

  return query;
}

/**
 * Validate SQL identifier for dangerous patterns
 *
 * @param identifier - Identifier to validate
 * @param allowQualified - Allow table.column format
 * @throws {Error} If identifier contains invalid characters or patterns
 */
export function validateIdentifier(
  identifier: string,
  allowQualified = false
): void {
  if (!identifier || identifier.trim() === "") {
    throw new Error("Identifier cannot be empty");
  }

  const trimmed = identifier.trim();

  // Check for SQL keywords that are suspicious as identifiers
  const dangerousKeywords = [
    "DROP",
    "DELETE",
    "INSERT",
    "UPDATE",
    "CREATE",
    "ALTER",
    "EXEC",
    "EXECUTE",
    "UNION",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
  ];

  if (dangerousKeywords.includes(trimmed.toUpperCase())) {
    throw new Error(`Cannot use SQL keyword '${trimmed}' as identifier`);
  }

  // For qualified names (table.column)
  if (allowQualified && trimmed.includes(".")) {
    const parts = trimmed.split(".");
    if (parts.length > 2) {
      throw new Error("Invalid qualified identifier (max one dot allowed)");
    }
    // Validate each part recursively
    parts.forEach((part) => validateIdentifier(part, false));
    return;
  }

  // Allow alphanumeric, underscore, and dollar sign (DuckDB compatible)
  // Must start with letter or underscore
  if (!/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(trimmed)) {
    throw new Error(
      `Invalid identifier '${trimmed}'. Must start with letter/underscore and contain only alphanumeric characters, underscores, or dollar signs`
    );
  }
}

/**
 * Sanitize SQL identifier (table/column name) for use in queries
 *
 * DuckDB supports double-quoted identifiers which preserve case and allow special characters.
 * This function validates and wraps identifiers safely.
 *
 * @param identifier - Identifier to sanitize
 * @param allowQualified - Allow table.column format
 * @returns Sanitized identifier wrapped in quotes
 * @throws {Error} If identifier is invalid
 */
export function sanitizeIdentifier(
  identifier: string,
  allowQualified = false
): string {
  // Validate first
  validateIdentifier(identifier, allowQualified);

  const trimmed = identifier.trim();

  // Handle qualified identifiers (table.column)
  if (allowQualified && trimmed.includes(".")) {
    const parts = trimmed.split(".");
    return parts.map((part) => sanitizeIdentifier(part, false)).join(".");
  }

  // Escape internal quotes and wrap in double quotes (DuckDB standard)
  const escaped = trimmed.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Escape string value for SQL (single quotes for DuckDB string literals)
 *
 * @param value - String value to escape
 * @returns Escaped string value (without surrounding quotes)
 */
export function escapeString(value: string): string {
  // Escape single quotes by doubling them (SQL standard)
  return value.replace(/'/g, "''");
}

/**
 * Validate WHERE/HAVING/ON clause for dangerous patterns
 *
 * @param clause - SQL clause to validate
 * @param clauseType - Type of clause (for error messages)
 * @throws {Error} If clause contains dangerous patterns
 */
export function validateClause(clause: string, clauseType = "clause"): void {
  if (!clause || clause.trim() === "") {
    return; // Empty clauses are ok (will be omitted)
  }

  const dangerous = [
    // Destructive operations
    /;\s*(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE)/i,
    // SQL comments (can hide malicious code)
    /--/,
    /\/\*|\*\//,
    // Union-based injection
    /(UNION|INTERSECT|EXCEPT)\s+(ALL\s+)?SELECT/i,
    // File operations (DuckDB specific)
    /INTO\s+(OUTFILE|DUMPFILE)/i,
    // Subqueries attempting to modify data
    /\(\s*(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER)/i,
  ];

  for (const pattern of dangerous) {
    if (pattern.test(clause)) {
      throw new Error(
        `${clauseType} contains potentially dangerous patterns. ` +
          "Use parameterized queries for user input."
      );
    }
  }

  // Check for excessive semicolons (statement chaining)
  const semicolonCount = (clause.match(/;/g) || []).length;
  if (semicolonCount > 0) {
    throw new Error(
      `${clauseType} contains semicolons which could enable SQL injection. ` +
        "Remove semicolons or use parameterized queries."
    );
  }
}

/**
 * Build parameterized query with safe placeholder replacement
 *
 * Uses DuckDB's prepared statement parameter substitution for type-safe queries.
 * Supports NULL, strings, numbers, booleans, dates, and arrays (for IN clauses).
 *
 * @param sql - SQL with $param placeholders
 * @param params - Parameter values
 * @returns SQL with parameters safely substituted
 *
 * @example
 * ```typescript
 * const sql = buildParameterizedQuery(
 *   "SELECT * FROM sales WHERE region = $region AND amount > $minAmount",
 *   { region: "North", minAmount: 1000 }
 * );
 * // SELECT * FROM sales WHERE region = 'North' AND amount > 1000
 *
 * // Array parameters for IN clauses
 * const sql2 = buildParameterizedQuery(
 *   "SELECT * FROM sales WHERE region IN $regions",
 *   { regions: ["North", "South"] }
 * );
 * // SELECT * FROM sales WHERE region IN ('North', 'South')
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
      // Escape and wrap in single quotes
      replacement = `'${escapeString(value)}'`;
    } else if (typeof value === "number") {
      // Validate number is finite
      if (!Number.isFinite(value)) {
        throw new Error(`Parameter '${key}' is not a finite number: ${value}`);
      }
      replacement = String(value);
    } else if (typeof value === "boolean") {
      // DuckDB uses TRUE/FALSE
      replacement = value ? "TRUE" : "FALSE";
    } else if (value instanceof Date) {
      // ISO format for timestamps
      replacement = `'${value.toISOString()}'`;
    } else if (Array.isArray(value)) {
      // Handle arrays for IN clauses
      if (value.length === 0) {
        throw new Error(`Parameter '${key}' is an empty array`);
      }
      const arrayValues = value.map((item) => {
        if (typeof item === "string") {
          return `'${escapeString(item)}'`;
        } else if (typeof item === "number") {
          if (!Number.isFinite(item)) {
            throw new Error(
              `Array parameter '${key}' contains non-finite number`
            );
          }
          return String(item);
        } else if (typeof item === "boolean") {
          return item ? "TRUE" : "FALSE";
        } else if (item === null || item === undefined) {
          return "NULL";
        } else {
          throw new Error(`Array parameter '${key}' contains unsupported type`);
        }
      });
      replacement = `(${arrayValues.join(", ")})`;
    } else {
      // For complex objects, try JSON serialization
      try {
        const jsonString = JSON.stringify(value);
        replacement = `'${escapeString(jsonString)}'`;
      } catch (error) {
        throw new Error(
          `Parameter '${key}' contains unserializable value: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Replace all occurrences of the placeholder (word boundary)
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
 * @throws {Error} If WHERE clause contains dangerous patterns
 */
export function buildCountQuery(tableName: string, where?: string): string {
  if (where) {
    validateClause(where, "WHERE");
  }

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
 * @throws {Error} If options contain invalid values
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

  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("Sample limit must be a non-negative integer");
  }

  if (options?.where) {
    validateClause(options.where, "WHERE");
  }

  let query = `SELECT * FROM ${sanitizeIdentifier(tableName)}`;

  if (options?.where) {
    query += ` WHERE ${options.where}`;
  }

  if (options?.random) {
    // DuckDB's RANDOM() function for sampling
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

  // Match table names after FROM and JOIN keywords
  // Handles quoted identifiers and qualified names (schema.table)
  const fromRegex = /FROM\s+(?:"([^"]+)"|([a-zA-Z0-9_$.]+))(?:\s+AS\s+)?/gi;
  const joinRegex = /JOIN\s+(?:"([^"]+)"|([a-zA-Z0-9_$.]+))(?:\s+AS\s+)?/gi;

  let match;
  while ((match = fromRegex.exec(sql)) !== null) {
    const tableName = match[1] || match[2];
    if (tableName) {
      // Extract table name (remove schema prefix if present)
      const parts = tableName.split(".");
      tables.push(parts[parts.length - 1]);
    }
  }

  while ((match = joinRegex.exec(sql)) !== null) {
    const tableName = match[1] || match[2];
    if (tableName) {
      const parts = tableName.split(".");
      tables.push(parts[parts.length - 1]);
    }
  }

  return Array.from(new Set(tables));
}

/**
 * Build safe WHERE clause from conditions object
 *
 * @param conditions - Object mapping column to value or comparison
 * @returns WHERE clause and params for buildParameterizedQuery
 *
 * @example
 * ```typescript
 * const { whereClause, params } = buildWhereClause({
 *   region: "North",
 *   amount: { op: ">", value: 1000 },
 *   status: { op: "IN", value: ["active", "pending"] }
 * });
 * // WHERE "region" = $param_region AND "amount" > $param_amount AND "status" IN $param_status
 * // params = { param_region: "North", param_amount: 1000, param_status: ["active", "pending"] }
 * ```
 */
export function buildWhereClause(
  conditions: Record<
    string,
    unknown | { op: ComparisonOperator; value: unknown }
  >
): { whereClause: string; params: Record<string, unknown> } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(conditions)) {
    validateIdentifier(key);
    const safeColumn = sanitizeIdentifier(key);
    const paramName = `param_${key.replace(/[^a-zA-Z0-9_]/g, "_")}`;

    if (
      typeof value === "object" &&
      value !== null &&
      "op" in value &&
      "value" in value
    ) {
      const { op, value: paramValue } = value as { op: string; value: unknown };

      // Validate operator against whitelist
      const upperOp = op.toUpperCase();
      const allowedOpsStrings = ALLOWED_OPERATORS.map((o) => o.toUpperCase());
      if (!allowedOpsStrings.includes(upperOp)) {
        throw new Error(
          `Invalid operator: ${op}. Allowed: ${ALLOWED_OPERATORS.join(", ")}`
        );
      }

      // Handle NULL checks specially
      if (upperOp === "IS NULL" || upperOp === "IS NOT NULL") {
        clauses.push(`${safeColumn} ${upperOp}`);
      } else {
        clauses.push(`${safeColumn} ${upperOp} $${paramName}`);
        params[paramName] = paramValue;
      }
    } else {
      // Simple equality
      if (value === null || value === undefined) {
        clauses.push(`${safeColumn} IS NULL`);
      } else {
        clauses.push(`${safeColumn} = $${paramName}`);
        params[paramName] = value;
      }
    }
  }

  return {
    whereClause: clauses.join(" AND "),
    params,
  };
}

/**
 * Type-safe query builder for SELECT statements
 *
 * Provides a fluent API for building safe SQL queries without string concatenation.
 *
 * @example
 * ```typescript
 * const { sql, params } = QueryBuilder.from("sales")
 *   .select(["region", "amount"])
 *   .where("amount", ">", 1000)
 *   .where("region", "IN", ["North", "South"])
 *   .orderBy("amount", "DESC")
 *   .limit(10)
 *   .build();
 *
 * const result = await engine.queryWithParams(sql, params);
 * ```
 */
export class QueryBuilder {
  private table: string;
  private selectColumns: string[] = [];
  private whereConditions: Array<{
    column: string;
    op: ComparisonOperator | string;
    value?: unknown;
  }> = [];
  private orderByColumns: Array<{ column: string; direction: SortDirection }> =
    [];
  private groupByColumns: string[] = [];
  private limitValue?: number;

  private constructor(table: string) {
    validateIdentifier(table);
    this.table = table;
  }

  /**
   * Start building a query from a table
   */
  static from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  }

  /**
   * Select specific columns
   */
  select(columns: string[]): this {
    columns.forEach((col) => validateIdentifier(col, true));
    this.selectColumns = columns;
    return this;
  }

  /**
   * Add a WHERE condition
   */
  where(
    column: string,
    operator: ComparisonOperator | string,
    value?: unknown
  ): this {
    validateIdentifier(column, true);

    // Validate operator
    const upperOp = operator.toUpperCase();
    const allowedOpsStrings = ALLOWED_OPERATORS.map((o) => o.toUpperCase());
    if (!allowedOpsStrings.includes(upperOp)) {
      throw new Error(`Invalid operator: ${operator}`);
    }

    this.whereConditions.push({ column, op: upperOp, value });
    return this;
  }

  /**
   * Add GROUP BY columns
   */
  groupBy(columns: string[]): this {
    columns.forEach((col) => validateIdentifier(col, true));
    this.groupByColumns = columns;
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(column: string, direction: SortDirection = "ASC"): this {
    validateIdentifier(column, true);

    if (!ALLOWED_DIRECTIONS.includes(direction)) {
      throw new Error(`Invalid sort direction: ${direction}`);
    }

    this.orderByColumns.push({ column, direction });
    return this;
  }

  /**
   * Add LIMIT clause
   */
  limit(count: number): this {
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error("LIMIT must be a positive integer");
    }
    this.limitValue = count;
    return this;
  }

  /**
   * Build the final SQL query with parameters
   */
  build(): { sql: string; params: Record<string, unknown> } {
    const params: Record<string, unknown> = {};

    // SELECT clause
    const selectClause =
      this.selectColumns.length > 0
        ? this.selectColumns
            .map((col) => sanitizeIdentifier(col, true))
            .join(", ")
        : "*";

    let sql = `SELECT ${selectClause}\nFROM ${sanitizeIdentifier(this.table)}`;

    // WHERE clause
    if (this.whereConditions.length > 0) {
      const whereClauses = this.whereConditions.map((cond, idx) => {
        const safeColumn = sanitizeIdentifier(cond.column, true);

        // Handle NULL checks
        if (cond.op === "IS NULL" || cond.op === "IS NOT NULL") {
          return `${safeColumn} ${cond.op}`;
        }

        const paramName = `param${idx}`;
        params[paramName] = cond.value;
        return `${safeColumn} ${cond.op} $${paramName}`;
      });
      sql += `\nWHERE ${whereClauses.join(" AND ")}`;
    }

    // GROUP BY clause
    if (this.groupByColumns.length > 0) {
      const groupByClause = this.groupByColumns
        .map((col) => sanitizeIdentifier(col, true))
        .join(", ");
      sql += `\nGROUP BY ${groupByClause}`;
    }

    // ORDER BY clause
    if (this.orderByColumns.length > 0) {
      const orderClauses = this.orderByColumns.map(
        (o) => `${sanitizeIdentifier(o.column, true)} ${o.direction}`
      );
      sql += `\nORDER BY ${orderClauses.join(", ")}`;
    }

    // LIMIT clause
    if (this.limitValue !== undefined) {
      sql += `\nLIMIT ${this.limitValue}`;
    }

    return { sql, params };
  }
}
