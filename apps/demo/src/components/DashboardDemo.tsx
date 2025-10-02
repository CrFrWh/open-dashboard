import { useState, useCallback } from "react";
import DataUploader from "./DataUploader";
import SampleDatasets from "./SampleDatasets";

interface Dataset {
  id: string;
  name: string;
  data: unknown[];
  schema: { field: string; type: string }[];
}

export default function DashboardDemo() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  const handleDatasetAdded = useCallback(
    (dataset: Dataset) => {
      if (datasets.find((d) => d.id === dataset.id)) {
        return; // Avoid adding duplicates
      }
      setDatasets((prev) => [...prev, dataset]);
      setSelectedDataset(dataset);
    },
    [datasets]
  );

  const handleDatasetDeleted = useCallback(
    (datasetId: string) => {
      setDatasets((prev) => {
        const updatedDatasets = prev.filter(
          (dataset) => dataset.id !== datasetId
        );

        // If the deleted dataset was selected, clear the selection or select another one
        if (selectedDataset?.id === datasetId) {
          setSelectedDataset(
            updatedDatasets.length > 0 ? updatedDatasets[0] : null
          );
        }

        return updatedDatasets;
      });
    },
    [selectedDataset]
  );

  const handleClearAllDatasets = useCallback(() => {
    setDatasets([]);
    setSelectedDataset(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="demo-card">
        <div className="demo-header">
          <h2 className="demo-title">Welcome to Open Dashboard</h2>
          <p className="demo-description">
            Upload your data (CSV, JSON) or try our sample datasets to see the
            dashboard in action.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Data Upload Section */}
          <div>
            <h3 className="font-semibold mb-3">Upload Your Data</h3>
            <DataUploader onDatasetAdded={handleDatasetAdded} />
          </div>

          {/* Sample Datasets */}
          <div>
            <h3 className="font-semibold mb-3">Try Sample Data</h3>
            <SampleDatasets onDatasetSelected={handleDatasetAdded} />
          </div>
        </div>
      </div>

      {/* Datasets Overview */}
      {datasets.length > 0 && (
        <div className="demo-card">
          <div className="demo-header">
            <div className="flex justify-between items-center">
              <h3 className="demo-title">
                Loaded Datasets ({datasets.length})
              </h3>
              <button
                onClick={handleClearAllDatasets}
                className="text-sm text-red-600 hover:text-red-800 underline"
                title="Clear all loaded datasets"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((dataset) => (
              <div
                key={dataset.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all relative group ${
                  selectedDataset?.id === dataset.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedDataset(dataset)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium">{dataset.name}</h4>
                    <p className="text-sm text-gray-600">
                      {dataset.data.length} rows, {dataset.schema.length}{" "}
                      columns
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dataset.schema.slice(0, 3).map((field) => (
                        <span
                          key={field.field}
                          className="text-xs bg-gray-100 px-2 py-1 rounded"
                        >
                          {field.field}
                        </span>
                      ))}
                      {dataset.schema.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{dataset.schema.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent selecting the dataset
                      handleDatasetDeleted(dataset.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded ml-2"
                    title="Remove this dataset"
                    aria-label={`Remove ${dataset.name} dataset`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-500 mt-4">
            <p>Click on a dataset to view its preview below.</p>
            <p>
              Hover over a dataset and click the delete icon to remove it from
              the loaded datasets.
            </p>
          </div>
        </div>
      )}

      {/* Selected Dataset Preview */}
      {selectedDataset && (
        <div className="demo-card">
          <div className="demo-header">
            <h3 className="demo-title">
              Dataset Preview: {selectedDataset.name}
            </h3>
            <p className="demo-description">
              Showing first 5 rows of {selectedDataset.data.length} total rows
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {selectedDataset.schema.map((field) => (
                    <th
                      key={field.field}
                      className="border border-gray-200 px-4 py-2 text-left font-medium"
                    >
                      {field.field}
                      <span className="text-xs text-gray-500 block">
                        {field.type}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedDataset.data.slice(0, 5).map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {selectedDataset.schema.map((field) => (
                      <td
                        key={field.field}
                        className="border border-gray-200 px-4 py-2"
                      >
                        {String(
                          (row as Record<string, unknown>)[field.field] || ""
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedDataset.data.length > 5 && (
            <p className="text-sm text-gray-600 mt-2">
              ... and {selectedDataset.data.length - 5} more rows
            </p>
          )}
        </div>
      )}

      {/* Coming Soon Features */}
      <div className="demo-card">
        <div className="demo-header">
          <h3 className="demo-title">Coming Soon</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center">
            <h4 className="font-medium mb-2">Query Builder</h4>
            <p className="text-sm text-gray-600">Visual query interface</p>
          </div>
          <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center">
            <h4 className="font-medium mb-2">Chart Widgets</h4>
            <p className="text-sm text-gray-600">Interactive visualizations</p>
          </div>
          <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center">
            <h4 className="font-medium mb-2">Dashboard Layout</h4>
            <p className="text-sm text-gray-600">Drag & drop composition</p>
          </div>
        </div>
      </div>
    </div>
  );
}
