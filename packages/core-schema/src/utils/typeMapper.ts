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
  const typeId = arrowType.typeId;

  // Use arrow.Type enum for type checking
  if (typeId === arrow.Type.Utf8 || typeId === arrow.Type.LargeUtf8) {
    return { type: "string" };
  }

  if (
    typeId === arrow.Type.Float64 ||
    typeId === arrow.Type.Float32 ||
    typeId === arrow.Type.Int32 ||
    typeId === arrow.Type.Int64 ||
    typeId === arrow.Type.Uint32 ||
    typeId === arrow.Type.Uint64 ||
    typeId === arrow.Type.Int16 ||
    typeId === arrow.Type.Int8 ||
    typeId === arrow.Type.Uint16 ||
    typeId === arrow.Type.Uint8
  ) {
    return { type: "number" };
  }

  if (
    typeId === arrow.Type.DateMillisecond ||
    typeId === arrow.Type.DateDay ||
    typeId === arrow.Type.TimestampMillisecond ||
    typeId === arrow.Type.TimestampMicrosecond ||
    typeId === arrow.Type.TimestampNanosecond ||
    typeId === arrow.Type.TimestampSecond
  ) {
    return { type: "date" };
  }

  if (typeId === arrow.Type.Bool) {
    return { type: "boolean" };
  }

  if (typeId === arrow.Type.Dictionary) {
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

  // Convert metadata object to Map<string, string> if present
  let metadataMap: Map<string, string> | undefined;
  if (field.metadata && typeof field.metadata === "object") {
    metadataMap = new Map(
      Object.entries(field.metadata)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
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

  return {
    name: arrowField.name,
    type: typeInfo.type,
    nullable: arrowField.nullable,
    metadata: arrowField.metadata
      ? Object.fromEntries(arrowField.metadata)
      : undefined,
  };
}
