import Papa from "papaparse";
import type { DataAdapter, ParsedDataset } from "@open-dashboard/shared/types";
import type { ParserOptions } from "../types/parser";
import { buildSchemaFromData, validateSchema } from "../utils/schemaBuilder";

export class DataParsingError extends Error {
  constructor(
    message: string,
    public readonly filename?: string,
    public readonly line?: number
  ) {
    super(message);
    this.name = "DataParsingError";
  }
}

export class CSVAdapter implements DataAdapter {
  getSupportedTypes(): string[] {
    return [".csv", "text/csv", "text/plain"];
  }

  validate(input: unknown): boolean {
    if (typeof input === "string") {
      return input.includes(",") || input.includes("\n");
    }
    if (input instanceof File) {
      return (
        input.name.toLowerCase().endsWith(".csv") || input.type === "text/csv"
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
    let filename = "unknown.csv";

    // Extract content from different input types
    if (typeof input === "string") {
      content = input;
    } else if (input instanceof File) {
      filename = input.name;
      content = await input.text();
    } else if (input instanceof URL) {
      filename = input.pathname.split("/").pop() || "remote.csv";
      const response = await fetch(input);
      if (!response.ok) {
        throw new DataParsingError(
          `Failed to fetch CSV from ${input.toString()}: ${response.statusText}`,
          filename
        );
      }
      content = await response.text();
    } else {
      throw new DataParsingError("Unsupported input type for CSV parser");
    }

    try {
      const parseResult = await this.parseCSVContent(
        content,
        options,
        filename
      );
      const parseTime = performance.now() - startTime;

      return {
        id: this.generateId(),
        name: filename,
        data: parseResult.data,
        schema: parseResult.schema,
        sourceType: "csv",
        createdAt: new Date(),
        metadata: {
          parseTime,
          rowCount: parseResult.data.length,
          columnCount: parseResult.schema.fields.length,
          encoding: options.encoding || "UTF-8",
        },
      };
    } catch (error) {
      if (error instanceof DataParsingError) {
        throw error;
      }
      throw new DataParsingError(
        `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
        filename
      );
    }
  }

  private async parseCSVContent(
    content: string,
    options: ParserOptions,
    filename: string
  ): Promise<{
    data: Record<string, unknown>[];
    schema: import("@open-dashboard/shared/types").DatasetSchema;
  }> {
    return new Promise((resolve, reject) => {
      Papa.parse(content, {
        header: options.hasHeader !== false,
        delimiter: options.delimiter || ",",
        dynamicTyping: options.inferTypes !== false,
        transformHeader: (header: string) => header.trim(),
        // Add these to handle malformed CSV more gracefully:
        skipEmptyLines: "greedy", // Skip empty lines more aggressively
        delimitersToGuess: [",", "\t", "|", ";"], // Auto-detect delimiter

        complete: (results) => {
          // Only reject if there are critical errors
          const criticalErrors = results.errors.filter(
            (err) => err.type === "Quotes" || err.type === "FieldMismatch"
          );

          if (criticalErrors.length > 0) {
            const firstError = criticalErrors[0];
            reject(
              new DataParsingError(
                `CSV parsing error: ${firstError.message}`,
                filename,
                firstError.row
              )
            );
            return;
          }

          const data = results.data as Record<string, unknown>[];

          if (data.length === 0) {
            reject(new DataParsingError("CSV file is empty", filename));
            return;
          }

          const fieldNames = Object.keys(data[0]);
          const schema = buildSchemaFromData(
            data,
            fieldNames,
            options.sampleSize
          );

          if (!validateSchema(schema)) {
            reject(
              new DataParsingError(
                "Invalid schema generated from CSV",
                filename
              )
            );
            return;
          }

          const limitedData = options.maxRows
            ? data.slice(0, options.maxRows)
            : data;
          resolve({ data: limitedData, schema });
        },
        error: (error: { message: unknown }) => {
          reject(
            new DataParsingError(
              `PapaParse error: ${String(error.message)}`,
              filename
            )
          );
        },
      });
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
