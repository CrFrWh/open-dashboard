import { useMemo, type ReactNode } from "react";
import { DEFAULT_GRID_CONFIG } from "../constants";

export interface DashboardGridProps {
  /** Number of columns (X dimension). Minimum: 1, no maximum */
  columns: number;
  /** Number of rows (Y dimension). Minimum: 1, no maximum. Use 'auto' for dynamic row sizing */
  rows: number | "auto";
  /** Minimum width for each cell in the grid */
  minCellWidth?: string;
  /** Minimum height for each cell in the grid */
  minCellHeight?: string;
  /** Gap between grid cells in pixels */
  gap?: number;
  /** Padding around the grid in pixels */
  padding?: number;
  /** Children widgets/components to render in the grid */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function DashboardGrid({
  columns,
  rows,
  minCellWidth = DEFAULT_GRID_CONFIG.minCellWidth,
  minCellHeight = DEFAULT_GRID_CONFIG.minCellHeight,
  gap = DEFAULT_GRID_CONFIG.gap,
  padding = DEFAULT_GRID_CONFIG.padding,
  children,
  className = "",
}: DashboardGridProps) {
  // Validate minimum grid size
  const validatedColumns = Math.max(1, columns);
  const validatedRows = rows === "auto" ? "auto" : Math.max(1, rows);

  // Calculate grid template
  const gridStyle = useMemo(() => {
    return {
      display: "grid",
      gridTemplateColumns: `repeat(${validatedColumns}, minmax(${minCellWidth}, 1fr))`,
      gridTemplateRows:
        validatedRows === "auto"
          ? `auto`
          : `repeat(${validatedRows}, minmax(${minCellHeight}, 1fr))`,
      gap: `${gap}px`,
      padding: `${padding}px`,
    };
  }, [
    validatedColumns,
    validatedRows,
    minCellWidth,
    minCellHeight,
    gap,
    padding,
  ]);

  return (
    <div
      className={`dashboard-grid ${className}`}
      style={gridStyle}
      data-columns={validatedColumns}
      data-rows={validatedRows}
    >
      {children}
    </div>
  );
}
