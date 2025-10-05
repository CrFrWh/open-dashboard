import { describe, it, expect } from "vitest";
import {
  buildSchemaFromData,
  validateSchema,
  mergeSchemas,
  getSchemaWarnings,
} from "./schemaBuilder";
import type { DatasetSchema } from "@open-dashboard/shared/types";

describe("buildSchemaFromData", () => {
  describe("basic functionality", () => {
    it("should build schema from simple data", () => {
      const data = [
        { name: "Alice", age: 30, active: true },
        { name: "Bob", age: 25, active: false },
      ];
      const fieldNames = ["name", "age", "active"];

      const schema = buildSchemaFromData(data, fieldNames);

      expect(schema.fields).toHaveLength(3);
      expect(schema.fields.map((f) => f.name)).toEqual([
        "name",
        "age",
        "active",
      ]);
    });

    it("should infer correct types for each field", () => {
      const data = [
        { name: "Alice", age: 30, salary: 95000, hire_date: "2024-01-15" },
        { name: "Bob", age: 25, salary: 80000, hire_date: "2024-02-20" },
      ];
      const fieldNames = ["name", "age", "salary", "hire_date"];

      const schema = buildSchemaFromData(data, fieldNames);

      const nameField = schema.fields.find((f) => f.name === "name");
      const ageField = schema.fields.find((f) => f.name === "age");
      const salaryField = schema.fields.find((f) => f.name === "salary");
      const dateField = schema.fields.find((f) => f.name === "hire_date");

      expect(nameField?.type).toBe("string");
      expect(ageField?.type).toBe("number");
      expect(salaryField?.type).toBe("number");
      expect(dateField?.type).toBe("date");
    });

    it("should include metadata for each field", () => {
      const data = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ];
      const fieldNames = ["name", "age"];

      const schema = buildSchemaFromData(data, fieldNames);

      schema.fields.forEach((field) => {
        expect(field.metadata).toBeDefined();
        expect(field.metadata?.confidence).toBeDefined();
        expect(field.metadata?.sampleSize).toBeDefined();
        expect(typeof field.metadata?.confidence).toBe("number");
        expect(typeof field.metadata?.sampleSize).toBe("number");
      });
    });

    it("should set nullable flag correctly", () => {
      const data = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: null },
        { name: "Carol", age: 35 },
      ];
      const fieldNames = ["name", "age"];

      const schema = buildSchemaFromData(data, fieldNames);

      const nameField = schema.fields.find((f) => f.name === "name");
      const ageField = schema.fields.find((f) => f.name === "age");

      expect(nameField?.nullable).toBe(false);
      expect(ageField?.nullable).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should return empty schema for empty data", () => {
      const data: Record<string, unknown>[] = [];
      const fieldNames: string[] = [];

      const schema = buildSchemaFromData(data, fieldNames);

      expect(schema.fields).toEqual([]);
    });

    it("should return empty schema for empty field names", () => {
      const data = [{ name: "Alice", age: 30 }];
      const fieldNames: string[] = [];

      const schema = buildSchemaFromData(data, fieldNames);

      expect(schema.fields).toEqual([]);
    });

    it("should handle missing values in data", () => {
      const data = [
        { name: "Alice", age: 30 },
        { name: "Bob" }, // age is missing
        { name: "Carol", age: 35 },
      ];
      const fieldNames = ["name", "age"];

      const schema = buildSchemaFromData(data, fieldNames);

      expect(schema.fields).toHaveLength(2);
      const ageField = schema.fields.find((f) => f.name === "age");
      expect(ageField?.nullable).toBe(true);
    });

    it("should handle undefined values", () => {
      const data = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: undefined },
        { name: "Carol", age: 35 },
      ];
      const fieldNames = ["name", "age"];

      const schema = buildSchemaFromData(data, fieldNames);

      const ageField = schema.fields.find((f) => f.name === "age");
      expect(ageField?.nullable).toBe(true);
    });

    it("should handle single row dataset", () => {
      const data = [{ name: "Alice", age: 30 }];
      const fieldNames = ["name", "age"];

      const schema = buildSchemaFromData(data, fieldNames);

      expect(schema.fields).toHaveLength(2);
      expect(schema.fields.every((f) => f.name && f.type)).toBe(true);
    });

    it("should handle fields with all null values", () => {
      const data = [
        { name: "Alice", age: null },
        { name: "Bob", age: null },
      ];
      const fieldNames = ["name", "age"];

      const schema = buildSchemaFromData(data, fieldNames);

      const ageField = schema.fields.find((f) => f.name === "age");
      expect(ageField?.nullable).toBe(true);
      expect(ageField?.type).toBeDefined();
    });
  });

  describe("sampleSize option", () => {
    it("should respect custom sample size", () => {
      const data = Array.from({ length: 200 }, (_, i) => ({
        id: i,
        name: `Person${i}`,
      }));
      const fieldNames = ["id", "name"];

      const schema = buildSchemaFromData(data, fieldNames, 50);

      schema.fields.forEach((field) => {
        expect(field.metadata?.sampleSize).toBeLessThanOrEqual(50);
      });
    });

    it("should use default sample size of 100", () => {
      const data = Array.from({ length: 200 }, (_, i) => ({
        id: i,
      }));
      const fieldNames = ["id"];

      const schema = buildSchemaFromData(data, fieldNames);

      const field = schema.fields[0];
      expect(field.metadata?.sampleSize).toBe(100);
    });

    it("should use actual data length if smaller than sample size", () => {
      const data = [{ name: "Alice" }, { name: "Bob" }, { name: "Carol" }];
      const fieldNames = ["name"];

      const schema = buildSchemaFromData(data, fieldNames, 100);

      const field = schema.fields[0];
      expect(field.metadata?.sampleSize).toBe(3);
    });
  });

  describe("type inference integration", () => {
    it("should infer boolean type", () => {
      const data = [{ active: true }, { active: false }, { active: true }];
      const fieldNames = ["active"];

      const schema = buildSchemaFromData(data, fieldNames);

      expect(schema.fields[0].type).toBe("boolean");
    });

    it("should infer date type from ISO strings", () => {
      const data = [
        { date: "2024-01-15" },
        { date: "2024-02-20" },
        { date: "2024-03-10" },
      ];
      const fieldNames = ["date"];

      const schema = buildSchemaFromData(data, fieldNames);

      expect(schema.fields[0].type).toBe("date");
    });

    it("should infer categorical type for limited unique values", () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        status: ["active", "inactive", "pending"][i % 3],
      }));
      const fieldNames = ["status"];

      const schema = buildSchemaFromData(data, fieldNames);

      const field = schema.fields[0];
      expect(["string", "categorical"]).toContain(field.type);
    });

    it("should handle mixed types and default appropriately", () => {
      const data = [{ value: 100 }, { value: "text" }, { value: 200 }];
      const fieldNames = ["value"];

      const schema = buildSchemaFromData(data, fieldNames);

      expect(schema.fields[0].type).toBeDefined();
    });
  });

  describe("metadata", () => {
    it("should include unique value count in metadata", () => {
      const data = [
        { status: "active" },
        { status: "inactive" },
        { status: "active" },
        { status: "pending" },
      ];
      const fieldNames = ["status"];

      const schema = buildSchemaFromData(data, fieldNames);

      const field = schema.fields[0];
      expect(field.metadata?.uniqueValueCount).toBeDefined();
    });

    it("should include warnings in metadata when present", () => {
      const data = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ];
      const fieldNames = ["name", "age"];

      const schema = buildSchemaFromData(data, fieldNames);

      schema.fields.forEach((field) => {
        // Warnings array should exist (even if empty)
        expect(field.metadata).toBeDefined();
      });
    });

    it("should have confidence value between 0 and 1", () => {
      const data = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ];
      const fieldNames = ["name", "age"];

      const schema = buildSchemaFromData(data, fieldNames);

      schema.fields.forEach((field) => {
        expect(field.metadata?.confidence).toBeGreaterThanOrEqual(0);
        expect(field.metadata?.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});

describe("validateSchema", () => {
  describe("valid schemas", () => {
    it("should validate a well-formed schema", () => {
      const schema: DatasetSchema = {
        fields: [
          { name: "name", type: "string", nullable: false },
          { name: "age", type: "number", nullable: false },
        ],
      };

      expect(validateSchema(schema)).toBe(true);
    });

    it("should validate schema with all supported types", () => {
      const schema: DatasetSchema = {
        fields: [
          { name: "text", type: "string" },
          { name: "count", type: "number" },
          { name: "date", type: "date" },
          { name: "flag", type: "boolean" },
          { name: "category", type: "categorical" },
        ],
      };

      expect(validateSchema(schema)).toBe(true);
    });

    it("should validate schema with metadata", () => {
      const schema: DatasetSchema = {
        fields: [
          {
            name: "name",
            type: "string",
            nullable: false,
            metadata: { confidence: 1.0, sampleSize: 100 },
          },
        ],
      };

      expect(validateSchema(schema)).toBe(true);
    });

    it("should validate schema with nullable fields", () => {
      const schema: DatasetSchema = {
        fields: [
          { name: "name", type: "string", nullable: true },
          { name: "age", type: "number", nullable: true },
        ],
      };

      expect(validateSchema(schema)).toBe(true);
    });
  });

  describe("invalid schemas", () => {
    it("should reject schema with no fields", () => {
      const schema: DatasetSchema = {
        fields: [],
      };

      expect(validateSchema(schema)).toBe(false);
    });

    it("should reject schema with undefined fields", () => {
      const schema = {
        fields: undefined,
      } as unknown as DatasetSchema;

      expect(validateSchema(schema)).toBe(false);
    });

    it("should reject schema with null fields", () => {
      const schema = {
        fields: null,
      } as unknown as DatasetSchema;

      expect(validateSchema(schema)).toBe(false);
    });

    it("should reject field with empty name", () => {
      const schema: DatasetSchema = {
        fields: [{ name: "", type: "string" }],
      };

      expect(validateSchema(schema)).toBe(false);
    });

    it("should reject field with whitespace-only name", () => {
      const schema: DatasetSchema = {
        fields: [{ name: "   ", type: "string" }],
      };

      expect(validateSchema(schema)).toBe(false);
    });

    it("should reject field with invalid type", () => {
      const schema = {
        fields: [{ name: "field1", type: "invalid" }],
      } as unknown as DatasetSchema;

      expect(validateSchema(schema)).toBe(false);
    });

    it("should reject field with missing name", () => {
      const schema = {
        fields: [{ type: "string" }],
      } as unknown as DatasetSchema;

      expect(validateSchema(schema)).toBe(false);
    });

    it("should reject field with missing type", () => {
      const schema = {
        fields: [{ name: "field1" }],
      } as unknown as DatasetSchema;

      expect(validateSchema(schema)).toBe(false);
    });

    it("should reject if any field is invalid", () => {
      const schema: DatasetSchema = {
        fields: [
          { name: "valid", type: "string" },
          { name: "", type: "number" }, // Invalid: empty name
          { name: "alsoValid", type: "boolean" },
        ],
      };

      expect(validateSchema(schema)).toBe(false);
    });
  });
});

describe("mergeSchemas", () => {
  describe("basic merging", () => {
    it("should merge two schemas with different fields", () => {
      const schema1: DatasetSchema = {
        fields: [
          { name: "name", type: "string" },
          { name: "age", type: "number" },
        ],
      };
      const schema2: DatasetSchema = {
        fields: [
          { name: "email", type: "string" },
          { name: "active", type: "boolean" },
        ],
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.fields).toHaveLength(4);
      expect(merged.fields.map((f) => f.name)).toContain("name");
      expect(merged.fields.map((f) => f.name)).toContain("age");
      expect(merged.fields.map((f) => f.name)).toContain("email");
      expect(merged.fields.map((f) => f.name)).toContain("active");
    });

    it("should preserve field types when merging", () => {
      const schema1: DatasetSchema = {
        fields: [{ name: "id", type: "number" }],
      };
      const schema2: DatasetSchema = {
        fields: [{ name: "name", type: "string" }],
      };

      const merged = mergeSchemas(schema1, schema2);

      const idField = merged.fields.find((f) => f.name === "id");
      const nameField = merged.fields.find((f) => f.name === "name");

      expect(idField?.type).toBe("number");
      expect(nameField?.type).toBe("string");
    });

    it("should handle empty first schema", () => {
      const schema1: DatasetSchema = { fields: [] };
      const schema2: DatasetSchema = {
        fields: [{ name: "name", type: "string" }],
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.fields).toHaveLength(1);
      expect(merged.fields[0].name).toBe("name");
    });

    it("should handle empty second schema", () => {
      const schema1: DatasetSchema = {
        fields: [{ name: "name", type: "string" }],
      };
      const schema2: DatasetSchema = { fields: [] };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.fields).toHaveLength(1);
      expect(merged.fields[0].name).toBe("name");
    });

    it("should handle both schemas empty", () => {
      const schema1: DatasetSchema = { fields: [] };
      const schema2: DatasetSchema = { fields: [] };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.fields).toHaveLength(0);
    });
  });

  describe("conflicting fields", () => {
    it("should handle same field with same type", () => {
      const schema1: DatasetSchema = {
        fields: [{ name: "id", type: "number", nullable: false }],
      };
      const schema2: DatasetSchema = {
        fields: [{ name: "id", type: "number", nullable: false }],
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.fields).toHaveLength(1);
      expect(merged.fields[0].type).toBe("number");
    });

    it("should default to string for type conflicts", () => {
      const schema1: DatasetSchema = {
        fields: [{ name: "value", type: "number" }],
      };
      const schema2: DatasetSchema = {
        fields: [{ name: "value", type: "string" }],
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.fields).toHaveLength(1);
      expect(merged.fields[0].type).toBe("string");
    });

    it("should add warning for type conflicts", () => {
      const schema1: DatasetSchema = {
        fields: [{ name: "value", type: "number" }],
      };
      const schema2: DatasetSchema = {
        fields: [{ name: "value", type: "boolean" }],
      };

      const merged = mergeSchemas(schema1, schema2);

      const field = merged.fields[0];
      expect(field.metadata?.warnings).toBeDefined();
      expect(Array.isArray(field.metadata?.warnings)).toBe(true);
      expect(
        Array.isArray(field.metadata?.warnings)
          ? field.metadata?.warnings.length
          : 0
      ).toBeGreaterThan(0);
      expect(
        Array.isArray(field.metadata?.warnings) &&
          field.metadata?.warnings[0]?.includes("Type conflict")
      ).toBe(true);
    });

    it("should preserve existing warnings when adding new ones", () => {
      const schema1: DatasetSchema = {
        fields: [
          {
            name: "value",
            type: "number",
            metadata: { warnings: ["Existing warning"] },
          },
        ],
      };
      const schema2: DatasetSchema = {
        fields: [{ name: "value", type: "string" }],
      };

      const merged = mergeSchemas(schema1, schema2);

      const field = merged.fields[0];
      expect(field.metadata?.warnings).toContain("Existing warning");
      expect(
        Array.isArray(field.metadata?.warnings) &&
          field.metadata?.warnings.some((w: string) =>
            w.includes("Type conflict")
          )
      ).toBe(true);
    });

    it("should merge nullable flags (OR logic)", () => {
      const schema1: DatasetSchema = {
        fields: [{ name: "age", type: "number", nullable: false }],
      };
      const schema2: DatasetSchema = {
        fields: [{ name: "age", type: "number", nullable: true }],
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.fields[0].nullable).toBe(true);
    });

    it("should handle nullable undefined values", () => {
      const schema1: DatasetSchema = {
        fields: [{ name: "age", type: "number" }],
      };
      const schema2: DatasetSchema = {
        fields: [{ name: "age", type: "number", nullable: true }],
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.fields[0].nullable).toBe(true);
    });
  });

  describe("metadata merging", () => {
    it("should preserve metadata from first schema", () => {
      const schema1: DatasetSchema = {
        fields: [
          {
            name: "id",
            type: "number",
            metadata: { confidence: 0.95, sampleSize: 100 },
          },
        ],
      };
      const schema2: DatasetSchema = {
        fields: [{ name: "name", type: "string" }],
      };

      const merged = mergeSchemas(schema1, schema2);

      const idField = merged.fields.find((f) => f.name === "id");
      expect(idField?.metadata?.confidence).toBe(0.95);
      expect(idField?.metadata?.sampleSize).toBe(100);
    });

    it("should merge metadata when fields conflict", () => {
      const schema1: DatasetSchema = {
        fields: [
          {
            name: "value",
            type: "number",
            metadata: { customProp: "test" },
          },
        ],
      };
      const schema2: DatasetSchema = {
        fields: [{ name: "value", type: "number" }],
      };

      const merged = mergeSchemas(schema1, schema2);

      const field = merged.fields[0];
      expect(field.metadata).toBeDefined();
    });
  });

  describe("complex scenarios", () => {
    it("should handle multiple overlapping fields", () => {
      const schema1: DatasetSchema = {
        fields: [
          { name: "id", type: "number" },
          { name: "name", type: "string" },
          { name: "age", type: "number" },
        ],
      };
      const schema2: DatasetSchema = {
        fields: [
          { name: "name", type: "string" },
          { name: "email", type: "string" },
          { name: "age", type: "string" }, // Type conflict
        ],
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.fields).toHaveLength(4); // id, name, age, email

      const ageField = merged.fields.find((f) => f.name === "age");
      expect(ageField?.type).toBe("string"); // Conflict resolved
      expect(
        Array.isArray(ageField?.metadata?.warnings) &&
          ageField?.metadata?.warnings.length > 0
      ).toBe(true);
    });

    it("should maintain field order from first schema", () => {
      const schema1: DatasetSchema = {
        fields: [
          { name: "z", type: "string" },
          { name: "a", type: "string" },
        ],
      };
      const schema2: DatasetSchema = {
        fields: [{ name: "m", type: "string" }],
      };

      const merged = mergeSchemas(schema1, schema2);

      const fieldNames = merged.fields.map((f) => f.name);
      expect(fieldNames.indexOf("z")).toBeLessThan(fieldNames.indexOf("a"));
    });
  });
});

describe("getSchemaWarnings", () => {
  it("should return empty array for schema with no warnings", () => {
    const schema: DatasetSchema = {
      fields: [
        { name: "name", type: "string" },
        { name: "age", type: "number" },
      ],
    };

    const warnings = getSchemaWarnings(schema);

    expect(warnings).toEqual([]);
  });

  it("should extract warnings from field metadata", () => {
    const schema: DatasetSchema = {
      fields: [
        {
          name: "value",
          type: "string",
          metadata: { warnings: ["Type conflict detected"] },
        },
      ],
    };

    const warnings = getSchemaWarnings(schema);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toBe("Type conflict detected");
  });

  it("should collect warnings from multiple fields", () => {
    const schema: DatasetSchema = {
      fields: [
        {
          name: "field1",
          type: "string",
          metadata: { warnings: ["Warning 1"] },
        },
        {
          name: "field2",
          type: "number",
          metadata: { warnings: ["Warning 2", "Warning 3"] },
        },
      ],
    };

    const warnings = getSchemaWarnings(schema);

    expect(warnings).toHaveLength(3);
    expect(warnings).toContain("Warning 1");
    expect(warnings).toContain("Warning 2");
    expect(warnings).toContain("Warning 3");
  });

  it("should handle fields without metadata", () => {
    const schema: DatasetSchema = {
      fields: [
        { name: "name", type: "string" },
        {
          name: "age",
          type: "number",
          metadata: { warnings: ["Age warning"] },
        },
      ],
    };

    const warnings = getSchemaWarnings(schema);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toBe("Age warning");
  });

  it("should handle metadata with non-array warnings", () => {
    const schema: DatasetSchema = {
      fields: [
        {
          name: "field1",
          type: "string",
          metadata: { warnings: "Not an array" as unknown },
        },
      ],
    };

    const warnings = getSchemaWarnings(schema);

    expect(warnings).toEqual([]);
  });

  it("should handle empty warnings array", () => {
    const schema: DatasetSchema = {
      fields: [
        {
          name: "field1",
          type: "string",
          metadata: { warnings: [] },
        },
      ],
    };

    const warnings = getSchemaWarnings(schema);

    expect(warnings).toEqual([]);
  });

  it("should handle undefined warnings in metadata", () => {
    const schema: DatasetSchema = {
      fields: [
        {
          name: "field1",
          type: "string",
          metadata: { confidence: 1.0 },
        },
      ],
    };

    const warnings = getSchemaWarnings(schema);

    expect(warnings).toEqual([]);
  });

  it("should preserve warning order", () => {
    const schema: DatasetSchema = {
      fields: [
        {
          name: "field1",
          type: "string",
          metadata: { warnings: ["Warning A", "Warning B", "Warning C"] },
        },
      ],
    };

    const warnings = getSchemaWarnings(schema);

    expect(warnings).toEqual(["Warning A", "Warning B", "Warning C"]);
  });
});
