import type { DataAdapter, ParsedDataset } from "@open-dashboard/shared/types";
import type { ParserOptions } from "../types/parser";
import { buildSchemaFromData, validateSchema } from "../utils/schemaBuilder";
import { DataParsingError } from "./csvAdapter";

export class JSONAdapter implements DataAdapter {
  getSupportedTypes(): string[] {
    return [".json", "application/json", "text/json"];
  }

  validate(input: unknown): boolean {
    if (typeof input === "string") {
      try {
        JSON.parse(input);
        return true;
      } catch {
        return false;
      }
    }
    if (input instanceof File) {
      return (
        input.name.toLowerCase().endsWith(".json") ||
        input.type === "application/json"
      );
    }
    return false;
  }

  async parse(
    input: string | File | URL,
    options: ParserOptions = {}
  ): Promise<ParsedDataset> {
    const startTime = performance.now();
    let content: string;
    let filename = "unknown.json";

    if (typeof input === "string") {
      content = input;
    } else if (input instanceof File) {
      filename = input.name;
      content = await input.text();
    } else if (input instanceof URL) {
      filename = input.pathname.split("/").pop() || "remote.json";
      const response = await fetch(input);
      if (!response.ok) {
        throw new DataParsingError(
          `Failed to fetch JSON from ${input.toString()}: ${response.statusText}`,
          filename
        );
      }
      content = await response.text();
    } else {
      throw new DataParsingError("Unsupported input type for JSON parser");
    }

    try {
      const parsed = JSON.parse(content);
      const data = this.extractDataArray(parsed);

      if (data.length === 0) {
        throw new DataParsingError("No data found in JSON", filename);
      }

      const allFields = new Set<string>();
      data.forEach((row) => {
        if (typeof row === "object" && row !== null) {
          Object.keys(row).forEach((key) => allFields.add(key));
        }
      });

      const fieldNames = Array.from(allFields);
      const schema = buildSchemaFromData(data, fieldNames, options.sampleSize);

      if (!validateSchema(schema)) {
        throw new DataParsingError(
          "Invalid schema generated from JSON",
          filename
        );
      }

      const limitedData = options.maxRows
        ? data.slice(0, options.maxRows)
        : data;
      const parseTime = performance.now() - startTime;

      return {
        id: this.generateId(),
        name: filename,
        data: limitedData,
        schema,
        sourceType: "json",
        createdAt: new Date(),
        metadata: {
          parseTime,
          rowCount: limitedData.length,
          columnCount: schema.fields.length,
        },
      };
    } catch (error) {
      if (error instanceof DataParsingError) {
        throw error;
      }
      if (error instanceof SyntaxError) {
        throw new DataParsingError(
          `Invalid JSON syntax: ${error.message}`,
          filename
        );
      }
      throw new DataParsingError(
        `Failed to parse JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
        filename
      );
    }
  }

  private extractDataArray(parsed: unknown): Record<string, unknown>[] {
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => {
        if (typeof item === "object" && item !== null) {
          return item as Record<string, unknown>;
        }
        return { value: item, index };
      });
    }

    if (typeof parsed === "object" && parsed !== null) {
      const values = Object.values(parsed);
      const arrayProperty = values.find((value) => Array.isArray(value));

      if (arrayProperty) {
        return this.extractDataArray(arrayProperty);
      }

      return [parsed as Record<string, unknown>];
    }

    throw new DataParsingError(
      "JSON must be an array or object containing an array"
    );
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
