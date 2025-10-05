import type {
  ParsedDataset,
  DataAdapter,
  ParserOptions,
} from "@open-dashboard/shared/types";

// Re-export ParserOptions for convenience
export type { ParserOptions } from "@open-dashboard/shared/types";

// Extended parser-specific interfaces
export interface ParseResult {
  success: boolean;
  data?: ParsedDataset;
  error?: string;
  warnings?: string[];
  metadata?: {
    parseTime: number;
    rowsParsed: number;
    columnsDetected: number;
    encoding?: string;
    fileSize?: number;
  };
}

export interface TypeInferenceResult {
  type: "string" | "number" | "date" | "boolean" | "categorical";
  confidence: number;
  samples: unknown[];
  nullable: boolean;
  metadata?: {
    fieldName?: string;
    sampleCount?: number;
    uniqueValueCount?: number;
    warnings?: string[];
  };
}

// Adapter registry for dynamic loading
export interface AdapterRegistry {
  register(name: string, adapter: DataAdapter): void;
  get(name: string): DataAdapter | undefined;
  getByFileExtension(extension: string): DataAdapter | undefined;
  getByMimeType(mimeType: string): DataAdapter | undefined;
  list(): string[];
}

// Parsing context for complex operations
export interface ParseContext {
  source: "file" | "url" | "string" | "stream";
  originalName?: string;
  mimeType?: string;
  size?: number;
  options: ParserOptions;
}

// Progress callback for large file parsing
export type ParseProgressCallback = (progress: {
  percentage: number;
  rowsParsed: number;
  currentRow?: Record<string, unknown>;
}) => void;
