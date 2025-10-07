import type { WidgetPosition } from "./widget";

export interface WidgetLayout extends WidgetPosition {
  id: string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  static?: boolean;
  responsive?: {
    mobile?: Partial<WidgetPosition>;
    tablet?: Partial<WidgetPosition>;
    desktop?: Partial<WidgetPosition>;
  };
}
