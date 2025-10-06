import type { Schema } from "apache-arrow";

export interface ArrowConversionOptions {
  preserveMetadata?: boolean;
  nullableByDefault?: boolean;
  dateFormat?: "millisecond" | "microsecond" | "nanosecond";
}

export interface ParquetOptions {
  compression?: "uncompressed" | "snappy" | "gzip" | "zstd" | "lz4";
  version?: "1.0" | "2.0";
  pageSize?: number;
  rowGroupSize?: number;
}

export interface SchemaConversionResult {
  schema: Schema;
  warnings: string[];
  metadata: Record<string, string>;
}

export interface ArrowConversionError extends Error {
  field?: string;
  value?: unknown;
  originalType?: string;
}
