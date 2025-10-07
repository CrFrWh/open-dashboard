import type { GridConfig, WidgetLayout, WidgetPosition } from "../types";

export function hasCollision(a: WidgetPosition, b: WidgetPosition): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

export function validateLayout(
  widgets: WidgetLayout[],
  gridConfig: GridConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check bounds
  widgets.forEach((widget) => {
    if (widget.x < 0 || widget.y < 0) {
      errors.push(`Widget ${widget.id} has negative position`);
    }
    if (widget.x + widget.width > gridConfig.columns) {
      errors.push(`Widget ${widget.id} exceeds grid width`);
    }
  });

  // Check collisions
  for (let i = 0; i < widgets.length; i++) {
    for (let j = i + 1; j < widgets.length; j++) {
      if (hasCollision(widgets[i], widgets[j])) {
        errors.push(`Widgets ${widgets[i].id} and ${widgets[j].id} overlap`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
