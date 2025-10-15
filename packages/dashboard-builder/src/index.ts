// Main entry point for @open-dashboard/dashboard-builder package

// Export all types
export type {
  GridConfig,
  GridDimensions,
  WidgetPosition,
  WidgetSize,
  WidgetSizeClass,
  WidgetLayout,
  Breakpoint,
  ResponsiveConfig,
} from "./types";

// Export all constants
export {
  DEFAULT_BREAKPOINTS,
  DEFAULT_GRID_CONFIG,
  WIDGET_SIZE_THRESHOLDS,
} from "./constants";

// Export all utilities
export {
  hasCollision,
  validateLayout,
  getActiveBreakpoint,
  transformLayoutForBreakpoint,
  calculateCellSize,
} from "./utils";

// Export all hooks
export { useGridLayout, useWidgetSize, useBreakpoint } from "./hooks";

// Export all components
export {
  DashboardGrid,
  GridCell,
  WidgetContainer,
  ResponsiveWrapper,
} from "./components";

export type {
  DashboardGridProps,
  GridCellProps,
  WidgetContainerProps,
  ResponsiveWrapperProps,
} from "./components";
