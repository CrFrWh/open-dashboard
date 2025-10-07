// packages/core-query/src/engine/QueryEngine.ts
import * as duckdb from "@duckdb/duckdb-wasm";
import * as arrow from "apache-arrow";

import { datasetToArrow } from "@open-dashboard/core-schema";
import type { ParsedDataset } from "@open-dashboard/shared/types";
import type {
  QueryResult,
  QueryOptions,
  QueryEngineConfig,
  QueryCacheEntry,
  RegistrationOptions,
} from "../types/query";
import { QueryExecutionError, RegistrationError } from "../types/query";

/**
 * Resolved configuration with defaults applied
 */
type ResolvedQueryEngineConfig = Required<
  Omit<QueryEngineConfig, "wasmUrl">
> & {
  wasmUrl?: string;
};

/**
 * DuckDB-powered SQL query engine for datasets
 *
 * Features:
 * - Execute SQL queries on ParsedDatasets
 * - Register Arrow Tables for zero-copy querying
 * - Query result caching with TTL
 * - Aggregations, joins, filters
 * - Advanced query optimization
 *
 * @example
 * ```typescript
 * // Create engine with custom config
 * const engine = await QueryEngine.create({
 *   enableCache: true,
 *   cacheTimeout: 10 * 60 * 1000, // 10 minutes
 *   maxCacheSize: 200,
 *   logQueries: true,
 * });
 *
 * // Register dataset
 * await engine.registerDataset(salesDataset);
 *
 * // Execute query
 * const result = await engine.query(`
 *   SELECT region, SUM(amount) as total
 *   FROM sales
 *   GROUP BY region
 * `);
 * ```
 */
export class QueryEngine {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private config: ResolvedQueryEngineConfig;
  private registeredTables: Set<string> = new Set();
  private queryCache: Map<string, QueryCacheEntry> = new Map();
  private initialized = false;

  /**
   * Private constructor - use QueryEngine.create() instead
   *
   * @param config - Engine configuration options
   */
  private constructor(config: QueryEngineConfig = {}) {
    // Set defaults for all config options
    this.config = {
      wasmUrl: config.wasmUrl,
      enableCache: config.enableCache ?? true,
      cacheTimeout: config.cacheTimeout ?? 5 * 60 * 1000, // 5 minutes
      maxCacheSize: config.maxCacheSize ?? 100,
      logQueries: config.logQueries ?? false,
    };
  }

  /**
   * Create and initialize a new QueryEngine instance
   *
   * @param config - Engine configuration options
   * @returns Initialized QueryEngine instance
   *
   * @example
   * ```typescript
   * // Default configuration
   * const engine = await QueryEngine.create();
   *
   * // Custom configuration
   * const engine = await QueryEngine.create({
   *   enableCache: true,
   *   cacheTimeout: 10 * 60 * 1000, // 10 minutes
   *   maxCacheSize: 200,
   *   logQueries: true,
   *   wasmUrl: 'https://cdn.example.com/duckdb.wasm',
   * });
   * ```
   */
  static async create(config?: QueryEngineConfig): Promise<QueryEngine> {
    const engine = new QueryEngine(config);
    await engine.initialize();
    return engine;
  }

