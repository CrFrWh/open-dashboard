import * as arrow from "apache-arrow";
import type { DataField } from "@open-dashboard/shared/types";

/**
 * Maps internal DataField type to Apache Arrow DataType
 *
 * Mapping strategy:
 * - string → Utf8
 * - number → Float64 (handles integers and floats)
 * - date → DateMillisecond (default), TimestampMicrosecond, or TimestampNanosecond
 * - boolean → Bool
 * - categorical → Dictionary<Utf8, Int32> (efficient for repeated values)
 *
 * @param field - The field to convert
 * @param options - Conversion options (date format, etc.)
 * @returns Apache Arrow DataType
 * @throws {Error} If field type is unsupported
 */
export function dataFieldToArrowType(
  field: DataField,
  options?: { dateFormat?: "millisecond" | "microsecond" | "nanosecond" }
): arrow.DataType {
  switch (field.type) {
    case "string":
      return new arrow.Utf8();

    case "number":
      return new arrow.Float64();

    case "date": {
      const format = options?.dateFormat ?? "millisecond";
      switch (format) {
        case "millisecond":
          return new arrow.DateMillisecond();
        case "microsecond":
          // null = timezone-naive (recommended for most use cases)
          return new arrow.TimestampMicrosecond(null);
        case "nanosecond":
          return new arrow.TimestampNanosecond(null);
        default:
          return new arrow.DateMillisecond();
      }
    }

    case "boolean":
      return new arrow.Bool();

    case "categorical":
      // Dictionary encoding: value type (Utf8), index type (Int32)
      return new arrow.Dictionary(new arrow.Utf8(), new arrow.Int32());

    default:
      throw new Error(`Unsupported field type: ${field.type}`);
  }
}

/**
 * Maps Apache Arrow DataType back to internal DataField type string
 *
 * @param arrowType - Apache Arrow DataType
 * @returns Internal type string
 */
export function arrowTypeToDataField(
  arrowType: arrow.DataType
): Pick<DataField, "type"> {
  // Use instanceof checks for reliable type detection in Apache Arrow v18

  // String types
  if (arrowType instanceof arrow.Utf8 || arrowType instanceof arrow.LargeUtf8) {
    return { type: "string" };
  }

  // Number types
  if (
    arrowType instanceof arrow.Float64 ||
    arrowType instanceof arrow.Float32 ||
    arrowType instanceof arrow.Int32 ||
    arrowType instanceof arrow.Int64 ||
    arrowType instanceof arrow.Uint32 ||
    arrowType instanceof arrow.Uint64 ||
    arrowType instanceof arrow.Int16 ||
    arrowType instanceof arrow.Int8 ||
    arrowType instanceof arrow.Uint16 ||
    arrowType instanceof arrow.Uint8
  ) {
    return { type: "number" };
  }

  // Date types
  if (
    arrowType instanceof arrow.DateMillisecond ||
    arrowType instanceof arrow.DateDay ||
    arrowType instanceof arrow.TimestampMillisecond ||
    arrowType instanceof arrow.TimestampMicrosecond ||
    arrowType instanceof arrow.TimestampNanosecond ||
    arrowType instanceof arrow.TimestampSecond
  ) {
    return { type: "date" };
  }

  // Boolean type
  if (arrowType instanceof arrow.Bool) {
    return { type: "boolean" };
  }

  // Dictionary (categorical) type
  if (arrowType instanceof arrow.Dictionary) {
    return { type: "categorical" };
  }

  // Fallback to string for unknown types
  return { type: "string" };
}

/**
 * Creates an Arrow Field from DataField
 * Includes name, type, and nullable information
 *
 * @param field - The DataField to convert
 * @param options - Conversion options
 * @returns Arrow Field
 */
export function createArrowField(
  field: DataField,
  options?: { dateFormat?: "millisecond" | "microsecond" | "nanosecond" }
): arrow.Field {
  const arrowType = dataFieldToArrowType(field, options);
  const nullable = field.nullable ?? true;

  // Convert metadata object to Map<string, string> if present and non-empty
  let metadataMap: Map<string, string> | undefined;
  if (field.metadata && typeof field.metadata === "object") {
    const entries = Object.entries(field.metadata)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k, String(v)] as [string, string]);

    // Only create Map if there are entries
    if (entries.length > 0) {
      metadataMap = new Map(entries);
    }
  }

  return new arrow.Field(field.name, arrowType, nullable, metadataMap);
}

/**
 * Extracts DataField from Arrow Field
 *
 * @param arrowField - Arrow Field to convert
 * @returns DataField
 */
export function extractDataFieldFromArrowField(
  arrowField: arrow.Field
): DataField {
  const typeInfo = arrowTypeToDataField(arrowField.type);

  // Convert metadata Map to object, but return undefined if empty or not present
  let metadata: Record<string, unknown> | undefined;
  if (arrowField.metadata && arrowField.metadata.size > 0) {
    metadata = Object.fromEntries(arrowField.metadata);
  }

  return {
    name: arrowField.name,
    type: typeInfo.type,
    nullable: arrowField.nullable,
    metadata,
  };
}
