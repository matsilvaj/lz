"use client";

import { useEffect, useState } from "react";

import { listPartnerOptionsAction } from "../parceiros/actions";
import type { PartnerOption } from "./partner-picker";

// Carrega os parceiros quando o modal abre (uma busca por abertura).
export function usePartnerOptions(active: boolean) {
  const [partners, setPartners] = useState<PartnerOption[]>([]);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    listPartnerOptionsAction()
      .then((options) => {
        if (!cancelled) {
          setPartners(options);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [active]);

  return partners;
}
