import type { DatasetSchema, DataField } from "@open-dashboard/shared/types";

/**
 * Normalizes a schema for Arrow conversion
 * - Removes duplicate field names (keeps first occurrence)
 * - Validates field names (no empty strings)
 * - Ensures all fields have valid types
 * - Sanitizes field names (replaces invalid characters)
 *
 * @param schema - The schema to normalize
 * @returns Normalized schema
 * @throws {Error} If schema is invalid
 */
export function normalizeSchema(schema: DatasetSchema): DatasetSchema {
  if (!schema.fields || schema.fields.length === 0) {
    throw new Error("Schema must have at least one field");
  }

  const seenNames = new Set<string>();
  const normalizedFields: DataField[] = [];

  for (const field of schema.fields) {
    // Validate field name
    if (!field.name || field.name.trim() === "") {
      throw new Error("Field name cannot be empty");
    }

    // Sanitize field name (Arrow is strict about field names)
    const sanitizedName = sanitizeFieldName(field.name);

    // Check for duplicates
    if (seenNames.has(sanitizedName)) {
      console.warn(
        `Duplicate field name detected: "${sanitizedName}". Skipping duplicate.`
      );
      continue;
    }

    seenNames.add(sanitizedName);

    // Ensure type is valid
    if (
      !["string", "number", "date", "boolean", "categorical"].includes(
        field.type
      )
    ) {
      throw new Error(
        `Invalid field type: ${field.type} for field ${field.name}`
      );
    }

    normalizedFields.push({
      ...field,
      name: sanitizedName,
      nullable: field.nullable ?? true,
    });
  }

  return { fields: normalizedFields };
}

/**
 * Sanitizes field name for Arrow compatibility
 * - Replaces spaces with underscores
 * - Removes special characters except underscore
 * - Ensures name starts with letter or underscore
 *
 * @param name - Field name to sanitize
 * @returns Sanitized field name
 */
export function sanitizeFieldName(name: string): string {
  // Trim first to handle leading/trailing whitespace
  let sanitized = name
    .trim()
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9_]/g, ""); // Remove special chars

  // Ensure starts with letter or underscore
  if (sanitized && !/^[a-zA-Z_]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  return sanitized || "unnamed_field";
}

/**
 * Validates if a schema can be converted to Arrow
 *
 * @param schema - Schema to validate
 * @returns Validation result with errors and warnings
 */
export function validateForArrowConversion(schema: DatasetSchema): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!schema.fields || schema.fields.length === 0) {
    errors.push("Schema has no fields");
    return { valid: false, errors, warnings };
  }

  const seenNames = new Set<string>();

  for (const field of schema.fields) {
    if (!field.name || field.name.trim() === "") {
      errors.push("Field has empty name");
    }

    if (seenNames.has(field.name)) {
      warnings.push(`Duplicate field name: ${field.name}`);
    }
    seenNames.add(field.name);

    if (
      !["string", "number", "date", "boolean", "categorical"].includes(
        field.type
      )
    ) {
      errors.push(`Invalid type '${field.type}' for field '${field.name}'`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
