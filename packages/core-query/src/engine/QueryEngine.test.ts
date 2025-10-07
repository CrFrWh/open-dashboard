import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryEngine } from "./QueryEngine";
import type { ParsedDataset } from "@open-dashboard/shared/types";
import { QueryError, RegistrationError } from "../types/query";

// DuckDB-WASM requires Web Worker support (browser environment)
// Skip tests in Node/Bun environment
const isBrowser =
  typeof window !== "undefined" && typeof Worker !== "undefined";
const describeOrSkip = isBrowser ? describe : describe.skip;

describeOrSkip("QueryEngine", () => {
  let engine: QueryEngine;
  let testDataset: ParsedDataset;

  beforeEach(async () => {
    // Create test dataset
    testDataset = {
      id: "test-1",
      name: "sales",
      data: [
        { region: "North", product: "A", amount: 100, date: "2024-01-01" },
        { region: "South", product: "B", amount: 150, date: "2024-01-02" },
        { region: "North", product: "B", amount: 200, date: "2024-01-03" },
        { region: "East", product: "A", amount: 120, date: "2024-01-04" },
        { region: "West", product: "C", amount: 180, date: "2024-01-05" },
      ],
      schema: {
        fields: [
          { name: "region", type: "string" },
          { name: "product", type: "string" },
          { name: "amount", type: "number" },
          { name: "date", type: "string" },
        ],
      },
      metadata: {
        source: "test",
        rowCount: 5,
        columnCount: 4,
      },
      sourceType: "json",
      createdAt: new Date(),
    };

    // Initialize engine
    engine = await QueryEngine.create({ logQueries: false });
  });

  afterEach(async () => {
    if (engine) {
      await engine.dispose();
    }
  });

  describe("initialization", () => {
    it("should create and initialize engine", async () => {
      expect(engine).toBeDefined();
      expect(engine.getRegisteredTables()).toEqual([]);
    });

    it("should create engine with custom config", async () => {
      const customEngine = await QueryEngine.create({
        enableCache: false,
        maxCacheSize: 50,
        cacheTimeout: 60000,
        logQueries: true,
      });

      expect(customEngine).toBeDefined();
      expect(customEngine.getCacheStats().enabled).toBe(false);
      expect(customEngine.getCacheStats().maxSize).toBe(50);

      await customEngine.dispose();
    });

    it("should handle multiple engine instances", async () => {
      const engine2 = await QueryEngine.create({ logQueries: false });

      expect(engine).toBeDefined();
      expect(engine2).toBeDefined();
      expect(engine).not.toBe(engine2);

      await engine2.dispose();
    });
  });

  describe("dataset registration", () => {
    it("should register a dataset", async () => {
      await engine.registerDataset(testDataset);

      expect(engine.getRegisteredTables()).toContain("sales");
      expect(engine.isTableRegistered("sales")).toBe(true);
    });

    it("should sanitize table names", async () => {
      const dataset = { ...testDataset, name: "Test Dataset 123!" };
      await engine.registerDataset(dataset);

      expect(engine.getRegisteredTables()).toContain("test_dataset_123");
    });

    it("should use custom table name", async () => {
      await engine.registerDataset(testDataset, { tableName: "my_sales" });

      expect(engine.getRegisteredTables()).toContain("my_sales");
      expect(engine.getRegisteredTables()).not.toContain("sales");
    });

    it("should throw error for duplicate table name without replace", async () => {
      await engine.registerDataset(testDataset);

      await expect(engine.registerDataset(testDataset)).rejects.toThrow(
        RegistrationError
      );
      await expect(engine.registerDataset(testDataset)).rejects.toThrow(
        "already exists"
      );
    });

    it("should replace existing table when replace option is true", async () => {
      await engine.registerDataset(testDataset);

      const updatedDataset = {
        ...testDataset,
        data: [
          { region: "Updated", product: "X", amount: 999, date: "2024-01-01" },
        ],
      };

      await engine.registerDataset(updatedDataset, { replace: true });

      expect(engine.getRegisteredTables()).toContain("sales");
      expect(engine.getRegisteredTables().length).toBe(1);
    });

    it("should handle empty dataset", async () => {
      const emptyDataset: ParsedDataset = {
        ...testDataset,
        data: [],
        metadata: {
          source: "test",
          rowCount: 0,
          columnCount: 4,
        },
      };

      await engine.registerDataset(emptyDataset);
      expect(engine.getRegisteredTables()).toContain("sales");
    });

    it("should register multiple datasets", async () => {
      const dataset2: ParsedDataset = {
        ...testDataset,
        id: "test-2",
        name: "products",
      };

      await engine.registerDataset(testDataset);
      await engine.registerDataset(dataset2);

      expect(engine.getRegisteredTables()).toContain("sales");
      expect(engine.getRegisteredTables()).toContain("products");
    });
  });

  describe("query execution", () => {
    beforeEach(async () => {
      await engine.registerDataset(testDataset);
    });

    it("should execute SELECT * query", async () => {
      const result = await engine.query("SELECT * FROM sales");

      expect(result.rowCount).toBe(5);
      expect(result.columnCount).toBe(4);
      expect(result.data).toHaveLength(5);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.sql).toBe("SELECT * FROM sales");
    });

    it("should execute filtered query", async () => {
      const result = await engine.query(
        "SELECT * FROM sales WHERE region = 'North'"
      );

      expect(result.rowCount).toBe(2);
      expect(result.data.every((row) => row.region === "North")).toBe(true);
    });

    it("should execute aggregation query", async () => {
      const result = await engine.query(`
        SELECT region, SUM(amount) as total
        FROM sales
        GROUP BY region
        ORDER BY total DESC
      `);

      expect(result.rowCount).toBe(4);
      expect(result.data[0].region).toBe("North");
      expect(result.data[0].total).toBe(300);
    });

    it("should execute COUNT query", async () => {
      const result = await engine.query("SELECT COUNT(*) as count FROM sales");

      expect(result.rowCount).toBe(1);
      expect(result.data[0].count).toBe(5);
    });

    it("should execute AVG query", async () => {
      const result = await engine.query(
        "SELECT AVG(amount) as avg_amount FROM sales"
      );

      expect(result.rowCount).toBe(1);
      expect(result.data[0].avg_amount).toBe(150);
    });

    it("should execute ORDER BY query", async () => {
      const result = await engine.query(
        "SELECT * FROM sales ORDER BY amount DESC"
      );

      expect(result.data[0].amount).toBe(200);
      expect(result.data[result.rowCount - 1].amount).toBe(100);
    });

    it("should execute LIMIT query", async () => {
      const result = await engine.query("SELECT * FROM sales LIMIT 2");

      expect(result.rowCount).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it("should execute JOIN query with multiple tables", async () => {
      const productsDataset: ParsedDataset = {
        id: "test-products",
        name: "products",
        data: [
          { product: "A", category: "Electronics" },
          { product: "B", category: "Furniture" },
          { product: "C", category: "Appliances" },
        ],
        schema: {
          fields: [
            { name: "product", type: "string" },
            { name: "category", type: "string" },
          ],
        },
        metadata: {
          source: "test",
          rowCount: 3,
          columnCount: 2,
        },
        sourceType: "json",
        createdAt: new Date(),
      };

      await engine.registerDataset(productsDataset);

      const result = await engine.query(`
        SELECT s.region, s.product, p.category, s.amount
        FROM sales s
        JOIN products p ON s.product = p.product
        WHERE s.region = 'North'
      `);

      expect(result.rowCount).toBe(2);
      expect(result.data[0]).toHaveProperty("category");
    });

    it("should throw QueryError for invalid SQL", async () => {
      await expect(engine.query("INVALID SQL")).rejects.toThrow(QueryError);
    });

    it("should throw QueryError for non-existent table", async () => {
      await expect(
        engine.query("SELECT * FROM non_existent_table")
      ).rejects.toThrow(QueryError);
    });

    it("should throw QueryError for non-existent column", async () => {
      await expect(
        engine.query("SELECT invalid_column FROM sales")
      ).rejects.toThrow(QueryError);
    });

    it("should include column metadata in result", async () => {
      const result = await engine.query("SELECT region, amount FROM sales");

      expect(result.metadata?.columns).toBeDefined();
      expect(result.metadata?.columns).toHaveLength(2);
      expect(result.metadata?.columns?.[0].name).toBe("region");
      expect(result.metadata?.columns?.[1].name).toBe("amount");
    });

    it("should mark result as not from cache on first execution", async () => {
      const result = await engine.query("SELECT * FROM sales");

      expect(result.metadata?.fromCache).toBe(false);
    });
  });

  describe("query caching", () => {
    beforeEach(async () => {
      await engine.registerDataset(testDataset);
    });

    it("should cache query results", async () => {
      const sql = "SELECT * FROM sales";

      const result1 = await engine.query(sql);
      const result2 = await engine.query(sql);

      expect(result1.data).toEqual(result2.data);
      expect(result2.metadata?.fromCache).toBe(true);
    });

    it("should use different cache keys for different queries", async () => {
      const result1 = await engine.query("SELECT * FROM sales");
      const result2 = await engine.query(
        "SELECT * FROM sales WHERE region = 'North'"
      );

      expect(result1.rowCount).not.toBe(result2.rowCount);
      expect(result1.metadata?.fromCache).toBe(false);
      expect(result2.metadata?.fromCache).toBe(false);
    });

    it("should normalize SQL for cache keys", async () => {
      const sql1 = "SELECT * FROM sales";
      const sql2 = "SELECT   *   FROM   sales"; // Extra spaces
      const sql3 = "select * from sales"; // Different case

      await engine.query(sql1);
      const result2 = await engine.query(sql2);
      const result3 = await engine.query(sql3);

      expect(result2.metadata?.fromCache).toBe(true);
      expect(result3.metadata?.fromCache).toBe(true);
    });

    it("should bypass cache when skipCache option is true", async () => {
      const sql = "SELECT * FROM sales";

      await engine.query(sql);
      const result = await engine.query(sql, { skipCache: true });

      expect(result.metadata?.fromCache).toBe(false);
    });

    it("should clear cache manually", async () => {
      const sql = "SELECT * FROM sales";

      await engine.query(sql);
      engine.clearCache();
      const result = await engine.query(sql);

      expect(result.metadata?.fromCache).toBe(false);
    });

    it("should clear cache when table is unregistered", async () => {
      const sql = "SELECT * FROM sales";

      await engine.query(sql);
      await engine.unregisterTable("sales");
      await engine.registerDataset(testDataset);
      const result = await engine.query(sql);

      expect(result.metadata?.fromCache).toBe(false);
    });

    it("should respect cache size limit", async () => {
      const smallCacheEngine = await QueryEngine.create({
        maxCacheSize: 2,
        logQueries: false,
      });

      await smallCacheEngine.registerDataset(testDataset);

      // Execute 3 different queries (exceeds cache size of 2)
      await smallCacheEngine.query("SELECT * FROM sales");
      await smallCacheEngine.query(
        "SELECT * FROM sales WHERE region = 'North'"
      );
      await smallCacheEngine.query(
        "SELECT * FROM sales WHERE region = 'South'"
      );

      const stats = smallCacheEngine.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(2);

      await smallCacheEngine.dispose();
    });

    it("should work when cache is disabled", async () => {
      const noCacheEngine = await QueryEngine.create({
        enableCache: false,
        logQueries: false,
      });

      await noCacheEngine.registerDataset(testDataset);

      const result1 = await noCacheEngine.query("SELECT * FROM sales");
      const result2 = await noCacheEngine.query("SELECT * FROM sales");

      expect(result1.metadata?.fromCache).toBe(false);
      expect(result2.metadata?.fromCache).toBe(false);

      await noCacheEngine.dispose();
    });

    it("should provide cache statistics", async () => {
      await engine.query("SELECT * FROM sales");
      await engine.query("SELECT * FROM sales WHERE region = 'North'");

      const stats = engine.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(100);
      expect(stats.enabled).toBe(true);
    });
  });

  describe("Arrow query", () => {
    beforeEach(async () => {
      await engine.registerDataset(testDataset);
    });

    it("should return Arrow Table", async () => {
      const table = await engine.queryArrow("SELECT * FROM sales");

      expect(table.numRows).toBe(5);
      expect(table.numCols).toBe(4);
      expect(table.schema.fields).toHaveLength(4);
    });

    it("should convert Arrow Table to array", async () => {
      const table = await engine.queryArrow("SELECT * FROM sales");
      const array = table.toArray();

      expect(array).toHaveLength(5);
      expect(array[0].toJSON()).toHaveProperty("region");
    });

    it("should throw QueryError for invalid SQL", async () => {
      await expect(engine.queryArrow("INVALID SQL")).rejects.toThrow(
        QueryError
      );
    });
  });

  describe("table operations", () => {
    it("should unregister table", async () => {
      await engine.registerDataset(testDataset);

      await engine.unregisterTable("sales");

      expect(engine.getRegisteredTables()).not.toContain("sales");
      expect(engine.isTableRegistered("sales")).toBe(false);
    });

    it("should handle unregistering non-existent table", async () => {
      // Should not throw error
      await expect(
        engine.unregisterTable("non_existent")
      ).resolves.not.toThrow();
    });

    it("should list all registered tables", async () => {
      const dataset2: ParsedDataset = {
        ...testDataset,
        id: "test-2",
        name: "products",
      };

      await engine.registerDataset(testDataset);
      await engine.registerDataset(dataset2);

      const tables = engine.getRegisteredTables();

      expect(tables).toContain("sales");
      expect(tables).toContain("products");
      expect(tables).toHaveLength(2);
    });

    it("should check if table is registered", async () => {
      await engine.registerDataset(testDataset);

      expect(engine.isTableRegistered("sales")).toBe(true);
      expect(engine.isTableRegistered("non_existent")).toBe(false);
    });
  });

  describe("table name sanitization", () => {
    it("should convert to lowercase", async () => {
      const dataset = { ...testDataset, name: "MyTable" };
      await engine.registerDataset(dataset);

      expect(engine.getRegisteredTables()).toContain("mytable");
    });

    it("should replace spaces with underscores", async () => {
      const dataset = { ...testDataset, name: "My Table Name" };
      await engine.registerDataset(dataset);

      expect(engine.getRegisteredTables()).toContain("my_table_name");
    });

    it("should remove special characters", async () => {
      const dataset = { ...testDataset, name: "Sales@Data#2024!" };
      await engine.registerDataset(dataset);

      expect(engine.getRegisteredTables()).toContain("sales_data_2024");
    });

    it("should prepend underscore to names starting with numbers", async () => {
      const dataset = { ...testDataset, name: "2024_sales" };
      await engine.registerDataset(dataset);

      expect(engine.getRegisteredTables()).toContain("_2024_sales");
    });

    it("should remove consecutive underscores", async () => {
      const dataset = { ...testDataset, name: "my___table___name" };
      await engine.registerDataset(dataset);

      expect(engine.getRegisteredTables()).toContain("my_table_name");
    });

    it("should truncate long names to 63 characters", async () => {
      const longName = "a".repeat(100);
      const dataset = { ...testDataset, name: longName };
      await engine.registerDataset(dataset);

      const tables = engine.getRegisteredTables();
      expect(tables[0].length).toBeLessThanOrEqual(63);
    });

    it("should handle edge case of empty string after sanitization", async () => {
      const dataset = { ...testDataset, name: "!@#$%^&*()" };
      await engine.registerDataset(dataset);

      const tables = engine.getRegisteredTables();
      expect(tables).toHaveLength(1);
      expect(tables[0]).toMatch(/^table_\d+$/);
    });
  });

  describe("resource cleanup", () => {
    it("should dispose engine properly", async () => {
      await engine.registerDataset(testDataset);
      await engine.query("SELECT * FROM sales");

      await engine.dispose();

      // Should not be able to query after disposal
      await expect(engine.query("SELECT * FROM sales")).rejects.toThrow();
    });

    it("should clear all state on disposal", async () => {
      await engine.registerDataset(testDataset);
      await engine.query("SELECT * FROM sales");

      await engine.dispose();

      expect(engine.getRegisteredTables()).toHaveLength(0);
      expect(engine.getCacheStats().size).toBe(0);
    });

    it("should handle multiple dispose calls", async () => {
      await engine.dispose();
      await expect(engine.dispose()).resolves.not.toThrow();
    });
  });

  describe("error handling", () => {
    it("should throw error when querying before initialization", async () => {
      const uninitializedEngine = Object.create(QueryEngine.prototype);

      await expect(
        uninitializedEngine.query("SELECT * FROM sales")
      ).rejects.toThrow("not initialized");
    });

    it("should throw error when registering without initialization", async () => {
      const uninitializedEngine = Object.create(QueryEngine.prototype);

      await expect(
        uninitializedEngine.registerDataset(testDataset)
      ).rejects.toThrow("not initialized");
    });

    it("should provide meaningful error messages", async () => {
      await engine.registerDataset(testDataset);

      try {
        await engine.query("SELECT invalid_column FROM sales");
      } catch (error) {
        expect(error).toBeInstanceOf(QueryError);
        expect((error as QueryError).message).toContain("execution failed");
        expect((error as QueryError).sql).toBe(
          "SELECT invalid_column FROM sales"
        );
      }
    });
  });

  describe("performance", () => {
    it("should execute queries quickly", async () => {
      await engine.registerDataset(testDataset);

      const start = performance.now();
      await engine.query("SELECT * FROM sales");
      const duration = performance.now() - start;

      // Query should complete in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    it("should handle large datasets efficiently", async () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 1000,
        category: ["A", "B", "C"][i % 3],
      }));

      const largeDataset: ParsedDataset = {
        id: "large-test",
        name: "large_data",
        data: largeData,
        schema: {
          fields: [
            { name: "id", type: "number" },
            { name: "name", type: "string" },
            { name: "value", type: "number" },
            { name: "category", type: "string" },
          ],
        },
        metadata: {
          source: "test",
          rowCount: 10000,
          columnCount: 4,
        },
        sourceType: "json",
        createdAt: new Date(),
      };

      await engine.registerDataset(largeDataset);

      const start = performance.now();
      const result = await engine.query(
        "SELECT category, AVG(value) as avg_value FROM large_data GROUP BY category"
      );
      const duration = performance.now() - start;

      expect(result.rowCount).toBe(3);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});
