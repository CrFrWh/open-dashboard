import { describe, it, expect, beforeEach } from "vitest";
import { CSVAdapter, DataParsingError } from "./csvAdapter";

describe("CSVAdapter", () => {
  let adapter: CSVAdapter;

  beforeEach(() => {
    adapter = new CSVAdapter();
  });

  describe("getSupportedTypes", () => {
    it("should return CSV file extensions and MIME types", () => {
      const types = adapter.getSupportedTypes();

      expect(types).toContain(".csv");
      expect(types).toContain("text/csv");
      expect(types).toContain("text/plain");
      expect(types).toHaveLength(3);
    });
  });

  describe("validate", () => {
    it("should validate CSV strings with commas", () => {
      const csvContent = "name,age\nAlice,30\nBob,25";

      expect(adapter.validate(csvContent)).toBe(true);
    });

    it("should validate CSV strings with newlines", () => {
      const csvContent = "name\nAlice\nBob";

      expect(adapter.validate(csvContent)).toBe(true);
    });

    it("should validate CSV files by extension", () => {
      const file = new File(["name,age\nAlice,30"], "test.csv", {
        type: "text/plain",
      });

      expect(adapter.validate(file)).toBe(true);
    });

    it("should validate CSV files by MIME type", () => {
      const file = new File(["name,age\nAlice,30"], "data.txt", {
        type: "text/csv",
      });

      expect(adapter.validate(file)).toBe(true);
    });

    it("should reject non-CSV strings", () => {
      expect(adapter.validate("just plain text")).toBe(false);
      expect(adapter.validate("single value")).toBe(false);
    });

    it("should reject non-CSV files", () => {
      const file = new File(["{}"], "test.json", { type: "application/json" });

      expect(adapter.validate(file)).toBe(false);
    });

    it("should reject non-string and non-File inputs", () => {
      expect(adapter.validate(123)).toBe(false);
      expect(adapter.validate(null)).toBe(false);
      expect(adapter.validate(undefined)).toBe(false);
      expect(adapter.validate({})).toBe(false);
      expect(adapter.validate([])).toBe(false);
    });
  });

  describe("parse - basic functionality", () => {
    it("should parse simple CSV string with headers", async () => {
      const csvContent = "name,age,city\nAlice,30,NYC\nBob,25,LA";

      const result = await adapter.parse(csvContent);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ name: "Alice", age: 30, city: "NYC" });
      expect(result.data[1]).toEqual({ name: "Bob", age: 25, city: "LA" });
      expect(result.schema.fields).toHaveLength(3);
      expect(result.sourceType).toBe("csv");
      expect(result.name).toBe("unknown.csv");
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it("should parse CSV from File object", async () => {
      const csvContent = "name,age\nAlice,30\nBob,25";
      const file = new File([csvContent], "employees.csv", {
        type: "text/csv",
      });

      const result = await adapter.parse(file);

      expect(result.data).toHaveLength(2);
      expect(result.name).toBe("employees.csv");
      expect(result.metadata?.encoding).toBe("UTF-8");
    });

    it("should generate unique IDs for each parse", async () => {
      const csvContent = "name\nAlice";

      const result1 = await adapter.parse(csvContent);
      const result2 = await adapter.parse(csvContent);

      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toMatch(/^\d+-[a-z0-9]+$/);
    });

    it("should include metadata with parse time and counts", async () => {
      const csvContent = "name,age,city\nAlice,30,NYC\nBob,25,LA";

      const result = await adapter.parse(csvContent);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.parseTime).toBeGreaterThan(0);
      expect(result.metadata?.rowCount).toBe(2);
      expect(result.metadata?.columnCount).toBe(3);
      expect(result.metadata?.encoding).toBe("UTF-8");
    });
  });

  describe("parse - type inference", () => {
    it("should infer string types", async () => {
      const csvContent = "name,city\nAlice,NYC\nBob,LA";

      const result = await adapter.parse(csvContent);

      const nameField = result.schema.fields.find((f) => f.name === "name");
      expect(nameField?.type).toBe("string");
    });

    it("should infer number types", async () => {
      const csvContent = "name,age,salary\nAlice,30,95000\nBob,25,80000";

      const result = await adapter.parse(csvContent);

      const ageField = result.schema.fields.find((f) => f.name === "age");
      const salaryField = result.schema.fields.find((f) => f.name === "salary");
      expect(ageField?.type).toBe("number");
      expect(salaryField?.type).toBe("number");
    });

    it("should infer date types", async () => {
      const csvContent = "name,hire_date\nAlice,2024-01-15\nBob,2024-02-20";

      const result = await adapter.parse(csvContent);

      const dateField = result.schema.fields.find(
        (f) => f.name === "hire_date"
      );
      expect(dateField?.type).toBe("date");
    });

    it("should handle mixed numeric types correctly", async () => {
      const csvContent = "id,price\n1,19.99\n2,29.99";

      const result = await adapter.parse(csvContent);

      expect(result.data[0].id).toBe(1);
      expect(result.data[0].price).toBe(19.99);
    });
  });

  describe("parse - options", () => {
    it("should respect maxRows option", async () => {
      const csvContent = "name,age\nAlice,30\nBob,25\nCarol,35\nDavid,40";

      const result = await adapter.parse(csvContent, { maxRows: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe("Alice");
      expect(result.data[1].name).toBe("Bob");
    });

    it("should respect custom delimiter", async () => {
      const tsvContent = "name\tage\nAlice\t30\nBob\t25";

      const result = await adapter.parse(tsvContent, { delimiter: "\t" });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ name: "Alice", age: 30 });
    });

    it("should handle custom delimiter with semicolon", async () => {
      const ssvContent = "name;age;city\nAlice;30;NYC\nBob;25;LA";

      const result = await adapter.parse(ssvContent, { delimiter: ";" });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ name: "Alice", age: 30, city: "NYC" });
    });

    it("should respect hasHeader option set to false", async () => {
      const csvContent = "Alice,30,NYC\nBob,25,LA";

      const result = await adapter.parse(csvContent, { hasHeader: false });

      expect(result.data).toHaveLength(2);
      // PapaParse will use default column names like "0", "1", "2"
      expect(result.schema.fields.length).toBeGreaterThan(0);
    });

    it("should respect inferTypes option set to false", async () => {
      const csvContent = "name,age\nAlice,30\nBob,25";

      const result = await adapter.parse(csvContent, { inferTypes: false });

      // Without type inference, numbers might be strings
      expect(result.data).toHaveLength(2);
    });

    it("should respect sampleSize option", async () => {
      const csvContent =
        "name,age\n" +
        Array.from({ length: 200 }, (_, i) => `Person${i},${20 + i}`).join(
          "\n"
        );

      const result = await adapter.parse(csvContent, { sampleSize: 50 });

      expect(result.data.length).toBe(200);
      // Schema inference should only use 50 samples
      expect(result.schema.fields).toBeDefined();
    });

    it("should respect custom encoding option in metadata", async () => {
      const csvContent = "name,age\nAlice,30";

      const result = await adapter.parse(csvContent, { encoding: "UTF-16" });

      expect(result.metadata?.encoding).toBe("UTF-16");
    });
  });

  describe("parse - special cases", () => {
    it("should handle CSV with quoted values", async () => {
      const csvContent =
        'name,description\n"Alice","Works at ""Big Corp"""\n"Bob","Lives in NYC, USA"';

      const result = await adapter.parse(csvContent);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe("Alice");
      expect(result.data[0].description).toContain("Big Corp");
      expect(result.data[1].description).toContain("NYC, USA");
    });

    it("should handle CSV with empty values", async () => {
      // Use proper CSV quoting for empty strings
      const csvContent = 'name,age,city\nAlice,30,""\nBob,"",LA\n"",25,Chicago';

      const result = await adapter.parse(csvContent);

      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toHaveProperty("city");
      expect(result.data[1]).toHaveProperty("age");
      expect(result.data[2]).toHaveProperty("name");
    });

    it("should skip empty lines", async () => {
      const csvContent = "name,age\nAlice,30\n\nBob,25\n\n";

      const result = await adapter.parse(csvContent);

      expect(result.data).toHaveLength(2);
    });

    it("should trim header whitespace", async () => {
      const csvContent = " name , age , city \nAlice,30,NYC";

      const result = await adapter.parse(csvContent);

      expect(result.schema.fields[0].name).toBe("name");
      expect(result.schema.fields[1].name).toBe("age");
      expect(result.schema.fields[2].name).toBe("city");
    });

    it("should handle CSV with trailing comma by adding extra column", async () => {
      // Trailing comma creates an extra column
      const csvContent = "name,age,extra\nAlice,30,\nBob,25,";

      const result = await adapter.parse(csvContent);

      expect(result.data).toHaveLength(2);
      expect(result.schema.fields).toHaveLength(3); // name, age, extra
    });

    it("should handle CSV with BOM (Byte Order Mark)", async () => {
      const csvContent = "\uFEFFname,age\nAlice,30";

      const result = await adapter.parse(csvContent);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Alice");
    });

    it("should handle large CSV files", async () => {
      const rows = Array.from(
        { length: 1000 },
        (_, i) => `Person${i},${20 + i},City${i % 10}`
      );
      const csvContent = "name,age,city\n" + rows.join("\n");

      const result = await adapter.parse(csvContent);

      expect(result.data).toHaveLength(1000);
      expect(result.metadata?.rowCount).toBe(1000);
    });
  });

  describe("parse - error handling", () => {
    it("should throw DataParsingError for empty CSV", async () => {
      const csvContent = "";

      await expect(adapter.parse(csvContent)).rejects.toThrow(DataParsingError);
      await expect(adapter.parse(csvContent)).rejects.toThrow(
        "CSV file is empty"
      );
    });

    it("should throw DataParsingError for CSV with only headers", async () => {
      const csvContent = "name,age\n";

      await expect(adapter.parse(csvContent)).rejects.toThrow(DataParsingError);
    });

    it("should throw DataParsingError for CSV with only whitespace", async () => {
      const csvContent = "   \n  \n  ";

      await expect(adapter.parse(csvContent)).rejects.toThrow(DataParsingError);
    });

    it("should throw DataParsingError for unsupported input type", async () => {
      const invalidInput = 123 as unknown as string;

      await expect(adapter.parse(invalidInput)).rejects.toThrow(
        DataParsingError
      );
      await expect(adapter.parse(invalidInput)).rejects.toThrow(
        "Unsupported input type"
      );
    });

    it("should include filename in error messages", async () => {
      const csvContent = "";
      const file = new File([csvContent], "test-file.csv", {
        type: "text/csv",
      });

      try {
        await adapter.parse(file);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(DataParsingError);
        expect((error as DataParsingError).filename).toBe("test-file.csv");
      }
    });

    it("should reject malformed CSV with inconsistent column counts", async () => {
      // This CSV has inconsistent number of fields - PapaParse will reject it
      const csvContent = "name,age\nAlice,30\nBob,25,extra,columns";

      await expect(adapter.parse(csvContent)).rejects.toThrow(DataParsingError);
      await expect(adapter.parse(csvContent)).rejects.toThrow(
        /CSV parsing error|Too many fields/
      );
    });

    it("should preserve DataParsingError type when re-throwing", async () => {
      const csvContent = "";

      try {
        await adapter.parse(csvContent);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(DataParsingError);
        expect((error as DataParsingError).name).toBe("DataParsingError");
      }
    });
  });

  describe("parse - URL support", () => {
    it("should handle URL input type check", async () => {
      // Note: Actual fetch will fail in test environment without mocking
      const url = new URL("https://example.com/data.csv");

      // This will throw because we can't fetch in test environment
      // but it tests that URL type is handled
      await expect(adapter.parse(url)).rejects.toThrow();
    });
  });

  describe("DataParsingError class", () => {
    it("should create error with message only", () => {
      const error = new DataParsingError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.name).toBe("DataParsingError");
      expect(error.filename).toBeUndefined();
      expect(error.line).toBeUndefined();
    });

    it("should create error with filename", () => {
      const error = new DataParsingError("Test error", "test.csv");

      expect(error.message).toBe("Test error");
      expect(error.filename).toBe("test.csv");
      expect(error.line).toBeUndefined();
    });

    it("should create error with filename and line number", () => {
      const error = new DataParsingError("Test error", "test.csv", 42);

      expect(error.message).toBe("Test error");
      expect(error.filename).toBe("test.csv");
      expect(error.line).toBe(42);
    });

    it("should be instanceof Error", () => {
      const error = new DataParsingError("Test error");

      expect(error instanceof Error).toBe(true);
      expect(error instanceof DataParsingError).toBe(true);
    });

    it("should have correct stack trace", () => {
      const error = new DataParsingError("Test error");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("DataParsingError");
    });
  });

  describe("schema validation integration", () => {
    it("should validate generated schema", async () => {
      const csvContent = "name,age\nAlice,30\nBob,25";

      const result = await adapter.parse(csvContent);

      expect(result.schema.fields).toBeDefined();
      expect(result.schema.fields.length).toBeGreaterThan(0);
      expect(result.schema.fields.every((f) => f.name && f.type)).toBe(true);
    });

    it("should include field metadata in schema", async () => {
      const csvContent = "name,age\nAlice,30\nBob,25";

      const result = await adapter.parse(csvContent);

      const field = result.schema.fields[0];
      expect(field.metadata).toBeDefined();
    });
  });
});
