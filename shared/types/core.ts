// Core data structures
export interface ParsedDataset {
  id: string;
  name: string;
  data: Record<string, unknown>[];
  schema: DatasetSchema;
  metadata?: Record<string, unknown>;
  sourceType: "csv" | "json" | "api" | "pdf" | "text";
  createdAt: Date;
}

export interface DatasetSchema {
  fields: DataField[];
}

export interface DataField {
  name: string;
  type: "string" | "number" | "date" | "boolean" | "categorical";
  nullable?: boolean;
  metadata?: Record<string, unknown>;
}

// Adapter interfaces
export interface DataAdapter {
  parse(input: string | File | URL): Promise<ParsedDataset>;
  validate(input: unknown): boolean;
  getSupportedTypes(): string[];
}

// Query interfaces
export interface QueryEngine {
  execute(query: string, datasets: ParsedDataset[]): Promise<QueryResult>;
  validateQuery(query: string): boolean;
  getSupportedOperations(): string[];
}

export interface QueryResult {
  data: Record<string, unknown>[];
  schema: DatasetSchema;
  metadata?: {
    rowCount: number;
    executionTime: number;
    query: string;
  };
}

// Widget interfaces
export interface Widget {
  id: string;
  type: "table" | "chart" | "metric" | "text";
  config: WidgetConfig;
  query?: string;
  datasetId?: string;
  position?: WidgetPosition;
}

export interface WidgetConfig {
  title?: string;
  [key: string]: unknown;
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Dashboard interfaces
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  layout: LayoutConfig;
  datasets: string[]; // References to dataset IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface LayoutConfig {
  type: "grid" | "flex" | "absolute";
  columns?: number;
  gap?: number;
  [key: string]: unknown;
}

// Chart specific types
export interface ChartConfig extends WidgetConfig {
  chartType: "bar" | "line" | "pie" | "scatter" | "area";
  xField?: string;
  yField?: string;
  colorField?: string;
  aggregation?: "sum" | "avg" | "count" | "min" | "max";
}

// Table specific types
export interface TableConfig extends WidgetConfig {
  columns?: string[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  pageSize?: number;
}

// Metric specific types
export interface MetricConfig extends WidgetConfig {
  field: string;
  aggregation: "sum" | "avg" | "count" | "min" | "max";
  format?: "number" | "currency" | "percentage";
  precision?: number;
}
