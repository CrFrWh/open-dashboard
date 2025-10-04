import type { DatasetSchema, DataField } from "@open-dashboard/shared/types";
import type { TypeInferenceResult } from "../types/parser";
import { inferFieldType } from "./typeInference";

/**
 * Builds a schema from raw data by inferring types for each field
 */
export function buildSchemaFromData(
  data: Record<string, unknown>[],
  fieldNames: string[],
  sampleSize = 100
): DatasetSchema {
  if (data.length === 0 || fieldNames.length === 0) {
    return { fields: [] };
  }

  const fields: DataField[] = fieldNames.map((fieldName) => {
    // Extract sample values for this field
    const samples = data.map((row) => row[fieldName]);

    // Infer type from samples
    const inference: TypeInferenceResult = inferFieldType(
      fieldName,
      samples,
      sampleSize
    );

    return {
      name: fieldName,
      type: inference.type,
      nullable: inference.nullable,
      metadata: {
        confidence: inference.confidence,
        sampleSize: Math.min(samples.length, sampleSize),
      },
    };
  });

  return { fields };
}

/**
 * Validates that a schema is well-formed
 */
export function validateSchema(schema: DatasetSchema): boolean {
  if (!schema.fields || schema.fields.length === 0) {
    return false;
  }

  return schema.fields.every(
    (field) =>
      field.name &&
      field.name.trim() !== "" &&
      ["string", "number", "date", "boolean", "categorical"].includes(
        field.type
      )
  );
}

/**
 * Merges two schemas (useful for combining multiple datasets)
 */
export function mergeSchemas(
  schema1: DatasetSchema,
  schema2: DatasetSchema
): DatasetSchema {
  const fieldMap = new Map<string, DataField>();

  // Add all fields from schema1
  schema1.fields.forEach((field) => {
    fieldMap.set(field.name, field);
  });

  // Add/merge fields from schema2
  schema2.fields.forEach((field) => {
    const existing = fieldMap.get(field.name);
    if (existing) {
      // If types differ, default to string
      if (existing.type !== field.type) {
        fieldMap.set(field.name, {
          ...existing,
          type: "string",
          nullable: existing.nullable || field.nullable,
        });
      }
    } else {
      fieldMap.set(field.name, field);
    }
  });

  return { fields: Array.from(fieldMap.values()) };
}
