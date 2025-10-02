import { z } from "zod";

// Data Field Schema
export const DataFieldSchema = z.object({
  name: z.string().min(1, "Field name cannot be empty"),
  type: z.enum(["string", "number", "date", "boolean", "categorical"]),
  nullable: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Dataset Schema
export const DatasetSchemaSchema = z.object({
  fields: z
    .array(DataFieldSchema)
    .min(1, "Schema must have at least one field"),
});

// Parsed Dataset Schema
export const ParsedDatasetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Dataset name is required"),
  data: z.array(z.record(z.string(), z.unknown())),
  schema: DatasetSchemaSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  sourceType: z.enum(["csv", "json", "api", "pdf", "text"]),
  createdAt: z.date(),
});

// Widget Position Schema
export const WidgetPositionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(1),
  height: z.number().min(1),
});

// Widget Config Schema
export const WidgetConfigSchema = z
  .object({
    title: z.string().optional(),
  })
  .passthrough(); // Allow additional properties

// Widget Schema
export const WidgetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["table", "chart", "metric", "text"]),
  config: WidgetConfigSchema,
  query: z.string().optional(),
  datasetId: z.string().optional(),
  position: WidgetPositionSchema.optional(),
});

// Chart Config Schema
export const ChartConfigSchema = WidgetConfigSchema.extend({
  chartType: z.enum(["bar", "line", "pie", "scatter", "area"]),
  xField: z.string().optional(),
  yField: z.string().optional(),
  colorField: z.string().optional(),
  aggregation: z.enum(["sum", "avg", "count", "min", "max"]).optional(),
});

// Table Config Schema
export const TableConfigSchema = WidgetConfigSchema.extend({
  columns: z.array(z.string()).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  pageSize: z.number().min(1).max(1000).optional(),
});

// Metric Config Schema
export const MetricConfigSchema = WidgetConfigSchema.extend({
  field: z.string().min(1, "Field is required"),
  aggregation: z.enum(["sum", "avg", "count", "min", "max"]),
  format: z.enum(["number", "currency", "percentage"]).optional(),
  precision: z.number().min(0).max(10).optional(),
});

// Layout Config Schema
export const LayoutConfigSchema = z
  .object({
    type: z.enum(["grid", "flex", "absolute"]),
    columns: z.number().min(1).max(12).optional(),
    gap: z.number().min(0).optional(),
  })
  .loose();

// Dashboard Schema
export const DashboardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Dashboard name is required"),
  description: z.string().optional(),
  widgets: z.array(WidgetSchema),
  layout: LayoutConfigSchema,
  datasets: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Query Result Schema
export const QueryResultSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  schema: DatasetSchemaSchema,
  metadata: z
    .object({
      rowCount: z.number().min(0),
      executionTime: z.number().min(0),
      query: z.string(),
    })
    .optional(),
});

// Type inference from schemas
export type DataField = z.infer<typeof DataFieldSchema>;
export type DatasetSchema = z.infer<typeof DatasetSchemaSchema>;
export type ParsedDataset = z.infer<typeof ParsedDatasetSchema>;
export type Widget = z.infer<typeof WidgetSchema>;
export type ChartConfig = z.infer<typeof ChartConfigSchema>;
export type TableConfig = z.infer<typeof TableConfigSchema>;
export type MetricConfig = z.infer<typeof MetricConfigSchema>;
export type Dashboard = z.infer<typeof DashboardSchema>;
export type QueryResult = z.infer<typeof QueryResultSchema>;
