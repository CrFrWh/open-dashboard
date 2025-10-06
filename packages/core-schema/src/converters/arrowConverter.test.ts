import { describe, it, expect } from "vitest";
import * as arrow from "apache-arrow";
import {
  schemaToArrowSchema,
  arrowTableSchemaToDatasetSchema,
  datasetToArrow,
  arrowToDataset,
} from "./arrowConverter";
import type {
  DatasetSchema,
  ParsedDataset,
} from "@open-dashboard/shared/types";

describe("arrowConverter", () => {
  describe("schemaToArrowSchema", () => {
    describe("basic schema conversion", () => {
      it("should convert simple schema to Arrow Schema", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "id", type: "number" },
            { name: "name", type: "string" },
          ],
        };

        const arrowSchema = schemaToArrowSchema(schema);

        expect(arrowSchema.fields).toHaveLength(2);
        expect(arrowSchema.fields[0].name).toBe("id");
        expect(arrowSchema.fields[1].name).toBe("name");
        expect(arrowSchema.fields[0].type).toBeInstanceOf(arrow.Float64);
        expect(arrowSchema.fields[1].type).toBeInstanceOf(arrow.Utf8);
      });

      it("should handle all data types", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "str", type: "string" },
            { name: "num", type: "number" },
            { name: "bool", type: "boolean" },
            { name: "date", type: "date" },
            { name: "cat", type: "categorical" },
          ],
        };

        const arrowSchema = schemaToArrowSchema(schema);

        expect(arrowSchema.fields).toHaveLength(5);
        expect(arrowSchema.fields[0].type).toBeInstanceOf(arrow.Utf8);
        expect(arrowSchema.fields[1].type).toBeInstanceOf(arrow.Float64);
        expect(arrowSchema.fields[2].type).toBeInstanceOf(arrow.Bool);
        expect(arrowSchema.fields[3].type).toBeInstanceOf(
          arrow.DateMillisecond
        );
        expect(arrowSchema.fields[4].type).toBeInstanceOf(arrow.Dictionary);
      });

      it("should preserve nullable information", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "required", type: "string", nullable: false },
            { name: "optional", type: "string", nullable: true },
          ],
        };

        const arrowSchema = schemaToArrowSchema(schema);

        expect(arrowSchema.fields[0].nullable).toBe(false);
        expect(arrowSchema.fields[1].nullable).toBe(true);
      });
    });

    describe("schema normalization", () => {
      it("should normalize field names with special characters", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "field name", type: "string" },
            { name: "field@name", type: "number" },
          ],
        };

        const arrowSchema = schemaToArrowSchema(schema);

        // "field name" becomes "field_name"
        // "field@name" becomes "fieldname" (@ removed, no underscore)
        expect(arrowSchema.fields[0].name).toBe("field_name");
        expect(arrowSchema.fields[1].name).toBe("fieldname");
      });

      it("should handle duplicate field names", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "name", type: "string" },
            { name: "name", type: "number" },
          ],
        };

        const arrowSchema = schemaToArrowSchema(schema);

        // Duplicate names are removed (first occurrence kept)
        expect(arrowSchema.fields).toHaveLength(1);
        expect(arrowSchema.fields[0].name).toBe("name");
        expect(arrowSchema.fields[0].type).toBeInstanceOf(arrow.Utf8);
      });
    });

    describe("date format options", () => {
      it("should use DateMillisecond by default", () => {
        const schema: DatasetSchema = {
          fields: [{ name: "timestamp", type: "date" }],
        };

        const arrowSchema = schemaToArrowSchema(schema);

        expect(arrowSchema.fields[0].type).toBeInstanceOf(
          arrow.DateMillisecond
        );
      });

      it("should respect microsecond date format option", () => {
        const schema: DatasetSchema = {
          fields: [{ name: "timestamp", type: "date" }],
        };

        const arrowSchema = schemaToArrowSchema(schema, {
          dateFormat: "microsecond",
        });

        expect(arrowSchema.fields[0].type).toBeInstanceOf(
          arrow.TimestampMicrosecond
        );
      });

      it("should respect nanosecond date format option", () => {
        const schema: DatasetSchema = {
          fields: [{ name: "timestamp", type: "date" }],
        };

        const arrowSchema = schemaToArrowSchema(schema, {
          dateFormat: "nanosecond",
        });

        expect(arrowSchema.fields[0].type).toBeInstanceOf(
          arrow.TimestampNanosecond
        );
      });
    });
  });

  describe("arrowTableSchemaToDatasetSchema", () => {
    it("should extract schema from Arrow Table", () => {
      const arrowSchema = new arrow.Schema([
        new arrow.Field("id", new arrow.Float64(), false),
        new arrow.Field("name", new arrow.Utf8(), true),
      ]);

      const emptyVectors = arrowSchema.fields.map((field) =>
        arrow.vectorFromArray([], field.type)
      );
      const data = arrow.makeData({
        type: new arrow.Struct(arrowSchema.fields),
        length: 0,
        nullCount: 0,
        children: emptyVectors.map((v) => v.data[0]),
      });
      const recordBatch = new arrow.RecordBatch(arrowSchema, data);
      const table = new arrow.Table([recordBatch]);

      const datasetSchema = arrowTableSchemaToDatasetSchema(table);

      expect(datasetSchema.fields).toHaveLength(2);
      expect(datasetSchema.fields[0].name).toBe("id");
      expect(datasetSchema.fields[0].type).toBe("number");
      expect(datasetSchema.fields[0].nullable).toBe(false);
      expect(datasetSchema.fields[1].name).toBe("name");
      expect(datasetSchema.fields[1].type).toBe("string");
      expect(datasetSchema.fields[1].nullable).toBe(true);
    });

    it("should handle all Arrow types", () => {
      const arrowSchema = new arrow.Schema([
        new arrow.Field("str", new arrow.Utf8(), true),
        new arrow.Field("num", new arrow.Float64(), true),
        new arrow.Field("bool", new arrow.Bool(), true),
        new arrow.Field("date", new arrow.DateMillisecond(), true),
      ]);

      const emptyVectors = arrowSchema.fields.map((field) =>
        arrow.vectorFromArray([], field.type)
      );
      const data = arrow.makeData({
        type: new arrow.Struct(arrowSchema.fields),
        length: 0,
        nullCount: 0,
        children: emptyVectors.map((v) => v.data[0]),
      });
      const recordBatch = new arrow.RecordBatch(arrowSchema, data);
      const table = new arrow.Table([recordBatch]);

      const datasetSchema = arrowTableSchemaToDatasetSchema(table);

      expect(datasetSchema.fields[0].type).toBe("string");
      expect(datasetSchema.fields[1].type).toBe("number");
      expect(datasetSchema.fields[2].type).toBe("boolean");
      expect(datasetSchema.fields[3].type).toBe("date");
    });
  });

  describe("datasetToArrow", () => {
    describe("basic conversion", () => {
      it("should convert simple dataset to Arrow Table", () => {
        const dataset: ParsedDataset = {
          id: "test-1",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "name", type: "string" },
            ],
          },
          data: [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
          ],
        };

        const { table, warnings } = datasetToArrow(dataset);

        expect(table.numRows).toBe(2);
        expect(table.numCols).toBe(2);
        expect(warnings).toHaveLength(0);
      });

      it("should preserve data values", () => {
        const dataset: ParsedDataset = {
          id: "test-2",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "value", type: "string" },
            ],
          },
          data: [
            { id: 100, value: "test" },
            { id: 200, value: "data" },
          ],
        };

        const { table } = datasetToArrow(dataset);

        const idColumn = table.getChildAt(0);
        const valueColumn = table.getChildAt(1);

        expect(idColumn?.get(0)).toBe(100);
        expect(idColumn?.get(1)).toBe(200);
        expect(valueColumn?.get(0)).toBe("test");
        expect(valueColumn?.get(1)).toBe("data");
      });

      it("should handle all data types", () => {
        const testDate = new Date("2024-01-15");
        const dataset: ParsedDataset = {
          id: "test-3",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "str", type: "string" },
              { name: "num", type: "number" },
              { name: "bool", type: "boolean" },
              { name: "date", type: "date" },
            ],
          },
          data: [
            { str: "hello", num: 42, bool: true, date: testDate },
            { str: "world", num: 99, bool: false, date: testDate },
          ],
        };

        const { table, warnings } = datasetToArrow(dataset);

        expect(table.numRows).toBe(2);
        expect(table.numCols).toBe(4);
        expect(warnings).toHaveLength(0);

        const strCol = table.getChildAt(0);
        const numCol = table.getChildAt(1);
        const boolCol = table.getChildAt(2);
        const dateCol = table.getChildAt(3);

        expect(strCol?.get(0)).toBe("hello");
        expect(numCol?.get(0)).toBe(42);
        expect(boolCol?.get(0)).toBe(true);
        expect(dateCol?.get(0)).toBe(testDate.getTime());
      });
    });

    describe("empty dataset handling", () => {
      it("should handle empty dataset", () => {
        const dataset: ParsedDataset = {
          id: "empty-1",
          name: "empty-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "name", type: "string" },
            ],
          },
          data: [],
        };

        const { table, warnings } = datasetToArrow(dataset);

        expect(table.numRows).toBe(0);
        expect(table.numCols).toBe(2);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("empty");
      });

      it("should preserve schema for empty dataset", () => {
        const dataset: ParsedDataset = {
          id: "empty-2",
          name: "empty-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number", nullable: false },
              { name: "name", type: "string", nullable: true },
            ],
          },
          data: [],
        };

        const { table } = datasetToArrow(dataset);

        expect(table.schema.fields[0].name).toBe("id");
        expect(table.schema.fields[0].nullable).toBe(false);
        expect(table.schema.fields[1].name).toBe("name");
        expect(table.schema.fields[1].nullable).toBe(true);
      });
    });

    describe("null handling", () => {
      it("should handle null values", () => {
        const dataset: ParsedDataset = {
          id: "null-1",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "value", type: "string", nullable: true },
            ],
          },
          data: [
            { id: 1, value: "test" },
            { id: 2, value: null },
            { id: 3, value: undefined },
          ],
        };

        const { table, warnings } = datasetToArrow(dataset);

        expect(table.numRows).toBe(3);
        expect(warnings).toHaveLength(0);

        const valueColumn = table.getChildAt(1);
        expect(valueColumn?.get(0)).toBe("test");
        expect(valueColumn?.get(1)).toBeNull();
        expect(valueColumn?.get(2)).toBeNull();
      });

      it("should handle all null column", () => {
        const dataset: ParsedDataset = {
          id: "null-2",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "nullable", type: "string", nullable: true },
            ],
          },
          data: [
            { id: 1, nullable: null },
            { id: 2, nullable: null },
          ],
        };

        const { table } = datasetToArrow(dataset);

        const nullableColumn = table.getChildAt(1);
        expect(nullableColumn?.get(0)).toBeNull();
        expect(nullableColumn?.get(1)).toBeNull();
      });
    });

    describe("type coercion", () => {
      it("should coerce string to number", () => {
        const dataset: ParsedDataset = {
          id: "coerce-1",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [{ name: "value", type: "number" }],
          },
          data: [{ value: "42" }, { value: "99.5" }],
        };

        const { table } = datasetToArrow(dataset);

        const valueColumn = table.getChildAt(0);
        expect(valueColumn?.get(0)).toBe(42);
        expect(valueColumn?.get(1)).toBe(99.5);
      });

      it("should coerce string to boolean", () => {
        const dataset: ParsedDataset = {
          id: "coerce-2",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [{ name: "active", type: "boolean" }],
          },
          data: [
            { active: "true" },
            { active: "false" },
            { active: "1" },
            { active: "0" },
          ],
        };

        const { table } = datasetToArrow(dataset);

        const activeColumn = table.getChildAt(0);
        expect(activeColumn?.get(0)).toBe(true);
        expect(activeColumn?.get(1)).toBe(false);
        expect(activeColumn?.get(2)).toBe(true);
        expect(activeColumn?.get(3)).toBe(false);
      });

      it("should coerce string to date", () => {
        const dataset: ParsedDataset = {
          id: "coerce-3",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [{ name: "timestamp", type: "date" }],
          },
          data: [{ timestamp: "2024-01-15" }, { timestamp: "2024-02-20" }],
        };

        const { table } = datasetToArrow(dataset);

        const timestampColumn = table.getChildAt(0);
        const date1 = new Date("2024-01-15").getTime();
        const date2 = new Date("2024-02-20").getTime();

        expect(timestampColumn?.get(0)).toBe(date1);
        expect(timestampColumn?.get(1)).toBe(date2);
      });

      it("should handle failed coercion", () => {
        const dataset: ParsedDataset = {
          id: "coerce-4",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [{ name: "value", type: "number" }],
          },
          data: [{ value: "not-a-number" }, { value: "invalid" }],
        };

        const { table } = datasetToArrow(dataset);

        const valueColumn = table.getChildAt(0);
        expect(valueColumn?.get(0)).toBeNull();
        expect(valueColumn?.get(1)).toBeNull();
      });
    });

    describe("missing fields", () => {
      it("should warn about missing fields in data", () => {
        const dataset: ParsedDataset = {
          id: "missing-1",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "name", type: "string" },
              { name: "email", type: "string" },
            ],
          },
          data: [
            { id: 1, name: "Alice" }, // email missing
            { id: 2, name: "Bob" }, // email missing
          ],
        };

        const { warnings } = datasetToArrow(dataset);

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("missing");
        expect(warnings[0]).toContain("email");
      });

      it("should fill missing fields with null", () => {
        const dataset: ParsedDataset = {
          id: "missing-2",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "optional", type: "string" },
            ],
          },
          data: [
            { id: 1, optional: "value" },
            { id: 2 }, // optional missing
          ],
        };

        const { table } = datasetToArrow(dataset);

        const optionalColumn = table.getChildAt(1);
        expect(optionalColumn?.get(0)).toBe("value");
        expect(optionalColumn?.get(1)).toBeNull();
      });
    });

    describe("error handling", () => {
      it("should throw error for invalid dataset (no schema)", () => {
        const dataset = {
          id: "invalid-1",
          name: "test-dataset",
          sourceType: "json" as const,
          createdAt: new Date(),
          data: [{ id: 1 }],
        } as unknown as ParsedDataset;

        expect(() => datasetToArrow(dataset)).toThrow("schema");
      });

      it("should throw error for invalid dataset (no data array)", () => {
        const dataset = {
          id: "invalid-2",
          name: "test-dataset",
          sourceType: "json" as const,
          createdAt: new Date(),
          schema: { fields: [{ name: "id", type: "number" as const }] },
          data: null as unknown as Record<string, unknown>[],
        };

        expect(() => datasetToArrow(dataset)).toThrow();
      });

      it("should throw error for empty schema", () => {
        const dataset: ParsedDataset = {
          id: "invalid-3",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: { fields: [] },
          data: [{ id: 1 }],
        };

        expect(() => datasetToArrow(dataset)).toThrow();
      });
    });

    describe("options", () => {
      it("should respect date format option", () => {
        const dataset: ParsedDataset = {
          id: "options-1",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [{ name: "timestamp", type: "date" }],
          },
          data: [{ timestamp: new Date("2024-01-15") }],
        };

        const { table } = datasetToArrow(dataset, {
          dateFormat: "microsecond",
        });

        expect(table.schema.fields[0].type).toBeInstanceOf(
          arrow.TimestampMicrosecond
        );
      });
    });
  });

  describe("arrowToDataset", () => {
    describe("basic conversion", () => {
      it("should convert Arrow Table to ParsedDataset", () => {
        const dataset: ParsedDataset = {
          id: "test-1",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "name", type: "string" },
            ],
          },
          data: [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
          ],
        };

        const { table } = datasetToArrow(dataset);
        const converted = arrowToDataset(table);

        expect(converted.data).toHaveLength(2);
        expect(converted.schema.fields).toHaveLength(2);
        expect(converted.id).toBeDefined();
        expect(converted.name).toBeDefined();
        expect(converted.sourceType).toBe("json");
        expect(converted.createdAt).toBeInstanceOf(Date);
      });

      it("should preserve data values", () => {
        const dataset: ParsedDataset = {
          id: "test-2",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "value", type: "string" },
            ],
          },
          data: [
            { id: 100, value: "test" },
            { id: 200, value: "data" },
          ],
        };

        const { table } = datasetToArrow(dataset);
        const converted = arrowToDataset(table);

        expect(converted.data[0].id).toBe(100);
        expect(converted.data[0].value).toBe("test");
        expect(converted.data[1].id).toBe(200);
        expect(converted.data[1].value).toBe("data");
      });

      it("should handle all data types", () => {
        const testDate = new Date("2024-01-15");
        const dataset: ParsedDataset = {
          id: "test-3",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "str", type: "string" },
              { name: "num", type: "number" },
              { name: "bool", type: "boolean" },
              { name: "date", type: "date" },
            ],
          },
          data: [{ str: "hello", num: 42, bool: true, date: testDate }],
        };

        const { table } = datasetToArrow(dataset);
        const converted = arrowToDataset(table);

        expect(converted.data[0].str).toBe("hello");
        expect(converted.data[0].num).toBe(42);
        expect(converted.data[0].bool).toBe(true);
        expect(converted.data[0].date).toBeInstanceOf(Date);
        expect((converted.data[0].date as Date).getTime()).toBe(
          testDate.getTime()
        );
      });
    });

    describe("null handling", () => {
      it("should preserve null values", () => {
        const dataset: ParsedDataset = {
          id: "null-1",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "nullable", type: "string", nullable: true },
            ],
          },
          data: [
            { id: 1, nullable: "value" },
            { id: 2, nullable: null },
          ],
        };

        const { table } = datasetToArrow(dataset);
        const converted = arrowToDataset(table);

        expect(converted.data[0].nullable).toBe("value");
        expect(converted.data[1].nullable).toBeNull();
      });
    });

    describe("empty table", () => {
      it("should handle empty Arrow Table", () => {
        const dataset: ParsedDataset = {
          id: "empty-1",
          name: "empty-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "name", type: "string" },
            ],
          },
          data: [],
        };

        const { table } = datasetToArrow(dataset);
        const converted = arrowToDataset(table);

        expect(converted.data).toHaveLength(0);
        expect(converted.schema.fields).toHaveLength(2);
      });
    });
  });

  describe("round-trip conversion", () => {
    it("should preserve data through round-trip conversion", () => {
      const original: ParsedDataset = {
        id: "round-trip-1",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [
            { name: "id", type: "number" },
            { name: "name", type: "string" },
            { name: "active", type: "boolean" },
          ],
        },
        data: [
          { id: 1, name: "Alice", active: true },
          { id: 2, name: "Bob", active: false },
          { id: 3, name: "Carol", active: true },
        ],
      };

      const { table } = datasetToArrow(original);
      const converted = arrowToDataset(table);

      expect(converted.data).toHaveLength(3);
      expect(converted.data[0]).toEqual(original.data[0]);
      expect(converted.data[1]).toEqual(original.data[1]);
      expect(converted.data[2]).toEqual(original.data[2]);
    });

    it("should preserve schema through round-trip", () => {
      const original: ParsedDataset = {
        id: "round-trip-2",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [
            { name: "id", type: "number", nullable: false },
            { name: "value", type: "string", nullable: true },
          ],
        },
        data: [{ id: 1, value: "test" }],
      };

      const { table } = datasetToArrow(original);
      const converted = arrowToDataset(table);

      expect(converted.schema.fields).toHaveLength(2);
      expect(converted.schema.fields[0].type).toBe("number");
      expect(converted.schema.fields[0].nullable).toBe(false);
      expect(converted.schema.fields[1].type).toBe("string");
      expect(converted.schema.fields[1].nullable).toBe(true);
    });

    it("should handle null values in round-trip", () => {
      const original: ParsedDataset = {
        id: "round-trip-3",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [
            { name: "id", type: "number" },
            { name: "optional", type: "string", nullable: true },
          ],
        },
        data: [
          { id: 1, optional: "value" },
          { id: 2, optional: null },
          { id: 3, optional: undefined },
        ],
      };

      const { table } = datasetToArrow(original);
      const converted = arrowToDataset(table);

      expect(converted.data[0].optional).toBe("value");
      expect(converted.data[1].optional).toBeNull();
      expect(converted.data[2].optional).toBeNull();
    });

    it("should preserve dates through round-trip", () => {
      const testDate = new Date("2024-01-15T10:30:00.000Z");
      const original: ParsedDataset = {
        id: "round-trip-4",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [
            { name: "id", type: "number" },
            { name: "timestamp", type: "date" },
          ],
        },
        data: [
          { id: 1, timestamp: testDate },
          { id: 2, timestamp: new Date("2024-02-20") },
        ],
      };

      const { table } = datasetToArrow(original);
      const converted = arrowToDataset(table);

      expect(converted.data[0].timestamp).toBeInstanceOf(Date);
      expect((converted.data[0].timestamp as Date).getTime()).toBe(
        testDate.getTime()
      );
    });

    it("should handle large dataset round-trip", () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User${i}`,
        score: Math.random() * 100,
        active: i % 2 === 0,
      }));

      const original: ParsedDataset = {
        id: "round-trip-5",
        name: "large-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [
            { name: "id", type: "number" },
            { name: "name", type: "string" },
            { name: "score", type: "number" },
            { name: "active", type: "boolean" },
          ],
        },
        data: largeData,
      };

      const { table } = datasetToArrow(original);
      const converted = arrowToDataset(table);

      expect(converted.data).toHaveLength(1000);
      expect(converted.data[0].id).toBe(0);
      expect(converted.data[999].id).toBe(999);
    });
  });
});
