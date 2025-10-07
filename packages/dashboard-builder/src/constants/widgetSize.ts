export const WIDGET_SIZE_THRESHOLDS = {
  xs: { maxColumns: 1, maxRows: 1 }, // Single cell
  sm: { maxColumns: 2, maxRows: 1 }, // 2×1
  md: { maxColumns: 4, maxRows: 2 }, // 4×2
  lg: { maxColumns: 6, maxRows: 3 }, // 6×3
  xl: { maxColumns: 8, maxRows: 4 }, // 8×4
  xxl: { maxColumns: 12, maxRows: 6 }, // Full width
} as const;
