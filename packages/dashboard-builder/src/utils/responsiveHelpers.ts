import type { WidgetLayout, WidgetPosition, Breakpoint } from "../types";

export function getActiveBreakpoint(
  width: number,
  breakpoints: Breakpoint[]
): Breakpoint {
  return (
    breakpoints.find(
      (bp) => width >= bp.minWidth && (!bp.maxWidth || width <= bp.maxWidth)
    ) || breakpoints[breakpoints.length - 1]
  );
}

export function transformLayoutForBreakpoint(
  layout: WidgetLayout,
  breakpoint: string
): WidgetPosition {
  const responsive =
    layout.responsive?.[breakpoint as keyof typeof layout.responsive];
  return responsive ? { ...layout, ...responsive } : layout;
}
