"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  clearConverterViewState,
  isConverterFlowLocation,
} from "@/lib/monitor-odds/converter-view-state";

export function ConverterStateGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isConverterFlowLocation(pathname, window.location.search)) {
      clearConverterViewState();
    }
  }, [pathname]);

  return null;
}
