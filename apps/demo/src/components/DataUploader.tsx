import { useCallback, useState } from "react";
import { parseData, DataParsingError } from "@open-dashboard/core-parser";
import type { ParsedDataset } from "@open-dashboard/shared/types";

interface DataUploaderProps {
  onDatasetAdded: (dataset: ParsedDataset) => void;
}

export default function DataUploader({ onDatasetAdded }: DataUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);

      try {
        // Use the new parser package!
        const dataset = await parseData(file);
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
    </div>
  );
}
