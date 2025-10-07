import { useMemo } from "react";
import type { WidgetPosition, WidgetSizeClass } from "../types";

export function useWidgetSize(position: WidgetPosition): WidgetSizeClass {
  return useMemo(() => {
    const { width, height } = position;

    if (width <= 1 && height <= 1) return "xs";
    if (width <= 2 && height <= 1) return "sm";
    if (width <= 4 && height <= 2) return "md";
    if (width <= 6 && height <= 3) return "lg";
    if (width <= 8 && height <= 4) return "xl";
    return "xxl";
  }, [position]);
}
