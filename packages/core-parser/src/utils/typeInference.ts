import type { TypeInferenceResult } from "../types/parser";

/**
 * Checks if a string represents a valid date
 */
export function isValidDate(value: string): boolean {
  if (!value || typeof value !== "string") return false;

  // Check format first
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    // Try MM/DD/YYYY format
    const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!usMatch) return false;
  }

  // Validate with Date constructor
  const date = new Date(value);
  if (isNaN(date.getTime())) return false;

  // For ISO format, verify components match (catches invalid dates)
  if (match) {
    const [, year, month, day] = match;
    const parsed = new Date(value);
    // Compare year, month (0-indexed), day
    if (
      parsed.getUTCFullYear() !== parseInt(year) ||
      parsed.getUTCMonth() !== parseInt(month) - 1 ||
      parsed.getUTCDate() !== parseInt(day)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Infers the data type of a single value
 */
export function inferType(
  value: unknown
): "string" | "number" | "date" | "boolean" | "categorical" {
  // Null/undefined/empty string should be treated as string
  if (value === null || value === undefined) return "string";

  // Whitespace strings are still strings - don't trim here
  if (typeof value === "string") {
    // Empty string is string type
    if (value === "") return "string";

    // Check for date patterns BEFORE trimming
    if (isValidDate(value)) return "date";

    // Check for numbers (but not whitespace-only)
    const trimmed = value.trim();
    if (trimmed !== "") {
      const num = Number(trimmed);
      if (!isNaN(num) && isFinite(num)) {
        return "number";
      }
    }

    // Whitespace or any other string
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
 * Analyzes field name for type hints
 */
function analyzeFieldName(fieldName: string): {
  isLikelyDate: boolean;
  isLikelyId: boolean;
  isLikelyCategory: boolean;
  isLikelyBoolean: boolean;
} {
  const fieldLower = fieldName.toLowerCase();

  return {
    isLikelyDate:
      fieldLower.includes("date") ||
      fieldLower.includes("time") ||
      fieldLower.endsWith("_at") ||
      fieldLower.endsWith("_on") ||
      fieldLower.startsWith("created") ||
      fieldLower.startsWith("updated") ||
      fieldLower.startsWith("deleted"),

    isLikelyId:
      fieldLower === "id" ||
      fieldLower.endsWith("_id") ||
      fieldLower.endsWith("id") ||
      fieldLower === "sku" ||
      fieldLower === "code" ||
      fieldLower === "uuid",

    isLikelyCategory:
      fieldLower.includes("category") ||
      fieldLower.includes("type") ||
      fieldLower.includes("status") ||
      fieldLower.includes("department") ||
      fieldLower.includes("region") ||
      fieldLower.includes("location") ||
      fieldLower.includes("group"),

    isLikelyBoolean:
      fieldLower.startsWith("is_") ||
      fieldLower.startsWith("has_") ||
      fieldLower.startsWith("can_") ||
      fieldLower.startsWith("should_") ||
      fieldLower.endsWith("_flag") ||
      fieldLower.includes("enabled") ||
      fieldLower.includes("active"),
  };
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
  const warnings: string[] = [];

  // Analyze field name for hints
  const fieldHints = analyzeFieldName(fieldName);

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
      metadata: {
        fieldName,
        sampleCount: 0,
        uniqueValueCount: 0,
        warnings: ["No samples available for type inference"],
      },
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

  // More lenient categorical detection when field name suggests category
  const shouldBeCategorical =
    mostCommonType === "string" &&
    uniqueValues <= 10 &&
    (fieldHints.isLikelyCategory
      ? true // Always categorical if field name suggests it and <= 10 unique values
      : uniqueValues < limitedSamples.length * 0.5); // 50% threshold without hint

  // Determine final type with field name hints
  let finalType: TypeInferenceResult["type"] = shouldBeCategorical
    ? "categorical"
    : (mostCommonType as TypeInferenceResult["type"]);

  // Apply field name heuristics
  if (fieldHints.isLikelyId && mostCommonType === "number") {
    finalType = "string";
    warnings.push(
      `Field "${fieldName}" looks like an ID but contains numbers. Treating as string to preserve leading zeros.`
    );
  }

  if (
    fieldHints.isLikelyDate &&
    mostCommonType === "number" &&
    confidence > 0.8
  ) {
    const firstValue = limitedSamples.find(
      (v) => v !== null && v !== undefined
    );
    if (typeof firstValue === "number" && firstValue > 1000000000) {
      finalType = "date";
      warnings.push(
        `Field "${fieldName}" contains Unix timestamps. Treating as date.`
      );
    }
  }

  // Boolean detection: check if original values are strings with boolean patterns
  // This allows string "1"/"0" to be detected as boolean, but not actual numbers 1/0
  if (fieldHints.isLikelyBoolean && uniqueValues <= 2) {
    const nonNullValues = limitedSamples.filter(
      (v) => v !== null && v !== undefined
    );

    // Check if all non-null values are strings (not actual numbers)
    const allStrings = nonNullValues.every((v) => typeof v === "string");

    if (allStrings) {
      const valueStrings = Array.from(new Set(nonNullValues)).map((v) =>
        String(v).toLowerCase()
      );

      // Check if all values match boolean patterns
      if (
        valueStrings.every((v) =>
          ["true", "false", "yes", "no", "1", "0", "y", "n"].includes(v)
        )
      ) {
        finalType = "boolean";
        warnings.push(
          `Field "${fieldName}" looks like boolean with values: ${valueStrings.join(", ")}`
        );
      }
    }
  }

  // Confidence warnings (use <= 0.6 to include exactly 60% confidence)
  if (confidence <= 0.6) {
    warnings.push(
      `Low confidence (${(confidence * 100).toFixed(1)}%) in type inference for "${fieldName}". Field has mixed types.`
    );
  }

  if (entries.length > 2) {
    warnings.push(
      `Field "${fieldName}" contains ${entries.length} different types. Using most common: ${finalType}`
    );
  }

  return {
    type: finalType,
    confidence,
    samples: limitedSamples,
    nullable,
    metadata: {
      fieldName,
      sampleCount: limitedSamples.length,
      uniqueValueCount: uniqueValues,
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  };
}
