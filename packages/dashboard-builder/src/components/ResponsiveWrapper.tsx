import { useMemo, type ReactNode } from "react";
import type { WidgetLayout, Breakpoint } from "../types";
import { useBreakpoint } from "../hooks";
import { DEFAULT_BREAKPOINTS } from "../constants";
import { getActiveBreakpoint, transformLayoutForBreakpoint } from "../utils";
import { DashboardGrid } from "./DashboardGrid";
import { WidgetContainer } from "./WidgetContainer";

export interface ResponsiveWrapperProps {
  /** Widget layouts with responsive configurations */
  layouts: WidgetLayout[];
  /** Custom breakpoints (defaults to mobile/tablet/desktop) */
  breakpoints?: Breakpoint[];
  /** Default number of columns when no breakpoint matches */
  defaultColumns?: number;
  /** Number of rows (can be 'auto' for dynamic height) */
  rows?: number | "auto";
  /** Gap between grid cells in pixels */
  gap?: number;
  /** Padding around the grid in pixels */
  padding?: number;
  /** Render function for each widget - receives layout and breakpoint info */
  renderWidget: (layout: WidgetLayout, breakpoint: string) => ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function ResponsiveWrapper({
  layouts,
  breakpoints,
  defaultColumns = 12,
  rows = "auto",
  gap = 16,
  padding = 16,
  renderWidget,
  className = "",
}: ResponsiveWrapperProps) {
  // Get current breakpoint
  const { breakpoint, width } = useBreakpoint();

  // Convert DEFAULT_BREAKPOINTS object to array format if custom breakpoints not provided
  const breakpointList: Breakpoint[] = useMemo(() => {
    if (breakpoints) return breakpoints;

    return [
      {
        name: "mobile",
        minWidth: DEFAULT_BREAKPOINTS.mobile.minWidth,
        maxWidth: DEFAULT_BREAKPOINTS.mobile.maxWidth,
        columns: DEFAULT_BREAKPOINTS.mobile.columns,
      },
      {
        name: "tablet",
        minWidth: DEFAULT_BREAKPOINTS.tablet.minWidth,
        maxWidth: DEFAULT_BREAKPOINTS.tablet.maxWidth,
        columns: DEFAULT_BREAKPOINTS.tablet.columns,
      },
      {
        name: "desktop",
        minWidth: DEFAULT_BREAKPOINTS.desktop.minWidth,
        maxWidth: DEFAULT_BREAKPOINTS.desktop.maxWidth,
        columns: DEFAULT_BREAKPOINTS.desktop.columns,
      },
    ];
  }, [breakpoints]);

  // Get active breakpoint configuration
  const activeBreakpoint = useMemo(
    () => getActiveBreakpoint(width, breakpointList),
    [width, breakpointList]
  );

  // Calculate columns based on breakpoint
  const columns = activeBreakpoint?.columns ?? defaultColumns;

  // Transform layouts for current breakpoint
  const transformedLayouts = useMemo(
    () =>
      layouts.map((layout) => ({
        ...layout,
        position: transformLayoutForBreakpoint(layout, breakpoint),
      })),
    [layouts, breakpoint]
  );

  return (
    <DashboardGrid
      columns={columns}
      rows={rows}
      gap={gap}
      padding={padding}
      className={`responsive-wrapper responsive-${breakpoint} ${className}`}
    >
      {transformedLayouts.map((layout) => (
        <WidgetContainer key={layout.id} position={layout.position}>
          {renderWidget(layout, breakpoint)}
        </WidgetContainer>
      ))}
    </DashboardGrid>
  );
}
