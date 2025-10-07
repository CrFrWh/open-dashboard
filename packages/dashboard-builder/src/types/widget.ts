export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetSize {
  columns: number;
  rows: number;
  pixelWidth: number;
  pixelHeight: number;
}

export type WidgetSizeClass = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
