import { useState, useEffect } from "react";
import { DEFAULT_BREAKPOINTS } from "../constants/breakpoints";

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState("desktop");
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      setWidth(newWidth);

      if (newWidth < DEFAULT_BREAKPOINTS.tablet.minWidth) {
        setBreakpoint("mobile");
      } else if (newWidth < DEFAULT_BREAKPOINTS.desktop.minWidth) {
        setBreakpoint("tablet");
      } else {
        setBreakpoint("desktop");
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return { breakpoint, width };
}
