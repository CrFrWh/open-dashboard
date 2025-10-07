export const DEFAULT_BREAKPOINTS = {
  mobile: { minWidth: 0, maxWidth: 767, columns: 2 },
  tablet: { minWidth: 768, maxWidth: 1023, columns: 6 },
  desktop: { minWidth: 1024, maxWidth: Infinity, columns: 12 },
} as const;
