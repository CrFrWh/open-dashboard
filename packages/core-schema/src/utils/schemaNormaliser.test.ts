import { describe, it, expect, vi } from "vitest";
import {
  normalizeSchema,
  sanitizeFieldName,
  validateForArrowConversion,
} from "./schemaNormaliser";
import type { DatasetSchema, DataField } from "@open-dashboard/shared/types";

describe("schemaNormaliser", () => {
  describe("sanitizeFieldName", () => {
    describe("basic sanitization", () => {
      it("should replace spaces with underscores", () => {
        expect(sanitizeFieldName("first name")).toBe("first_name");
        expect(sanitizeFieldName("full   name   here")).toBe("full_name_here");
      });

      it("should remove special characters except underscore", () => {
        expect(sanitizeFieldName("name@domain")).toBe("namedomain");
        expect(sanitizeFieldName("price$USD")).toBe("priceUSD");
        expect(sanitizeFieldName("field#1")).toBe("field1");
        expect(sanitizeFieldName("data!@#$%^&*()")).toBe("data");
      });

      it("should preserve underscores", () => {
        expect(sanitizeFieldName("first_name")).toBe("first_name");
        expect(sanitizeFieldName("_private_field")).toBe("_private_field");
        expect(sanitizeFieldName("field_1_test")).toBe("field_1_test");
      });

      it("should preserve alphanumeric characters", () => {
        expect(sanitizeFieldName("Field123")).toBe("Field123");
        expect(sanitizeFieldName("data2023Q1")).toBe("data2023Q1");
      });

      it("should trim whitespace", () => {
        expect(sanitizeFieldName("  field  ")).toBe("field");
        expect(sanitizeFieldName("\tfield\n")).toBe("field");
      });
    });

    describe("name starting rules", () => {
      it("should ensure name starts with letter", () => {
        const result = sanitizeFieldName("validName");
        expect(/^[a-zA-Z_]/.test(result)).toBe(true);
      });

      it("should prepend underscore if starts with number", () => {
        expect(sanitizeFieldName("123field")).toBe("_123field");
        expect(sanitizeFieldName("42answer")).toBe("_42answer");
      });

      it("should allow name starting with underscore", () => {
        expect(sanitizeFieldName("_field")).toBe("_field");
        expect(sanitizeFieldName("__private")).toBe("__private");
      });

      it("should handle name that becomes empty after sanitization", () => {
        expect(sanitizeFieldName("@#$%")).toBe("unnamed_field");
        expect(sanitizeFieldName("!!!")).toBe("unnamed_field");
        expect(sanitizeFieldName("   ")).toBe("unnamed_field");
      });
    });

    describe("unicode and special cases", () => {
      it("should remove unicode characters", () => {
        expect(sanitizeFieldName("name™")).toBe("name");
        expect(sanitizeFieldName("data€")).toBe("data");
        expect(sanitizeFieldName("field→value")).toBe("fieldvalue");
      });

      it("should handle emoji", () => {
        expect(sanitizeFieldName("field🚀name")).toBe("fieldname");
        expect(sanitizeFieldName("data✨")).toBe("data");
      });

      it("should handle mixed case", () => {
        expect(sanitizeFieldName("FirstName")).toBe("FirstName");
        expect(sanitizeFieldName("camelCase")).toBe("camelCase");
        expect(sanitizeFieldName("UPPER_CASE")).toBe("UPPER_CASE");
      });
    });

    describe("empty and edge cases", () => {
      it("should handle empty string", () => {
        expect(sanitizeFieldName("")).toBe("unnamed_field");
      });

      it("should handle whitespace-only string", () => {
        expect(sanitizeFieldName("   ")).toBe("unnamed_field");
        expect(sanitizeFieldName("\t\n")).toBe("unnamed_field");
      });

      it("should handle single character names", () => {
        expect(sanitizeFieldName("a")).toBe("a");
        expect(sanitizeFieldName("Z")).toBe("Z");
        expect(sanitizeFieldName("_")).toBe("_");
      });
    });
  });

  describe("normalizeSchema", () => {
    describe("basic normalization", () => {
      it("should normalize valid schema", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "name", type: "string" },
            { name: "age", type: "number" },
          ],
        };

        const result = normalizeSchema(schema);

        expect(result.fields).toHaveLength(2);
        expect(result.fields[0]).toEqual({
          name: "name",
          type: "string",
          nullable: true,
        });
        expect(result.fields[1]).toEqual({
          name: "age",
          type: "number",
          nullable: true,
        });
      });

      it("should preserve nullable property when provided", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "required_field", type: "string", nullable: false },
            { name: "optional_field", type: "string", nullable: true },
          ],
        };

        const result = normalizeSchema(schema);

        expect(result.fields[0].nullable).toBe(false);
        expect(result.fields[1].nullable).toBe(true);
      });

      it("should default nullable to true when not provided", () => {
        const schema: DatasetSchema = {
          fields: [{ name: "field", type: "string" }],
        };

        const result = normalizeSchema(schema);

        expect(result.fields[0].nullable).toBe(true);
      });

      it("should preserve metadata", () => {
        const schema: DatasetSchema = {
          fields: [
            {
              name: "field",
              type: "string",
              metadata: { description: "Test field", unit: "meters" },
            },
          ],
        };

        const result = normalizeSchema(schema);

        expect(result.fields[0].metadata).toEqual({
          description: "Test field",
          unit: "meters",
        });
      });
    });

    describe("field name sanitization", () => {
      it("should sanitize field names with spaces", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "first name", type: "string" },
            { name: "last name", type: "string" },
          ],
        };

        const result = normalizeSchema(schema);

        expect(result.fields[0].name).toBe("first_name");
        expect(result.fields[1].name).toBe("last_name");
      });

      it("should sanitize field names with special characters", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "price$USD", type: "number" },
            { name: "email@domain", type: "string" },
          ],
        };

        const result = normalizeSchema(schema);

        expect(result.fields[0].name).toBe("priceUSD");
        expect(result.fields[1].name).toBe("emaildomain");
      });

      it("should handle field names starting with numbers", () => {
        const schema: DatasetSchema = {
          fields: [{ name: "123field", type: "string" }],
        };

        const result = normalizeSchema(schema);

        expect(result.fields[0].name).toBe("_123field");
      });
    });

    describe("duplicate field handling", () => {
      it("should remove duplicate field names (keep first)", () => {
        const consoleWarnSpy = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        const schema: DatasetSchema = {
          fields: [
            { name: "name", type: "string" },
            { name: "name", type: "number" }, // Duplicate
            { name: "age", type: "number" },
          ],
        };

        const result = normalizeSchema(schema);

        expect(result.fields).toHaveLength(2);
        expect(result.fields[0].name).toBe("name");
        expect(result.fields[0].type).toBe("string"); // First occurrence kept
        expect(result.fields[1].name).toBe("age");

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Duplicate field name detected: "name"')
        );

        consoleWarnSpy.mockRestore();
      });

      it("should detect duplicates after sanitization", () => {
        const consoleWarnSpy = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        const schema: DatasetSchema = {
          fields: [
            { name: "first name", type: "string" },
            { name: "first_name", type: "number" }, // Becomes duplicate after sanitization
          ],
        };

        const result = normalizeSchema(schema);

        expect(result.fields).toHaveLength(1);
        expect(result.fields[0].name).toBe("first_name");
        expect(result.fields[0].type).toBe("string");

        expect(consoleWarnSpy).toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
      });

      it("should handle multiple duplicates", () => {
        const consoleWarnSpy = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        const schema: DatasetSchema = {
          fields: [
            { name: "field", type: "string" },
            { name: "field", type: "number" },
            { name: "field", type: "boolean" },
            { name: "other", type: "string" },
          ],
        };

        const result = normalizeSchema(schema);

        expect(result.fields).toHaveLength(2);
        expect(result.fields[0].name).toBe("field");
        expect(result.fields[1].name).toBe("other");

        expect(consoleWarnSpy).toHaveBeenCalledTimes(2);

        consoleWarnSpy.mockRestore();
      });
    });

    describe("type validation", () => {
      it("should accept all valid types", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "str", type: "string" },
            { name: "num", type: "number" },
            { name: "date", type: "date" },
            { name: "bool", type: "boolean" },
            { name: "cat", type: "categorical" },
          ],
        };

        const result = normalizeSchema(schema);

        expect(result.fields).toHaveLength(5);
      });

      it("should throw error for invalid type", () => {
        const schema = {
          fields: [
            { name: "field", type: "invalid_type" } as unknown as DataField,
          ],
        } as DatasetSchema;

        expect(() => normalizeSchema(schema)).toThrow(
          "Invalid field type: invalid_type for field field"
        );
      });

      it("should throw error for missing type", () => {
        const schema = {
          fields: [{ name: "field" } as DataField],
        } as DatasetSchema;

        expect(() => normalizeSchema(schema)).toThrow();
      });
    });

    describe("error handling", () => {
      it("should throw error for empty schema", () => {
        const schema: DatasetSchema = { fields: [] };

        expect(() => normalizeSchema(schema)).toThrow(
          "Schema must have at least one field"
        );
      });

      it("should throw error for missing fields array", () => {
        const schema = {} as DatasetSchema;

        expect(() => normalizeSchema(schema)).toThrow(
          "Schema must have at least one field"
        );
      });

      it("should throw error for empty field name", () => {
        const schema: DatasetSchema = {
          fields: [{ name: "", type: "string" }],
        };

        expect(() => normalizeSchema(schema)).toThrow(
          "Field name cannot be empty"
        );
      });

      it("should throw error for whitespace-only field name", () => {
        const schema: DatasetSchema = {
          fields: [{ name: "   ", type: "string" }],
        };

        expect(() => normalizeSchema(schema)).toThrow(
          "Field name cannot be empty"
        );
      });

      it("should throw error for null field name", () => {
        const schema = {
          fields: [{ name: null, type: "string" } as unknown as DataField],
        } as DatasetSchema;

        expect(() => normalizeSchema(schema)).toThrow(
          "Field name cannot be empty"
        );
      });
    });

    describe("complex schemas", () => {
      it("should handle large schemas", () => {
        const fields: DataField[] = Array.from({ length: 100 }, (_, i) => ({
          name: `field_${i}`,
          type: "string" as const,
        }));

        const schema: DatasetSchema = { fields };
        const result = normalizeSchema(schema);

        expect(result.fields).toHaveLength(100);
      });

      it("should handle schema with mixed metadata", () => {
        const schema: DatasetSchema = {
          fields: [
            {
              name: "with_metadata",
              type: "string",
              metadata: { key: "value" },
            },
            { name: "without_metadata", type: "number" },
            {
              name: "complex_metadata",
              type: "date",
              metadata: { key1: "value1", key2: "value2" },
            },
          ],
        };

        const result = normalizeSchema(schema);

        expect(result.fields[0].metadata).toEqual({ key: "value" });
        expect(result.fields[1].metadata).toBeUndefined();
        expect(result.fields[2].metadata).toEqual({
          key1: "value1",
          key2: "value2",
        });
      });
    });
  });

  describe("validateForArrowConversion", () => {
    describe("valid schemas", () => {
      it("should validate correct schema", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "name", type: "string" },
            { name: "age", type: "number" },
          ],
        };

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
      });

      it("should validate all valid types", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "str", type: "string" },
            { name: "num", type: "number" },
            { name: "date", type: "date" },
            { name: "bool", type: "boolean" },
            { name: "cat", type: "categorical" },
          ],
        };

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it("should validate schema with nullable fields", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "required", type: "string", nullable: false },
            { name: "optional", type: "string", nullable: true },
          ],
        };

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(true);
      });
    });

    describe("invalid schemas", () => {
      it("should detect empty schema", () => {
        const schema: DatasetSchema = { fields: [] };

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Schema has no fields");
      });

      it("should detect missing fields array", () => {
        const schema = {} as DatasetSchema;

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Schema has no fields");
      });

      it("should detect empty field names", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "", type: "string" },
            { name: "valid", type: "number" },
          ],
        };

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Field has empty name");
      });

      it("should detect whitespace-only field names", () => {
        const schema: DatasetSchema = {
          fields: [{ name: "   ", type: "string" }],
        };

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Field has empty name");
      });

      it("should detect invalid types", () => {
        const schema = {
          fields: [
            { name: "field1", type: "invalid" } as unknown as DataField,
            { name: "field2", type: "string" },
          ],
        } as DatasetSchema;

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          "Invalid type 'invalid' for field 'field1'"
        );
      });

      it("should detect multiple errors", () => {
        const schema = {
          fields: [
            { name: "", type: "string" },
            { name: "field", type: "invalid" } as unknown as DataField,
          ],
        } as DatasetSchema;

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });

    describe("warnings", () => {
      it("should warn about duplicate field names", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "name", type: "string" },
            { name: "name", type: "number" },
            { name: "age", type: "number" },
          ],
        };

        const result = validateForArrowConversion(schema);

        expect(result.warnings).toContain("Duplicate field name: name");
        // Schema is still considered valid (normalizeSchema will handle duplicates)
        expect(result.valid).toBe(true);
      });

      it("should warn about multiple duplicates", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "field1", type: "string" },
            { name: "field1", type: "number" },
            { name: "field2", type: "string" },
            { name: "field2", type: "boolean" },
          ],
        };

        const result = validateForArrowConversion(schema);

        expect(result.warnings).toContain("Duplicate field name: field1");
        expect(result.warnings).toContain("Duplicate field name: field2");
        expect(result.warnings).toHaveLength(2);
      });

      it("should return warnings with valid=true if only warnings exist", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "name", type: "string" },
            { name: "name", type: "string" },
          ],
        };

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });

    describe("combined errors and warnings", () => {
      it("should return both errors and warnings", () => {
        const schema = {
          fields: [
            { name: "field", type: "invalid" } as unknown as DataField,
            { name: "duplicate", type: "string" },
            { name: "duplicate", type: "number" },
          ],
        } as DatasetSchema;

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it("should set valid=false if any errors exist, regardless of warnings", () => {
        const schema = {
          fields: [
            { name: "", type: "string" },
            { name: "duplicate", type: "string" },
            { name: "duplicate", type: "number" },
          ],
        } as DatasetSchema;

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });

    describe("edge cases", () => {
      it("should handle schema with metadata", () => {
        const schema: DatasetSchema = {
          fields: [
            {
              name: "field",
              type: "string",
              metadata: { description: "Test" },
            },
          ],
        };

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(true);
      });

      it("should handle large schemas efficiently", () => {
        const fields: DataField[] = Array.from({ length: 1000 }, (_, i) => ({
          name: `field_${i}`,
          type: "string" as const,
        }));

        const schema: DatasetSchema = { fields };
        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it("should handle complex field names", () => {
        const schema: DatasetSchema = {
          fields: [
            { name: "field_with_underscores", type: "string" },
            { name: "fieldWithCamelCase", type: "number" },
            { name: "FIELD_UPPER", type: "boolean" },
          ],
        };

        const result = validateForArrowConversion(schema);

        expect(result.valid).toBe(true);
      });
    });
  });
});
