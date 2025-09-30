import { useCallback, useState } from "react";

interface Dataset {
  id: string;
  name: string;
  data: Record<string, unknown>[];
  schema: { field: string; type: string }[];
}

interface DataUploaderProps {
  onDatasetAdded: (dataset: Dataset) => void;
}

interface ParseResult {
  data: Record<string, unknown>[];
  schema: { field: string; type: string }[];
}

// Utility functions
const inferType = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "string";
  if (!isNaN(Number(value)) && value !== "") return "number";
  if (typeof value === "boolean") return "boolean";
  if (value instanceof Date) return "date";
  return "string";
};

const inferSchemaFromData = (
  data: Record<string, unknown>[],
  fields: string[]
): { field: string; type: string }[] => {
  return fields.map((field) => {
    const sampleValues = data.slice(0, 10).map((row) => row[field]);
    const types = sampleValues.map(inferType);
    const mostCommonType = types.reduce((a, b) => {
      const aCount = types.filter((v) => v === a).length;
      const bCount = types.filter((v) => v === b).length;
      return aCount >= bCount ? a : b;
    });

    return { field, type: mostCommonType };
  });
};

const parseCSV = (content: string): ParseResult => {
  const lines = content.trim().split("\n");

  if (lines.length < 2) {
    throw new Error("CSV must have at least a header and one data row");
  }

  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      let value: unknown = values[index] || "";

      // Try to convert to number
      if (!isNaN(Number(value)) && value !== "") {
        value = Number(value);
      }

      row[header] = value;
    });

    rows.push(row);
  }

  const schema = inferSchemaFromData(rows, headers);
  return { data: rows, schema };
};

const parseJSON = (content: string): ParseResult => {
  const parsed = JSON.parse(content);
  let data: Record<string, unknown>[];

  if (Array.isArray(parsed)) {
    data = parsed;
  } else if (typeof parsed === "object" && parsed !== null) {
    // If it's an object, try to find an array property
    const arrayProperty = Object.values(parsed).find((value) =>
      Array.isArray(value)
    );
    if (arrayProperty) {
      data = arrayProperty as Record<string, unknown>[];
    } else {
      // Treat the object as a single row
      data = [parsed as Record<string, unknown>];
    }
  } else {
    throw new Error("JSON must be an array or object containing an array");
  }

  if (data.length === 0) {
    throw new Error("No data found in JSON");
  }

  // Collect all unique field names
  const allFields = new Set<string>();
  data.forEach((row) => {
    Object.keys(row).forEach((key) => allFields.add(key));
  });

  const schema = inferSchemaFromData(data, Array.from(allFields));
  return { data, schema };
};

const getFileParser = (fileName: string) => {
  const extension = fileName.toLowerCase().split(".").pop();

  switch (extension) {
    case "csv":
      return parseCSV;
    case "json":
      return parseJSON;
    default:
      throw new Error(
        "Unsupported file type. Please upload CSV or JSON files."
      );
  }
};

const generateDatasetId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export default function DataUploader({ onDatasetAdded }: DataUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);

      try {
        const content = await file.text();
        const parser = getFileParser(file.name);
        const parsedData = parser(content);

        const dataset: Dataset = {
          id: generateDatasetId(),
          name: file.name,
          data: parsedData.data,
          schema: parsedData.schema,
        };

        onDatasetAdded(dataset);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
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
