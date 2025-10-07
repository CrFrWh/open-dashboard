import * as arrow from "apache-arrow";
import type {
  DatasetSchema,
  DataField,
  ParsedDataset,
} from "@open-dashboard/shared/types";
import type { ArrowConversionOptions } from "../types/converters";
import { normalizeSchema } from "../utils/schemaNormaliser";
import {
  createArrowField,
  extractDataFieldFromArrowField,
} from "../utils/typeMapper";

/**
 * Converts DatasetSchema to Apache Arrow Schema
 *
 * @param schema - The schema to convert
 * @param options - Conversion options
 * @returns Apache Arrow Schema
 */
export function schemaToArrowSchema(
  schema: DatasetSchema,
  options?: ArrowConversionOptions
): arrow.Schema {
  // Normalize schema first
  const normalized = normalizeSchema(schema);

  // Convert each field to Arrow Field
  const arrowFields = normalized.fields.map((field) =>
    createArrowField(field, { dateFormat: options?.dateFormat })
  );

  // Create Arrow Schema
  return new arrow.Schema(arrowFields);
}

/**
 * Extracts DatasetSchema from Apache Arrow Table
 *
 * @param table - Arrow Table to extract schema from
 * @returns DatasetSchema
 */
export function arrowTableSchemaToDatasetSchema(
  table: arrow.Table
): DatasetSchema {
  const fields = table.schema.fields.map((arrowField) =>
    extractDataFieldFromArrowField(arrowField)
  );

  return { fields };
}

/**
 * Validates dataset for Arrow conversion
 *
 * @param dataset - Dataset to validate
 * @returns Validation result with errors and missing field warnings
 */
