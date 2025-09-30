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

// Helper functions outside component to avoid dependency issues
const inferType = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "string";
  if (!isNaN(Number(value))) return "number";
  if (typeof value === "boolean") return "boolean";
  if (value instanceof Date) return "date";
  return "string";
};

const parseCSV = (content: string) => {
  const lines = content.trim().split("\\n");
  if (lines.length < 2)
    throw new Error("CSV must have at least a header and one data row");

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

  // Infer schema from first few rows
  const schema = headers.map((field) => {
    const sampleValues = rows.slice(0, 10).map((row) => row[field]);
    const types = sampleValues.map(inferType);
    const mostCommonType = types.reduce((a, b) => {
      const aCount = types.filter((v) => v === a).length;
      const bCount = types.filter((v) => v === b).length;
      return aCount >= bCount ? a : b;
    });

    return { field, type: mostCommonType };
  });

  return { data: rows, schema };
};

const parseJSON = (content: string) => {
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

  if (data.length === 0) throw new Error("No data found in JSON");

  // Infer schema
  const allFields = new Set<string>();
  data.forEach((row) => {
    Object.keys(row).forEach((key) => allFields.add(key));
  });

  const schema = Array.from(allFields).map((field) => {
    const sampleValues = data.slice(0, 10).map((row) => row[field]);
    const types = sampleValues.map(inferType);
    const mostCommonType = types.reduce((a, b) => {
      const aCount = types.filter((v) => v === a).length;
      const bCount = types.filter((v) => v === b).length;
      return aCount >= bCount ? a : b;
    });

    return { field, type: mostCommonType };
  });

  return { data, schema };
};

export default function DataUploader({ onDatasetAdded }: DataUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const inferType = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "string";
    if (!isNaN(Number(value))) return "number";
    if (typeof value === "boolean") return "boolean";
    if (value instanceof Date) return "date";
    return "string";
  };

  const parseCSV = (
    content: string
  ): {
    data: Record<string, unknown>[];
    schema: { field: string; type: string }[];
  } => {
    const lines = content.trim().split("\\n");
    if (lines.length < 2)
      throw new Error("CSV must have at least a header and one data row");

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

    // Infer schema from first few rows
    const schema = headers.map((field) => {
      const sampleValues = rows.slice(0, 10).map((row) => row[field]);
      const types = sampleValues.map(inferType);
      const mostCommonType = types.reduce((a, b, i, arr) =>
        arr.filter((v) => v === a).length >= arr.filter((v) => v === b).length
          ? a
          : b
      );

      return { field, type: mostCommonType };
    });

    return { data: rows, schema };
  };

  const parseJSON = (
    content: string
  ): {
    data: Record<string, unknown>[];
    schema: { field: string; type: string }[];
  } => {
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

    if (data.length === 0) throw new Error("No data found in JSON");

    // Infer schema
    const allFields = new Set<string>();
    data.forEach((row) => {
      Object.keys(row).forEach((key) => allFields.add(key));
    });

    const schema = Array.from(allFields).map((field) => {
      const sampleValues = data.slice(0, 10).map((row) => row[field]);
      const types = sampleValues.map(inferType);
      const mostCommonType = types.reduce((a, b, i, arr) =>
        arr.filter((v) => v === a).length >= arr.filter((v) => v === b).length
          ? a
          : b
      );

      return { field, type: mostCommonType };
    });

    return { data, schema };
  };

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);

      try {
        const content = await file.text();
        let parsedData: {
          data: Record<string, unknown>[];
          schema: { field: string; type: string }[];
        };

        if (file.name.toLowerCase().endsWith(".csv")) {
          parsedData = parseCSV(content);
        } else if (file.name.toLowerCase().endsWith(".json")) {
          parsedData = parseJSON(content);
        } else {
          throw new Error(
            "Unsupported file type. Please upload CSV or JSON files."
          );
        }

        const dataset: Dataset = {
          id: Date.now().toString(),
          name: file.name,
          data: parsedData.data,
          schema: parsedData.schema,
        };

        onDatasetAdded(dataset);
      } catch (error) {
        alert(
          `Error processing file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
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

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(processFile);
    },
    [processFile]
  );

  return (
    <div className="space-y-4">
      <div
        className={`upload-zone ${isDragOver ? "dragover" : ""}`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.json"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {isProcessing ? (
          <div className="space-y-2">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p>Processing files...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-4xl">📁</div>
            <p className="font-medium">Drop files here or click to browse</p>
            <p className="text-sm text-gray-600">Supports CSV and JSON files</p>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500">
        <p>
          <strong>Supported formats:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>
            <strong>CSV:</strong> Comma-separated values with header row
          </li>
          <li>
            <strong>JSON:</strong> Array of objects or object containing an
            array
          </li>
        </ul>
      </div>
    </div>
  );
}
