import { describe, it, expect } from "vitest";
import * as arrow from "apache-arrow";
import {
  dataFieldToArrowType,
  arrowTypeToDataField,
  createArrowField,
  extractDataFieldFromArrowField,
} from "./typeMapper";
import type { DataField } from "@open-dashboard/shared/types";

describe("typeMapper", () => {
  describe("dataFieldToArrowType", () => {
    describe("string type mapping", () => {
      it("should map string to Utf8", () => {
        const field: DataField = { name: "name", type: "string" };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.Utf8);
        // typeId comparison removed - instanceof check is sufficient
      });

      it("should handle string field with nullable", () => {
        const field: DataField = {
          name: "description",
          type: "string",
          nullable: true,
        };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.Utf8);
      });
    });

    describe("number type mapping", () => {
      it("should map number to Float64", () => {
        const field: DataField = { name: "age", type: "number" };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.Float64);
        // typeId comparison removed - instanceof check is sufficient
      });

      it("should handle integer values", () => {
        const field: DataField = { name: "count", type: "number" };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.Float64);
      });

      it("should handle decimal values", () => {
        const field: DataField = { name: "price", type: "number" };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.Float64);
      });
    });

    describe("boolean type mapping", () => {
      it("should map boolean to Bool", () => {
        const field: DataField = { name: "active", type: "boolean" };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.Bool);
        // typeId comparison removed - instanceof check is sufficient
      });

      it("should handle nullable boolean", () => {
        const field: DataField = {
          name: "is_verified",
          type: "boolean",
          nullable: true,
        };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.Bool);
      });
    });

    describe("date type mapping", () => {
      it("should map date to DateMillisecond by default", () => {
        const field: DataField = { name: "created_at", type: "date" };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.DateMillisecond);
        // typeId comparison removed - instanceof check is sufficient
      });

      it("should map date to TimestampMicrosecond with microsecond option", () => {
        const field: DataField = { name: "timestamp", type: "date" };
        const arrowType = dataFieldToArrowType(field, {
          dateFormat: "microsecond",
        });

        expect(arrowType).toBeInstanceOf(arrow.TimestampMicrosecond);
        // typeId comparison removed - instanceof check is sufficient
      });

      it("should map date to TimestampNanosecond with nanosecond option", () => {
        const field: DataField = { name: "precise_time", type: "date" };
        const arrowType = dataFieldToArrowType(field, {
          dateFormat: "nanosecond",
        });

        expect(arrowType).toBeInstanceOf(arrow.TimestampNanosecond);
        // typeId comparison removed - instanceof check is sufficient
      });

      it("should use millisecond format when option is not specified", () => {
        const field: DataField = { name: "date", type: "date" };
        const arrowType = dataFieldToArrowType(field, {});

        expect(arrowType).toBeInstanceOf(arrow.DateMillisecond);
      });
    });

    describe("categorical type mapping", () => {
      it("should map categorical to Dictionary", () => {
        const field: DataField = { name: "status", type: "categorical" };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.Dictionary);
        // typeId comparison removed - instanceof check is sufficient
      });

      it("should handle categorical with nullable", () => {
        const field: DataField = {
          name: "category",
          type: "categorical",
          nullable: true,
        };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.Dictionary);
      });
    });

    describe("error handling", () => {
      it("should throw error for unsupported type", () => {
        // @ts-expect-error: intentionally passing unsupported type for test
        const field: DataField = { name: "invalid", type: "unknown" };

        expect(() => dataFieldToArrowType(field)).toThrow(
          "Unsupported field type"
        );
      });
    });

    describe("edge cases", () => {
      it("should handle field with metadata", () => {
        const field: DataField = {
          name: "value",
          type: "number",
          metadata: { unit: "meters" },
        };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.Float64);
      });

      it("should handle field with complex metadata", () => {
        const field: DataField = {
          name: "measurement",
          type: "number",
          metadata: {
            precision: 0.01,
            unit: "celsius",
            description: "Temperature reading",
          },
        };
        const arrowType = dataFieldToArrowType(field);

        expect(arrowType).toBeInstanceOf(arrow.Float64);
      });
    });
  });

  describe("arrowTypeToDataField", () => {
    describe("string type detection", () => {
      it("should detect Utf8 as string", () => {
        const arrowType = new arrow.Utf8();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("string");
      });

      it("should detect LargeUtf8 as string", () => {
        const arrowType = new arrow.LargeUtf8();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("string");
      });
    });

    describe("number type detection", () => {
      it("should detect Float64 as number", () => {
        const arrowType = new arrow.Float64();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("number");
      });

      it("should detect Float32 as number", () => {
        const arrowType = new arrow.Float32();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("number");
      });

      it("should detect Int32 as number", () => {
        const arrowType = new arrow.Int32();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("number");
      });

      it("should detect Int64 as number", () => {
        const arrowType = new arrow.Int64();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("number");
      });

      it("should detect Uint32 as number", () => {
        const arrowType = new arrow.Uint32();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("number");
      });

      it("should detect Uint64 as number", () => {
        const arrowType = new arrow.Uint64();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("number");
      });

      it("should detect Int16 as number", () => {
        const arrowType = new arrow.Int16();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("number");
      });

      it("should detect Int8 as number", () => {
        const arrowType = new arrow.Int8();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("number");
      });

      it("should detect Uint16 as number", () => {
        const arrowType = new arrow.Uint16();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("number");
      });

      it("should detect Uint8 as number", () => {
        const arrowType = new arrow.Uint8();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("number");
      });
    });

    describe("boolean type detection", () => {
      it("should detect Bool as boolean", () => {
        const arrowType = new arrow.Bool();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("boolean");
      });
    });

    describe("date type detection", () => {
      it("should detect DateMillisecond as date", () => {
        const arrowType = new arrow.DateMillisecond();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("date");
      });

      it("should detect DateDay as date", () => {
        const arrowType = new arrow.DateDay();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("date");
      });

      it("should detect TimestampMillisecond as date", () => {
        const arrowType = new arrow.TimestampMillisecond();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("date");
      });

      it("should detect TimestampMicrosecond as date", () => {
        const arrowType = new arrow.TimestampMicrosecond(null);
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("date");
      });

      it("should detect TimestampNanosecond as date", () => {
        const arrowType = new arrow.TimestampNanosecond(null);
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("date");
      });

      it("should detect TimestampSecond as date", () => {
        const arrowType = new arrow.TimestampSecond();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("date");
      });
    });

    describe("categorical type detection", () => {
      it("should detect Dictionary as categorical", () => {
        const arrowType = new arrow.Dictionary(
          new arrow.Utf8(),
          new arrow.Int32()
        );
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("categorical");
      });
    });

    describe("fallback behavior", () => {
      it("should fallback to string for unknown types", () => {
        // Create a Binary type which we don't explicitly handle
        const arrowType = new arrow.Binary();
        const result = arrowTypeToDataField(arrowType);

        expect(result.type).toBe("string");
      });
    });
  });

  describe("createArrowField", () => {
    describe("basic field creation", () => {
      it("should create Arrow Field with correct name and type", () => {
        const field: DataField = { name: "username", type: "string" };
        const arrowField = createArrowField(field);

        expect(arrowField.name).toBe("username");
        expect(arrowField.type).toBeInstanceOf(arrow.Utf8);
        expect(arrowField.nullable).toBe(true);
      });

      it("should respect nullable: false", () => {
        const field: DataField = {
          name: "id",
          type: "number",
          nullable: false,
        };
        const arrowField = createArrowField(field);

        expect(arrowField.nullable).toBe(false);
      });

      it("should default nullable to true", () => {
        const field: DataField = { name: "email", type: "string" };
        const arrowField = createArrowField(field);

        expect(arrowField.nullable).toBe(true);
      });
    });

    describe("metadata handling", () => {
      it("should convert metadata to Map", () => {
        const field: DataField = {
          name: "temperature",
          type: "number",
          metadata: { unit: "celsius", precision: "0.1" },
        };
        const arrowField = createArrowField(field);

        expect(arrowField.metadata).toBeInstanceOf(Map);
        expect(arrowField.metadata?.size).toBe(2);
        expect(arrowField.metadata?.get("unit")).toBe("celsius");
        expect(arrowField.metadata?.get("precision")).toBe("0.1");
      });

      it("should handle undefined metadata", () => {
        const field: DataField = { name: "value", type: "number" };
        const arrowField = createArrowField(field);

        // Arrow Field constructor returns an empty Map when undefined is passed
        expect(
          arrowField.metadata === undefined || arrowField.metadata?.size === 0
        ).toBe(true);
      });

      it("should filter out null values in metadata", () => {
        const field: DataField = {
          name: "field",
          type: "string",
          metadata: { key1: "value1", key2: null, key3: "value3" },
        };
        const arrowField = createArrowField(field);

        expect(arrowField.metadata?.size).toBe(2);
        expect(arrowField.metadata?.has("key2")).toBe(false);
      });

      it("should filter out undefined values in metadata", () => {
        const field: DataField = {
          name: "field",
          type: "string",
          metadata: { key1: "value1", key2: undefined, key3: "value3" },
        };
        const arrowField = createArrowField(field);

        expect(arrowField.metadata?.size).toBe(2);
        expect(arrowField.metadata?.has("key2")).toBe(false);
      });

      it("should convert non-string metadata values to strings", () => {
        const field: DataField = {
          name: "stats",
          type: "number",
          metadata: { count: 42, active: true, ratio: 0.75 },
        };
        const arrowField = createArrowField(field);

        expect(arrowField.metadata?.get("count")).toBe("42");
        expect(arrowField.metadata?.get("active")).toBe("true");
        expect(arrowField.metadata?.get("ratio")).toBe("0.75");
      });

      it("should handle empty metadata object", () => {
        const field: DataField = {
          name: "field",
          type: "string",
          metadata: {},
        };
        const arrowField = createArrowField(field);

        expect(arrowField.metadata?.size).toBe(0);
      });
    });

    describe("date format options", () => {
      it("should use millisecond format by default", () => {
        const field: DataField = { name: "timestamp", type: "date" };
        const arrowField = createArrowField(field);

        expect(arrowField.type).toBeInstanceOf(arrow.DateMillisecond);
      });

      it("should use microsecond format when specified", () => {
        const field: DataField = { name: "timestamp", type: "date" };
        const arrowField = createArrowField(field, {
          dateFormat: "microsecond",
        });

        expect(arrowField.type).toBeInstanceOf(arrow.TimestampMicrosecond);
      });

      it("should use nanosecond format when specified", () => {
        const field: DataField = { name: "timestamp", type: "date" };
        const arrowField = createArrowField(field, {
          dateFormat: "nanosecond",
        });

        expect(arrowField.type).toBeInstanceOf(arrow.TimestampNanosecond);
      });
    });

    describe("all field types", () => {
      it("should create string field", () => {
        const field: DataField = { name: "text", type: "string" };
        const arrowField = createArrowField(field);

        expect(arrowField.type).toBeInstanceOf(arrow.Utf8);
      });

      it("should create number field", () => {
        const field: DataField = { name: "count", type: "number" };
        const arrowField = createArrowField(field);

        expect(arrowField.type).toBeInstanceOf(arrow.Float64);
      });

      it("should create boolean field", () => {
        const field: DataField = { name: "active", type: "boolean" };
        const arrowField = createArrowField(field);

        expect(arrowField.type).toBeInstanceOf(arrow.Bool);
      });

      it("should create date field", () => {
        const field: DataField = { name: "created", type: "date" };
        const arrowField = createArrowField(field);

        expect(arrowField.type).toBeInstanceOf(arrow.DateMillisecond);
      });

      it("should create categorical field", () => {
        const field: DataField = { name: "status", type: "categorical" };
        const arrowField = createArrowField(field);

        expect(arrowField.type).toBeInstanceOf(arrow.Dictionary);
      });
    });
  });

  describe("extractDataFieldFromArrowField", () => {
    describe("basic field extraction", () => {
      it("should extract name and type", () => {
        const arrowField = new arrow.Field("age", new arrow.Float64(), false);
        const dataField = extractDataFieldFromArrowField(arrowField);

        expect(dataField.name).toBe("age");
        expect(dataField.type).toBe("number");
        expect(dataField.nullable).toBe(false);
      });

      it("should extract nullable information", () => {
        const arrowField = new arrow.Field(
          "description",
          new arrow.Utf8(),
          true
        );
        const dataField = extractDataFieldFromArrowField(arrowField);

        expect(dataField.nullable).toBe(true);
      });
    });

    describe("metadata extraction", () => {
      it("should extract metadata from Arrow Field", () => {
        const metadata = new Map([
          ["unit", "meters"],
          ["precision", "0.01"],
        ]);
        const arrowField = new arrow.Field(
          "distance",
          new arrow.Float64(),
          true,
          metadata
        );
        const dataField = extractDataFieldFromArrowField(arrowField);

        expect(dataField.metadata).toBeDefined();
        expect(dataField.metadata?.unit).toBe("meters");
        expect(dataField.metadata?.precision).toBe("0.01");
      });

      it("should handle undefined metadata", () => {
        const arrowField = new arrow.Field("value", new arrow.Float64(), true);
        const dataField = extractDataFieldFromArrowField(arrowField);

        expect(dataField.metadata).toBeUndefined();
      });

      it("should handle empty metadata", () => {
        const metadata = new Map();
        const arrowField = new arrow.Field(
          "field",
          new arrow.Utf8(),
          true,
          metadata
        );
        const dataField = extractDataFieldFromArrowField(arrowField);

        // Empty Map should return undefined metadata
        expect(dataField.metadata).toBeUndefined();
      });
    });

    describe("all type conversions", () => {
      it("should extract string type", () => {
        const arrowField = new arrow.Field("name", new arrow.Utf8(), true);
        const dataField = extractDataFieldFromArrowField(arrowField);

        expect(dataField.type).toBe("string");
      });

      it("should extract number type from Float64", () => {
        const arrowField = new arrow.Field("value", new arrow.Float64(), true);
        const dataField = extractDataFieldFromArrowField(arrowField);

        expect(dataField.type).toBe("number");
      });

      it("should extract number type from Int32", () => {
        const arrowField = new arrow.Field("count", new arrow.Int32(), true);
        const dataField = extractDataFieldFromArrowField(arrowField);

        expect(dataField.type).toBe("number");
      });

      it("should extract boolean type", () => {
        const arrowField = new arrow.Field("active", new arrow.Bool(), true);
        const dataField = extractDataFieldFromArrowField(arrowField);

        expect(dataField.type).toBe("boolean");
      });

      it("should extract date type from DateMillisecond", () => {
        const arrowField = new arrow.Field(
          "timestamp",
          new arrow.DateMillisecond(),
          true
        );
        const dataField = extractDataFieldFromArrowField(arrowField);

        expect(dataField.type).toBe("date");
      });

      it("should extract date type from TimestampMicrosecond", () => {
        const arrowField = new arrow.Field(
          "timestamp",
          new arrow.TimestampMicrosecond(null),
          true
        );
        const dataField = extractDataFieldFromArrowField(arrowField);

        expect(dataField.type).toBe("date");
      });

      it("should extract categorical type", () => {
        const arrowField = new arrow.Field(
          "status",
          new arrow.Dictionary(new arrow.Utf8(), new arrow.Int32()),
          true
        );
        const dataField = extractDataFieldFromArrowField(arrowField);

        expect(dataField.type).toBe("categorical");
      });
    });
  });

  describe("round-trip conversions", () => {
    describe("DataField -> Arrow -> DataField", () => {
      it("should preserve string field through round trip", () => {
        const original: DataField = {
          name: "username",
          type: "string",
          nullable: false,
        };

        const arrowField = createArrowField(original);
        const converted = extractDataFieldFromArrowField(arrowField);

        expect(converted.name).toBe(original.name);
        expect(converted.type).toBe(original.type);
        expect(converted.nullable).toBe(original.nullable);
      });

      it("should preserve number field through round trip", () => {
        const original: DataField = {
          name: "count",
          type: "number",
          nullable: true,
        };

        const arrowField = createArrowField(original);
        const converted = extractDataFieldFromArrowField(arrowField);

        expect(converted.name).toBe(original.name);
        expect(converted.type).toBe(original.type);
        expect(converted.nullable).toBe(original.nullable);
      });

      it("should preserve boolean field through round trip", () => {
        const original: DataField = {
          name: "is_active",
          type: "boolean",
          nullable: false,
        };

        const arrowField = createArrowField(original);
        const converted = extractDataFieldFromArrowField(arrowField);

        expect(converted.name).toBe(original.name);
        expect(converted.type).toBe(original.type);
        expect(converted.nullable).toBe(original.nullable);
      });

      it("should preserve date field through round trip", () => {
        const original: DataField = {
          name: "created_at",
          type: "date",
          nullable: true,
        };

        const arrowField = createArrowField(original);
        const converted = extractDataFieldFromArrowField(arrowField);

        expect(converted.name).toBe(original.name);
        expect(converted.type).toBe(original.type);
        expect(converted.nullable).toBe(original.nullable);
      });

      it("should preserve categorical field through round trip", () => {
        const original: DataField = {
          name: "status",
          type: "categorical",
          nullable: false,
        };

        const arrowField = createArrowField(original);
        const converted = extractDataFieldFromArrowField(arrowField);

        expect(converted.name).toBe(original.name);
        expect(converted.type).toBe(original.type);
        expect(converted.nullable).toBe(original.nullable);
      });

      it("should preserve metadata through round trip", () => {
        const original: DataField = {
          name: "temperature",
          type: "number",
          nullable: true,
          metadata: {
            unit: "celsius",
            precision: "0.1",
            sensor: "TMP36",
          },
        };

        const arrowField = createArrowField(original);
        const converted = extractDataFieldFromArrowField(arrowField);

        expect(converted.metadata).toBeDefined();
        expect(converted.metadata?.unit).toBe("celsius");
        expect(converted.metadata?.precision).toBe("0.1");
        expect(converted.metadata?.sensor).toBe("TMP36");
      });

      it("should handle field with no metadata through round trip", () => {
        const original: DataField = {
          name: "simple_field",
          type: "string",
        };

        const arrowField = createArrowField(original);
        const converted = extractDataFieldFromArrowField(arrowField);

        expect(converted.name).toBe(original.name);
        expect(converted.type).toBe(original.type);
        expect(converted.nullable).toBe(true); // Default
        expect(converted.metadata).toBeUndefined();
      });
    });

    describe("complex scenarios", () => {
      it("should handle field with all properties", () => {
        const original: DataField = {
          name: "measurement",
          type: "number",
          nullable: false,
          metadata: {
            unit: "meters",
            precision: "0.001",
            calibrationDate: "2025-01-01",
          },
        };

        const arrowField = createArrowField(original);
        const converted = extractDataFieldFromArrowField(arrowField);

        expect(converted).toEqual({
          name: original.name,
          type: original.type,
          nullable: original.nullable,
          metadata: {
            unit: "meters",
            precision: "0.001",
            calibrationDate: "2025-01-01",
          },
        });
      });

      it("should handle multiple fields in sequence", () => {
        const fields: DataField[] = [
          { name: "id", type: "number", nullable: false },
          { name: "name", type: "string", nullable: false },
          { name: "active", type: "boolean", nullable: true },
          { name: "created", type: "date", nullable: false },
          { name: "status", type: "categorical", nullable: true },
        ];

        const arrowFields = fields.map((f) => createArrowField(f));
        const converted = arrowFields.map((af) =>
          extractDataFieldFromArrowField(af)
        );

        expect(converted).toHaveLength(5);
        converted.forEach((field, index) => {
          expect(field.name).toBe(fields[index].name);
          expect(field.type).toBe(fields[index].type);
          expect(field.nullable).toBe(fields[index].nullable);
        });
      });
    });
  });
});
