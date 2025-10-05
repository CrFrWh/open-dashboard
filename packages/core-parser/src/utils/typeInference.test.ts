import { describe, it, expect } from "vitest";
import { isValidDate, inferType, inferFieldType } from "./typeInference";

describe("isValidDate", () => {
  describe("valid dates", () => {
    it("should validate ISO 8601 date format", () => {
      expect(isValidDate("2024-01-15")).toBe(true);
      expect(isValidDate("2024-12-31")).toBe(true);
      expect(isValidDate("2020-02-29")).toBe(true); // Leap year
    });

    it("should validate US date format (MM/DD/YYYY)", () => {
      expect(isValidDate("01/15/2024")).toBe(true);
      expect(isValidDate("12/31/2024")).toBe(true);
      expect(isValidDate("1/1/2024")).toBe(true);
    });

    it("should validate short year format (MM/DD/YY)", () => {
      expect(isValidDate("01/15/24")).toBe(true);
      expect(isValidDate("12/31/99")).toBe(true);
      expect(isValidDate("1/1/00")).toBe(true);
    });

    it("should validate dates with single digit month/day", () => {
      expect(isValidDate("1/5/2024")).toBe(true);
      expect(isValidDate("01/5/2024")).toBe(true);
      expect(isValidDate("1/05/2024")).toBe(true);
    });
  });

  describe("invalid dates", () => {
    it("should reject non-string values", () => {
      expect(isValidDate(null as unknown as string)).toBe(false);
      expect(isValidDate(undefined as unknown as string)).toBe(false);
      expect(isValidDate(123 as unknown as string)).toBe(false);
      expect(isValidDate({} as unknown as string)).toBe(false);
      expect(isValidDate([] as unknown as string)).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidDate("")).toBe(false);
    });

    it("should reject invalid date strings", () => {
      expect(isValidDate("not a date")).toBe(false);
      expect(isValidDate("abc123")).toBe(false);
      expect(isValidDate("2024")).toBe(false);
      expect(isValidDate("01/15")).toBe(false);
    });

    it("should reject invalid date values", () => {
      expect(isValidDate("2024-13-01")).toBe(false); // Invalid month
      expect(isValidDate("2024-02-30")).toBe(false); // Invalid day
      expect(isValidDate("2023-02-29")).toBe(false); // Not a leap year
    });

    it("should reject dates without proper format", () => {
      expect(isValidDate("15-01-2024")).toBe(false); // Wrong order
      expect(isValidDate("2024/01/15")).toBe(false); // Wrong delimiter for ISO
      expect(isValidDate("01-15-2024")).toBe(false); // Wrong delimiter
    });

    it("should reject plain text that looks like dates", () => {
      expect(isValidDate("January 15, 2024")).toBe(false);
      expect(isValidDate("15 Jan 2024")).toBe(false);
    });
  });
});

