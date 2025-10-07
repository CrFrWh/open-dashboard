/**
 * Tests for query building utilities
 *
 * Validates SQL injection protection, type safety, and query construction
 */

import { describe, it, expect } from "vitest";
import {
  buildJoinQuery,
  buildAggregateQuery,
  buildParameterizedQuery,
  buildCountQuery,
  buildSampleQuery,
  sanitizeIdentifier,
  escapeString,
  validateClause,
  extractTableNames,
  buildWhereClause,
  QueryBuilder,
  type JoinOptions,
  type AggregateOptions,
} from "./queryHelpers";

describe("sanitizeIdentifier", () => {
  it("should wrap valid identifiers in quotes", () => {
    expect(sanitizeIdentifier("sales")).toBe('"sales"');
    expect(sanitizeIdentifier("employee_id")).toBe('"employee_id"');
    expect(sanitizeIdentifier("table123")).toBe('"table123"');
  });

  it("should reject identifiers with quotes", () => {
    // Quotes in identifier names should be rejected - they're invalid input
    expect(() => sanitizeIdentifier('col"name')).toThrow(/Invalid identifier/);
  });

  it("should handle qualified identifiers", () => {
    expect(sanitizeIdentifier("sales.amount", true)).toBe('"sales"."amount"');
    expect(sanitizeIdentifier("s.total", true)).toBe('"s"."total"');
  });

  it("should throw on dangerous keywords", () => {
    expect(() => sanitizeIdentifier("DROP")).toThrow(/SQL keyword/);
    expect(() => sanitizeIdentifier("DELETE")).toThrow(/SQL keyword/);
    expect(() => sanitizeIdentifier("EXEC")).toThrow(/SQL keyword/);
  });

  it("should throw on invalid identifiers", () => {
    expect(() => sanitizeIdentifier("")).toThrow(/cannot be empty/);
    expect(() => sanitizeIdentifier("123invalid")).toThrow(
      /Invalid identifier/
    );
    expect(() => sanitizeIdentifier("col-name")).toThrow(/Invalid identifier/);
    expect(() => sanitizeIdentifier("col name")).toThrow(/Invalid identifier/);
  });

  it("should throw on too many dots in qualified names", () => {
    expect(() => sanitizeIdentifier("a.b.c", true)).toThrow(/max one dot/);
  });
});

describe("validateClause", () => {
  it("should allow safe clauses", () => {
    expect(() => validateClause("amount > 1000")).not.toThrow();
    expect(() => validateClause("region = 'North'")).not.toThrow();
    expect(() =>
      validateClause("status IN ('active', 'pending')")
    ).not.toThrow();
  });

  it("should reject dangerous patterns", () => {
    expect(() => validateClause("; DROP TABLE users")).toThrow(
      /dangerous patterns/
    );
    expect(() => validateClause("1=1; DELETE FROM sales")).toThrow(
      /dangerous patterns/
    );
    expect(() => validateClause("-- comment")).toThrow(/dangerous patterns/);
    expect(() => validateClause("/* comment */")).toThrow(/dangerous patterns/);
    expect(() => validateClause("UNION SELECT * FROM passwords")).toThrow(
      /dangerous patterns/
    );
  });

  it("should reject semicolons", () => {
    expect(() => validateClause("amount > 1000; SELECT 1")).toThrow(
      /semicolons/
    );
  });
});

describe("escapeString", () => {
  it("should escape single quotes", () => {
    expect(escapeString("O'Reilly")).toBe("O''Reilly");
    expect(escapeString("It's")).toBe("It''s");
  });

  it("should handle strings without quotes", () => {
    expect(escapeString("normal string")).toBe("normal string");
  });
});

