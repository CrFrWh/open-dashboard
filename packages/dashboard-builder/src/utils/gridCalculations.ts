import type { WidgetPosition } from "../types";

export function calculateCellSize(
  containerWidth: number,
  columns: number,
  gap: number
): number {
  return (containerWidth - gap * (columns - 1)) / columns;
}

export function getCellCoordinates(
  x: number,
  y: number,
  cellWidth: number,
  cellHeight: number,
  gap: number
): { left: number; top: number } {
  return {
    left: x * (cellWidth + gap),
    top: y * (cellHeight + gap),
  };
}

export function getWidgetPixelSize(
  position: WidgetPosition,
  cellWidth: number,
  cellHeight: number,
  gap: number
): { width: number; height: number } {
  return {
    width: position.width * cellWidth + (position.width - 1) * gap,
    height: position.height * cellHeight + (position.height - 1) * gap,
  };
}