describe("inferType", () => {
  describe("null/undefined/empty handling", () => {
    it("should return string for null", () => {
      expect(inferType(null)).toBe("string");
    });

    it("should return string for undefined", () => {
      expect(inferType(undefined)).toBe("string");
    });

    it("should return string for empty string", () => {
      expect(inferType("")).toBe("string");
    });
  });

  describe("boolean type inference", () => {
    it("should infer boolean from true/false", () => {
      expect(inferType(true)).toBe("boolean");
      expect(inferType(false)).toBe("boolean");
    });
  });

  describe("date type inference", () => {
    it("should infer date from Date objects", () => {
      expect(inferType(new Date())).toBe("date");
      expect(inferType(new Date("2024-01-15"))).toBe("date");
    });

    it("should infer date from ISO string", () => {
      expect(inferType("2024-01-15")).toBe("date");
      expect(inferType("2024-12-31")).toBe("date");
    });

    it("should infer date from US date format", () => {
      expect(inferType("01/15/2024")).toBe("date");
      expect(inferType("1/1/2024")).toBe("date");
    });
  });

  describe("number type inference", () => {
    it("should infer number from numeric values", () => {
      expect(inferType(0)).toBe("number");
      expect(inferType(42)).toBe("number");
      expect(inferType(-10)).toBe("number");
      expect(inferType(3.14)).toBe("number");
      expect(inferType(-99.99)).toBe("number");
    });

    it("should infer number from numeric strings", () => {
      expect(inferType("42")).toBe("number");
      expect(inferType("3.14")).toBe("number");
      expect(inferType("-10")).toBe("number");
      expect(inferType("0")).toBe("number");
    });

    it("should infer number from scientific notation", () => {
      expect(inferType("1e5")).toBe("number");
      expect(inferType("1.5e10")).toBe("number");
      expect(inferType("2.5E-3")).toBe("number");
    });

    it("should handle very large numbers", () => {
      expect(inferType(999999999999999)).toBe("number");
      expect(inferType("999999999999999")).toBe("number");
    });

    it("should handle very small numbers", () => {
      expect(inferType(0.0000001)).toBe("number");
      expect(inferType("0.0000001")).toBe("number");
    });
  });

  describe("string type inference", () => {
    it("should infer string from text", () => {
      expect(inferType("hello")).toBe("string");
      expect(inferType("Hello World")).toBe("string");
      expect(inferType("abc123")).toBe("string");
    });

    it("should infer string from mixed alphanumeric", () => {
      expect(inferType("123abc")).toBe("string");
      expect(inferType("a1b2c3")).toBe("string");
    });

    it("should infer string from special characters", () => {
      expect(inferType("!@#$%")).toBe("string");
      expect(inferType("test@example.com")).toBe("string");
    });

    it("should infer string from NaN", () => {
      expect(inferType(NaN)).toBe("string");
    });

    it("should infer string from Infinity", () => {
      expect(inferType(Infinity)).toBe("string");
      expect(inferType(-Infinity)).toBe("string");
    });
  });

  describe("edge cases", () => {
    it("should handle whitespace strings", () => {
      expect(inferType("   ")).toBe("string");
      expect(inferType("\t")).toBe("string");
      expect(inferType("\n")).toBe("string");
    });

    it("should handle zero", () => {
      expect(inferType(0)).toBe("number");
      expect(inferType("0")).toBe("number");
      expect(inferType("0.0")).toBe("number");
    });

    it("should handle negative numbers", () => {
      expect(inferType(-42)).toBe("number");
      expect(inferType("-42")).toBe("number");
    });

    it("should handle objects", () => {
      expect(inferType({})).toBe("string");
      expect(inferType({ key: "value" })).toBe("string");
    });

    it("should handle arrays", () => {
      expect(inferType([])).toBe("string");
      expect(inferType([1, 2, 3])).toBe("string");
    });
  });
});

