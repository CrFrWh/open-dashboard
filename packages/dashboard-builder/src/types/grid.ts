export interface GridConfig {
  columns: number;
  rows?: number | "auto";
  minCellWidth?: string;
  minCellHeight?: string;
  gap?: number;
  padding?: number;
}

export interface GridDimensions {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  gap: number;
}
