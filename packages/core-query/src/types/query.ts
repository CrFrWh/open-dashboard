/**
 * Query engine configuration options
 */
export interface QueryEngineConfig {
  /**
   * Custom WASM bundle URL (optional, uses jsDelivr CDN by default)
   * @default undefined (uses DuckDB's default CDN)
   */
  wasmUrl?: string;

  /**
   * Enable query result caching
   * @default true
   */
  enableCache?: boolean;

  /**
   * Cache entry timeout in milliseconds
   * Cached queries older than this will be evicted
   * @default 300000 (5 minutes)
   */
  cacheTimeout?: number;

  /**
   * Maximum number of cached queries
   * When exceeded, oldest entries are evicted
   * @default 100
   */
  maxCacheSize?: number;

  /**
   * Log queries and operations to console
   * Useful for debugging and development
   * @default false
   */
  logQueries?: boolean;
}

/**
 * Options for registering a dataset as a queryable table
 */
export interface RegistrationOptions {
  /**
   * Custom table name for SQL queries
   * If not provided, dataset name will be sanitized and used
   *
   * @example
   * ```typescript
   * // Auto-generated from dataset name
   * await engine.registerDataset(dataset);
   *
   * // Custom table name
   * await engine.registerDataset(dataset, { tableName: "sales_2024" });
   * ```
   */
  tableName?: string;

  /**
   * Whether to replace existing table with same name
   * If false and table exists, throws RegistrationError
   *
   * @default false
   *
   * @example
   * ```typescript
   * // Replace existing table
   * await engine.registerDataset(dataset, {
   *   tableName: "sales",
   *   replace: true,
   * });
   * ```
   */
  replace?: boolean;
}

/**
 * Query execution options
 */
export interface QueryOptions {
  /**
   * Skip cache and force query execution
   * Useful for ensuring fresh data or testing
   *
   * @default false
   *
   * @example
   * ```typescript
   * // Force fresh query
   * const result = await engine.query(sql, { skipCache: true });
   * ```
   */
  skipCache?: boolean;

  /**
   * Query timeout in milliseconds
   * Query will be aborted if it exceeds this duration
   *
   * @default undefined (no timeout)
   *
   * @example
   * ```typescript
   * // Set 30 second timeout
   * const result = await engine.query(sql, { timeout: 30000 });
   * ```
   */
  timeout?: number;

  /**
   * Query parameters for parameterized queries
   * Prevents SQL injection and improves performance
   *
   * @example
   * ```typescript
   * const result = await engine.query(
   *   "SELECT * FROM sales WHERE region = $region",
   *   { params: { region: "West" } }
   * );
   * ```
   */
  params?: Record<string, unknown>;
}

/**
 * Query execution result with data and metadata
 */
export interface QueryResult {
  /**
   * Query result data as array of records
   * Each record is a key-value map of column names to values
   */
  data: Record<string, unknown>[];

  /**
   * Number of rows returned by the query
   */
  rowCount: number;

  /**
   * Number of columns in the result set
   */
  columnCount: number;

  /**
   * Query execution time in milliseconds
   * Useful for performance monitoring and optimization
   */
  executionTime: number;

  /**
   * The SQL query that was executed
   * Helpful for debugging and logging
   */
  sql: string;

  /**
   * Additional query metadata
   */
  metadata?: {
    /**
     * Column names and types from the result schema
     */
    columns?: Array<{
      name: string;
      type: string;
    }>;

    /**
     * Whether result was served from cache
     * True if cache hit, false if executed fresh
     */
    fromCache?: boolean;
  };
}

/**
 * Internal cache entry structure
 * @internal
 */
export interface QueryCacheEntry {
  /**
   * Cached query result
   */
  result: QueryResult;

  /**
   * Timestamp when entry was cached (milliseconds since epoch)
   * Used for TTL-based cache eviction
   */
  timestamp: number;
}

/**
 * Base error class for query-related errors
 */
export class QueryError extends Error {
  /**
   * The SQL query that caused the error
   */
  public readonly sql: string;

  /**
   * Original error that caused this error (if any)
   */
  public readonly cause?: Error;

  constructor(message: string, sql: string, cause?: Error) {
    super(message);
    this.name = "QueryError";
    this.sql = sql;
    this.cause = cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, QueryError);
    }
  }
}

/**
 * Error thrown when query execution fails
 */
export class QueryExecutionError extends QueryError {
  constructor(message: string, sql: string, cause?: Error) {
    super(message, sql, cause);
    this.name = "QueryExecutionError";
  }
}

/**
 * Error thrown when dataset registration fails
 */
export class RegistrationError extends Error {
  /**
   * The table name that failed to register
   */
  public readonly tableName: string;

  /**
   * Original error that caused this error (if any)
   */
  public readonly cause?: Error;

  constructor(message: string, tableName: string, cause?: Error) {
    super(message);
    this.name = "RegistrationError";
    this.tableName = tableName;
    this.cause = cause;

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RegistrationError);
    }
  }
}
