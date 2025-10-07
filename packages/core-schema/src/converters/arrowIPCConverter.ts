import * as arrow from "apache-arrow";
import type { ParsedDataset } from "@open-dashboard/shared/types";
import type { ArrowConversionOptions } from "../types/converters";
import { datasetToArrow, arrowToDataset } from "./arrowConverter";

/**
 * Arrow IPC (Inter-Process Communication) Converter
 *
 * Arrow IPC format provides:
 * - Columnar storage (like Parquet)
 * - Zero-copy reads
 * - Fast serialization/deserialization
 * - Excellent browser support
 * - Streaming capabilities
 *
 * Use cases:
 * - Data transfer between web workers
 * - Efficient local storage
 * - API responses with large datasets
 * - Caching query results
 */

export type IPCFormat = "stream" | "file";

export interface IPCOptions extends ArrowConversionOptions {
  /**
   * Format type:
   * - "stream": RecordBatch stream format (default, better for streaming)
   * - "file": Arrow file format (better for random access)
   */
  format?: IPCFormat;
}

// Store format metadata using a Symbol property on the buffer
const FORMAT_SYMBOL = Symbol("ipc-format");

// Arrow IPC magic bytes for format detection
const ARROW_MAGIC_STREAM = new Uint8Array([0xff, 0xff, 0xff, 0xff]); // Stream format
const ARROW_MAGIC_FILE = new Uint8Array([0x41, 0x52, 0x52, 0x4f, 0x57, 0x31]); // "ARROW1"

/**
 * Validates if a buffer contains valid Arrow IPC magic bytes
 */
function hasValidArrowMagic(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 6) {
    return false;
  }

  const bytes = new Uint8Array(buffer);

  // Check for stream format magic (0xFFFFFFFF at start)
  if (bytes.length >= 4) {
    const streamMatch = bytes
      .slice(0, 4)
      .every((byte, i) => byte === ARROW_MAGIC_STREAM[i]);
    if (streamMatch) return true;
  }

  // Check for file format magic ("ARROW1" at start)
  if (bytes.length >= 6) {
    const fileMatch = bytes
      .slice(0, 6)
      .every((byte, i) => byte === ARROW_MAGIC_FILE[i]);
    if (fileMatch) return true;
  }

  return false;
}

/**
 * Converts ParsedDataset to Arrow IPC format
 *
 * @param dataset - Dataset to convert
 * @param options - IPC conversion options
 * @returns IPC buffer and any conversion warnings
 *
 * @example
 * ```typescript
 * const { buffer, warnings } = await datasetToIPC(dataset, {
 *   format: 'stream',
 *   dateFormat: 'millisecond'
 * });
 *
 * // Save to file or send over network
 * await saveFile('data.arrow', buffer);
 * ```
 */
