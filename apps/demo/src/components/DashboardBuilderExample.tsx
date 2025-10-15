import { useState } from "react";
import type { WidgetLayout } from "@open-dashboard/dashboard-builder";
import {
  DashboardGrid,
  WidgetContainer,
  ResponsiveWrapper,
} from "@open-dashboard/dashboard-builder";

// Sample widget components
function MetricCard({
  title,
  value,
  change,
  color = "blue",
}: {
  title: string;
  value: string | number;
  change?: string;
  color?: "blue" | "green" | "purple" | "orange";
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
  };

  return (
    <div
      className={`h-full border-2 rounded-lg p-4 flex flex-col justify-between ${colorClasses[color]}`}
    >
      <div className="text-sm font-medium opacity-80">{title}</div>
      <div className="text-3xl font-bold my-2">{value}</div>
      {change && <div className="text-xs opacity-70">{change}</div>}
    </div>
  );
}

function ChartWidget({ title }: { title: string }) {
  return (
    <div className="h-full bg-white border-2 border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="h-full flex items-center justify-center bg-gray-50 rounded">
        <div className="text-gray-400 text-sm">Chart Visualization</div>
      </div>
    </div>
  );
}

function TableWidget({ title, rows }: { title: string; rows: number }) {
  return (
    <div className="h-full bg-white border-2 border-gray-200 rounded-lg p-4 flex flex-col">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Value</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">Item {i + 1}</td>
                <td className="p-2">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                    Active
                  </span>
                </td>
                <td className="p-2">${(Math.random() * 1000).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GridBuilderDemo() {
  const [demoType, setDemoType] = useState<"basic" | "responsive" | "custom">(
    "basic"
  );
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(3);

  // Responsive layouts for ResponsiveWrapper demo
  const responsiveLayouts: WidgetLayout[] = [
    {
      id: "metric-1",
      x: 1,
      y: 1,
      width: 3,
      height: 1,
      responsive: {
        mobile: { x: 1, y: 1, width: 2, height: 1 },
        tablet: { x: 1, y: 1, width: 2, height: 1 },
        desktop: { x: 1, y: 1, width: 3, height: 1 },
      },
    },
    {
      id: "metric-2",
      x: 4,
      y: 1,
      width: 3,
      height: 1,
      responsive: {
        mobile: { x: 1, y: 2, width: 2, height: 1 },
        tablet: { x: 3, y: 1, width: 2, height: 1 },
        desktop: { x: 4, y: 1, width: 3, height: 1 },
      },
    },
    {
      id: "metric-3",
      x: 7,
      y: 1,
      width: 3,
      height: 1,
      responsive: {
        mobile: { x: 1, y: 3, width: 2, height: 1 },
        tablet: { x: 5, y: 1, width: 2, height: 1 },
        desktop: { x: 7, y: 1, width: 3, height: 1 },
      },
    },
    {
      id: "metric-4",
      x: 10,
      y: 1,
      width: 3,
      height: 1,
      responsive: {
        mobile: { x: 1, y: 4, width: 2, height: 1 },
        tablet: { x: 1, y: 2, width: 2, height: 1 },
        desktop: { x: 10, y: 1, width: 3, height: 1 },
      },
    },
    {
      id: "chart-1",
      x: 1,
      y: 2,
      width: 6,
      height: 2,
      responsive: {
        mobile: { x: 1, y: 5, width: 2, height: 2 },
        tablet: { x: 3, y: 2, width: 4, height: 2 },
        desktop: { x: 1, y: 2, width: 6, height: 2 },
      },
    },
    {
      id: "chart-2",
      x: 7,
      y: 2,
      width: 6,
      height: 2,
      responsive: {
        mobile: { x: 1, y: 7, width: 2, height: 2 },
        tablet: { x: 1, y: 4, width: 6, height: 2 },
        desktop: { x: 7, y: 2, width: 6, height: 2 },
      },
    },
    {
      id: "table-1",
      x: 1,
      y: 4,
      width: 12,
      height: 2,
      responsive: {
        mobile: { x: 1, y: 9, width: 2, height: 3 },
        tablet: { x: 1, y: 6, width: 6, height: 2 },
        desktop: { x: 1, y: 4, width: 12, height: 2 },
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Demo Controls */}
      <div className="demo-card">
        <div className="demo-header">
          <h2 className="demo-title">Dashboard Grid Builder</h2>
          <p className="demo-description">
            Interactive demonstration of the grid-based dashboard system with
            flexible layouts and responsive design.
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setDemoType("basic")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              demoType === "basic"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Basic Grid
          </button>
          <button
            onClick={() => setDemoType("responsive")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              demoType === "responsive"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Responsive Layout
          </button>
          <button
            onClick={() => setDemoType("custom")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              demoType === "custom"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Custom Grid
          </button>
        </div>

        {demoType === "custom" && (
          <div className="flex gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Columns: {gridCols}
              </label>
              <input
                type="range"
                min="1"
                max="12"
                value={gridCols}
                onChange={(e) => setGridCols(Number(e.target.value))}
                className="w-32"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Rows: {gridRows}
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={gridRows}
                onChange={(e) => setGridRows(Number(e.target.value))}
                className="w-32"
              />
            </div>
          </div>
        )}
      </div>

      {/* Basic Grid Demo */}
      {demoType === "basic" && (
        <div className="demo-card">
          <div className="demo-header">
            <h3 className="demo-title">Basic 4×3 Grid Layout</h3>
            <p className="demo-description">
              Fixed grid with various widget sizes (1×1, 2×1, 2×2, 4×1)
            </p>
          </div>

          <DashboardGrid columns={4} rows={3} gap={16} padding={16}>
            {/* 1x1 widgets */}
            <WidgetContainer position={{ x: 1, y: 1, width: 1, height: 1 }}>
              <MetricCard
                title="Total Users"
                value="1,234"
                change="+12% from last month"
                color="blue"
              />
            </WidgetContainer>

            <WidgetContainer position={{ x: 2, y: 1, width: 1, height: 1 }}>
              <MetricCard
                title="Revenue"
                value="$42,000"
                change="+8% from last month"
                color="green"
              />
            </WidgetContainer>

            {/* 2x1 widget */}
            <WidgetContainer position={{ x: 3, y: 1, width: 2, height: 1 }}>
              <MetricCard
                title="Conversion Rate"
                value="3.24%"
                change="+0.5% from last month"
                color="purple"
              />
            </WidgetContainer>

            {/* 2x2 widget */}
            <WidgetContainer position={{ x: 1, y: 2, width: 2, height: 2 }}>
              <ChartWidget title="Sales Over Time" />
            </WidgetContainer>

            {/* 2x2 widget */}
            <WidgetContainer position={{ x: 3, y: 2, width: 2, height: 2 }}>
              <ChartWidget title="User Growth" />
            </WidgetContainer>
          </DashboardGrid>
        </div>
      )}

      {/* Responsive Demo */}
      {demoType === "responsive" && (
        <div className="demo-card">
          <div className="demo-header">
            <h3 className="demo-title">Responsive Dashboard Layout</h3>
            <p className="demo-description">
              Resize your browser to see the layout adapt (Mobile: 2 cols,
              Tablet: 6 cols, Desktop: 12 cols)
            </p>
          </div>

          <ResponsiveWrapper
            layouts={responsiveLayouts}
            gap={16}
            padding={16}
            renderWidget={(layout, breakpoint) => {
              switch (layout.id) {
                case "metric-1":
                  return (
                    <MetricCard
                      title="Active Users"
                      value="5,432"
                      change="+15%"
                      color="blue"
                    />
                  );
                case "metric-2":
                  return (
                    <MetricCard
                      title="Revenue"
                      value="$86,420"
                      change="+23%"
                      color="green"
                    />
                  );
                case "metric-3":
                  return (
                    <MetricCard
                      title="Conversions"
                      value="892"
                      change="+8%"
                      color="purple"
                    />
                  );
                case "metric-4":
                  return (
                    <MetricCard
                      title="Avg. Order"
                      value="$156"
                      change="+5%"
                      color="orange"
                    />
                  );
                case "chart-1":
                  return <ChartWidget title="Revenue Trends" />;
                case "chart-2":
                  return <ChartWidget title="User Analytics" />;
                case "table-1":
                  return (
                    <TableWidget
                      title="Recent Transactions"
                      rows={breakpoint === "mobile" ? 3 : 5}
                    />
                  );
                default:
                  return null;
              }
            }}
          />
        </div>
      )}

      {/* Custom Grid Demo */}
      {demoType === "custom" && (
        <div className="demo-card">
          <div className="demo-header">
            <h3 className="demo-title">
              Custom {gridCols}×{gridRows} Grid
            </h3>
            <p className="demo-description">
              Adjust the sliders above to create different grid configurations
            </p>
          </div>

          <DashboardGrid
            columns={gridCols}
            rows={gridRows}
            gap={12}
            padding={12}
          >
            {/* Fill grid with colored cells to show structure */}
            {Array.from({ length: Math.min(gridCols * gridRows, 20) }).map(
              (_, i) => {
                const col = (i % gridCols) + 1;
                const row = Math.floor(i / gridCols) + 1;
                const colors = ["blue", "green", "purple", "orange"] as const;
                const color = colors[i % colors.length];

                return (
                  <WidgetContainer
                    key={i}
                    position={{ x: col, y: row, width: 1, height: 1 }}
                  >
                    <MetricCard
                      title={`Widget ${i + 1}`}
                      value={`${col},${row}`}
                      color={color}
                    />
                  </WidgetContainer>
                );
              }
            )}
          </DashboardGrid>
        </div>
      )}

      {/* Features Info */}
      <div className="demo-card">
        <div className="demo-header">
          <h3 className="demo-title">Dashboard Builder Features</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold mb-2">✓ Flexible Grid Sizes</h4>
            <p className="text-sm text-gray-700">
              Any X×Y dimension from 1×1 to unlimited. Perfect for dashboards of
              any size.
            </p>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold mb-2">✓ Widget Scaling</h4>
            <p className="text-sm text-gray-700">
              Widgets can span multiple cells (1×1, 2×2, 4×3, etc.) with content
              automatically scaling.
            </p>
          </div>

          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 className="font-semibold mb-2">✓ Responsive Design</h4>
            <p className="text-sm text-gray-700">
              Layouts automatically adapt to screen size with mobile, tablet,
              and desktop breakpoints.
            </p>
          </div>

          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="font-semibold mb-2">✓ Type-Safe API</h4>
            <p className="text-sm text-gray-700">
              Full TypeScript support with proper types for grid configuration
              and widget positioning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
