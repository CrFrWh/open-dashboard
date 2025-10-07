/**
 * Query utilities for SQL building and error handling
 */

// Export query building helpers
export {
  buildJoinQuery,
  buildAggregateQuery,
  buildParameterizedQuery,
  buildTableInfoQuery,
  buildCountQuery,
  buildSampleQuery,
  sanitizeIdentifier,
  escapeString,
  extractTableNames,
  type JoinOptions,
  type AggregateOptions,
} from "./queryHelpers";

// Export error handling utilities
export {
  parseDuckDBError,
  formatErrorMessage,
  isRecoverableError,
  withErrorHandling,
  validateSQL,
  createErrorContext,
  ErrorSeverity,
  type ErrorContext,
} from "./errorHandling";