describe("buildParameterizedQuery", () => {
  it("should substitute string parameters", () => {
    const sql = "SELECT * FROM sales WHERE region = $region";
    const result = buildParameterizedQuery(sql, { region: "North" });
    expect(result).toBe("SELECT * FROM sales WHERE region = 'North'");
  });

  it("should escape single quotes in strings", () => {
    const sql = "SELECT * FROM sales WHERE name = $name";
    const result = buildParameterizedQuery(sql, { name: "O'Reilly" });
    expect(result).toBe("SELECT * FROM sales WHERE name = 'O''Reilly'");
  });

  it("should handle number parameters", () => {
    const sql = "SELECT * FROM sales WHERE amount > $min";
    const result = buildParameterizedQuery(sql, { min: 1000 });
    expect(result).toBe("SELECT * FROM sales WHERE amount > 1000");
  });

  it("should handle boolean parameters", () => {
    const sql = "SELECT * FROM users WHERE active = $active";
    const result = buildParameterizedQuery(sql, { active: true });
    expect(result).toBe("SELECT * FROM users WHERE active = TRUE");
  });

  it("should handle NULL parameters", () => {
    const sql = "SELECT * FROM sales WHERE notes = $notes";
    const result = buildParameterizedQuery(sql, { notes: null });
    expect(result).toBe("SELECT * FROM sales WHERE notes = NULL");
  });

  it("should handle array parameters for IN clauses", () => {
    const sql = "SELECT * FROM sales WHERE region IN $regions";
    const result = buildParameterizedQuery(sql, {
      regions: ["North", "South"],
    });
    expect(result).toBe(
      "SELECT * FROM sales WHERE region IN ('North', 'South')"
    );
  });

  it("should handle Date parameters", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    const sql = "SELECT * FROM sales WHERE date = $date";
    const result = buildParameterizedQuery(sql, { date });
    expect(result).toContain("'2024-01-01T00:00:00.000Z'");
  });

  it("should throw on empty arrays", () => {
    const sql = "SELECT * FROM sales WHERE region IN $regions";
    expect(() => buildParameterizedQuery(sql, { regions: [] })).toThrow(
      /empty array/
    );
  });

  it("should throw on non-finite numbers", () => {
    const sql = "SELECT * FROM sales WHERE amount = $amount";
    expect(() => buildParameterizedQuery(sql, { amount: Infinity })).toThrow(
      /not a finite number/
    );
    expect(() => buildParameterizedQuery(sql, { amount: NaN })).toThrow(
      /not a finite number/
    );
  });
});

describe("buildJoinQuery", () => {
  it("should build basic INNER JOIN", () => {
    const options: JoinOptions = {
      tables: [
        { name: "sales", alias: "s" },
        { name: "employees", alias: "e" },
      ],
      on: [{ left: "s.employee_id", right: "e.id" }],
    };

    const sql = buildJoinQuery(options);
    expect(sql).toContain('FROM "sales" AS "s"');
    expect(sql).toContain('INNER JOIN "employees" AS "e"');
    expect(sql).toContain('ON "s"."employee_id" = "e"."id"');
  });

  it("should sanitize column names in SELECT", () => {
    const options: JoinOptions = {
      tables: [{ name: "sales" }, { name: "employees" }],
      on: [{ left: "sales.employee_id", right: "employees.id" }],
      select: ["sales.amount", "employees.name"],
    };

    const sql = buildJoinQuery(options);
    expect(sql).toContain('"sales"."amount"');
    expect(sql).toContain('"employees"."name"');
  });

  it("should support LEFT JOIN", () => {
    const options: JoinOptions = {
      tables: [{ name: "sales" }, { name: "employees" }],
      on: [{ left: "sales.employee_id", right: "employees.id", type: "LEFT" }],
    };

    const sql = buildJoinQuery(options);
    expect(sql).toContain("LEFT JOIN");
  });

  it("should throw on invalid join type", () => {
    const options = {
      tables: [{ name: "sales" }, { name: "employees" }],
      on: [
        {
          left: "sales.employee_id",
          right: "employees.id",
          type: "INVALID" as unknown as JoinOptions["on"][number]["type"],
        },
      ],
    };

    expect(() => buildJoinQuery(options)).toThrow(/Invalid join type/);
  });

  it("should validate WHERE clause", () => {
    const options: JoinOptions = {
      tables: [{ name: "sales" }, { name: "employees" }],
      on: [{ left: "sales.employee_id", right: "employees.id" }],
      where: "; DROP TABLE users",
    };

    expect(() => buildJoinQuery(options)).toThrow(/dangerous patterns/);
  });

  it("should throw on negative LIMIT", () => {
    const options: JoinOptions = {
      tables: [{ name: "sales" }, { name: "employees" }],
      on: [{ left: "sales.employee_id", right: "employees.id" }],
      limit: -1,
    };

    expect(() => buildJoinQuery(options)).toThrow(/non-negative integer/);
  });
});

