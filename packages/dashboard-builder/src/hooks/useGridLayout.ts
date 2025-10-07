import { useMemo } from "react";
import type { GridConfig } from "../types";
import { calculateCellSize } from "../utils";

export function useGridLayout(containerWidth: number, config: GridConfig) {
  return useMemo(() => {
    const cellWidth = calculateCellSize(
      containerWidth - (config.padding ?? 0) * 2,
      config.columns,
      config.gap ?? 0
    );

    const cellHeight = config.minCellHeight
      ? parseInt(config.minCellHeight)
      : cellWidth * 0.75; // Default aspect ratio

    return {
      columns: config.columns,
      cellWidth,
      cellHeight,
      gap: config.gap,
      padding: config.padding ?? 0,
    };
  }, [containerWidth, config]);
}
