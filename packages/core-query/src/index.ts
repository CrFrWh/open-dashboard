// Main exports
export { QueryEngine } from "./engine/QueryEngine";

// Type exports
export type {
  QueryEngineConfig,
  QueryResult,
  QueryOptions,
  RegistrationOptions,
  QueryCacheEntry,
} from "./types/query";
export { QueryError, RegistrationError } from "./types/query";

// Export query utilities (for advanced users)
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
} from "./utils/queryHelpers";

// Export error utilities (for error handling)
export {
  parseDuckDBError,
  formatErrorMessage,
  isRecoverableError,
  validateSQL,
  ErrorSeverity,
  type ErrorContext,
} from "./utils/errorHandling";