describe("buildAggregateQuery", () => {
  it("should build SUM aggregation", () => {
    const options: AggregateOptions = {
      table: "sales",
      field: "amount",
      operation: "SUM",
      alias: "total",
    };

    const sql = buildAggregateQuery(options);
    expect(sql).toContain('SUM("amount")');
    expect(sql).toContain('AS "total"');
    expect(sql).toContain('FROM "sales"');
  });

  it("should build COUNT DISTINCT", () => {
    const options: AggregateOptions = {
      table: "sales",
      field: "customer_id",
      operation: "COUNT_DISTINCT",
    };

    const sql = buildAggregateQuery(options);
    expect(sql).toContain('COUNT(DISTINCT "customer_id")');
  });

  it("should include GROUP BY", () => {
    const options: AggregateOptions = {
      table: "sales",
      field: "amount",
      operation: "SUM",
      groupBy: ["region", "category"],
    };

    const sql = buildAggregateQuery(options);
    expect(sql).toContain('GROUP BY "region", "category"');
    expect(sql).toContain('"region", "category", SUM');
  });

  it("should throw on invalid aggregation", () => {
    const options = {
      table: "sales",
      field: "amount",
      operation: "INVALID" as unknown as AggregateOptions["operation"],
    };

    expect(() => buildAggregateQuery(options)).toThrow(
      /Invalid aggregation operation/
    );
  });

  it("should validate WHERE and HAVING clauses", () => {
    const options: AggregateOptions = {
      table: "sales",
      field: "amount",
      operation: "SUM",
      where: "; DROP TABLE users",
    };

    expect(() => buildAggregateQuery(options)).toThrow(/dangerous patterns/);

    const options2: AggregateOptions = {
      table: "sales",
      field: "amount",
      operation: "SUM",
      having: "-- malicious",
    };

    expect(() => buildAggregateQuery(options2)).toThrow(/dangerous patterns/);
  });
});

describe("buildCountQuery", () => {
  it("should build simple count query", () => {
    const sql = buildCountQuery("sales");
    expect(sql).toBe('SELECT COUNT(*) AS count FROM "sales"');
  });

  it("should include WHERE clause", () => {
    const sql = buildCountQuery("sales", "amount > 1000");
    expect(sql).toContain("WHERE amount > 1000");
  });

  it("should validate WHERE clause", () => {
    expect(() => buildCountQuery("sales", "; DROP TABLE users")).toThrow(
      /dangerous patterns/
    );
  });
});

describe("buildSampleQuery", () => {
  it("should build basic sample query", () => {
    const sql = buildSampleQuery("sales");
    expect(sql).toContain('SELECT * FROM "sales"');
    expect(sql).toContain("LIMIT 100");
  });

  it("should support random sampling", () => {
    const sql = buildSampleQuery("sales", { random: true, limit: 50 });
    expect(sql).toContain("ORDER BY RANDOM()");
    expect(sql).toContain("LIMIT 50");
  });

  it("should throw on negative limit", () => {
    expect(() => buildSampleQuery("sales", { limit: -1 })).toThrow(
      /non-negative integer/
    );
  });

  it("should validate WHERE clause", () => {
    expect(() =>
      buildSampleQuery("sales", { where: "; DROP TABLE users" })
    ).toThrow(/dangerous patterns/);
  });
});

