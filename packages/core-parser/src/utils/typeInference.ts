import type { TypeInferenceResult } from "../types/parser";

/**
 * Checks if a string represents a valid date
 */
export function isValidDate(value: string): boolean {
  if (!value || typeof value !== "string") return false;

  const date = new Date(value);
  return (
    !isNaN(date.getTime()) &&
    value.match(/\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}$/) !== null
  );
}

/**
 * Infers the data type of a single value
 */
export function inferType(
  value: unknown
): "string" | "number" | "date" | "boolean" | "categorical" {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === "") {
    return "string";
  }

  // Check for boolean
  if (typeof value === "boolean") {
    return "boolean";
  }

  // Check for date (if it's already a Date object)
  if (value instanceof Date) {
    return "date";
  }

  // Check for string-based dates
  if (typeof value === "string" && isValidDate(value)) {
    return "date";
  }

  // Check for numbers (including scientific notation)
  if (typeof value === "string" || typeof value === "number") {
    const num = Number(value);
    if (!isNaN(num) && isFinite(num) && value !== "") {
      return "number";
    }
  }

  return "string";
}

/**
 * Performs comprehensive type inference on a field across multiple samples
 */
export function inferFieldType(
  fieldName: string,
  samples: unknown[],
  sampleSize = 100
): TypeInferenceResult {
  const limitedSamples = samples.slice(0, sampleSize);
  const typeCount = new Map<string, number>();

  // Count occurrences of each type
  limitedSamples.forEach((value) => {
    const type = inferType(value);
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  });

  // Find the most common type
  const entries = Array.from(typeCount.entries());
  if (entries.length === 0) {
    return {
      type: "string",
      confidence: 0,
      samples: limitedSamples,
      nullable: true,
    };
  }

  const [mostCommonType, count] = entries.reduce((a, b) =>
    a[1] > b[1] ? a : b
  );

  const confidence = count / limitedSamples.length;
  const nullable = limitedSamples.some(
    (v) => v === null || v === undefined || v === ""
  );

  // Check if this should be categorical (string with low cardinality)
  const uniqueValues = new Set(limitedSamples).size;
  const shouldBeCategorical =
    mostCommonType === "string" &&
    uniqueValues <= 10 &&
    uniqueValues < limitedSamples.length * 0.5;

  return {
    type: shouldBeCategorical
      ? "categorical"
      : (mostCommonType as TypeInferenceResult["type"]),
    confidence,
    samples: limitedSamples,
    nullable,
  };
}
