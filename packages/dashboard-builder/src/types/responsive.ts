export interface Breakpoint {
  name: string;
  minWidth: number;
  maxWidth?: number;
  columns: number;
}

export interface ResponsiveConfig {
  breakpoints: Breakpoint[];
  defaultColumns: number;
}