function validateDatasetForConversion(dataset: ParsedDataset): {
  valid: boolean;
  errors: string[];
  missingFields: string[];
} {
  const errors: string[] = [];
  const missingFields: string[] = [];

  // Check schema exists
  if (!dataset.schema || !dataset.schema.fields) {
    errors.push("Dataset schema is missing or invalid");
    return { valid: false, errors, missingFields };
  }

  // Check schema has fields
  if (dataset.schema.fields.length === 0) {
    errors.push("Dataset schema has no fields");
  }

  // Check data array exists
  if (!Array.isArray(dataset.data)) {
    errors.push("Dataset data must be an array");
    return { valid: false, errors, missingFields };
  }

  // Check field names match data keys (if data exists)
  if (dataset.data.length > 0) {
    const firstRow = dataset.data[0];
    const dataKeys = new Set(Object.keys(firstRow));
    const schemaFields = new Set(dataset.schema.fields.map((f) => f.name));

    // Track missing fields in data
    for (const fieldName of schemaFields) {
      if (!dataKeys.has(fieldName)) {
        missingFields.push(fieldName);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    missingFields,
  };
}

/**
 * Coerces a value to the target type
 *
 * @param value - Value to coerce
 * @param targetType - Target data type
 * @returns Coerced value or null if coercion fails
 */
function coerceValue(value: unknown, targetType: DataField["type"]): unknown {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  switch (targetType) {
    case "string":
      return String(value);

    case "number": {
      // Already a number
      if (typeof value === "number") {
        return isNaN(value) || !isFinite(value) ? null : value;
      }

      // Try to parse string
      if (typeof value === "string") {
        const parsed = Number(value);
        return isNaN(parsed) || !isFinite(parsed) ? null : parsed;
      }

      // Boolean to number
      if (typeof value === "boolean") {
        return value ? 1 : 0;
      }

      return null;
    }

    case "boolean": {
      // Already boolean
      if (typeof value === "boolean") {
        return value;
      }

      // Number to boolean
      if (typeof value === "number") {
        return value !== 0;
      }

      // String to boolean
      if (typeof value === "string") {
        const lower = value.toLowerCase().trim();
        if (lower === "true" || lower === "1" || lower === "yes") return true;
        if (lower === "false" || lower === "0" || lower === "no") return false;
      }

      return null;
    }

    case "date": {
      // Already a Date
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value.getTime();
      }

      // Number (timestamp)
      if (typeof value === "number") {
        return isNaN(value) ? null : value;
      }

      // String (ISO date or timestamp)
      if (typeof value === "string") {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.getTime();
      }

      return null;
    }

    case "categorical":
      // Treat as string for now (proper Dictionary encoding is complex)
      return String(value);

    default:
      return null;
  }
}

/**
 * Builds an Arrow Vector for a single column
 *
 * @param data - Dataset rows
 * @param field - Field definition
 * @returns Arrow Vector
 */
function buildColumnVector(
  data: Record<string, unknown>[],
  field: DataField
): arrow.Vector {
  const columnData: unknown[] = [];

  // Extract and coerce column values
  for (const row of data) {
    const rawValue = row[field.name];
    const coercedValue = coerceValue(rawValue, field.type);
    columnData.push(coercedValue);
  }

  // Create the appropriate vector based on type
  switch (field.type) {
    case "string": {
      return arrow.vectorFromArray(
        columnData as (string | null)[],
        new arrow.Utf8()
      );
    }

    case "number": {
      return arrow.vectorFromArray(
        columnData as (number | null)[],
        new arrow.Float64()
      );
    }

    case "boolean": {
      return arrow.vectorFromArray(
        columnData as (boolean | null)[],
        new arrow.Bool()
      );
    }

    case "date": {
      // Use DateMillisecond as default
      return arrow.vectorFromArray(
        columnData as (number | null)[],
        new arrow.DateMillisecond()
      );
    }

    case "categorical": {
      // TODO: Implement proper Dictionary encoding
      // For now, use Utf8 (still queryable, just not as space-efficient)
      return arrow.vectorFromArray(
        columnData as (string | null)[],
        new arrow.Utf8()
      );
    }

    default:
      // Fallback to Utf8
      return arrow.vectorFromArray(
        columnData.map((v) => (v === null ? null : String(v))),
        new arrow.Utf8()
      );
  }
}

/**
 * Converts ParsedDataset to Apache Arrow Table
 *
 * @param dataset - Dataset to convert
 * @param options - Conversion options
 * @returns Arrow Table and any conversion warnings
 */
export function datasetToArrow(
  dataset: ParsedDataset,
  options?: ArrowConversionOptions
): {
  table: arrow.Table;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Validate dataset
  const validation = validateDatasetForConversion(dataset);
  if (!validation.valid) {
    throw new Error(`Invalid dataset: ${validation.errors.join(", ")}`);
  }

  // Warn about missing fields
  if (validation.missingFields.length > 0) {
    warnings.push(
      `Fields missing from data (will be filled with nulls): ${validation.missingFields.join(", ")}`
    );
  }

  // Convert schema FIRST to preserve type information
  const arrowSchema = schemaToArrowSchema(dataset.schema, options);

  // Handle empty dataset
  if (dataset.data.length === 0) {
    warnings.push("Dataset is empty - creating table with schema only");

    // Create empty vectors using vectorFromArray
    const emptyVectors = arrowSchema.fields.map((field) => {
      return arrow.vectorFromArray([], field.type);
    });

    // Use makeData to create properly formatted Data object
    const data = arrow.makeData({
      type: new arrow.Struct(arrowSchema.fields),
      length: 0,
      nullCount: 0,
      children: emptyVectors.map((v) => v.data[0]),
    });

    const recordBatch = new arrow.RecordBatch(arrowSchema, data);
    const table = new arrow.Table([recordBatch]);

    return { table, warnings };
  }

  // Build vectors for each column
  const vectors: arrow.Vector[] = [];

  for (let i = 0; i < dataset.schema.fields.length; i++) {
    const field = dataset.schema.fields[i];

    try {
      const vector = buildColumnVector(dataset.data, field);
      vectors.push(vector);
    } catch (error) {
      warnings.push(
        `Failed to convert column "${field.name}": ${error instanceof Error ? error.message : String(error)}`
      );
      // Create null vector as fallback
      const nullVector = arrow.vectorFromArray(
        new Array(dataset.data.length).fill(null),
        new arrow.Utf8()
      );
      vectors.push(nullVector);
    }
  }

  // Create RecordBatch with schema and vectors using makeData
  const data = arrow.makeData({
    type: new arrow.Struct(arrowSchema.fields),
    length: dataset.data.length,
    nullCount: 0,
    children: vectors.map((v) => v.data[0]),
  });

  const recordBatch = new arrow.RecordBatch(arrowSchema, data);
  const table = new arrow.Table([recordBatch]);

  return { table, warnings };
}

/**
 * Converts Apache Arrow Table back to ParsedDataset
 *
 * @param table - Arrow Table to convert
 * @returns ParsedDataset
 */
export function arrowToDataset(table: arrow.Table): ParsedDataset {
  // Extract schema
  const schema = arrowTableSchemaToDatasetSchema(table);

  // Convert data
  const data: Record<string, unknown>[] = [];

  // Iterate through rows
  for (let rowIndex = 0; rowIndex < table.numRows; rowIndex++) {
    const row: Record<string, unknown> = {};

    // Extract each column value for this row
    for (let colIndex = 0; colIndex < table.numCols; colIndex++) {
      const column = table.getChildAt(colIndex);
      const fieldName = schema.fields[colIndex].name;
      const fieldType = schema.fields[colIndex].type;

      if (column) {
        const value = column.get(rowIndex);

        // Convert Arrow value to JavaScript primitive
        if (value === null || value === undefined) {
          row[fieldName] = null;
        } else if (fieldType === "date") {
          // Handle date/timestamp conversion - Arrow returns numbers or BigInts
          if (typeof value === "number") {
            row[fieldName] = new Date(value);
          } else if (typeof value === "bigint") {
            // Convert BigInt timestamp to Date (microsecond/nanosecond precision)
            row[fieldName] = new Date(Number(value / 1000n));
          } else if (value instanceof Date) {
            row[fieldName] = value;
          } else {
            // Fallback: try to parse as timestamp
            row[fieldName] = new Date(Number(value));
          }
        } else if (value instanceof Date) {
          row[fieldName] = value;
        } else if (typeof value === "bigint") {
          // Convert BigInt to Number (may lose precision for very large values)
          row[fieldName] = Number(value);
        } else {
          row[fieldName] = value;
        }
      } else {
        row[fieldName] = null;
      }
    }

    data.push(row);
  }

  // Return ParsedDataset with required fields
  return {
    id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: "arrow-dataset",
    // Converted from Arrow Table, using 'json' as sourceType for compatibility
    sourceType: "json",
    schema,
    data,
    createdAt: new Date(),
  };
}
