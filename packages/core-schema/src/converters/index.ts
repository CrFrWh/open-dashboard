/**
 * Core Schema Converters
 *
 * Data format conversion utilities for Open Dashboard.
 * Enables transformation between ParsedDataset, Apache Arrow, and Arrow IPC formats.
 */

// Arrow Table Converters
export {
  schemaToArrowSchema,
  arrowTableSchemaToDatasetSchema,
  datasetToArrow,
  arrowToDataset,
} from "./arrowConverter";

// Arrow IPC (Binary Serialization) Converters
export {
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

// Type Mapping Utilities
export {
  dataFieldToArrowType,
  arrowTypeToDataField,
  createArrowField,
  extractDataFieldFromArrowField,
} from "../utils/typeMapper";

// Schema Normalization
export { normalizeSchema } from "../utils/schemaNormaliser";

// Type exports
export type { IPCFormat, IPCOptions } from "./arrowIPCConverter";