describe("inferFieldType", () => {
  describe("basic type inference", () => {
    it("should infer string type from text samples", () => {
      const samples = ["Alice", "Bob", "Carol", "David"];
      const result = inferFieldType("name", samples);

      expect(result.type).toBe("string");
      expect(result.confidence).toBe(1.0);
      expect(result.nullable).toBe(false);
    });

    it("should infer number type from numeric samples", () => {
      const samples = [10, 20, 30, 40, 50];
      const result = inferFieldType("age", samples);

      expect(result.type).toBe("number");
      expect(result.confidence).toBe(1.0);
      expect(result.nullable).toBe(false);
    });

    it("should infer boolean type from boolean samples", () => {
      const samples = [true, false, true, false];
      const result = inferFieldType("active", samples);

      expect(result.type).toBe("boolean");
      expect(result.confidence).toBe(1.0);
      expect(result.nullable).toBe(false);
    });

    it("should infer date type from date strings", () => {
      const samples = ["2024-01-15", "2024-02-20", "2024-03-10"];
      const result = inferFieldType("hire_date", samples);

      expect(result.type).toBe("date");
      expect(result.confidence).toBe(1.0);
      expect(result.nullable).toBe(false);
    });
  });

  describe("categorical type inference", () => {
    it("should infer categorical for low cardinality strings", () => {
      const samples = Array.from(
        { length: 100 },
        (_, i) => ["active", "inactive", "pending"][i % 3]
      );
      const result = inferFieldType("status", samples);

      expect(result.type).toBe("categorical");
    });

    it("should not infer categorical for high cardinality", () => {
      const samples = Array.from({ length: 100 }, (_, i) => `Person${i}`);
      const result = inferFieldType("name", samples);

      expect(result.type).toBe("string");
    });

    it("should infer categorical for fields with category hint", () => {
      const samples = ["A", "B", "C", "A", "B", "C"];
      const result = inferFieldType("category", samples);

      expect(result.type).toBe("categorical");
    });

    it("should not infer categorical if unique values exceed threshold", () => {
      const samples = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
      const result = inferFieldType("field", samples);

      expect(result.type).toBe("string");
    });
  });

  describe("nullable detection", () => {
    it("should detect nullable from null values", () => {
      const samples = ["Alice", null, "Bob", "Carol"];
      const result = inferFieldType("name", samples);

      expect(result.nullable).toBe(true);
    });

    it("should detect nullable from undefined values", () => {
      const samples = ["Alice", undefined, "Bob", "Carol"];
      const result = inferFieldType("name", samples);

      expect(result.nullable).toBe(true);
    });

    it("should detect nullable from empty strings", () => {
      const samples = ["Alice", "", "Bob", "Carol"];
      const result = inferFieldType("name", samples);

      expect(result.nullable).toBe(true);
    });

    it("should not set nullable if all values present", () => {
      const samples = ["Alice", "Bob", "Carol"];
      const result = inferFieldType("name", samples);

      expect(result.nullable).toBe(false);
    });
  });

  describe("field name heuristics", () => {
    describe("ID fields", () => {
      it("should treat numeric IDs as strings", () => {
        const samples = [1, 2, 3, 4, 5];
        const result = inferFieldType("id", samples);

        expect(result.type).toBe("string");
        expect(result.metadata?.warnings).toBeDefined();
        expect(result.metadata?.warnings?.some((w) => w.includes("ID"))).toBe(
          true
        );
      });

      it("should treat user_id as string", () => {
        const samples = [101, 102, 103, 104];
        const result = inferFieldType("user_id", samples);

        expect(result.type).toBe("string");
      });

      it("should treat sku as string", () => {
        const samples = [1001, 1002, 1003];
        const result = inferFieldType("sku", samples);

        expect(result.type).toBe("string");
      });

      it("should treat uuid as string even if numeric", () => {
        const samples = [123456, 234567, 345678];
        const result = inferFieldType("uuid", samples);

        expect(result.type).toBe("string");
      });
    });

    describe("date fields", () => {
      it("should detect Unix timestamps in date-named fields", () => {
        const samples = [1704067200000, 1704153600000, 1704240000000];
        const result = inferFieldType("created_at", samples);

        expect(result.type).toBe("date");
        expect(
          result.metadata?.warnings?.some((w) => w.includes("Unix timestamps"))
        ).toBe(true);
      });

      it("should detect dates in updated_at fields", () => {
        const samples = [1704067200000, 1704153600000, 1704240000000];
        const result = inferFieldType("updated_at", samples);

        expect(result.type).toBe("date");
      });

      it("should detect dates in fields ending with _on", () => {
        const samples = [1704067200000, 1704153600000, 1704240000000];
        const result = inferFieldType("published_on", samples);

        expect(result.type).toBe("date");
      });

      it("should not convert small numbers to dates", () => {
        const samples = [1, 2, 3, 4, 5];
        const result = inferFieldType("created_at", samples);

        expect(result.type).toBe("number");
      });
    });

    describe("boolean fields", () => {
      it("should detect boolean from is_ prefix with yes/no", () => {
        const samples = ["yes", "no", "yes", "no"];
        const result = inferFieldType("is_active", samples);

        expect(result.type).toBe("boolean");
        expect(
          result.metadata?.warnings?.some((w) => w.includes("boolean"))
        ).toBe(true);
      });

      it("should detect boolean from has_ prefix with true/false strings", () => {
        const samples = ["true", "false", "true", "false"];
        const result = inferFieldType("has_permission", samples);

        expect(result.type).toBe("boolean");
      });

      it("should detect boolean from 1/0 strings", () => {
        const samples = ["1", "0", "1", "0"];
        const result = inferFieldType("is_enabled", samples);

        expect(result.type).toBe("boolean");
      });

      it("should detect boolean from y/n strings", () => {
        const samples = ["y", "n", "y", "n"];
        const result = inferFieldType("can_edit", samples);

        expect(result.type).toBe("boolean");
      });

      it("should not convert non-boolean strings", () => {
        const samples = ["active", "inactive", "pending"];
        const result = inferFieldType("is_status", samples);

        expect(result.type).toBe("categorical");
      });

      it("should handle _flag suffix", () => {
        const samples = ["yes", "no", "yes", "no"];
        const result = inferFieldType("active_flag", samples);

        expect(result.type).toBe("boolean");
      });
    });

    describe("category fields", () => {
      it("should recognize category field names", () => {
        const samples = ["A", "B", "C", "A", "B"];
        const result = inferFieldType("category", samples);

        expect(result.type).toBe("categorical");
      });

      it("should recognize type field names", () => {
        const samples = ["admin", "user", "guest"];
        const result = inferFieldType("user_type", samples);

        expect(result.type).toBe("categorical");
      });

      it("should recognize status field names", () => {
        const samples = ["active", "inactive", "pending"];
        const result = inferFieldType("status", samples);

        expect(result.type).toBe("categorical");
      });
    });
  });

  describe("mixed type handling", () => {
    it("should use most common type for mixed values", () => {
      const samples = [1, 2, 3, "text", 5, 6, 7, 8, 9];
      const result = inferFieldType("value", samples);

      expect(result.type).toBe("number");
      expect(result.confidence).toBeLessThan(1.0);
    });

    it("should add warning for low confidence", () => {
      const samples = [1, "text", 3, "more", 3];
      const result = inferFieldType("mixed_field", samples);

      expect(result.confidence).toBeLessThan(0.7);
      expect(result.metadata?.warnings).toBeDefined();
      expect(
        result.metadata?.warnings?.some((w) => w.includes("Low confidence"))
      ).toBe(true);
    });

    it("should warn about multiple types", () => {
      const samples = [1, "text", true, null];
      const result = inferFieldType("multi_type", samples);

      expect(result.metadata?.warnings).toBeDefined();
      expect(
        result.metadata?.warnings?.some((w) => w.includes("different types"))
      ).toBe(true);
    });

    it("should calculate correct confidence with mixed types", () => {
      const samples = [1, 2, 3, 4, 5, 6, 7, "text", "more", "data"];
      const result = inferFieldType("value", samples);

      expect(result.confidence).toBe(0.7); // 7 numbers out of 10
    });
  });

  describe("sample size handling", () => {
    it("should respect custom sample size", () => {
      const samples = Array.from({ length: 200 }, (_, i) => i);
      const result = inferFieldType("id", samples, 50);

      expect(result.samples).toHaveLength(50);
      expect(result.metadata?.sampleCount).toBe(50);
    });

    it("should use default sample size of 100", () => {
      const samples = Array.from({ length: 200 }, (_, i) => i);
      const result = inferFieldType("id", samples);

      expect(result.samples).toHaveLength(100);
      expect(result.metadata?.sampleCount).toBe(100);
    });

    it("should use all samples if fewer than sample size", () => {
      const samples = [1, 2, 3, 4, 5];
      const result = inferFieldType("id", samples, 100);

      expect(result.samples).toHaveLength(5);
      expect(result.metadata?.sampleCount).toBe(5);
    });
  });

  describe("metadata", () => {
    it("should include field name in metadata", () => {
      const samples = ["Alice", "Bob", "Carol"];
      const result = inferFieldType("name", samples);

      expect(result.metadata?.fieldName).toBe("name");
    });

    it("should include sample count in metadata", () => {
      const samples = ["Alice", "Bob", "Carol", "David", "Eve"];
      const result = inferFieldType("name", samples);

      expect(result.metadata?.sampleCount).toBe(5);
    });

    it("should include unique value count in metadata", () => {
      const samples = ["A", "B", "A", "C", "B", "A"];
      const result = inferFieldType("value", samples);

      expect(result.metadata?.uniqueValueCount).toBe(3);
    });

    it("should not include warnings if none exist", () => {
      const samples = ["Alice", "Bob", "Carol"];
      const result = inferFieldType("name", samples);

      expect(result.metadata?.warnings).toBeUndefined();
    });

    it("should include warnings array when warnings exist", () => {
      const samples = [1, 2, 3, 4];
      const result = inferFieldType("id", samples);

      expect(result.metadata?.warnings).toBeDefined();
      expect(Array.isArray(result.metadata?.warnings)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty samples array", () => {
      const samples: unknown[] = [];
      const result = inferFieldType("empty", samples);

      expect(result.type).toBe("string");
      expect(result.confidence).toBe(0);
      expect(result.nullable).toBe(true);
      expect(result.metadata?.warnings).toContain(
        "No samples available for type inference"
      );
    });

    it("should handle all null samples", () => {
      const samples = [null, null, null, null];
      const result = inferFieldType("all_null", samples);

      expect(result.nullable).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it("should handle single sample", () => {
      const samples = ["Alice"];
      const result = inferFieldType("name", samples);

      expect(result.type).toBe("string");
      expect(result.confidence).toBe(1.0);
      expect(result.samples).toHaveLength(1);
    });

    it("should handle duplicate values", () => {
      const samples = ["A", "A", "A", "A"];
      const result = inferFieldType("value", samples);

      expect(result.metadata?.uniqueValueCount).toBe(1);
      expect(result.type).toBe("categorical");
    });

    it("should handle very large sample sets", () => {
      const samples = Array.from({ length: 10000 }, (_, i) => i);
      const result = inferFieldType("id", samples, 100);

      expect(result.samples).toHaveLength(100);
      expect(result.type).toBe("string"); // ID hint applies
    });
  });

  describe("confidence calculation", () => {
    it("should have 100% confidence for uniform types", () => {
      const samples = [1, 2, 3, 4, 5];
      const result = inferFieldType("value", samples);

      expect(result.confidence).toBe(1.0);
    });

    it("should calculate confidence correctly for mixed types", () => {
      const samples = [1, 2, 3, 4, 5, "text", "more"];
      const result = inferFieldType("value", samples);

      const expectedConfidence = 5 / 7; // 5 numbers out of 7
      expect(result.confidence).toBeCloseTo(expectedConfidence, 2);
    });

    it("should have low confidence for evenly mixed types", () => {
      const samples = [1, "a", 2, "b", 3];
      const result = inferFieldType("value", samples);

      expect(result.confidence).toBeLessThanOrEqual(0.6);
    });
  });

  describe("complex scenarios", () => {
    it("should handle mixed numeric and date strings", () => {
      const samples = ["2024-01-15", "2024-02-20", "2024-03-10", 123];
      const result = inferFieldType("date_or_id", samples);

      expect(result.type).toBe("date");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should handle percentage strings as numbers", () => {
      const samples = ["10", "20", "30", "40"];
      const result = inferFieldType("percentage", samples);

      expect(result.type).toBe("number");
    });

    it("should handle boolean-like numbers", () => {
      const samples = [1, 0, 1, 0, 1];
      const result = inferFieldType("is_active", samples);

      expect(result.type).toBe("number");
    });

    it("should preserve samples in result", () => {
      const samples = ["Alice", "Bob", "Carol"];
      const result = inferFieldType("name", samples);

      expect(result.samples).toEqual(samples);
    });
  });
});