export async function datasetToIPC(
  dataset: ParsedDataset,
  options?: IPCOptions
): Promise<{
  buffer: ArrayBuffer;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const format = options?.format || "stream";

  // Convert to Arrow Table
  const { table, warnings: arrowWarnings } = datasetToArrow(dataset, {
    dateFormat: options?.dateFormat,
    preserveMetadata: options?.preserveMetadata,
    nullableByDefault: options?.nullableByDefault,
  });
  warnings.push(...arrowWarnings);

  // Handle empty dataset - Arrow supports empty tables but we need special handling
  if (table.numRows === 0) {
    // Create a minimal IPC buffer with schema only
    try {
      // Force creation even for empty table by using the writer directly
      let ipcBuffer: Uint8Array;

      if (format === "file") {
        const writer = arrow.RecordBatchFileWriter.writeAll(table);
        ipcBuffer = await writer.toUint8Array();
      } else {
        const writer = arrow.RecordBatchStreamWriter.writeAll(table);
        ipcBuffer = await writer.toUint8Array();
      }

      let buffer: ArrayBuffer;
      if (ipcBuffer.buffer instanceof ArrayBuffer) {
        buffer = ipcBuffer.buffer.slice(
          ipcBuffer.byteOffset,
          ipcBuffer.byteOffset + ipcBuffer.byteLength
        );
      } else {
        // If buffer is SharedArrayBuffer, copy to ArrayBuffer
        buffer = new ArrayBuffer(ipcBuffer.byteLength);
        new Uint8Array(buffer).set(ipcBuffer);
      }

      // Store format metadata
      (buffer as unknown as Record<symbol, unknown>)[FORMAT_SYMBOL] = format;

      return { buffer, warnings };
    } catch (error) {
      throw new Error(
        `Failed to convert empty dataset to Arrow IPC: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Convert to IPC format
  try {
    const buffer = await tableToIPC(table, options);
    return { buffer, warnings };
  } catch (error) {
    throw new Error(
      `Failed to convert to Arrow IPC: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Converts Arrow IPC buffer to ParsedDataset
 *
 * @param buffer - Arrow IPC buffer
 * @returns Parsed dataset
 *
 * @example
 * ```typescript
 * const buffer = await loadFile('data.arrow');
 * const dataset = await ipcToDataset(buffer);
 * console.log(`Loaded ${dataset.data.length} rows`);
 * ```
 */
export async function ipcToDataset(
  buffer: ArrayBuffer
): Promise<ParsedDataset> {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("Invalid buffer: buffer is empty or null");
  }

  try {
    const table = await ipcToTable(buffer);
    return arrowToDataset(table);
  } catch (error) {
    throw new Error(
      `Failed to parse Arrow IPC: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Converts Arrow Table to IPC format
 *
 * @param table - Arrow Table to convert
 * @param options - IPC options
 * @returns IPC buffer
 */
export async function tableToIPC(
  table: arrow.Table,
  options?: IPCOptions
): Promise<ArrayBuffer> {
  if (!table) {
    throw new Error("Invalid table: table is null");
  }

  if (table.numRows < 0) {
    throw new Error("Invalid table: table has negative rows");
  }

  // Empty tables are technically valid for schema-only use cases
  // but may cause issues with some IPC readers
  if (table.numRows === 0) {
    throw new Error("Cannot serialize empty table to IPC");
  }

  try {
    const format = options?.format || "stream";
    let ipcBuffer: Uint8Array;

    if (format === "file") {
      // Arrow File format (includes footer for random access)
      const writer = arrow.RecordBatchFileWriter.writeAll(table);
      ipcBuffer = await writer.toUint8Array();
    } else {
      // Arrow Stream format (better for streaming)
      const writer = arrow.RecordBatchStreamWriter.writeAll(table);
      ipcBuffer = await writer.toUint8Array();
    }

    // Ensure we return a proper ArrayBuffer
    let buffer: ArrayBuffer;
    if (ipcBuffer.buffer instanceof ArrayBuffer) {
      buffer = ipcBuffer.buffer.slice(
        ipcBuffer.byteOffset,
        ipcBuffer.byteOffset + ipcBuffer.byteLength
      );
    } else {
      // Fallback: Create a copy if buffer is SharedArrayBuffer
      const copy = new ArrayBuffer(ipcBuffer.byteLength);
      new Uint8Array(copy).set(ipcBuffer);
      buffer = copy;
    }

    // Store format metadata using Symbol property
    (buffer as unknown as Record<symbol, unknown>)[FORMAT_SYMBOL] = format;

    return buffer;
  } catch (error) {
    throw new Error(
      `Failed to write Arrow IPC: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Converts Arrow IPC buffer to Table
 *
 * @param buffer - Arrow IPC buffer
 * @returns Arrow Table
 */
export async function ipcToTable(buffer: ArrayBuffer): Promise<arrow.Table> {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("Invalid buffer: buffer is empty or null");
  }

  // Validate Arrow magic bytes before attempting parse
  if (!hasValidArrowMagic(buffer)) {
    throw new Error(
      "Failed to read Arrow IPC: Invalid buffer: missing Arrow IPC magic bytes. Ensure the buffer is a valid Arrow IPC format."
    );
  }

  try {
    const uint8Array = new Uint8Array(buffer);
    const table = arrow.tableFromIPC(uint8Array);

    if (!table) {
      throw new Error("Failed to parse IPC: returned table is null");
    }

    // Validate that the table has the expected structure
    if (table.numRows < 0 || table.numCols < 0) {
      throw new Error("Invalid table structure");
    }

    return table;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // If error already starts with "Failed to read Arrow IPC", don't wrap it again
    if (errorMsg.startsWith("Failed to read Arrow IPC")) {
      throw error;
    }
    throw new Error(
      `Failed to read Arrow IPC: ${errorMsg}. Ensure the buffer is a valid Arrow IPC format.`
    );
  }
}

/**
 * Validates if a buffer is valid Arrow IPC format
 *
 * @param buffer - Buffer to validate
 * @returns True if buffer is valid Arrow IPC
 */
export function isValidIPC(buffer: ArrayBuffer): boolean {
  try {
    if (!buffer || buffer.byteLength === 0) {
      return false;
    }

    // Minimum size check - Arrow IPC has minimum structure
    if (buffer.byteLength < 32) {
      return false;
    }

    // Check for valid Arrow magic bytes
    if (!hasValidArrowMagic(buffer)) {
      return false;
    }

    // Try to parse as IPC - if it succeeds, it's valid
    const uint8Array = new Uint8Array(buffer);
    const table = arrow.tableFromIPC(uint8Array);

    if (!table || table.numRows < 0 || table.numCols < 0) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the IPC format type from a buffer
 *
 * @param buffer - Buffer to check
 * @returns IPC format type
 */
export function getIPCFormat(buffer: ArrayBuffer): IPCFormat | "unknown" {
  try {
    // Check if we have stored metadata for this buffer
    const storedFormat =
      typeof buffer === "object" && buffer !== null
        ? (buffer as unknown as Record<PropertyKey, unknown>)[FORMAT_SYMBOL]
        : undefined;
    if (
      typeof storedFormat === "string" &&
      (storedFormat === "stream" || storedFormat === "file")
    ) {
      return storedFormat as IPCFormat;
    }

    if (!buffer || buffer.byteLength < 6) {
      return "unknown";
    }

    // Check magic bytes to determine format
    const bytes = new Uint8Array(buffer);

    // Check for stream format magic (0xFFFFFFFF at start)
    if (bytes.length >= 4) {
      const streamMatch = bytes
        .slice(0, 4)
        .every((byte, i) => byte === ARROW_MAGIC_STREAM[i]);
      if (streamMatch) return "stream";
    }

    // Check for file format magic ("ARROW1" at start)
    if (bytes.length >= 6) {
      const fileMatch = bytes
        .slice(0, 6)
        .every((byte, i) => byte === ARROW_MAGIC_FILE[i]);
      if (fileMatch) return "file";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Gets metadata from Arrow IPC buffer
 *
 * @param buffer - Arrow IPC buffer
 * @returns Metadata information
 */
export async function getIPCMetadata(buffer: ArrayBuffer): Promise<{
  numRows: number;
  numColumns: number;
  schema: string[];
  fileSize: number;
  format: IPCFormat | "unknown";
}> {
  try {
    const table = await ipcToTable(buffer);
    const format = getIPCFormat(buffer);

    return {
      numRows: table.numRows,
      numColumns: table.numCols,
      schema: table.schema.fields.map((f) => f.name),
      fileSize: buffer.byteLength,
      format,
    };
  } catch (error) {
    throw new Error(
      `Failed to read IPC metadata: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Estimates the size of a dataset when converted to Arrow IPC
 *
 * @param dataset - Dataset to estimate
 * @param format - IPC format type
 * @returns Estimated size in bytes
 */
export function estimateIPCSize(
  dataset: ParsedDataset,
  format: IPCFormat = "stream"
): number {
  if (!dataset.data || dataset.data.length === 0) {
    return 1024; // Minimum size for empty file with schema
  }

  // Sample first 100 rows to estimate row size
  const sampleSize = Math.min(100, dataset.data.length);
  const sample = dataset.data.slice(0, sampleSize);
  const sampleJsonSize = JSON.stringify(sample).length;

  // Extrapolate to full dataset
  const estimatedJsonSize = (sampleJsonSize / sampleSize) * dataset.data.length;

  // Arrow IPC is more efficient than JSON due to:
  // - Columnar storage
  // - Binary encoding
  // - No repeated field names
  // Typical ratio: 2-5x smaller than JSON
  const efficiencyRatio = 3;

  // Add overhead for schema and metadata
  const overhead = 1.05; // 5% overhead

  // File format has slightly more overhead (footer)
  const formatOverhead = format === "file" ? 1.02 : 1.0;

  return Math.ceil(
    (estimatedJsonSize / efficiencyRatio) * overhead * formatOverhead
  );
}

/**
 * Converts Arrow IPC between stream and file formats
 *
 * @param buffer - Source IPC buffer
 * @param targetFormat - Target format
 * @returns Converted IPC buffer
 */
export async function convertIPCFormat(
  buffer: ArrayBuffer,
  targetFormat: IPCFormat
): Promise<ArrayBuffer> {
  const table = await ipcToTable(buffer);
  return tableToIPC(table, { format: targetFormat });
}

/**
 * Splits large dataset into multiple IPC files
 *
 * @param dataset - Dataset to split
 * @param rowsPerFile - Rows per file
 * @param options - IPC options
 * @returns Array of IPC buffers with metadata
 */
export async function datasetToIPCPartitions(
  dataset: ParsedDataset,
  rowsPerFile: number,
  options?: IPCOptions
): Promise<
  Array<{
    buffer: ArrayBuffer;
    startRow: number;
    endRow: number;
    partitionIndex: number;
    numRows: number;
  }>
> {
  if (rowsPerFile <= 0) {
    throw new Error("rowsPerFile must be greater than 0");
  }

  if (!dataset.data || dataset.data.length === 0) {
    throw new Error("Cannot partition empty dataset");
  }

  const partitions: Array<{
    buffer: ArrayBuffer;
    startRow: number;
    endRow: number;
    partitionIndex: number;
    numRows: number;
  }> = [];

  const totalRows = dataset.data.length;
  const numPartitions = Math.ceil(totalRows / rowsPerFile);

  for (let i = 0; i < numPartitions; i++) {
    const startRow = i * rowsPerFile;
    const endRow = Math.min((i + 1) * rowsPerFile, totalRows);

    const partitionData = dataset.data.slice(startRow, endRow);
    const partitionDataset: ParsedDataset = {
      ...dataset,
      id: `${dataset.id}-partition-${i}`,
      name: `${dataset.name} (partition ${i + 1}/${numPartitions})`,
      data: partitionData,
      metadata: {
        ...dataset.metadata,
        partitionIndex: i,
        totalPartitions: numPartitions,
        startRow,
        endRow,
      },
    };

    const { buffer } = await datasetToIPC(partitionDataset, options);

    partitions.push({
      buffer,
      startRow,
      endRow,
      partitionIndex: i,
      numRows: partitionData.length,
    });
  }

  return partitions;
}

/**
 * Merges multiple IPC files into a single dataset
 *
 * @param buffers - Array of IPC buffers
 * @returns Merged dataset
 */
export async function mergeIPCFiles(
  buffers: ArrayBuffer[]
): Promise<ParsedDataset> {
  if (!buffers || buffers.length === 0) {
    throw new Error("No IPC files provided to merge");
  }

  const datasets = await Promise.all(
    buffers.map((buf, idx) => {
      try {
        return ipcToDataset(buf);
      } catch (error) {
        throw new Error(
          `Failed to parse file ${idx + 1}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  const [firstDataset, ...restDatasets] = datasets;

  // Validate schema compatibility - compare in sorted order for robustness
  const firstSchemaStr = firstDataset.schema.fields
    .map((f) => `${f.name}:${f.type}`)
    .sort()
    .join(",");

  for (let i = 0; i < restDatasets.length; i++) {
    const schemaStr = restDatasets[i].schema.fields
      .map((f) => `${f.name}:${f.type}`)
      .sort()
      .join(",");

    if (schemaStr !== firstSchemaStr) {
      throw new Error(
        `Schema mismatch at file ${i + 2}. All files must have the same schema.`
      );
    }
  }

  const mergedData = [
    firstDataset.data,
    ...restDatasets.map((d) => d.data),
  ].flat();

  return {
    ...firstDataset,
    id: `${firstDataset.id}-merged`,
    name: `${firstDataset.name} (merged from ${buffers.length} files)`,
    data: mergedData,
    createdAt: new Date(),
    metadata: {
      ...firstDataset.metadata,
      mergedFrom: buffers.length,
      totalRows: mergedData.length,
    },
  };
}
