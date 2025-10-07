import { describe, it, expect } from "vitest";
import {
  datasetToIPC,
  ipcToDataset,
  tableToIPC,
  ipcToTable,
  isValidIPC,
  getIPCFormat,
  getIPCMetadata,
  estimateIPCSize,
  convertIPCFormat,
  datasetToIPCPartitions,
  mergeIPCFiles,
} from "./arrowIPCConverter";
import type { ParsedDataset } from "@open-dashboard/shared/types";
import { datasetToArrow } from "./arrowConverter";

describe("arrowIPCConverter", () => {
  describe("datasetToIPC", () => {
    describe("basic conversion", () => {
      it("should convert simple dataset to IPC stream format", async () => {
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

        const { buffer, warnings } = await datasetToIPC(dataset);

        expect(buffer).toBeInstanceOf(ArrayBuffer);
        expect(buffer.byteLength).toBeGreaterThan(0);
        expect(warnings).toHaveLength(0);
      });

      it("should use stream format by default", async () => {
        const dataset: ParsedDataset = {
          id: "test-2",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [{ name: "value", type: "number" }],
          },
          data: [{ value: 42 }],
        };

        const { buffer } = await datasetToIPC(dataset);

        expect(getIPCFormat(buffer)).toBe("stream");
      });

      it("should support file format option", async () => {
        const dataset: ParsedDataset = {
          id: "test-3",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [{ name: "value", type: "number" }],
          },
          data: [{ value: 42 }],
        };

        const { buffer } = await datasetToIPC(dataset, { format: "file" });

        expect(getIPCFormat(buffer)).toBe("file");
      });

      it("should handle all data types", async () => {
        const testDate = new Date("2024-01-15");
        const dataset: ParsedDataset = {
          id: "test-4",
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

        const { buffer, warnings } = await datasetToIPC(dataset);

        expect(buffer.byteLength).toBeGreaterThan(0);
        expect(warnings).toHaveLength(0);
      });
    });

    describe("empty dataset handling", () => {
      it("should handle empty dataset", async () => {
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

        const { buffer, warnings } = await datasetToIPC(dataset);

        expect(buffer.byteLength).toBeGreaterThan(0);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("empty");
      });
    });

    describe("options", () => {
      it("should pass through date format option", async () => {
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

        const { buffer } = await datasetToIPC(dataset, {
          dateFormat: "microsecond",
        });

        expect(buffer.byteLength).toBeGreaterThan(0);
      });

      it("should collect warnings from arrow conversion", async () => {
        const dataset: ParsedDataset = {
          id: "options-2",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [
              { name: "id", type: "number" },
              { name: "missing", type: "string" },
            ],
          },
          data: [{ id: 1 }, { id: 2 }], // missing field
        };

        const { warnings } = await datasetToIPC(dataset);

        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings.some((w) => w.includes("missing"))).toBe(true);
      });
    });
  });

  describe("ipcToDataset", () => {
    describe("basic conversion", () => {
      it("should convert IPC buffer back to dataset", async () => {
        const original: ParsedDataset = {
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

        const { buffer } = await datasetToIPC(original);
        const converted = await ipcToDataset(buffer);

        expect(converted.data).toHaveLength(2);
        expect(converted.schema.fields).toHaveLength(2);
        expect(converted.data[0].id).toBe(1);
        expect(converted.data[0].name).toBe("Alice");
      });

      it("should handle both stream and file formats", async () => {
        const dataset: ParsedDataset = {
          id: "test-2",
          name: "test-dataset",
          sourceType: "json",
          createdAt: new Date(),
          schema: {
            fields: [{ name: "value", type: "number" }],
          },
          data: [{ value: 42 }],
        };

        // Test stream format
        const { buffer: streamBuffer } = await datasetToIPC(dataset, {
          format: "stream",
        });
        const fromStream = await ipcToDataset(streamBuffer);
        expect(fromStream.data[0].value).toBe(42);

        // Test file format
        const { buffer: fileBuffer } = await datasetToIPC(dataset, {
          format: "file",
        });
        const fromFile = await ipcToDataset(fileBuffer);
        expect(fromFile.data[0].value).toBe(42);
      });
    });

    describe("error handling", () => {
      it("should throw error for empty buffer", async () => {
        const emptyBuffer = new ArrayBuffer(0);

        await expect(ipcToDataset(emptyBuffer)).rejects.toThrow(
          "buffer is empty"
        );
      });

      it("should throw error for null buffer", async () => {
        await expect(
          ipcToDataset(null as unknown as ArrayBuffer)
        ).rejects.toThrow("buffer is empty or null");
      });

      it("should throw error for invalid buffer", async () => {
        const invalidBuffer = new ArrayBuffer(100);
        new Uint8Array(invalidBuffer).fill(0);

        await expect(ipcToDataset(invalidBuffer)).rejects.toThrow(
          "Failed to parse Arrow IPC"
        );
      });
    });
  });

  describe("tableToIPC", () => {
    it("should convert Arrow Table to IPC stream", async () => {
      const dataset: ParsedDataset = {
        id: "test-1",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [{ value: 42 }],
      };

      const { table } = datasetToArrow(dataset);
      const buffer = await tableToIPC(table);

      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it("should support file format", async () => {
      const dataset: ParsedDataset = {
        id: "test-2",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [{ value: 42 }],
      };

      const { table } = datasetToArrow(dataset);
      const buffer = await tableToIPC(table, { format: "file" });

      expect(getIPCFormat(buffer)).toBe("file");
    });

    it("should throw error for empty table", async () => {
      const dataset: ParsedDataset = {
        id: "empty",
        name: "empty-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [],
      };

      const { table } = datasetToArrow(dataset);

      await expect(tableToIPC(table)).rejects.toThrow("empty table");
    });
  });

  describe("ipcToTable", () => {
    it("should convert IPC buffer to Arrow Table", async () => {
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

      const { buffer } = await datasetToIPC(dataset);
      const table = await ipcToTable(buffer);

      expect(table.numRows).toBe(2);
      expect(table.numCols).toBe(2);
    });

    it("should throw error for invalid buffer", async () => {
      const invalidBuffer = new ArrayBuffer(50);

      await expect(ipcToTable(invalidBuffer)).rejects.toThrow(
        "Failed to read Arrow IPC"
      );
    });
  });

  describe("isValidIPC", () => {
    it("should validate stream format", async () => {
      const dataset: ParsedDataset = {
        id: "test-1",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [{ value: 42 }],
      };

      const { buffer } = await datasetToIPC(dataset, { format: "stream" });

      expect(isValidIPC(buffer)).toBe(true);
    });

    it("should validate file format", async () => {
      const dataset: ParsedDataset = {
        id: "test-2",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [{ value: 42 }],
      };

      const { buffer } = await datasetToIPC(dataset, { format: "file" });

      expect(isValidIPC(buffer)).toBe(true);
    });

    it("should return false for invalid buffer", () => {
      const invalidBuffer = new ArrayBuffer(100);
      new Uint8Array(invalidBuffer).fill(0);

      expect(isValidIPC(invalidBuffer)).toBe(false);
    });

    it("should return false for empty buffer", () => {
      const emptyBuffer = new ArrayBuffer(0);

      expect(isValidIPC(emptyBuffer)).toBe(false);
    });

    it("should return false for small buffer", () => {
      const smallBuffer = new ArrayBuffer(4);

      expect(isValidIPC(smallBuffer)).toBe(false);
    });
  });

  describe("getIPCFormat", () => {
    it("should detect stream format", async () => {
      const dataset: ParsedDataset = {
        id: "test-1",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [{ value: 42 }],
      };

      const { buffer } = await datasetToIPC(dataset, { format: "stream" });

      expect(getIPCFormat(buffer)).toBe("stream");
    });

    it("should detect file format", async () => {
      const dataset: ParsedDataset = {
        id: "test-2",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [{ value: 42 }],
      };

      const { buffer } = await datasetToIPC(dataset, { format: "file" });

      expect(getIPCFormat(buffer)).toBe("file");
    });

    it("should return unknown for invalid buffer", () => {
      const invalidBuffer = new ArrayBuffer(100);
      new Uint8Array(invalidBuffer).fill(0);

      expect(getIPCFormat(invalidBuffer)).toBe("unknown");
    });

    it("should return unknown for small buffer", () => {
      const smallBuffer = new ArrayBuffer(4);

      expect(getIPCFormat(smallBuffer)).toBe("unknown");
    });
  });

  describe("getIPCMetadata", () => {
    it("should extract metadata from IPC buffer", async () => {
      const dataset: ParsedDataset = {
        id: "test-1",
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
        ],
      };

      const { buffer } = await datasetToIPC(dataset);
      const metadata = await getIPCMetadata(buffer);

      expect(metadata.numRows).toBe(2);
      expect(metadata.numColumns).toBe(3);
      expect(metadata.schema).toEqual(["id", "name", "active"]);
      expect(metadata.fileSize).toBe(buffer.byteLength);
      expect(metadata.format).toBe("stream");
    });

    it("should include format in metadata", async () => {
      const dataset: ParsedDataset = {
        id: "test-2",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [{ value: 42 }],
      };

      const { buffer: streamBuffer } = await datasetToIPC(dataset, {
        format: "stream",
      });
      const streamMeta = await getIPCMetadata(streamBuffer);
      expect(streamMeta.format).toBe("stream");

      const { buffer: fileBuffer } = await datasetToIPC(dataset, {
        format: "file",
      });
      const fileMeta = await getIPCMetadata(fileBuffer);
      expect(fileMeta.format).toBe("file");
    });
  });

  describe("estimateIPCSize", () => {
    it("should estimate size for non-empty dataset", () => {
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

      const estimate = estimateIPCSize(dataset);

      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(JSON.stringify(dataset.data).length);
    });

    it("should estimate larger size for file format", () => {
      const dataset: ParsedDataset = {
        id: "test-2",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: Array.from({ length: 100 }, (_, i) => ({ value: i })),
      };

      const streamEstimate = estimateIPCSize(dataset, "stream");
      const fileEstimate = estimateIPCSize(dataset, "file");

      expect(fileEstimate).toBeGreaterThan(streamEstimate);
    });

    it("should return minimum size for empty dataset", () => {
      const dataset: ParsedDataset = {
        id: "empty",
        name: "empty-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [],
      };

      const estimate = estimateIPCSize(dataset);

      expect(estimate).toBe(1024);
    });
  });

  describe("convertIPCFormat", () => {
    it("should convert from stream to file format", async () => {
      const dataset: ParsedDataset = {
        id: "test-1",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [{ value: 42 }],
      };

      const { buffer: streamBuffer } = await datasetToIPC(dataset, {
        format: "stream",
      });
      const fileBuffer = await convertIPCFormat(streamBuffer, "file");

      expect(getIPCFormat(fileBuffer)).toBe("file");
    });

    it("should convert from file to stream format", async () => {
      const dataset: ParsedDataset = {
        id: "test-2",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [{ value: 42 }],
      };

      const { buffer: fileBuffer } = await datasetToIPC(dataset, {
        format: "file",
      });
      const streamBuffer = await convertIPCFormat(fileBuffer, "stream");

      expect(getIPCFormat(streamBuffer)).toBe("stream");
    });

    it("should preserve data through format conversion", async () => {
      const dataset: ParsedDataset = {
        id: "test-3",
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

      const { buffer: streamBuffer } = await datasetToIPC(dataset, {
        format: "stream",
      });
      const fileBuffer = await convertIPCFormat(streamBuffer, "file");
      const converted = await ipcToDataset(fileBuffer);

      expect(converted.data).toEqual(dataset.data);
    });
  });

  describe("datasetToIPCPartitions", () => {
    it("should split dataset into partitions", async () => {
      const dataset: ParsedDataset = {
        id: "test-1",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [
            { name: "id", type: "number" },
            { name: "value", type: "string" },
          ],
        },
        data: Array.from({ length: 250 }, (_, i) => ({
          id: i,
          value: `Item${i}`,
        })),
      };

      const partitions = await datasetToIPCPartitions(dataset, 100);

      expect(partitions).toHaveLength(3);
      expect(partitions[0].numRows).toBe(100);
      expect(partitions[1].numRows).toBe(100);
      expect(partitions[2].numRows).toBe(50);
    });

    it("should include correct partition metadata", async () => {
      const dataset: ParsedDataset = {
        id: "test-2",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "id", type: "number" }],
        },
        data: Array.from({ length: 150 }, (_, i) => ({ id: i })),
      };

      const partitions = await datasetToIPCPartitions(dataset, 50);

      expect(partitions[0].startRow).toBe(0);
      expect(partitions[0].endRow).toBe(50);
      expect(partitions[0].partitionIndex).toBe(0);

      expect(partitions[1].startRow).toBe(50);
      expect(partitions[1].endRow).toBe(100);
      expect(partitions[1].partitionIndex).toBe(1);

      expect(partitions[2].startRow).toBe(100);
      expect(partitions[2].endRow).toBe(150);
      expect(partitions[2].partitionIndex).toBe(2);
    });

    it("should create valid IPC buffers", async () => {
      const dataset: ParsedDataset = {
        id: "test-3",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: Array.from({ length: 100 }, (_, i) => ({ value: i })),
      };

      const partitions = await datasetToIPCPartitions(dataset, 30);

      for (const partition of partitions) {
        expect(isValidIPC(partition.buffer)).toBe(true);
        const converted = await ipcToDataset(partition.buffer);
        expect(converted.data).toHaveLength(partition.numRows);
      }
    });

    it("should throw error for invalid rowsPerFile", async () => {
      const dataset: ParsedDataset = {
        id: "test-4",
        name: "test-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [{ value: 42 }],
      };

      await expect(datasetToIPCPartitions(dataset, 0)).rejects.toThrow(
        "rowsPerFile must be greater than 0"
      );

      await expect(datasetToIPCPartitions(dataset, -10)).rejects.toThrow(
        "rowsPerFile must be greater than 0"
      );
    });

    it("should throw error for empty dataset", async () => {
      const dataset: ParsedDataset = {
        id: "empty",
        name: "empty-dataset",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "number" }],
        },
        data: [],
      };

      await expect(datasetToIPCPartitions(dataset, 100)).rejects.toThrow(
        "Cannot partition empty dataset"
      );
    });
  });

  describe("mergeIPCFiles", () => {
    it("should merge multiple IPC files", async () => {
      const dataset1: ParsedDataset = {
        id: "test-1",
        name: "dataset-1",
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

      const dataset2: ParsedDataset = {
        ...dataset1,
        id: "test-2",
        data: [
          { id: 3, name: "Carol" },
          { id: 4, name: "Dave" },
        ],
      };

      const { buffer: buffer1 } = await datasetToIPC(dataset1);
      const { buffer: buffer2 } = await datasetToIPC(dataset2);

      const merged = await mergeIPCFiles([buffer1, buffer2]);

      expect(merged.data).toHaveLength(4);
      expect(merged.data[0].id).toBe(1);
      expect(merged.data[2].id).toBe(3);
    });

    it("should preserve schema", async () => {
      const dataset1: ParsedDataset = {
        id: "test-1",
        name: "dataset-1",
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

      const dataset2: ParsedDataset = {
        ...dataset1,
        id: "test-2",
        data: [{ id: 2, value: "data" }],
      };

      const { buffer: buffer1 } = await datasetToIPC(dataset1);
      const { buffer: buffer2 } = await datasetToIPC(dataset2);

      const merged = await mergeIPCFiles([buffer1, buffer2]);

      const sortedFields = merged.schema.fields
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      expect(sortedFields.find((f) => f.name === "id")?.type).toBe("number");
      expect(sortedFields.find((f) => f.name === "value")?.type).toBe("string");
    });

    it("should throw error for incompatible schemas", async () => {
      const dataset1: ParsedDataset = {
        id: "test-1",
        name: "dataset-1",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "id", type: "number" }],
        },
        data: [{ id: 1 }],
      };

      const dataset2: ParsedDataset = {
        id: "test-2",
        name: "dataset-2",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "value", type: "string" }], // Different schema
        },
        data: [{ value: "test" }],
      };

      const { buffer: buffer1 } = await datasetToIPC(dataset1);
      const { buffer: buffer2 } = await datasetToIPC(dataset2);

      await expect(mergeIPCFiles([buffer1, buffer2])).rejects.toThrow(
        "Schema mismatch"
      );
    });

    it("should throw error for empty array", async () => {
      await expect(mergeIPCFiles([])).rejects.toThrow(
        "No IPC files provided to merge"
      );
    });

    it("should handle single file", async () => {
      const dataset: ParsedDataset = {
        id: "test-1",
        name: "dataset-1",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "id", type: "number" }],
        },
        data: [{ id: 1 }, { id: 2 }],
      };

      const { buffer } = await datasetToIPC(dataset);
      const merged = await mergeIPCFiles([buffer]);

      expect(merged.data).toHaveLength(2);
    });

    it("should add merge metadata", async () => {
      const dataset: ParsedDataset = {
        id: "test-1",
        name: "dataset-1",
        sourceType: "json",
        createdAt: new Date(),
        schema: {
          fields: [{ name: "id", type: "number" }],
        },
        data: [{ id: 1 }],
      };

      const { buffer: buffer1 } = await datasetToIPC(dataset);
      const { buffer: buffer2 } = await datasetToIPC(dataset);
      const { buffer: buffer3 } = await datasetToIPC(dataset);

      const merged = await mergeIPCFiles([buffer1, buffer2, buffer3]);

      expect(merged.metadata?.mergedFrom).toBe(3);
      expect(merged.metadata?.totalRows).toBe(3);
    });
  });

  describe("round-trip conversion", () => {
    it("should preserve data through round-trip", async () => {
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

      const { buffer } = await datasetToIPC(original);
      const converted = await ipcToDataset(buffer);

      expect(converted.data).toEqual(original.data);
    });

    it("should preserve schema through round-trip", async () => {
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

      const { buffer } = await datasetToIPC(original);
      const converted = await ipcToDataset(buffer);

      // Find fields by name instead of relying on index order
      const idField = converted.schema.fields.find((f) => f.name === "id");
      const valueField = converted.schema.fields.find(
        (f) => f.name === "value"
      );

      expect(idField?.type).toBe("number");
      expect(idField?.nullable).toBe(false);
      expect(valueField?.type).toBe("string");
      expect(valueField?.nullable).toBe(true);
    });

    it("should handle null values in round-trip", async () => {
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

      const { buffer } = await datasetToIPC(original);
      const converted = await ipcToDataset(buffer);

      expect(converted.data[0].optional).toBe("value");
      expect(converted.data[1].optional).toBeNull();
      expect(converted.data[2].optional).toBeNull();
    });

    it("should preserve dates through round-trip", async () => {
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
        data: [{ id: 1, timestamp: testDate }],
      };

      const { buffer } = await datasetToIPC(original);
      const converted = await ipcToDataset(buffer);

      // Debug: Check what type the schema says
      const timestampField = converted.schema.fields.find(
        (f) => f.name === "timestamp"
      );
      console.log("Timestamp field:", timestampField);
      console.log("Timestamp value:", converted.data[0].timestamp);
      console.log("Timestamp type:", typeof converted.data[0].timestamp);

      expect(converted.data[0].timestamp).toBeInstanceOf(Date);
      expect((converted.data[0].timestamp as Date).getTime()).toBe(
        testDate.getTime()
      );
    });

    it("should handle large dataset round-trip", async () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
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

      const { buffer } = await datasetToIPC(original);
      const converted = await ipcToDataset(buffer);

      expect(converted.data).toHaveLength(10000);
      expect(converted.data[0].id).toBe(0);
      expect(converted.data[9999].id).toBe(9999);
    });
  });
});
