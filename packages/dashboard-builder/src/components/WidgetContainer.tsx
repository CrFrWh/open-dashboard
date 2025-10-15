import { useMemo, type ReactNode, type CSSProperties } from "react";
import type { WidgetPosition } from "../types";
import { useWidgetSize } from "../hooks";

export interface WidgetContainerProps {
  /** Widget position and size (x, y are 1-based, width/height are in grid units) */
  position: WidgetPosition;
  /** Widget content to render (should adapt to container size) */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Custom styles */
  style?: CSSProperties;
}

export function WidgetContainer({
  position,
  children,
  className = "",
  style = {},
}: WidgetContainerProps) {
  // Validate minimum size (1x1)
  const validatedPosition: WidgetPosition = useMemo(
    () => ({
      x: Math.max(1, position.x),
      y: Math.max(1, position.y),
      width: Math.max(1, position.width),
      height: Math.max(1, position.height),
    }),
    [position]
  );

  // Calculate widget size class for responsive content
  const widgetSize = useWidgetSize(validatedPosition);

  // Grid positioning styles
  const gridStyle: CSSProperties = useMemo(
    () => ({
      gridColumn: `${validatedPosition.x} / span ${validatedPosition.width}`,
      gridRow: `${validatedPosition.y} / span ${validatedPosition.height}`,
      minWidth: 0, // Prevent grid blowout
      minHeight: 0,
      overflow: "hidden", // Contain content within widget bounds
      ...style,
    }),
    [validatedPosition, style]
  );

  return (
    <div
      className={`widget-container widget-size-${widgetSize} ${className}`}
      style={gridStyle}
      data-widget-x={validatedPosition.x}
      data-widget-y={validatedPosition.y}
      data-widget-width={validatedPosition.width}
      data-widget-height={validatedPosition.height}
      data-size-class={widgetSize}
    >
      <div className="widget-content" style={{ width: "100%", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}
