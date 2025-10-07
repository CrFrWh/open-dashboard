import { useCallback, useState } from "react";
import { parseData, DataParsingError } from "@open-dashboard/core-parser";
import { datasetToIPC, ipcToDataset } from "@open-dashboard/core-schema";
import type { ParsedDataset } from "@open-dashboard/shared/types";

interface DataUploaderProps {
  onDatasetAdded: (dataset: ParsedDataset) => void;
}

export default function DataUploader({ onDatasetAdded }: DataUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading] = useState(false);
  const [lastDataset, setLastDataset] = useState<ParsedDataset | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);

      try {
        // Use the new parser package!
        const dataset = await parseData(file);
        setLastDataset(dataset); // Track last uploaded dataset
        onDatasetAdded(dataset);
      } catch (error) {
        const errorMessage =
          error instanceof DataParsingError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unknown error";
        alert(`Error processing file "${file.name}": ${errorMessage}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [onDatasetAdded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      files.forEach(processFile);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(processFile);

      // Reset the input value to allow selecting the same file again
      e.target.value = "";
    },
    [processFile]
  );

  const handleUploadClick = useCallback(() => {
    document.getElementById("file-input")?.click();
  }, []);

  const renderUploadContent = () => {
    if (isProcessing) {
      return (
        <div className="space-y-2">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p>Processing files...</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="text-4xl">📁</div>
        <p className="font-medium">Drop files here or click to browse</p>
        <p className="text-sm text-gray-600">Supports CSV and JSON files</p>
      </div>
    );
  };

  const renderSupportedFormats = () => (
    <div className="text-xs text-gray-500">
      <p>
        <strong>Supported formats:</strong>
      </p>
      <ul className="list-disc list-inside space-y-1 mt-1">
        <li>
          <strong>CSV:</strong> Comma-separated values with header row
        </li>
        <li>
          <strong>JSON:</strong> Array of objects or object containing an array
        </li>
      </ul>
    </div>
  );

  const testArrowIPC = useCallback(async (dataset: ParsedDataset) => {
    console.group("Arrow IPC Test");

    // Test serialization
    console.time("IPC serialization");
    const { buffer, warnings } = await datasetToIPC(dataset);
    console.timeEnd("IPC serialization");

    // Test deserialization
    console.time("IPC deserialization");
    const restored = await ipcToDataset(buffer);
    console.timeEnd("IPC deserialization");

    // Compare sizes
    const jsonSize = JSON.stringify(dataset.data).length;
    const ipcSize = buffer.byteLength;
    console.log("Size comparison:", {
      json: `${(jsonSize / 1024).toFixed(2)} KB`,
      ipc: `${(ipcSize / 1024).toFixed(2)} KB`,
      compression: `${((1 - ipcSize / jsonSize) * 100).toFixed(1)}% smaller`,
    });

    // Verify data integrity
    console.log("Data integrity:", {
      originalRows: dataset.data.length,
      restoredRows: restored.data.length,
      match: JSON.stringify(dataset.data) === JSON.stringify(restored.data),
    });

    if (warnings.length > 0) {
      console.warn("Warnings:", warnings);
    }

    console.groupEnd();
  }, []);

  const handleTestArrowIPC = useCallback(async () => {
    // Use last uploaded dataset or create test data
    const dataset: ParsedDataset = lastDataset || {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: "Test Dataset",
      data: [
        { name: "Alice", age: 30, city: "NYC" },
        { name: "Bob", age: 25, city: "LA" },
        { name: "Charlie", age: 35, city: "Chicago" },
      ],
      schema: {
        fields: [
          { name: "name", type: "string" },
          { name: "age", type: "number" },
          { name: "city", type: "string" },
        ],
      },
      metadata: {
        source: "test",
        rowCount: 3,
        columnCount: 3,
      },
      sourceType: "json",
      createdAt: new Date(),
    };

    await testArrowIPC(dataset);
  }, [lastDataset, testArrowIPC]);

  return (
    <div className="space-y-4">
      <div
        className={`upload-zone ${isDragOver ? "dragover" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleUploadClick}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.json"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {renderUploadContent()}
      </div>

      {renderSupportedFormats()}

      <button
        type="button"
        onClick={handleTestArrowIPC}
        disabled={isLoading}
        className="mt-4 px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label={
          lastDataset
            ? `Test Arrow IPC with ${lastDataset.name}`
            : "Test Arrow IPC with sample data"
        }
      >
        Test Arrow IPC
        {lastDataset && (
          <span className="ml-2 text-xs opacity-80">({lastDataset.name})</span>
        )}
      </button>
    </div>
  );
}