describe("buildWhereClause", () => {
  it("should build simple equality conditions", () => {
    const { whereClause, params } = buildWhereClause({
      region: "North",
      status: "active",
    });

    expect(whereClause).toContain('"region" = $param_region');
    expect(whereClause).toContain('"status" = $param_status');
    expect(params).toEqual({
      param_region: "North",
      param_status: "active",
    });
  });

  it("should support comparison operators", () => {
    const { whereClause, params } = buildWhereClause({
      amount: { op: ">", value: 1000 },
      rating: { op: "<=", value: 5 },
    });

    expect(whereClause).toContain('"amount" > $param_amount');
    expect(whereClause).toContain('"rating" <= $param_rating');
    expect(params.param_amount).toBe(1000);
    expect(params.param_rating).toBe(5);
  });

  it("should handle NULL values", () => {
    const { whereClause, params } = buildWhereClause({
      notes: null,
      archived: { op: "IS NULL", value: null },
    });

    expect(whereClause).toContain('"notes" IS NULL');
    expect(whereClause).toContain('"archived" IS NULL');
    expect(Object.keys(params)).toHaveLength(0);
  });

  it("should throw on invalid operator", () => {
    expect(() =>
      buildWhereClause({
        amount: { op: "INVALID", value: 1000 },
      })
    ).toThrow(/Invalid operator/);
  });
});

describe("QueryBuilder", () => {
  it("should build simple SELECT query", () => {
    const { sql, params } = QueryBuilder.from("sales")
      .select(["region", "amount"])
      .build();

    expect(sql).toContain('SELECT "region", "amount"');
    expect(sql).toContain('FROM "sales"');
    expect(params).toEqual({});
  });

  it("should build query with WHERE conditions", () => {
    const { sql, params } = QueryBuilder.from("sales")
      .where("region", "=", "North")
      .where("amount", ">", 1000)
      .build();

    expect(sql).toContain('WHERE "region" = $param0 AND "amount" > $param1');
    expect(params).toEqual({
      param0: "North",
      param1: 1000,
    });
  });

  it("should build query with GROUP BY and ORDER BY", () => {
    const { sql } = QueryBuilder.from("sales")
      .select(["region"])
      .groupBy(["region"])
      .orderBy("region", "DESC")
      .build();

    expect(sql).toContain('GROUP BY "region"');
    expect(sql).toContain('ORDER BY "region" DESC');
  });

  it("should build query with LIMIT", () => {
    const { sql } = QueryBuilder.from("sales").limit(10).build();

    expect(sql).toContain("LIMIT 10");
  });

  it("should throw on invalid table name", () => {
    expect(() => QueryBuilder.from("DROP")).toThrow(/SQL keyword/);
  });

  it("should throw on invalid column names", () => {
    expect(() => QueryBuilder.from("sales").select(["invalid-col"])).toThrow(
      /Invalid identifier/
    );
  });

  it("should throw on invalid operator", () => {
    expect(() =>
      QueryBuilder.from("sales").where("amount", "INVALID", 1000)
    ).toThrow(/Invalid operator/);
  });

  it("should throw on invalid LIMIT", () => {
    expect(() => QueryBuilder.from("sales").limit(-1)).toThrow(
      /positive integer/
    );
    expect(() => QueryBuilder.from("sales").limit(0)).toThrow(
      /positive integer/
    );
  });
});

describe("extractTableNames", () => {
  it("should extract table from simple SELECT", () => {
    const tables = extractTableNames("SELECT * FROM sales");
    expect(tables).toEqual(["sales"]);
  });

  it("should extract tables from JOIN", () => {
    const tables = extractTableNames(
      "SELECT * FROM sales INNER JOIN employees ON sales.emp_id = employees.id"
    );
    expect(tables).toContain("sales");
    expect(tables).toContain("employees");
  });

  it("should handle quoted identifiers", () => {
    const tables = extractTableNames('SELECT * FROM "my_table"');
    expect(tables).toEqual(["my_table"]);
  });

  it("should extract unique table names", () => {
    const tables = extractTableNames(
      "SELECT * FROM sales s1 INNER JOIN sales s2 ON s1.id = s2.parent_id"
    );
    expect(tables).toEqual(["sales"]);
  });
});