  /**
   * Initialize DuckDB-WASM instance
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      if (this.config.logQueries) {
        console.log("🔧 Initializing DuckDB-WASM...");
      }

      // Select DuckDB bundle
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

      // Override bundle URLs if custom wasmUrl provided
      if (this.config.wasmUrl) {
        bundle.mainModule = this.config.wasmUrl;
        bundle.mainWorker = this.config.wasmUrl.replace(".wasm", "-worker.js");
      }

      // Initialize DuckDB worker
      const worker = new Worker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();

      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);

      // Create connection
      this.conn = await this.db.connect();
      this.initialized = true;

      if (this.config.logQueries) {
        console.log("✅ DuckDB initialized successfully");
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize DuckDB: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute SQL query
   *
   * @param sql - SQL query to execute
   * @param options - Query execution options
   * @returns Query result with data and metadata
   * @throws {QueryExecutionError} If query execution fails
   *
   * @example
   * ```typescript
   * const result = await engine.query("SELECT * FROM sales WHERE amount > 1000");
   * console.log(`Found ${result.rowCount} rows`);
   * ```
   */
  async query(sql: string, options?: QueryOptions): Promise<QueryResult> {
    if (!this.conn) {
      throw new Error("QueryEngine not initialized. Call create() first.");
    }

    try {
      // Check cache first
      if (this.config.enableCache && !options?.skipCache) {
        const cached = this.getCachedQuery(sql);
        if (cached) {
          if (this.config.logQueries) {
            console.log(`📦 Cache hit for query: ${sql.substring(0, 50)}...`);
          }
          return {
            ...cached,
            metadata: {
              ...cached.metadata,
              fromCache: true,
            },
          };
        }
      }

      // Log query if enabled
      if (this.config.logQueries) {
        console.log(`🔍 Executing query: ${sql}`);
      }

      const startTime = performance.now();

      // Execute query
      const arrowResult = await this.conn.query(sql);
      const table = arrowResult.toArray();

      const executionTime = performance.now() - startTime;

      // Extract column information from Arrow schema
      const columns = arrowResult.schema.fields.map((field) => ({
        name: field.name,
        type: field.type.toString(),
      }));

      // Convert Arrow result to QueryResult
      const result: QueryResult = {
        data: table.map((row) => row.toJSON()) as Record<string, unknown>[],
        rowCount: table.length,
        columnCount: columns.length,
        executionTime,
        sql,
        metadata: {
          columns,
          fromCache: false,
        },
      };

      // Cache the result
      this.cacheQuery(sql, result);

      if (this.config.logQueries) {
        console.log(
          `✅ Query completed in ${executionTime.toFixed(2)}ms - ${result.rowCount} rows, ${result.columnCount} columns`
        );
      }

      return result;
    } catch (error) {
      if (this.config.logQueries) {
        console.error(`❌ Query failed: ${sql}`, error);
      }

      throw new QueryExecutionError(
        `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
        sql,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute query and return raw Arrow Table for advanced use cases
   *
   * Converts DuckDB's Arrow Table to the project's standard Arrow format
   * using IPC serialization for cross-version compatibility.
   *
   * @param sql - SQL query to execute
   * @returns Arrow Table with query results
   * @throws {QueryExecutionError} If query execution fails
   *
   * @example
   * ```typescript
   * const table = await engine.queryArrow("SELECT * FROM sales");
   * console.log(`Table has ${table.numRows} rows`);
   * ```
   */
  async queryArrow(sql: string): Promise<arrow.Table> {
    if (!this.conn) {
      throw new Error("QueryEngine not initialized. Call create() first.");
    }

    try {
      if (this.config.logQueries) {
        console.log(`🔍 Executing Arrow query: ${sql}`);
      }

      // Execute query and get DuckDB's Arrow Table
      const duckdbTable = await this.conn.query(sql);

      // Convert to standard Apache Arrow Table using IPC format
      // This bridges the version gap between DuckDB's bundled Arrow
      // and our project's Apache Arrow version
      const writer = arrow.RecordBatchStreamWriter.writeAll(duckdbTable);
      const buffer = await writer.toUint8Array();
      const reader = arrow.RecordBatchStreamReader.from(buffer);
      const result = new arrow.Table(reader.readAll());

      if (this.config.logQueries) {
        console.log(
          `✅ Arrow query completed: ${result.numRows} rows, ${result.numCols} cols`
        );
      }

      return result;
    } catch (error) {
      if (this.config.logQueries) {
        console.error(`❌ Arrow query failed: ${sql}`, error);
      }

      throw new QueryExecutionError(
        `Arrow query execution failed: ${error instanceof Error ? error.message : String(error)}`,
        sql,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Register a ParsedDataset for querying
   *
   * Converts the dataset to Apache Arrow format and registers it with DuckDB.
   * The table can then be queried using standard SQL.
   *
   * @param dataset - The parsed dataset to register
   * @param options - Registration options (table name, replace behavior)
   * @throws {RegistrationError} If table exists and replace is false
   *
   * @example
   * ```typescript
   * // Auto-generated table name
   * await engine.registerDataset(salesDataset);
   * await engine.query("SELECT * FROM sales_dataset");
   *
   * // Custom table name
   * await engine.registerDataset(salesDataset, { tableName: "sales" });
   * await engine.query("SELECT * FROM sales");
   *
   * // Replace existing table
   * await engine.registerDataset(salesDataset, {
   *   tableName: "sales",
   *   replace: true,
   * });
   * ```
   */
  async registerDataset(
    dataset: ParsedDataset,
    options?: RegistrationOptions
  ): Promise<void> {
    if (!this.conn) {
      throw new Error("QueryEngine not initialized. Call create() first.");
    }

    const tableName =
      options?.tableName ?? this.sanitizeTableName(dataset.name);

    try {
      // Check if table exists
      if (this.registeredTables.has(tableName)) {
        if (!options?.replace) {
          throw new RegistrationError(
            `Table '${tableName}' already exists. Use replace: true to overwrite.`,
            tableName
          );
        }
        await this.unregisterTable(tableName);
      }

      // Convert dataset to Arrow Table (uses apache-arrow@18.0.0)
      const { table, warnings } = datasetToArrow(dataset);

      if (warnings.length > 0 && this.config.logQueries) {
        console.warn(
          `Warnings during Arrow conversion for '${tableName}':`,
          warnings
        );
      }

      // Register Arrow Table with DuckDB
      // Type assertion is necessary due to Apache Arrow version mismatch:
      // - Our package uses apache-arrow@18.0.0
      // - DuckDB-WASM bundles its own version internally
      // The Arrow IPC format is stable and compatible across versions.
      // The in-memory structures are identical; only TypeScript types differ.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.conn.insertArrowTable(table as any, {
        name: tableName,
      });
      this.registeredTables.add(tableName);

      // Clear cache when new table is registered
      this.clearCache();

      if (this.config.logQueries) {
        console.log(
          `✅ Registered table '${tableName}' (${table.numRows} rows, ${table.numCols} cols)`
        );
      }
    } catch (error) {
      // If it's already a RegistrationError, re-throw it
      if (error instanceof RegistrationError) {
        throw error;
      }

      // Wrap other errors
      throw new RegistrationError(
        `Failed to register dataset '${dataset.name}': ${error instanceof Error ? error.message : String(error)}`,
        tableName,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Unregister a table
   */
  async unregisterTable(tableName: string): Promise<void> {
    if (!this.conn) {
      throw new Error("QueryEngine not initialized. Call create() first.");
    }

    try {
      await this.conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
      this.registeredTables.delete(tableName);

      // Clear cache when table is modified
      this.clearCache();

      if (this.config.logQueries) {
        console.log(`🗑️  Unregistered table '${tableName}'`);
      }
    } catch (error) {
      throw new RegistrationError(
        `Failed to unregister table '${tableName}': ${error instanceof Error ? error.message : String(error)}`,
        tableName,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get list of registered tables
   */
  getRegisteredTables(): string[] {
    return Array.from(this.registeredTables);
  }

  /**
   * Check if a table is registered
   */
  isTableRegistered(tableName: string): boolean {
    return this.registeredTables.has(tableName);
  }

  /**
   * Clear query result cache
   */
  clearCache(): void {
    this.queryCache.clear();

    if (this.config.logQueries) {
      console.log("🗑️  Query cache cleared");
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    enabled: boolean;
  } {
    return {
      size: this.queryCache.size,
      maxSize: this.config.maxCacheSize,
      enabled: this.config.enableCache,
    };
  }

  /**
   * Sanitize table name for SQL safety
   *
   * Converts dataset names to valid SQL identifiers by:
   * - Converting to lowercase
   * - Replacing spaces and special characters with underscores
   * - Removing consecutive underscores
   * - Ensuring name starts with a letter or underscore
   * - Limiting length to 63 characters (PostgreSQL limit)
   *
   * @param name - The table name to sanitize
   * @returns Sanitized table name safe for SQL use
   *
   * @example
   * ```typescript
   * sanitizeTableName("My Sales Data 2024!") // "my_sales_data_2024"
   * sanitizeTableName("123_invalid") // "_123_invalid"
   * ```
   */
  private sanitizeTableName(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        // Replace spaces and special characters with underscores
        .replace(/[^a-z0-9_]/g, "_")
        // Remove consecutive underscores
        .replace(/_+/g, "_")
        // Remove leading/trailing underscores
        .replace(/^_+|_+$/g, "")
        // Ensure starts with letter or underscore (prepend if starts with number)
        .replace(/^(\d)/, "_$1")
        // Limit length to 63 characters (PostgreSQL identifier limit)
        .slice(0, 63) ||
      // Fallback if somehow empty
      `table_${Date.now()}`
    );
  }

  /**
   * Cache query result
   *
   * @param sql - SQL query string (used as cache key)
   * @param result - Query result to cache
   */
  private cacheQuery(sql: string, result: QueryResult): void {
    if (!this.config.enableCache) {
      return;
    }

    // Generate cache key from SQL
    const cacheKey = this.generateCacheKey(sql);

    // Store in cache with timestamp
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    // Evict old entries if cache is too large
    if (this.queryCache.size > this.config.maxCacheSize) {
      this.evictOldestCacheEntry();
    }
  }

  /**
   * Get cached query result
   *
   * @param sql - SQL query string
   * @returns Cached query result or null if not found/expired
   */
  private getCachedQuery(sql: string): QueryResult | null {
    if (!this.config.enableCache) {
      return null;
    }

    const cacheKey = this.generateCacheKey(sql);
    const cached = this.queryCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTimeout) {
      this.queryCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Generate cache key from SQL query
   *
   * Normalizes SQL for consistent caching by:
   * - Trimming whitespace
   * - Replacing multiple spaces with single space
   * - Converting to lowercase
   *
   * @param sql - SQL query string
   * @returns Normalized cache key
   */
  private generateCacheKey(sql: string): string {
    return sql.trim().replace(/\s+/g, " ").toLowerCase();
  }

  /**
   * Evict oldest cache entry when cache is full
   */
  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, value] of this.queryCache.entries()) {
      if (value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.queryCache.delete(oldestKey);

      if (this.config.logQueries) {
        console.log(
          `🗑️  Evicted cache entry: ${oldestKey.substring(0, 50)}...`
        );
      }
    }
  }

  /**
   * Dispose of resources and close connections
   */
  async dispose(): Promise<void> {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }

    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }

    this.registeredTables.clear();
    this.queryCache.clear();
    this.initialized = false;

    if (this.config.logQueries) {
      console.log("🔌 QueryEngine disposed");
    }
  }
}
