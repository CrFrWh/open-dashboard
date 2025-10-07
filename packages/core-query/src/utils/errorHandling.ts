/**
 * Error handling utilities for QueryEngine
 *
 * Provides enhanced error classes, error parsing, and user-friendly messages
 * for better debugging and UX.
 */

import { QueryExecutionError, RegistrationError } from "../types/query";

/**
 * Error severity levels for logging and UI feedback
 */
export enum ErrorSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

/**
 * Enhanced error context for better debugging
 */
export interface ErrorContext {
  operation: string;
  tableName?: string;
  sql?: string;
  datasetName?: string;
  timestamp: number;
  severity: ErrorSeverity;
  recoverable: boolean;
  suggestion?: string;
}

/**
 * Parse DuckDB error messages into structured format
 *
 * DuckDB errors can be cryptic - this extracts useful information
 *
 * @param error - Raw error from DuckDB
 * @returns Structured error information
 */
export function parseDuckDBError(error: unknown): {
  type: string;
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
} {
  const errorString = error instanceof Error ? error.message : String(error);

  // Parse common DuckDB error patterns
  const patterns = {
    // Syntax errors: "syntax error at or near ..."
    syntax: /syntax error at or near "(.+?)"/i,
    // Column not found: "column "X" does not exist"
    columnNotFound: /column "(.+?)" does not exist/i,
    // Table not found: "table "X" does not exist"
    tableNotFound: /table "(.+?)" does not exist/i,
    // Type mismatch: "cannot cast ... to ..."
    typeMismatch: /cannot cast (.+?) to (.+)/i,
    // Duplicate column: "duplicate column name"
    duplicateColumn: /duplicate column name "(.+?)"/i,
    // Line/column info: "LINE X:Y"
    position: /LINE (\d+):(\d+)/i,
  };

  let type = "unknown";
  let suggestion: string | undefined;

  if (patterns.syntax.test(errorString)) {
    type = "syntax";
    suggestion =
      "Check your SQL syntax. Use SQL keywords like SELECT, FROM, WHERE correctly.";
  } else if (patterns.columnNotFound.test(errorString)) {
    type = "column_not_found";
    const match = errorString.match(patterns.columnNotFound);
    suggestion = `Column "${match?.[1]}" doesn't exist. Use getTableInfo() to see available columns.`;
  } else if (patterns.tableNotFound.test(errorString)) {
    type = "table_not_found";
    const match = errorString.match(patterns.tableNotFound);
    suggestion = `Table "${match?.[1]}" is not registered. Use registerDataset() first.`;
  } else if (patterns.typeMismatch.test(errorString)) {
    type = "type_mismatch";
    suggestion =
      "Check that operations match column types (e.g., don't SUM a text column).";
  } else if (patterns.duplicateColumn.test(errorString)) {
    type = "duplicate_column";
    suggestion = "Use aliases (AS) to rename duplicate columns in your query.";
  }

  // Extract line/column if present
  const posMatch = errorString.match(patterns.position);
  const line = posMatch ? parseInt(posMatch[1], 10) : undefined;
  const column = posMatch ? parseInt(posMatch[2], 10) : undefined;

  return {
    type,
    message: errorString,
    line,
    column,
    suggestion,
  };
}

/**
 * Create user-friendly error message from technical error
 *
 * @param error - Error object
 * @param context - Additional context about the operation
 * @returns User-friendly error message
 */
export function formatErrorMessage(
  error: unknown,
  context?: Partial<ErrorContext>
): string {
  const parsed = parseDuckDBError(error);

  let message = `❌ ${context?.operation || "Operation"} failed`;

  if (context?.tableName) {
    message += ` for table '${context.tableName}'`;
  }

  message += `:\n${parsed.message}`;

  if (parsed.suggestion) {
    message += `\n\n💡 Suggestion: ${parsed.suggestion}`;
  }

  if (context?.sql) {
    message += `\n\n📝 Query:\n${context.sql}`;
  }

  return message;
}

/**
 * Determine if an error is recoverable
 *
 * @param error - Error to check
 * @returns True if the error might be recoverable with retry or user action
 */
export function isRecoverableError(error: unknown): boolean {
  const errorString = error instanceof Error ? error.message : String(error);

  // Non-recoverable: syntax errors, type mismatches, schema issues
  const nonRecoverable = [
    /syntax error/i,
    /type mismatch/i,
    /cannot cast/i,
    /duplicate column/i,
  ];

  // Recoverable: network issues, timeouts, locks
  const recoverable = [
    /timeout/i,
    /network/i,
    /connection/i,
    /locked/i,
    /busy/i,
  ];

  if (nonRecoverable.some((pattern) => pattern.test(errorString))) {
    return false;
  }

  if (recoverable.some((pattern) => pattern.test(errorString))) {
    return true;
  }

  // Default: assume non-recoverable for safety
  return false;
}

/**
 * Wrap operation with error handling and context
 *
 * @param operation - Function to execute
 * @param context - Error context
 * @returns Result of operation
 * @throws Enhanced error with context
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = formatErrorMessage(error, context);

    if (context.sql) {
      throw new QueryExecutionError(
        message,
        context.sql,
        error instanceof Error ? error : undefined
      );
    }

    if (context.tableName) {
      throw new RegistrationError(
        message,
        context.tableName,
        error instanceof Error ? error : undefined
      );
    }

    // Generic error
    throw new Error(message);
  }
}

/**
 * Validate SQL query for common issues
 *
 * @param sql - SQL query to validate
 * @returns Validation result with warnings
 */
export function validateSQL(sql: string): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  const normalized = sql.trim().toUpperCase();

  // Check for empty query
  if (!sql.trim()) {
    errors.push("Query cannot be empty");
    return { valid: false, warnings, errors };
  }

  // Check for dangerous operations
  if (normalized.includes("DROP TABLE") || normalized.includes("DELETE FROM")) {
    warnings.push(
      "Query contains potentially destructive operations (DROP/DELETE)"
    );
  }

  // Check for SELECT *
  if (normalized.includes("SELECT *")) {
    warnings.push(
      "SELECT * may be inefficient for large tables. Consider selecting specific columns."
    );
  }

  // Check for missing LIMIT on large operations
  if (
    !normalized.includes("LIMIT") &&
    !normalized.includes("WHERE") &&
    !normalized.includes("GROUP BY")
  ) {
    warnings.push(
      "Query has no LIMIT clause. Consider adding LIMIT for large datasets."
    );
  }

  // Check for SQL injection patterns (basic check)
  const injectionPatterns = [
    /;\s*(DROP|DELETE|UPDATE|INSERT)/i,
    /--/,
    /\/\*/,
    /\*\//,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(sql)) {
      errors.push(
        "Query contains suspicious patterns. Use parameterized queries instead."
      );
      break;
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Create error context for logging
 *
 * @param operation - Operation name
 * @param additionalContext - Additional context fields
 * @returns Error context object
 */
export function createErrorContext(
  operation: string,
  additionalContext?: Partial<ErrorContext>
): ErrorContext {
  return {
    operation,
    timestamp: Date.now(),
    severity: ErrorSeverity.ERROR,
    recoverable: false,
    ...additionalContext,
  };
}
