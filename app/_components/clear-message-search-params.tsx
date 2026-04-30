"use client";

import { useEffect } from "react";

const DEFAULT_MESSAGE_PARAMS = ["error", "message"];

type ClearMessageSearchParamsProps = {
  params?: string[];
};

export function ClearMessageSearchParams({
  params = DEFAULT_MESSAGE_PARAMS,
}: ClearMessageSearchParamsProps) {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;

    params.forEach((param) => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    });

    if (!changed) {
      return;
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [params]);

  return null;
}
