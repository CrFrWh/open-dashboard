import type { CSSProperties } from "react";

export interface GridCellProps {
  /** Cell column position (1-based) */
  column: number;
  /** Cell row position (1-based) */
  row: number;
  /** Additional CSS classes */
  className?: string;
  /** Custom styles */
  style?: CSSProperties;
}

/**
 * GridCell - Visual representation of a single grid cell.
 * Useful for debugging grid layouts or showing empty grid spaces.
 */
export function GridCell({
  column,
  row,
  className = "",
  style = {},
}: GridCellProps) {
  const gridStyle: CSSProperties = {
    gridColumn: column,
    gridRow: row,
    border: "1px dashed #e5e7eb",
    minHeight: "60px",
    ...style,
  };

  return (
    <div
      className={`grid-cell ${className}`}
      style={gridStyle}
      data-column={column}
      data-row={row}
    />
  );
}
